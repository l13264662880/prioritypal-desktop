/* day15-shot-frontend.js —— 前端公网页面截图（穿透默认域名风险提醒中间页）
 *
 * 关键：默认域名对「非 navigate」请求加 content-disposition:attachment（下载），
 * 对「navigate」请求返回「风险提醒」中间页。所以：
 *   1) 用 webRequest 注入 Sec-Fetch-Mode: navigate 头，拿到可渲染的中间页；
 *   2) 等倒计时后点「确定访问」(submitBtn) 重新跳转，进入真实页面；
 *   3) 截真正的 app 页面 + 仿真地址栏。
 */

'use strict';

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const OUT_DIR = 'E:/wordbuddy工作空间';
const URL = 'https://yuanjian-d5gdhcntg91022662-1500297151.tcloudbaseapp.com/';
const OUT = path.join(OUT_DIR, 'day15-frontend.png');

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('in-process-gpu');
app.commandLine.appendSwitch('no-sandbox');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 820,
    height: 1500,
    show: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  try {
    const ses = win.webContents.session;
    await ses.setProxy({ mode: 'direct' });
    ses.webRequest.onBeforeSendHeaders((details, cb) => {
      details.requestHeaders['Sec-Fetch-Mode'] = 'navigate';
      details.requestHeaders['Sec-Fetch-Dest'] = 'document';
      cb({ requestHeaders: details.requestHeaders });
    });

    // 1) 第一次加载 → 应命中「风险提醒」中间页
    await win.loadURL(URL);
    await sleep(3500); // 等倒计时结束

    // 2) 点「确定访问」重新跳转
    const clicked = await win.webContents.executeJavaScript(`
      (function () {
        var b = document.getElementById('submitBtn');
        if (b) { b.disabled = false; b.click(); return 'clicked'; }
        return 'no-btn';
      })();
    `);
    console.log('[中间页] submitBtn 处理结果: ' + clicked);

    // 3) 等真实页面 + mock 异步加载完成
    await sleep(4000);

    // 4) 注入地址栏 + 截图
    await injectAddrBar(win);
    await sleep(1500);
    const img = await win.webContents.capturePage();
    if (img.isEmpty()) { console.log('[FAIL] 空图'); return; }
    fs.writeFileSync(OUT, img.toPNG());
    const sz = img.getSize();
    console.log('[OK] day15-frontend -> ' + OUT + '  ' + sz.width + 'x' + sz.height + '  ' + fs.statSync(OUT).size + ' bytes');
  } catch (err) {
    console.log('[ERROR] ' + (err && err.stack ? err.stack : String(err)));
  } finally {
    win.destroy();
  }
  app.exit(0);
});

setTimeout(() => { console.log('[WARN] 超时退出'); app.exit(1); }, 60000);
