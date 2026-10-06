/* capture-task.js —— 为图 3-2 截「任务队列特写」
 *
 * 只聚焦核心的「强制排序」：滚动到任务列表，展示几条带截止标签的任务
 * 和第一件事高亮。不含番茄钟/情绪记录，跟图 3-3 的「完整全览」区分开。
 * 产出：plan-task.png
 */

'use strict';

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const LOG_PATH = path.join(__dirname, 'capture-task-log.txt');
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(async () => {
  log('app ready');
  const win = new BrowserWindow({
    width: 720,
    height: 640,
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });

  const target = 'C:\\Users\\L1326\\WorkBuddy\\2026-09-17-16-11-37\\my-site\\index.html';
  await win.loadFile(target);
  await sleep(1800);

  // 清空数据 + 重置主题，reload
  await win.webContents.executeJavaScript(`
    localStorage.removeItem('todo-queue-v1');
    localStorage.removeItem('sprite-theme');
    localStorage.removeItem('mood');
  `);
  await win.webContents.reload();
  await sleep(2200);

  // 加 5 条任务（含截止时间，展示队列 + 截止标签）
  await win.webContents.executeJavaScript(`
    (function () {
      const form = document.getElementById('addForm');
      const input = document.getElementById('taskInput');
      const add = (t) => { input.value = t; form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); };
      add('交数学论文初稿，周五前');
      add('复习英语，明天');
      add('下周三之前交课程设计，约5小时');
      add('12月31日前交报告');
      add('整理课堂笔记');
    })()
  `);
  await sleep(600);

  // 点排序，让任务按截止时间排好
  await win.webContents.executeJavaScript(`document.getElementById('sortBtn').click()`);
  await sleep(500);

  // 滚动到任务列表（聚焦任务队列，不截番茄钟/情绪记录）
  await win.webContents.executeJavaScript(`
    document.getElementById('taskList').scrollIntoView({ block: 'start' });
  `);
  await sleep(500);

  const img = await win.webContents.capturePage();
  fs.writeFileSync(path.join(__dirname, 'plan-task.png'), img.toPNG());
  log('截图完成: plan-task.png');

  log('=== 完成 ===');
  app.exit(0);
});

setTimeout(() => { log('[WARN] 超时退出'); app.exit(1); }, 30000);
