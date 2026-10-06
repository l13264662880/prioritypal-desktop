/* capture-plan.js —— 为计划书第 3 章生成「产品界面示意」截图
 *
 * 加载 my-site/index.html，清空数据 → 放 3 条干净示例任务 →
 * 输入框填一句话展示 AI 录入实时提示 → 点一个心情展示联动 →
 * 截一张完整界面图。
 * 产出：plan-ui-full.png
 */

'use strict';

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const LOG_PATH = path.join(__dirname, 'capture-plan-log.txt');
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
    width: 820,
    height: 1060,
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });

  const target = 'C:\\Users\\L1326\\WorkBuddy\\2026-09-17-16-11-37\\my-site\\index.html';
  await win.loadFile(target);
  await sleep(1800);

  // 清空数据 + 放 3 条示例任务
  await win.webContents.executeJavaScript(`
    (function () {
      localStorage.removeItem('todo-queue-v1');
      localStorage.removeItem('mood');
      const form = document.getElementById('addForm');
      const input = document.getElementById('taskInput');
      const add = (t) => { input.value = t; form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); };
      add('交数学论文初稿，周五前');   // 截止今天(周五)
      add('复习英语，明天');            // 截止明天
      add('整理课堂笔记');              // 无截止
    })()
  `);
  await sleep(600);

  // 点「按截止时间排序」，展示预排序
  await win.webContents.executeJavaScript(`document.getElementById('sortBtn').click()`);
  await sleep(400);

  // 输入一句话，展示 AI 录入实时提示
  await win.webContents.executeJavaScript(`
    (function () {
      const input = document.getElementById('taskInput');
      input.value = '下周三之前交课程设计，约5小时';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    })()
  `);
  await sleep(400);

  // 点「平静」心情，展示联动
  await win.webContents.executeJavaScript(`
    (function () {
      document.querySelector('.mood-btn[data-mood="平静"]').click();
    })()
  `);
  await sleep(400);

  const img = await win.webContents.capturePage();
  fs.writeFileSync(path.join(__dirname, 'plan-ui-full.png'), img.toPNG());
  log('截图完成: plan-ui-full.png');

  log('=== 完成 ===');
  app.exit(0);
});

setTimeout(() => { log('[WARN] 超时退出'); app.exit(1); }, 30000);
