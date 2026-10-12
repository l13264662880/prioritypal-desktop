/* tools/verify-modules.js —— 新增两大模块的端到端验证
 * 运行：node tools/verify-modules.js
 * 做法：启动 Electron，在面板窗口里执行真实操作，再核对数据文件与界面状态。
 */
'use strict';
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const APP_DIR = path.join(__dirname, '..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findElectron() {
  // 直接用 electron.exe（.cmd 在 Windows 上 spawn 会 EINVAL）
  const exe = path.join(APP_DIR, 'node_modules', 'electron', 'dist',
    process.platform === 'win32' ? 'electron.exe' : 'electron');
  return fs.existsSync(exe) ? exe : null;
}

(async () => {
  const electron = findElectron();
  if (!electron) { console.error('未找到 electron，请先 npm install'); process.exit(1); }

  // 用独立的 userData 目录跑测试，不污染真实数据
  const tmpData = path.join(os.tmpdir(), 'pp-verify-' + Date.now());
  // 关键：剥掉 ELECTRON_RUN_AS_NODE（本机环境里有这个变量，
  // 会让 electron 以纯 Node 方式启动，app 等 API 全部为空）
  const env = Object.assign({}, process.env, { PP_USER_DATA: tmpData });
  delete env.ELECTRON_RUN_AS_NODE;

  const child = spawn(electron, ['.', '--pp-test'], {
    cwd: APP_DIR,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let out = '';
  child.stdout.on('data', (d) => { out += d.toString(); });
  child.stderr.on('data', (d) => { out += d.toString(); });

  const results = [];
  const check = (name, ok, detail) => { results.push([name, ok, detail]); };

  try {
    await sleep(6000); // 等窗口起来

    // 通过主进程把面板窗口暴露的验证钩子调起来需要 IPC；这里用 Electron 的
    // 远程调试端口更简单 —— 改用 CDP 连 panel 窗口
    const http = require('http');
    const getJson = (p) => new Promise((res, rej) => {
      const req = http.get({ host: '127.0.0.1', port: 9333, path: p, timeout: 8000 },
        (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); });
      req.on('error', rej); req.on('timeout', () => { req.destroy(); rej(new Error('timeout')); });
    });

    const list = await getJson('/json/list');
    const panel = list.find((t) => t.type === 'page' && /panel\.html/.test(t.url));
    if (!panel) throw new Error('未找到面板窗口（debug 端口 9333 未开？）');

    const WebSocket = require('ws');
    const ws = new WebSocket(panel.webSocketDebuggerUrl, { perMessageDeflate: false });
    let id = 0; const pend = new Map();
    const send = (m, p) => new Promise((rs, rj) => { const i = ++id; pend.set(i, { rs, rj }); ws.send(JSON.stringify({ id: i, method: m, params: p || {} })); });
    await new Promise((rs, rj) => { ws.on('open', rs); ws.on('error', rj); });
    ws.on('message', (raw) => {
      const m = JSON.parse(raw.toString());
      if (m.id && pend.has(m.id)) { const { rs } = pend.get(m.id); pend.delete(m.id); rs(m.result); }
    });
    const evalJs = async (expr) => {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
      return r && r.result ? r.result.value : undefined;
    };
    await send('Runtime.enable');

    // 1) 新增任务（带备注/预估/优先级）
    await evalJs(`(() => {
      document.getElementById('taskInput').value = '验证任务A';
      document.getElementById('noteInput').value = '这是备注';
      document.getElementById('estimateInput').value = '45';
      document.getElementById('prioritySelect').value = '高';
      document.getElementById('addForm').dispatchEvent(new Event('submit', { cancelable: true }));
      return true;
    })()`);
    await sleep(1200);
    const rowCount = await evalJs(`document.querySelectorAll('#taskList .task').length`);
    const hasMeta = await evalJs(`(document.querySelector('#taskList .task-meta')||{}).textContent || ''`);
    check('新增任务（含备注/预估/优先级）', rowCount === 1 && /高优先/.test(hasMeta) && /45 分钟/.test(hasMeta),
      `行数=${rowCount} meta="${hasMeta}"`);

    // 2) JSON 文件落盘
    await sleep(900);
    const dataFile = path.join(tmpData, 'prioritypal-data.json');
    let fileOk = false, fileDetail = '未生成';
    if (fs.existsSync(dataFile)) {
      const d = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
      fileOk = Array.isArray(d.tasks) && d.tasks.length === 1 && d.tasks[0].note === '这是备注' && d.tasks[0].priority === '高';
      fileDetail = JSON.stringify({ tasks: d.tasks.length, note: d.tasks[0] && d.tasks[0].note, priority: d.tasks[0] && d.tasks[0].priority });
    }
    check('任务写入本地 JSON', fileOk, fileDetail);

    // 3) 清空已完成
    await evalJs(`document.querySelector('#taskList .js-done').click(); true`);
    await sleep(600);
    await evalJs(`document.getElementById('clearDoneBtn').click(); true`);
    await sleep(600);
    const afterClear = await evalJs(`document.querySelectorAll('#taskList .task').length`);
    check('清空已完成', afterClear === 0, `剩余 ${afterClear} 行`);

    // 4) 番茄设置持久化
    await evalJs(`(() => {
      const f = document.getElementById('focusMinInput');
      f.value = '40'; f.dispatchEvent(new Event('change'));
      const r = document.getElementById('restMinInput');
      r.value = '8'; r.dispatchEvent(new Event('change'));
      const a = document.getElementById('autoLoopInput');
      a.checked = true; a.dispatchEvent(new Event('change'));
      return document.getElementById('pomoTime').textContent;
    })()`);
    await sleep(900);
    const pomoShown = await evalJs(`document.getElementById('pomoTime').textContent`);
    let cfgOk = false, cfgDetail = '';
    if (fs.existsSync(dataFile)) {
      const d = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
      cfgOk = d.pomodoro && d.pomodoro.focusMin === 40 && d.pomodoro.restMin === 8 && d.pomodoro.autoLoop === true;
      cfgDetail = JSON.stringify(d.pomodoro);
    }
    check('番茄设置写入 JSON', cfgOk, cfgDetail);
    check('番茄界面同步 40:00', pomoShown === '40:00', `显示 ${pomoShown}`);

    // 5) 单任务正计时（新增一条 → 选中 → 计时 3 秒）
    await evalJs(`(() => {
      document.getElementById('taskInput').value = '计时任务B';
      document.getElementById('addForm').dispatchEvent(new Event('submit', { cancelable: true }));
      return true;
    })()`);
    await sleep(800);
    await evalJs(`document.querySelector('#taskList .js-timer').click(); true`);
    await sleep(400);
    await evalJs(`document.getElementById('timerToggle').click(); true`);
    await sleep(3300);
    const clock = await evalJs(`document.getElementById('timerClock').textContent`);
    check('任务正计时走动', /^00:0[23]$/.test(clock), `计时显示 ${clock}`);
    await evalJs(`document.getElementById('timerToggle').click(); true`); // 停止
    await sleep(900);
    let spentOk = false, spentDetail = '';
    if (fs.existsSync(dataFile)) {
      const d = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
      const t = (d.tasks || []).find((x) => x.text === '计时任务B');
      spentOk = t && t.spent >= 2;
      spentDetail = t ? `spent=${t.spent}` : '未找到任务';
    }
    check('计时结果写入任务 spent', spentOk, spentDetail);

    // 6) 桌宠状态同步协议（不改渲染代码，只验通道）
    const pomState = await evalJs(`(document.getElementById('pomoToggle').click(), localStorage.getItem('pom-state'))`);
    check('pom-state 通道可写（桌宠联动）', ['focus', 'rest', 'idle'].includes(pomState), `pom-state=${pomState}`);
  } catch (err) {
    check('验证流程', false, err.message);
  } finally {
    try { child.kill(); } catch (e) {}
    await sleep(800);
    let fail = 0;
    for (const [name, ok, detail] of results) {
      console.log(`${ok ? '[PASS]' : '[FAIL]'} ${name} — ${detail}`);
      if (!ok) fail++;
    }
    console.log(fail === 0 ? '全部通过 ✓' : `${fail} 项失败`);
    process.exit(fail === 0 ? 0 : 1);
  }
})();
