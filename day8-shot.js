/* day8-shot.js —— 用 Electron 给 Day 8 mock 主视图截图（带仿真地址栏）
 *
 * 本机 agent-browser 跑不了（Chrome 起不来），改用 Electron（memory 已实证可靠）。
 * 流程：loadURL(localhost:8000) → 清 localStorage → 重载触发 mock → 注入仿真地址栏 → 截图。
 * 产出：day8-mock-view.png（本目录）+ day8-shot-log.txt（取证日志）。
 */

'use strict';

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const LOG = path.join(__dirname, 'day8-shot-log.txt');
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(LOG, line + '\n'); } catch (_) {}
}

// 本机 GPU 进程起不来会直接 FATAL，必须先关（memory 已实证）
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('in-process-gpu');
app.commandLine.appendSwitch('no-sandbox');

const URL = 'http://localhost:8000/index.html';
const OUT = path.join(__dirname, 'day8-final.png');

app.whenReady().then(async () => {
  try {
    const win = new BrowserWindow({
      width: 820,
      height: 1500,
      show: true, // 真显示：离屏模式下 capturePage 会拿到旧帧（已实测踩坑）
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });

    // 1. 先加载一次（可能带着旧 localStorage 渲染）
    await win.loadURL(URL);
    log('首次加载完成');

    // 2. 清掉 localStorage，确保走 mock 首次加载分支
    await win.webContents.executeJavaScript(`localStorage.removeItem('todo-queue-v1')`);
    log('已清 localStorage');

    // 3. 重新加载：localStorage 为空 → 走 mock（加载中 → 4 条假任务）
    await win.loadURL(URL);
    await new Promise((r) => setTimeout(r, 2200)); // mock 600ms + 渲染 buffer
    log('重载完成，等待 mock 渲染');

    // 4. 验证 mock 数据确实渲染出来了
    const focus = await win.webContents.executeJavaScript(
      `document.getElementById('focusText').textContent`
    );
    const count = await win.webContents.executeJavaScript(
      `document.querySelectorAll('.task').length`
    );
    log(`第一件事 = "${focus}" | 任务数 = ${count}`);

    // 5. 注入仿真浏览器地址栏（Electron 窗口没有真地址栏，这里补一个），
    //    并把主内容整体缩放到 0.7，让 4 条任务都进视口（窗口实际可视高度约 940px）
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
        // 主内容缩放（地址栏在 body 层不受影响），列表就能完整入镜
        const appEl = document.querySelector('.app');
        if (appEl) appEl.style.zoom = '0.68';
        document.body.style.paddingTop = '42px';
      })();
    `);
    await new Promise((r) => setTimeout(r, 1500)); // 给合成器足够时间画出注入后的新帧
    log('已注入地址栏 + 内容缩放 0.7');

    // 5.5 验证列表底部确实在视口内
    const listBottom = await win.webContents.executeJavaScript(
      `Math.round(document.querySelector('.task-list').getBoundingClientRect().bottom)`
    );
    log(`列表底部 y = ${listBottom}（视口高约 940）`);

    // 6. 截图
    const img = await win.webContents.capturePage();
    if (img.isEmpty()) {
      log('[FAIL] 截到空图');
      app.exit(1);
      return;
    }
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
