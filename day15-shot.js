/* day15-shot.js —— Day 15 公网地址截图（稳健版）
 *
 * 每场景独立 BrowserWindow + 直连代理 + ERR_ABORTED 重试，避免导航竞态。
 * 产出：day15-api-health.png / day15-frontend.png 到 E:/wordbuddy工作空间/
 */

'use strict';

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const OUT_DIR = 'E:/wordbuddy工作空间';

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('in-process-gpu');
app.commandLine.appendSwitch('no-sandbox');

const SCENES = [
  { name: 'day15-api-health', url: 'https://yuanjian-d5gdhcntg91022662.service.tcloudbase.com/api/health', zoom: false },
  { name: 'day15-frontend',   url: 'https://yuanjian-d5gdhcntg91022662-1500297151.tcloudbaseapp.com/', zoom: true },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function injectAddrBar(win, zoom) {
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
      ${zoom ? "var appEl = document.querySelector('.app'); if (appEl) appEl.style.zoom = '0.68';" : ''}
      document.body.style.paddingTop = '46px';
    })();
  `);
}

async function shootOne(scene) {
  const { name, url, zoom } = scene;
  const win = new BrowserWindow({
    width: 820,
    height: 1500,
    show: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  try {
    await win.webContents.session.setProxy({ mode: 'direct' });
    let ok = false;
    for (let i = 0; i < 3 && !ok; i++) {
      try { await win.loadURL(url); ok = true; }
      catch (e) { console.log('[retry ' + (i + 1) + '] ' + name + ' ' + (e && e.message ? e.message : String(e))); await sleep(1200); }
    }
    if (!ok) { console.log('[FAIL] ' + name + ' 无法加载'); return false; }
    await sleep(2500);
    await injectAddrBar(win, zoom);
    await sleep(1200);
    const img = await win.webContents.capturePage();
    if (img.isEmpty()) { console.log('[FAIL] ' + name + ' 空图'); return false; }
    const out = path.join(OUT_DIR, name + '.png');
    fs.writeFileSync(out, img.toPNG());
    const sz = img.getSize();
    console.log('[OK] ' + name + ' -> ' + out + '  ' + sz.width + 'x' + sz.height + '  ' + fs.statSync(out).size + ' bytes');
    return true;
  } catch (err) {
    console.log('[ERROR] ' + name + ' ' + (err && err.message ? err.message : String(err)));
    return false;
  } finally {
    win.destroy();
  }
}

app.whenReady().then(async () => {
  for (const scene of SCENES) { await shootOne(scene); }
  console.log('全部截图流程结束');
  app.exit(0);
});

setTimeout(() => { console.log('[WARN] 超时退出'); app.exit(1); }, 90000);
