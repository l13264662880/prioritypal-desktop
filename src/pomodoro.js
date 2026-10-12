/* pomodoro.js —— 番茄专注计时器
 *
 * 专注 / 休息时长可自定义（默认 25 / 5），支持自动循环。
 * 用「时间戳」计时而不是「每秒递减」：即使页面在后台被节流，
 * 回到前台剩余时间依然准确。
 * 每完成一个「专注」阶段，把当天计数 +1（存 localStorage，供专注周报用）。
 *
 * 桌宠联动协议（与 sprite.html 的既有实现对齐，不改渲染代码）：
 *   localStorage['pom-state'] = 'idle' | 'focus' | 'rest'
 *   idle → 桌宠正常闲逛；focus → 停止闲逛播专注动画；rest → 恢复休闲动画
 *   桌宠在 focus / rest 切换时会自动弹气泡（「专注模式，喵~」「休息一下~」）
 */
(() => {
  'use strict';

  const COUNT_KEY = 'pomodoro-count';

  const el = {
    time: document.getElementById('pomoTime'),
    phase: document.getElementById('pomoPhase'),
    toggle: document.getElementById('pomoToggle'),
    reset: document.getElementById('pomoReset'),
    focusMin: document.getElementById('focusMinInput'),
    restMin: document.getElementById('restMinInput'),
    autoLoop: document.getElementById('autoLoopInput'),
  };

  const cfg = () => window.PPStore.state.pomodoro;   // 配置真相源（随 JSON 持久化）
  const focusSec = () => Math.max(1, cfg().focusMin) * 60;
  const breakSec = () => Math.max(1, cfg().restMin) * 60;

  let phase = 'focus';        // focus | break
  let running = false;
  let fresh = true;           // 当前阶段还没开始过（控制「开始 / 继续」文案）
  let remaining = focusSec();
  let endAt = null;
  let timer = null;

  const fmt = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  function render() {
    el.time.textContent = fmt(remaining);
    let phaseText;
    if (running) phaseText = phase === 'focus' ? '专注中' : '休息中';
    else if (fresh) phaseText = phase === 'focus' ? '待开始' : '休息';
    else phaseText = phase === 'focus' ? '已暂停' : '休息已暂停';
    el.phase.textContent = phaseText;
    el.toggle.textContent = running ? '暂停' : fresh ? '开始' : '继续';
    syncState();
  }

  /* 桌宠联动：把当前阶段写给桌宠窗口（storage 事件跨窗口）
     专注进行中 → 'focus'；处于休息阶段 → 'rest'；其余 → 'idle' */
  function syncState() {
    const state = running && phase === 'focus' ? 'focus'
      : phase === 'break' ? 'rest'
      : 'idle';
    try { localStorage.setItem('pom-state', state); } catch (err) { /* 忽略 */ }
  }

  /* 一个阶段走完，切到下一阶段 */
  function switchPhase() {
    const isFocusDone = phase === 'focus';
    if (isFocusDone) recordFocus();          // 专注完成记一笔
    phase = isFocusDone ? 'break' : 'focus';
    remaining = isFocusDone ? breakSec() : focusSec();
    fresh = true;

    if (!cfg().autoLoop) {
      // 不自动循环：停在下一阶段等用户点「开始」。
      // 桌宠此刻已收到状态变化（focus→rest 会弹「休息一下~」气泡提醒）
      running = false;
      clearInterval(timer);
      timer = null;
      syncState();
      return;
    }
    endAt = Date.now() + remaining * 1000;   // 自动循环：无缝进入下一阶段
  }

  function tick() {
    remaining = Math.max(0, Math.round((endAt - Date.now()) / 1000));
    if (remaining <= 0) switchPhase();
    render();
  }

  function start() {
    if (running) return;
    running = true;
    fresh = false;
    endAt = Date.now() + remaining * 1000;
    timer = setInterval(tick, 250);
    render();
  }

  function pause() {
    if (!running) return;
    running = false;
    clearInterval(timer);
    timer = null;
    render();
  }

  function reset() {
    pause();
    phase = 'focus';
    remaining = focusSec();
    fresh = true;
    endAt = null;
    render();
  }

  /* 专注完成 +1，按天记：{ "2026-09-25": 3 } */
  function recordFocus() {
    try {
      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const data = JSON.parse(localStorage.getItem(COUNT_KEY) || '{}');
      data[today] = (data[today] || 0) + 1;
      localStorage.setItem(COUNT_KEY, JSON.stringify(data));
    } catch (err) { /* 忽略，计数不影响主流程 */ }
  }

  /* ---- 设置项：改了就存；未开始/暂停时立刻套用到剩余时间 ---- */
  function readSettings() {
    const f = Math.min(180, Math.max(1, parseInt(el.focusMin.value, 10) || 25));
    const r = Math.min(60, Math.max(1, parseInt(el.restMin.value, 10) || 5));
    cfg().focusMin = f;
    cfg().restMin = r;
    cfg().autoLoop = el.autoLoop.checked;
    el.focusMin.value = f;
    el.restMin.value = r;
    window.PPStore.save();
    if (!running && fresh) {
      remaining = phase === 'focus' ? focusSec() : breakSec();
    }
    render();
  }

  /* 用 JSON 里存的配置初始化控件 */
  function applyConfigToInputs() {
    el.focusMin.value = cfg().focusMin;
    el.restMin.value = cfg().restMin;
    el.autoLoop.checked = cfg().autoLoop;
    remaining = phase === 'focus' && fresh ? focusSec() : remaining;
  }

  [el.focusMin, el.restMin].forEach((input) => input.addEventListener('change', readSettings));
  el.autoLoop.addEventListener('change', readSettings);

  el.toggle.addEventListener('click', () => (running ? pause() : start()));
  el.reset.addEventListener('click', reset);

  /* 桌宠右键「快速启动番茄钟」：小猫窗口写 pom-command，这里收到后重置并开始 */
  window.addEventListener('storage', (e) => {
    if (e.key === 'pom-command' && e.newValue === 'start') {
      reset();
      start();
    }
  });

  /* 等 PPStore 读完盘再初始化控件（JSON 里的配置优先） */
  window.PPStore.load().then(() => {
    applyConfigToInputs();
    render();
  }).catch(() => {
    applyConfigToInputs();
    render();
  });
})();
