/* day14-mobile-check.js —— Day 14 余力加练：手机宽度检测（三视图 × 四宽度）
 *
 * 用法：cd prioritypal-desktop && electron day14-mobile-check.js
 * 产出：day14-mobile-log.txt（检测报告）+ day14-mobile-<view>-<w>.png（12 张截图）
 *
 * 重点盯 Day 13 新增的 view-nav（三个标签）在窄屏下是否拆字/溢出，
 * 以及番茄、心情两个新视图在窄屏下是否横向溢出。
 * 已踩坑沿用：show:true + 等 1200ms + loadURL 前 clearCache。
 * Day 9 教训：窄屏「挤压拆字」不一定触发 scrollWidth 溢出，检测必须配截图肉眼看。
 */

'use strict';

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const LOG = path.join(__dirname, 'day14-mobile-log.txt');
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

const WIDTHS = [420, 375, 360, 320];
const VIEWS = ['todo', 'pomodoro', 'mood'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(async () => {
  try {
    const win = new BrowserWindow({
      width: 420,
      height: 900,
      show: true,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });

    await win.webContents.session.clearCache();
    await win.loadURL('http://localhost:8000/index.html#/todo');
    await win.webContents.executeJavaScript(`localStorage.removeItem('todo-queue-v1')`);
    await win.loadURL('http://localhost:8000/index.html#/todo');
    await sleep(2200);

    for (const view of VIEWS) {
      // 每个视图：先 loadURL 到对应 hash（清缓存避免拿旧 CSS）
      await win.webContents.session.clearCache();
      await win.loadURL(`http://localhost:8000/index.html#/${view}`);
      await sleep(1500);

      for (const w of WIDTHS) {
        win.setSize(w, 900);
        await sleep(1200);

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
                });
              }
            });
            // 导航栏 + 当前视图的自身溢出（拆字/挤压可能不出现在全局 scrollWidth）
            const nav = document.querySelector('.view-nav');
            const panel = document.querySelector('[data-view-panel]:not([hidden])');
            const navInfo = nav
              ? { scrollW: nav.scrollWidth, clientW: nav.clientWidth, overflow: nav.scrollWidth > nav.clientWidth }
              : null;
            const panelInfo = panel
              ? { scrollW: panel.scrollWidth, clientW: panel.clientWidth, overflow: panel.scrollWidth > panel.clientWidth }
              : null;
            return JSON.stringify({ vw, docW, overflow, nav: navInfo, panel: panelInfo, offenders: offenders.slice(0, 12) });
          })();
        `);
        log(`视图 ${view} @ ${w}px → ${report}`);

        const img = await win.webContents.capturePage();
        fs.writeFileSync(path.join(__dirname, `day14-mobile-${view}-${w}.png`), img.toPNG());
        log(`  截图 day14-mobile-${view}-${w}.png`);
      }
    }

    log('[OK] 移动端检测完成');
    app.exit(0);
  } catch (err) {
    log('[ERROR] ' + (err && err.stack ? err.stack : String(err)));
    app.exit(1);
  }
});

setTimeout(() => { log('[WARN] 超时退出'); app.exit(1); }, 120000);
