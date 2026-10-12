/* store.js —— 面板侧统一存储层（任务 + 番茄配置）
 *
 * 两套落盘：
 *   1. 本地 JSON 文件（桌面版）：走 preload 暴露的 priorityPal.store，
 *      由主进程写 userData/prioritypal-data.json，重启自动加载。
 *   2. localStorage（网页版兜底 + 旧数据迁移）：浏览器环境没有文件权限，
 *      自动降级，逻辑一致。
 *
 * 用法：
 *   await PPStore.load();          // 启动时调一次
 *   PPStore.state.tasks            // 内存里的真相（app.js / pomodoro.js 共用）
 *   PPStore.save();                // 任何改动后调一次（内部防抖写文件）
 */
window.PPStore = (() => {
  'use strict';

  const LS_TASKS = 'todo-queue-v1';        // 旧版任务键（迁移用）
  const LS_POMO = 'pomodoro-settings-v1';  // 番茄配置键
  const api = window.priorityPal;          // 桌面壳才有

  const state = {
    tasks: [],
    pomodoro: { focusMin: 25, restMin: 5, autoLoop: false },
  };

  /* 任务数据规范化：旧数据缺字段补默认值，脏数据丢弃 */
  function normalize(list) {
    if (!Array.isArray(list)) return [];
    return list
      .filter((t) => t && typeof t.text === 'string')
      .map((t) => ({
        id: t.id || 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        text: t.text,
        done: !!t.done,
        due: t.due || null,
        estimate: t.estimate || null,
        note: typeof t.note === 'string' ? t.note : '',        // 备注
        priority: ['高', '中', '低'].includes(t.priority) ? t.priority : '中', // 优先级
        spent: Number.isFinite(t.spent) ? t.spent : 0,         // 累计耗时（秒）
      }));
  }

  let loadPromise = null;
  /* 只会真正读一次盘：app.js 和 pomodoro.js 都会调，重复读会把内存改动冲掉 */
  function load() {
    if (!loadPromise) loadPromise = doLoad();
    return loadPromise;
  }

  async function doLoad() {
    let data = null;
    if (api && api.store) {
      try { data = await api.store.load(); } catch (err) { /* 读失败走兜底 */ }
    }
    if (!data) {
      // 迁移：把旧版 localStorage 里的任务/配置搬过来
      data = {};
      try {
        const raw = localStorage.getItem(LS_TASKS);
        if (raw) data.tasks = JSON.parse(raw);
      } catch (err) { /* 忽略 */ }
    }
    try {
      const p = localStorage.getItem(LS_POMO);
      if (p) data.pomodoro = Object.assign(data.pomodoro || {}, JSON.parse(p));
    } catch (err) { /* 忽略 */ }

    state.tasks = normalize(data.tasks);
    if (data.pomodoro) Object.assign(state.pomodoro, data.pomodoro);
    return state;
  }

  /* 防抖写文件：连续操作（拖拽排序每秒好几下）不至于密集落盘 */
  let timer = null;
  function save() {
    const payload = {
      version: 1,
      savedAt: new Date().toISOString(),
      tasks: state.tasks,
      pomodoro: state.pomodoro,
    };
    // 网页兜底：localStorage 同步写，立即生效
    try {
      localStorage.setItem(LS_TASKS, JSON.stringify(state.tasks));
      localStorage.setItem(LS_POMO, JSON.stringify(state.pomodoro));
    } catch (err) { /* 隐私模式等场景忽略 */ }

    if (api && api.store) {
      clearTimeout(timer);
      timer = setTimeout(() => {
        api.store.save(payload).catch(() => { /* 写失败不阻断界面 */ });
      }, 250);
    }
  }

  /* 立即落盘（关闭窗口前用，绕过防抖） */
  function flush() {
    if (!(api && api.store)) return;
    clearTimeout(timer);
    api.store.save({
      version: 1, savedAt: new Date().toISOString(),
      tasks: state.tasks, pomodoro: state.pomodoro,
    }).catch(() => {});
  }

  window.addEventListener('beforeunload', flush);

  return { state, load, save, flush, normalize };
})();
