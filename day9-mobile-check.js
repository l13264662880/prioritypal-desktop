/* day9-mobile-check.js —— Day 9 补漏：移动端横向溢出检测
 *
 * 用法：electron day9-mobile-check.js
 * 在多个窄视口宽度下加载页面，检测横向溢出元素并各截一张图。
 * 产出：day9-mobile-log.txt（检测报告）+ day9-mobile-<宽度>.png
 */

'use strict';

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const LOG = path.join(__dirname, 'day9-mobile-log.txt');
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(LOG, line + '\n'); } catch (_) {}
}

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('in-process-gpu');
app.commandLine.appendSwitch('no-sandbox');

const URL = 'http://localhost:8000/index.html';
const WIDTHS = [420, 375, 360, 320];

app.whenReady().then(async () => {
  try {
    const win = new BrowserWindow({
      width: 420,
      height: 900,
      show: true,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });

    await win.webContents.session.clearCache();
    await win.loadURL(URL);
    await win.webContents.executeJavaScript(`localStorage.removeItem('todo-queue-v1')`);
    await win.loadURL(URL);
    await new Promise((r) => setTimeout(r, 2200));

    for (const w of WIDTHS) {
      win.setSize(w, 900);
      await new Promise((r) => setTimeout(r, 1200));

      const report = await win.webContents.executeJavaScript(`
        (function () {
          const vw = window.innerWidth;
          const docW = document.documentElement.scrollWidth;
          const overflow = docW > vw;
          const offenders = [];
          document.querySelectorAll('body *').forEach((el) => {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && r.right > vw + 1) {
              offenders.push({
                tag: el.tagName.toLowerCase(),
                cls: (el.className && el.className.baseVal !== undefined)
                  ? el.className.baseVal : String(el.className),
                right: Math.round(r.right),
                w: Math.round(r.width),
              });
            }
          });
          const pomo = document.querySelector('.pomodoro');
          const pomoInfo = pomo
            ? { scrollW: pomo.scrollWidth, clientW: pomo.clientWidth, overflow: pomo.scrollWidth > pomo.clientWidth }
            : null;
          return JSON.stringify({ vw, docW, overflow, pomo: pomoInfo, offenders: offenders.slice(0, 15) });
        })();
      `);
      log(`宽度 ${w}px → ${report}`);

      const img = await win.webContents.capturePage();
      fs.writeFileSync(path.join(__dirname, `day9-mobile-${w}.png`), img.toPNG());
      log(`  截图 day9-mobile-${w}.png 完成`);
    }

    log('[OK] 移动端检测完成');
    app.exit(0);
  } catch (err) {
    log('[ERROR] ' + (err && err.stack ? err.stack : String(err)));
    app.exit(1);
  }
});

setTimeout(() => { log('[WARN] 超时退出'); app.exit(1); }, 60000);
