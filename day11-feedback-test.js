/* day11-feedback-test.js —— Day 11 连续操作测试 + 前后截图（复用 Day 9 的 Electron 方案）
 *
 * 用法：electron day11-feedback-test.js
 * 产出：day11-before.png / day11-after.png + day11-test-log.txt
 *
 * 测三件事（都在 localhost:8000 上）：
 *   1. 复制按钮：点 → 变「✓」→ 1.5s 还原
 *   2. 完成：点 → 底部 toast「已完成…」
 *   3. 排序：点 → 底部 toast「已排好 / 顺序没变」
 *   再连续快速点，验证不出错、提示不串。
 *
 * 已踩坑（沿用 Day 9 结论）：show:true + 注入后等 1500ms 才截图；loadURL 前 clearCache。
 */

'use strict';
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const LOG = path.join(__dirname, 'day11-test-log.txt');
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(LOG, line + '\n'); } catch (_) {}
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('in-process-gpu');
app.commandLine.appendSwitch('no-sandbox');

const URL = 'http://localhost:8000/index.html';

app.whenReady().then(async () => {
  try {
    const win = new BrowserWindow({
      width: 820, height: 1500, show: true,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });

    await win.webContents.session.clearCache();
    await win.loadURL(URL);
    await win.webContents.executeJavaScript(`localStorage.removeItem('todo-queue-v1')`);
    await win.loadURL(URL);
    await sleep(2200);

    // 注入仿真地址栏 + zoom 0.68，让列表 + 底部 toast 都入镜
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
    await sleep(1500);

    const count = await win.webContents.executeJavaScript(
      `document.querySelectorAll('.task').length`
    );
    log(`任务数 = ${count}`);

    // ---- 截图 before（点击前） ----
    const before = await win.webContents.capturePage();
    fs.writeFileSync(path.join(__dirname, 'day11-before.png'), before.toPNG());
    log(`[OK] before 截图完成  ${before.getSize().width}x${before.getSize().height}`);

    // ---- 测试 1：复制按钮（点 → ✓ → 还原） ----
    const copyBefore = await win.webContents.executeJavaScript(`
      (function () {
        const btn = document.querySelector('.task .js-copy');
        const t = btn.textContent;
        btn.click();
        return t;
      })();
    `);
    await sleep(150);
    const copyAfter = await win.webContents.executeJavaScript(
      `document.querySelector('.task .js-copy').textContent`
    );
    log(`复制：点击前="${copyBefore}" → 150ms 后="${copyAfter}"（预期 ✓）`);

    // ---- 截图 after（点击复制后、按钮反馈的瞬间） ----
    const after = await win.webContents.capturePage();
    fs.writeFileSync(path.join(__dirname, 'day11-after.png'), after.toPNG());
    log(`[OK] after 截图完成  ${after.getSize().width}x${after.getSize().height}`);

    await sleep(1700);
    const copyRestore = await win.webContents.executeJavaScript(
      `document.querySelector('.task .js-copy').textContent`
    );
    log(`复制：1.7s 后按钮=" ${copyRestore} "（预期还原为 ⧉）`);

    // ---- 连续操作：快速点所有复制按钮，验证不串 ----
    await win.webContents.executeJavaScript(
      `document.querySelectorAll('.task .js-copy').forEach((b) => b.click())`
    );
    await sleep(120);
    const multiOn = await win.webContents.executeJavaScript(
      `Array.from(document.querySelectorAll('.task .js-copy')).map((b) => b.textContent).join(',')`
    );
    log(`连续复制后各按钮 = [${multiOn}]（预期都是 ✓）`);
    await sleep(1700);
    const multiRestore = await win.webContents.executeJavaScript(
      `Array.from(document.querySelectorAll('.task .js-copy')).map((b) => b.textContent).join(',')`
    );
    log(`连续复制还原后 = [${multiRestore}]（预期都是 ⧉）`);

    // ---- 测试 2：完成 → toast ----
    await win.webContents.executeJavaScript(
      `document.querySelector('.task .js-done').click()`
    );
    await sleep(150);
    const doneToast = await win.webContents.executeJavaScript(`
      (function () {
        const t = document.getElementById('toast');
        return JSON.stringify({ hidden: t.hidden, text: t.textContent });
      })()
    `);
    log(`完成：toast = ${doneToast}`);

    // ---- 测试 3：排序 → toast ----
    await win.webContents.executeJavaScript(
      `document.getElementById('sortBtn').click()`
    );
    await sleep(150);
    const sortToast = await win.webContents.executeJavaScript(`
      (function () {
        const t = document.getElementById('toast');
        return JSON.stringify({ hidden: t.hidden, text: t.textContent });
      })()
    `);
    log(`排序：toast = ${sortToast}`);

    log('[OK] 连续操作测试全部跑完');
    app.exit(0);
  } catch (err) {
    log('[ERROR] ' + (err && err.stack ? err.stack : String(err)));
    app.exit(1);
  }
});

setTimeout(() => { log('[WARN] 超时退出'); app.exit(1); }, 60000);
