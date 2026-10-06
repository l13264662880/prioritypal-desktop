/* verify-pomodoro.js —— 验证番茄钟计时器（开始/暂停/重置 + 倒计时）
 *
 * 加载 my-site/index.html，读初始状态 → 点开始 → 等 2 秒看倒计时 →
 * 暂停看是否停住 → 重置看是否回到 25:00 → 截图。
 * 产出：verify-pomodoro-log.txt / verify-pomodoro.png
 */

'use strict';

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const LOG_PATH = path.join(__dirname, 'verify-pomodoro-log.txt');
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
    width: 800, height: 1100, show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });

  const target = 'C:\\Users\\L1326\\WorkBuddy\\2026-09-17-16-11-37\\my-site\\index.html';
  await win.loadFile(target);
  await sleep(2000);

  const readState = () => win.webContents.executeJavaScript(`
    JSON.stringify({
      time: document.getElementById('pomoTime').textContent,
      phase: document.getElementById('pomoPhase').textContent,
      toggle: document.getElementById('pomoToggle').textContent,
    })
  `);

  log('初始: ' + (await readState()));

  // 开始
  await win.webContents.executeJavaScript(`document.getElementById('pomoToggle').click()`);
  await sleep(2200);
  log('开始后 2.2 秒: ' + (await readState()));

  // 暂停
  await win.webContents.executeJavaScript(`document.getElementById('pomoToggle').click()`);
  const pausedTime = await readState();
  await sleep(2200);
  const pausedTime2 = await readState();
  log('暂停时: ' + pausedTime);
  log('暂停后 2.2 秒(应不变): ' + pausedTime2);

  // 重置
  await win.webContents.executeJavaScript(`document.getElementById('pomoReset').click()`);
  log('重置后: ' + (await readState()));

  const img = await win.webContents.capturePage();
  fs.writeFileSync(path.join(__dirname, 'verify-pomodoro.png'), img.toPNG());
  log('截图完成');

  log('=== 验证完成 ===');
  app.exit(0);
});

setTimeout(() => { log('[WARN] 超时退出'); app.exit(1); }, 30000);
