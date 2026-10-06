/* verify-parse.js —— 验证「AI 智能任务录入」在真实浏览器环境里的表现
 *
 * 加载 my-site/index.html（和用户双击打开的是同一个文件），
 * 模拟输入一句话 → 检查实时提示 → 提交 → 截图 + 读 localStorage。
 * 产出：verify-log.txt / verify-input.png / verify-added.png
 */

'use strict';

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const LOG_PATH = path.join(__dirname, 'verify-log.txt');
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(LOG_PATH, line + '\n'); } catch (_) {}
}

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('in-process-gpu');
app.commandLine.appendSwitch('no-sandbox');

app.whenReady().then(async () => {
  log('app ready');
  const win = new BrowserWindow({
    width: 800,
    height: 1100,
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });

  const target = 'C:\\Users\\L1326\\WorkBuddy\\2026-09-17-16-11-37\\my-site\\index.html';
  await win.loadFile(target);
  log('index.html 已加载');

  await new Promise((r) => setTimeout(r, 2600));

  // 1. parseTask 是否暴露到了页面全局
  const hasParse = await win.webContents.executeJavaScript('typeof parseTask');
  log('typeof parseTask = ' + hasParse);
  if (hasParse !== 'function') {
    log('[FAIL] parseTask 不可用，中断');
    app.exit(1);
    return;
  }

  // 2. 填入一句话（触发 input 事件 → 实时提示）
  const inputText = '周五前交数学论文初稿，大概需要3小时';
  await win.webContents.executeJavaScript(`
    (function () {
      const input = document.getElementById('taskInput');
      input.value = ${JSON.stringify(inputText)};
      input.dispatchEvent(new Event('input', { bubbles: true }));
    })();
  `);
  log('已填入: ' + inputText);

  await new Promise((r) => setTimeout(r, 500));

  // 3. 读实时提示
  const hint = await win.webContents.executeJavaScript(
    `document.getElementById('parseHint').textContent`
  );
  const hintHidden = await win.webContents.executeJavaScript(
    `document.getElementById('parseHint').hidden`
  );
  log(`parseHint(hidden=${hintHidden}) = ${hint}`);

  // 4. 截图：输入态（含实时提示）
  const img1 = await win.webContents.capturePage();
  fs.writeFileSync(path.join(__dirname, 'verify-input.png'), img1.toPNG());
  log('截图1（输入态）完成');

  // 5. 提交（触发 form 的 submit → addTask）
  await win.webContents.executeJavaScript(`
    (function () {
      document.getElementById('addForm')
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    })();
  `);
  log('已提交');

  await new Promise((r) => setTimeout(r, 600));

  // 6. 截图：添加后（任务行 + meta 标签）
  const img2 = await win.webContents.capturePage();
  fs.writeFileSync(path.join(__dirname, 'verify-added.png'), img2.toPNG());
  log('截图2（添加后）完成');

  // 7. 读 localStorage：验证 due / estimate 真的存了
  const data = await win.webContents.executeJavaScript(
    `JSON.stringify(JSON.parse(localStorage.getItem('todo-queue-v1') || '[]'))`
  );
  log('localStorage = ' + data);

  // 8. 读任务行的 meta 标签文字
  const metaText = await win.webContents.executeJavaScript(
    `(function () {
       const m = document.querySelector('.task-meta');
       return m ? m.textContent : '(无 meta)';
     })()`
  );
  log('任务行 meta = ' + metaText);

  log('=== 验证完成 ===');
  app.exit(0);
});

setTimeout(() => {
  log('[WARN] 超时退出');
  app.exit(1);
}, 30000);
