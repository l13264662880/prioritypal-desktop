/* tools/shot-panel.js —— 打开应用截一张面板全图（交付证据用） */
'use strict';
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');

const APP_DIR = path.join(__dirname, '..');
const OUT = process.argv[2] || path.join(os.tmpdir(), 'panel-shot.png');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const exe = path.join(APP_DIR, 'node_modules', 'electron', 'dist',
    process.platform === 'win32' ? 'electron.exe' : 'electron');
  const env = Object.assign({}, process.env, { PP_USER_DATA: path.join(os.tmpdir(), 'pp-shot-' + Date.now()) });
  delete env.ELECTRON_RUN_AS_NODE;

  const child = spawn(exe, ['.', '--pp-test'], { cwd: APP_DIR, env, stdio: 'ignore' });
  try {
    await sleep(7000);
    const getJson = (p) => new Promise((res, rej) => {
      const req = http.get({ host: '127.0.0.1', port: 9333, path: p, timeout: 8000 },
        (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => res(JSON.parse(d))); });
      req.on('error', rej); req.on('timeout', () => { req.destroy(); rej(new Error('timeout')); });
    });
    const list = await getJson('/json/list');
    const panel = list.find((t) => t.type === 'page' && /panel\.html/.test(t.url));
    if (!panel) throw new Error('未找到面板窗口');

    const WebSocket = require('ws');
    const ws = new WebSocket(panel.webSocketDebuggerUrl, { perMessageDeflate: false, maxPayload: 64 * 1024 * 1024 });
    let id = 0; const pend = new Map();
    const send = (m, p) => new Promise((rs) => { const i = ++id; pend.set(i, { rs }); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); });
    await new Promise((rs, rj) => { ws.on('open', rs); ws.on('error', rj); });
    ws.on('message', (raw) => {
      const m = JSON.parse(raw.toString());
      if (m.id && pend.has(m.id)) { const { rs } = pend.get(m.id); pend.delete(m.id); rs(m.result); }
    });
    await send('Runtime.enable');
    // 塞两条示例任务，让截图有内容（含新字段）
    await send('Runtime.evaluate', { expression: `(() => {
      const add = (t, n, e, p) => {
        document.getElementById('taskInput').value = t;
        document.getElementById('noteInput').value = n;
        document.getElementById('estimateInput').value = e;
        document.getElementById('prioritySelect').value = p;
        document.getElementById('addForm').dispatchEvent(new Event('submit', { cancelable: true }));
      };
      add('写完课程作业第三章', '先看例题再动笔', '45', '高');
      add('回复导师的邮件', '', '15', '中');
      add('整理书桌', '', '10', '低');
      document.querySelector('#taskList .js-timer').click();
      return true; })()`, awaitPromise: true });
    await sleep(1200);
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    fs.writeFileSync(OUT, Buffer.from(shot.data, 'base64'));
    console.log('已保存', OUT);
  } catch (e) {
    console.error('ERR:', e.message);
  } finally {
    try { child.kill(); } catch (e) {}
    await sleep(700);
    process.exit(0);
  }
})();
