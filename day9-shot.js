/* day9-shot.js —— Day 9 前端审查用截图（复用 Day 8 的 Electron 方案）
 *
 * 用法：electron day9-shot.js <输出文件名.png>
 *   例：electron day9-shot.js day9-before.png
 * 产出：<argv[2]>（本目录）+ day9-shot-log.txt（取证日志）
 *
 * 流程：loadURL(localhost:8000) → 清 localStorage → 重载触发 mock → 注入仿真地址栏
 *       → zoom 0.68 让列表入镜 → capturePage 截图。
 * 已踩坑：离屏(show:false)+禁 GPU 时 capturePage 返回旧帧，必须 show:true + 等 1500ms。
 */

'use strict';

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const LOG = path.join(__dirname, 'day9-shot-log.txt');
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
const OUT = path.join(__dirname, process.argv[2] || 'day9-shot.png');

app.whenReady().then(async () => {
  try {
    const win = new BrowserWindow({
      width: 820,
      height: 1500,
      show: true,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });

    // 清 HTTP 缓存：否则第二次 loadURL 会拿到上次缓存的旧 style.css（已实测踩坑）
    await win.webContents.session.clearCache();

    await win.loadURL(URL);
    await win.webContents.executeJavaScript(`localStorage.removeItem('todo-queue-v1')`);
    await win.loadURL(URL);
    await new Promise((r) => setTimeout(r, 2200));

    const focus = await win.webContents.executeJavaScript(
      `document.getElementById('focusText').textContent`
    );
    const count = await win.webContents.executeJavaScript(
      `document.querySelectorAll('.task').length`
    );
    log(`第一件事 = "${focus}" | 任务数 = ${count}`);

    await win.webContents.executeJavaScript(`
      (function () {
        if (!document.getElementById('fake-addr')) {
          const bar = document.createElement('div');
          bar.id = 'fake-addr';
          bar.style.cssText = 'position:fixed;top:0;left:0;right:0;height:40px;'
            + 'background:#dee1e6;border-bottom:1px solid #b9bcc0;'
            + 'display:flex;align-items:center;gap:10px;padding:0 16px;'
            + 'z-index:99999;font-family:system-ui,"Segoe UI",sans-serif;box-sizing:border-box;';
          bar.innerHTML =
            '<span style="font-size:15px;color:#5f6368;">&#128274;</span>' +
            '<span style="flex:1;background:#fff;border-radius:18px;padding:6px 16px;'
            + 'font-size:14px;color:#202124;border:1px solid #cfcfcf;">localhost:8000/index.html</span>';
          document.body.prepend(bar);
        }
        const appEl = document.querySelector('.app');
        if (appEl) appEl.style.zoom = '0.68';
        document.body.style.paddingTop = '42px';
      })();
    `);
    await new Promise((r) => setTimeout(r, 1500));
    log('已注入地址栏 + zoom 0.68');

    const img = await win.webContents.capturePage();
    if (img.isEmpty()) { log('[FAIL] 空图'); app.exit(1); return; }
    fs.writeFileSync(OUT, img.toPNG());
    const sz = img.getSize();
    log(`[OK] 截图完成：${OUT}  ${sz.width}x${sz.height}  ${fs.statSync(OUT).size} bytes`);
    app.exit(0);
  } catch (err) {
    log('[ERROR] ' + (err && err.stack ? err.stack : String(err)));
    app.exit(1);
  }
});

setTimeout(() => { log('[WARN] 超时退出'); app.exit(1); }, 40000);
