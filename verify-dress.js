/* verify-dress.js —— 验证换装功能：默认主题 → 点换装按钮 → 看主题切换
 *
 * 加载 sprite.html，截默认（奶黄包），点换装按钮依次截蜜桃/薄荷/天空/薰衣草。
 * 产出：verify-dress-log.txt / dress-0.png ~ dress-4.png
 */

'use strict';

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const LOG_PATH = path.join(__dirname, 'verify-dress-log.txt');
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
    width: 220, height: 240, show: false,
    transparent: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });

  await win.loadFile(path.join(__dirname, 'src', 'sprite.html'));
  await sleep(2200);

  // 清空主题（从默认奶黄包开始）
  await win.webContents.executeJavaScript(`localStorage.removeItem('sprite-theme')`);
  await win.webContents.reload();
  await sleep(2200);

  const NAMES = ['奶黄包', '蜜桃', '薄荷', '天空', '薰衣草'];
  for (let i = 0; i < 5; i++) {
    const img = await win.webContents.capturePage();
    fs.writeFileSync(path.join(__dirname, `dress-${i}.png`), img.toPNG());
    const themeName = await win.webContents.executeJavaScript(
      `THEMES[${i}].name`
    ).catch(() => '?');
    log(`第 ${i} 张（${NAMES[i]} / 读取名=${themeName}）`);
    // 点换装按钮切到下一个
    await win.webContents.executeJavaScript(`document.getElementById('dressBtn').click()`);
    await sleep(400);
  }

  log('=== 完成 ===');
  app.exit(0);
});

setTimeout(() => { log('[WARN] 超时退出'); app.exit(1); }, 30000);
