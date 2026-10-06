/* verify-mood.js —— 验证情绪记录（心情打卡 + 联动提示 + 呼吸引导）
 *
 * 加载 my-site/index.html：读初始提示 → 点「低落」看关怀语 + 记录 →
 * 点「焦虑缓解」看呼吸区展开 + 呼吸文字循环 → 截图。
 * 产出：verify-mood-log.txt / verify-mood.png
 */

'use strict';

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const LOG_PATH = path.join(__dirname, 'verify-mood-log.txt');
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
    width: 800, height: 1300, show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });

  const target = 'C:\\Users\\L1326\\WorkBuddy\\2026-09-17-16-11-37\\my-site\\index.html';
  await win.loadFile(target);
  await sleep(2000);

  const hint = () => win.webContents.executeJavaScript(`document.getElementById('moodHint').textContent`);

  log('初始提示: ' + (await hint()));

  // 点「低落」
  await win.webContents.executeJavaScript(`
    (function () {
      document.querySelector('.mood-btn[data-mood="低落"]').click();
    })()
  `);
  await sleep(300);
  log('点「低落」后: ' + (await hint()));

  const moodData = await win.webContents.executeJavaScript(`localStorage.getItem('mood')`);
  log('mood 记录: ' + moodData);

  // 呼吸引导
  await win.webContents.executeJavaScript(`document.getElementById('breatheToggle').click()`);
  await sleep(300);
  const breatheHidden = await win.webContents.executeJavaScript(`document.getElementById('breathe').hidden`);
  const breatheText = await win.webContents.executeJavaScript(`document.getElementById('breatheText').textContent`);
  log(`呼吸区 hidden=${breatheHidden}, 文字=${breatheText}`);

  await sleep(4500); // 等一轮吸气结束，看是否切到屏息
  const breatheText2 = await win.webContents.executeJavaScript(`document.getElementById('breatheText').textContent`);
  log(`4.5 秒后呼吸文字: ${breatheText2}`);

  const img = await win.webContents.capturePage();
  fs.writeFileSync(path.join(__dirname, 'verify-mood.png'), img.toPNG());
  log('截图完成');

  log('=== 验证完成 ===');
  app.exit(0);
});

setTimeout(() => { log('[WARN] 超时退出'); app.exit(1); }, 30000);
