/* render-logo.js —— 把 logo.svg 渲染成高清图片，并存到桌面
 *
 * 产出：
 *   - 项目目录：logo.png（透明 1800×600）、logo-white.jpg（白底 1800×600）
 *   - 桌面：智伴PriorityPal_Logo.png（透明）、智伴PriorityPal_Logo白底.jpg
 *
 * 思路：SVG → data URL → <img> → 画到 3 倍 canvas。透明版直接画；
 * 白底版先 fillRect 白色再画，导出 jpeg。canvas 天然保留 alpha，比 capturePage 稳。
 */
'use strict';

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const LOG_PATH = path.join(__dirname, 'render-logo-log.txt');
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

function writeB64(filePath, dataUrl) {
  const b64 = dataUrl.replace(/^data:image\/(png|jpeg);base64,/, '');
  fs.writeFileSync(filePath, Buffer.from(b64, 'base64'));
  log('写出: ' + filePath + ' (' + fs.statSync(filePath).size + ' bytes)');
}

app.whenReady().then(async () => {
  log('app ready');

  const svgText = fs.readFileSync(path.join(__dirname, 'logo.svg'), 'utf8');
  const dataUrl = 'data:image/svg+xml;base64,' + Buffer.from(svgText, 'utf8').toString('base64');

  const win = new BrowserWindow({
    width: 640, height: 240, show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  await win.loadURL('data:text/html,<html><body style="margin:0"></body></html>');
  await sleep(300);

  const out = await win.webContents.executeJavaScript(`
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const scale = 3, w = 600, h = 200;
          // 透明 PNG
          const c1 = document.createElement('canvas');
          c1.width = w * scale; c1.height = h * scale;
          const x1 = c1.getContext('2d');
          x1.drawImage(img, 0, 0, c1.width, c1.height);
          // 白底 JPG
          const c2 = document.createElement('canvas');
          c2.width = w * scale; c2.height = h * scale;
          const x2 = c2.getContext('2d');
          x2.fillStyle = '#ffffff';
          x2.fillRect(0, 0, c2.width, c2.height);
          x2.drawImage(img, 0, 0, c2.width, c2.height);
          resolve({ png: c1.toDataURL('image/png'), jpg: c2.toDataURL('image/jpeg', 0.95) });
        } catch (e) { reject(e.message); }
      };
      img.onerror = () => reject('img load error');
      img.src = ${JSON.stringify(dataUrl)};
    })
  `);

  // 项目目录留存
  writeB64(path.join(__dirname, 'logo.png'), out.png);
  writeB64(path.join(__dirname, 'logo-white.jpg'), out.jpg);

  // 桌面交付（中文文件名）
  const desktop = path.join('C:\\Users\\L1326', 'Desktop');
  try { fs.mkdirSync(desktop, { recursive: true }); } catch (_) {}
  writeB64(path.join(desktop, '智伴PriorityPal_Logo.png'), out.png);
  writeB64(path.join(desktop, '智伴PriorityPal_Logo白底.jpg'), out.jpg);

  log('=== 完成 ===');
  app.exit(0);
});

setTimeout(() => { log('[WARN] 超时退出'); app.exit(1); }, 30000);
