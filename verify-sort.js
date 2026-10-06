/* verify-sort.js —— 验证「智能优先级排序（预排序）」逻辑
 *
 * 加载 my-site/index.html，清空数据后添加几条带不同截止时间的任务，
 * 点「按截止时间排序」，读排序后的顺序，验证按截止时间从近到远。
 * 产出：verify-sort-log.txt / verify-sort.png
 */

'use strict';

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const LOG_PATH = path.join(__dirname, 'verify-sort-log.txt');
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
    width: 800, height: 1100, show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });

  const target = 'C:\\Users\\L1326\\WorkBuddy\\2026-09-17-16-11-37\\my-site\\index.html';
  await win.loadFile(target);
  await new Promise((r) => setTimeout(r, 2000));

  // 清空数据，重新加载
  await win.webContents.executeJavaScript(`localStorage.removeItem('todo-queue-v1')`);
  await win.webContents.reload();
  await new Promise((r) => setTimeout(r, 2000));

  // 添加 4 条任务（不同截止时间）
  const addSeq = await win.webContents.executeJavaScript(`
    (function () {
      const form = document.getElementById('addForm');
      const input = document.getElementById('taskInput');
      const add = (t) => { input.value = t; form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); };
      add('12月31日前交报告');   // due 12-31
      add('背单词');              // 无 due
      add('明天复习英语');        // due 明天
      add('周五前交数学论文初稿'); // due 今天(周五)
      return true;
    })()
  `);
  log('已添加 4 条任务');

  // 读排序前顺序
  const before = await win.webContents.executeJavaScript(`
    JSON.stringify(Array.from(document.querySelectorAll('.task-text')).map(n => n.childNodes[0].textContent))
  `);
  log('排序前: ' + before);

  // 点排序按钮
  await win.webContents.executeJavaScript(`document.getElementById('sortBtn').click()`);
  await new Promise((r) => setTimeout(r, 500));

  // 读排序后顺序
  const after = await win.webContents.executeJavaScript(`
    JSON.stringify(Array.from(document.querySelectorAll('.task-text')).map(n => n.childNodes[0].textContent))
  `);
  log('排序后: ' + after);

  // 读排序后 localStorage 顺序 + due
  const data = await win.webContents.executeJavaScript(`
    JSON.stringify(JSON.parse(localStorage.getItem('todo-queue-v1') || '[]').map(t => ({ text: t.text, due: t.due })))
  `);
  log('排序后数据: ' + data);

  const img = await win.webContents.capturePage();
  fs.writeFileSync(path.join(__dirname, 'verify-sort.png'), img.toPNG());
  log('截图完成');

  log('=== 验证完成 ===');
  app.exit(0);
});

setTimeout(() => { log('[WARN] 超时退出'); app.exit(1); }, 30000);
