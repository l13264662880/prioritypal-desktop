/* verify-desktop.js —— 验证「AI 智能任务录入」在桌面版面板里生效
 *
 * 加载 prioritypal-desktop/src/panel.html（桌面版任务面板本体），
 * 模拟输入一句话 → 检查实时提示 → 提交 → 截图 + 读 localStorage。
 * 产出：verify-desktop-log.txt / verify-desktop-input.png / verify-desktop-added.png
 */

'use strict';

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const LOG_PATH = path.join(__dirname, 'verify-desktop-log.txt');
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

  const target = path.join(__dirname, 'src', 'panel.html');
  await win.loadFile(target);
  log('panel.html 已加载');

  await new Promise((r) => setTimeout(r, 2600));

  const hasParse = await win.webContents.executeJavaScript('typeof parseTask');
  log('typeof parseTask = ' + hasParse);

  const inputText = '下周三之前交课程设计，约5小时';
  await win.webContents.executeJavaScript(`
    (function () {
      const input = document.getElementById('taskInput');
      input.value = ${JSON.stringify(inputText)};
      input.dispatchEvent(new Event('input', { bubbles: true }));
    })();
  `);
  log('已填入: ' + inputText);

  await new Promise((r) => setTimeout(r, 500));

  const hint = await win.webContents.executeJavaScript(
    `document.getElementById('parseHint').textContent`
  );
  log('parseHint = ' + hint);

  const img1 = await win.webContents.capturePage();
  fs.writeFileSync(path.join(__dirname, 'verify-desktop-input.png'), img1.toPNG());
  log('截图1（输入态）完成');

  await win.webContents.executeJavaScript(`
    (function () {
      document.getElementById('addForm')
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    })();
  `);
  log('已提交');

  await new Promise((r) => setTimeout(r, 600));

  const img2 = await win.webContents.capturePage();
  fs.writeFileSync(path.join(__dirname, 'verify-desktop-added.png'), img2.toPNG());
  log('截图2（添加后）完成');

  const data = await win.webContents.executeJavaScript(
    `JSON.stringify(JSON.parse(localStorage.getItem('todo-queue-v1') || '[]'))`
  );
  log('localStorage = ' + data);

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
