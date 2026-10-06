/* day13-shot.js —— Day 13 视图切换 + 四状态核对截图
 *
 * 用法：cd prioritypal-desktop && electron day13-shot.js
 * 产出：6 张原始 PNG 到工作区根目录（E:/wordbuddy工作空间/）
 *   view-todo / view-pomodoro / view-mood  （三视图切换）
 *   state-empty / state-error / state-loading（四状态里的三种，正常态复用 view-todo）
 *
 * 每张顶部注入「仿真地址栏」，显示真实 location（含 #/hash 与 ?scenario= 参数），
 * 满足今日清单「图里要有地址栏」的要求。
 * 已踩坑沿用：show:true + 等 1500ms + 每次 loadURL 前 clearCache（防拿旧 CSS 帧）。
 */

'use strict';

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const OUT_DIR = 'E:/wordbuddy工作空间';
const LOG = path.join(__dirname, 'day13-shot-log.txt');
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

// 六个场景：三视图（正常数据）+ 三状态（空/错/加载）。正常态 = view-todo。
const SCENES = [
  { name: 'view-todo',     url: 'http://127.0.0.1:8000/index.html#/todo' },
  { name: 'view-pomodoro', url: 'http://127.0.0.1:8000/index.html#/pomodoro' },
  { name: 'view-mood',     url: 'http://127.0.0.1:8000/index.html#/mood' },
  { name: 'state-empty',   url: 'http://127.0.0.1:8000/index.html?scenario=empty#/todo' },
  { name: 'state-error',   url: 'http://127.0.0.1:8000/index.html?scenario=error#/todo' },
  { name: 'state-loading', url: 'http://127.0.0.1:8000/index.html?scenario=loading#/todo' },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 注入仿真地址栏：显示精简的真实 URL（host + path + search + hash），并给 .app 缩放
async function injectAddrBar(win) {
  await win.webContents.executeJavaScript(`
    (function () {
      var bar = document.getElementById('fake-addr');
      if (!bar) {
        bar = document.createElement('div');
        bar.id = 'fake-addr';
        bar.style.cssText = 'position:fixed;top:0;left:0;right:0;height:44px;'
          + 'background:#dee1e6;border-bottom:1px solid #b9bcc0;'
          + 'display:flex;align-items:center;gap:10px;padding:0 16px;'
          + 'z-index:99999;font-family:system-ui,"Segoe UI",sans-serif;box-sizing:border-box;';
        bar.innerHTML =
          '<span style="font-size:15px;color:#5f6368;">&#128274;</span>' +
          '<span id="fake-addr-text" style="flex:1;background:#fff;border-radius:18px;padding:6px 16px;'
          + 'font-size:14px;color:#202124;border:1px solid #cfcfcf;"></span>';
        document.body.prepend(bar);
      }
      var addr = location.host + location.pathname + location.search + location.hash;
      document.getElementById('fake-addr-text').textContent = addr;
      var appEl = document.querySelector('.app');
      if (appEl) appEl.style.zoom = '0.68';
      document.body.style.paddingTop = '46px';
    })();
  `);
}

async function shootOne(win, scene) {
  const { name, url } = scene;
  // 1) 清 HTTP 缓存，防拿旧 CSS 帧
  await win.webContents.session.clearCache();
  // 2) 首次加载，清掉 localStorage 里的旧任务，确保走 mock 数据源（四状态才能被触发）
  await win.loadURL(url);
  await win.webContents.executeJavaScript(`localStorage.removeItem('todo-queue-v1')`);
  // 3) 重新加载（localStorage 已空），触发 mock 异步加载
  await win.loadURL(url);
  // 4) 等异步 mock 完成（FAKE_DELAY 600ms）+ 稳定；loading 场景永不完成，也停在这里
  await sleep(2200);
  // 5) 注入仿真地址栏 + zoom
  await injectAddrBar(win);
  await sleep(1500);
  // 6) 截图
  const img = await win.webContents.capturePage();
  if (img.isEmpty()) { log(`[FAIL] ${name} 空图`); return false; }
  const out = path.join(OUT_DIR, `day13-${name}.png`);
  fs.writeFileSync(out, img.toPNG());
  const sz = img.getSize();
  log(`[OK] ${name} -> ${out}  ${sz.width}x${sz.height}  ${fs.statSync(out).size} bytes`);
  return true;
}

app.whenReady().then(async () => {
  try {
    const win = new BrowserWindow({
      width: 820,
      height: 1500,
      show: true,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });

    for (const scene of SCENES) {
      await shootOne(win, scene);
    }

    log('全部 6 张截图完成');
    app.exit(0);
  } catch (err) {
    log('[ERROR] ' + (err && err.stack ? err.stack : String(err)));
    app.exit(1);
  }
});

setTimeout(() => { log('[WARN] 超时退出'); app.exit(1); }, 90000);
