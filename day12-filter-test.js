/* day12-filter-test.js —— Day 12 筛选三种情况测试 + 截图（复用 Day 9/11 的 Electron 方案）
 *
 * 用法：electron day12-filter-test.js
 * 产出：day12-filter.png + day12-filter-log.txt
 *
 * 测三种情况（SKILL.md 的验收口径）：
 *   有结果（点「进行中」）→ 列表只剩未完成，count 提示「共 4 · 匹配 3」
 *   无结果（搜索不存在的词）→ 列表 0 条，空提示出现
 *   清空恢复（清空搜索 + 点「全部」）→ 完整列表回来
 */

'use strict';
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const LOG = path.join(__dirname, 'day12-filter-log.txt');
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
    const exec = (code) => win.webContents.executeJavaScript(code);

    await win.webContents.session.clearCache();
    await win.loadURL(URL);
    await exec(`localStorage.removeItem('todo-queue-v1')`);
    await win.loadURL(URL);
    await sleep(2200);

    // 注入仿真地址栏 + zoom
    await exec(`
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

    const countAll = await exec(`document.querySelectorAll('.task').length`);
    log(`初始全部任务 = ${countAll} 条`);

    // ---- 情况 1：有结果（点「进行中」） ----
    await exec(`document.querySelector('.filter-tab[data-filter="open"]').click()`);
    await sleep(200);
    const openCount = await exec(`document.querySelectorAll('.task').length`);
    const openMeta = await exec(
      `document.getElementById('filterCount').textContent + ' | hidden=' + document.getElementById('filterCount').hidden`
    );
    const openTab = await exec(
      `document.querySelector('.filter-tab.is-active').textContent`
    );
    log(`有结果：点「${openTab}」后列表=${openCount} 条，count="${openMeta}"`);

    // ---- 情况 2：无结果（搜索不存在的词） ----
    await exec(`(function(){const s=document.getElementById('filterSearch');s.value='不存在的任务xyz';s.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await sleep(200);
    const noneCount = await exec(`document.querySelectorAll('.task').length`);
    const noneEmpty = await exec(
      `(function(){const e=document.getElementById('emptyHint');return JSON.stringify({hidden:e.hidden,text:e.textContent});})()`
    );
    log(`无结果：搜索不存在词后列表=${noneCount} 条，emptyHint=${noneEmpty}`);

    // ---- 情况 3：清空恢复 ----
    await exec(`(function(){const s=document.getElementById('filterSearch');s.value='';s.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await exec(`document.querySelector('.filter-tab[data-filter="all"]').click()`);
    await sleep(200);
    const restoreCount = await exec(`document.querySelectorAll('.task').length`);
    const restoreHidden = await exec(`document.getElementById('filterCount').hidden`);
    log(`清空恢复：清空搜索+点「全部」后列表=${restoreCount} 条，count隐藏=${restoreHidden}`);

    // ---- 截图：筛选状态（进行中 + 搜索「高数」） ----
    await exec(`document.querySelector('.filter-tab[data-filter="open"]').click()`);
    await exec(`(function(){const s=document.getElementById('filterSearch');s.value='高数';s.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await sleep(300);
    const shotCount = await exec(`document.querySelectorAll('.task').length`);
    const shotMeta = await exec(`document.getElementById('filterCount').textContent`);
    log(`截图状态：进行中 + 搜索「高数」，列表=${shotCount} 条，count="${shotMeta}"`);
    await sleep(1500);
    const img = await win.webContents.capturePage();
    fs.writeFileSync(path.join(__dirname, 'day12-filter.png'), img.toPNG());
    log(`[OK] 截图 day12-filter.png  ${img.getSize().width}x${img.getSize().height}`);

    log('[OK] 三种情况测试完成');
    app.exit(0);
  } catch (err) {
    log('[ERROR] ' + (err && err.stack ? err.stack : String(err)));
    app.exit(1);
  }
});

setTimeout(() => { log('[WARN] 超时退出'); app.exit(1); }, 60000);
