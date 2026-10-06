/* verify-sync.js —— 验证「套装同步」：精灵换装 → 面板跟着换色
 *
 * 开两个同源窗口（精灵 + 面板），在精灵窗口里改主题，
 * 读面板窗口的背景色，确认 storage 事件跨窗口触发了。
 * 产出：verify-sync-log.txt
 */

'use strict';

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const LOG_PATH = path.join(__dirname, 'verify-sync-log.txt');
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
  const panel = new BrowserWindow({ width: 700, height: 900, show: false });
  const sprite = new BrowserWindow({ width: 220, height: 240, show: false, transparent: true });

  await panel.loadFile(path.join(__dirname, 'src', 'panel.html'));
  await sprite.loadFile(path.join(__dirname, 'src', 'sprite.html'));
  await sleep(2500);

  // 清空主题，都回到默认（奶黄包）
  await panel.webContents.executeJavaScript(`localStorage.removeItem('sprite-theme')`);
  await sprite.webContents.reload();
  await panel.webContents.reload();
  await sleep(2500);

  const bg0 = await panel.webContents.executeJavaScript(
    `getComputedStyle(document.body).backgroundColor`
  );
  log('初始面板背景色(奶黄包): ' + bg0);

  // 在精灵窗口里切主题（模拟点换装按钮到「薄荷」idx=2）
  await sprite.webContents.executeJavaScript(`localStorage.setItem('sprite-theme', '2')`);
  await sleep(800);

  const bg1 = await panel.webContents.executeJavaScript(
    `getComputedStyle(document.body).backgroundColor`
  );
  log('精灵切到薄荷后，面板背景色: ' + bg1);

  // 再切到薰衣草 idx=4
  await sprite.webContents.executeJavaScript(`localStorage.setItem('sprite-theme', '4')`);
  await sleep(800);
  const bg2 = await panel.webContents.executeJavaScript(
    `getComputedStyle(document.body).backgroundColor`
  );
  log('精灵切到薰衣草后，面板背景色: ' + bg2);

  const synced = bg1 !== bg0 && bg2 !== bg1;
  log(synced ? '✅ 套装同步生效' : '❌ 面板没跟着变');

  log('=== 完成 ===');
  app.exit(0);
});

setTimeout(() => { log('[WARN] 超时退出'); app.exit(1); }, 30000);
