/* preload.js —— 安全桥（渲染层 ↔ 主进程）
 *
 * 为什么需要它：
 *   main.js 里开了 contextIsolation: true + nodeIntegration: false，
 *   渲染层完全拿不到 Node/Electron 的 API —— 这是 Electron 官方推荐的安全配置。
 *   渲染层想「移动窗口」「打开面板」，只能通过这里显式暴露的几个函数。
 *
 * 一句话：这是渲染层唯一能碰到桌面能力的窗口，别的路全堵死。
 */

'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('priorityPal', {
  /* ---- 精灵 → 主进程 ---- */

  /* 拖动精灵：把新的屏幕坐标交给主进程去 setPosition */
  moveSprite: (x, y) => ipcRenderer.send('sprite:move', { x, y }),

  /* 打开 / 呼出任务面板 */
  openPanel: () => ipcRenderer.send('panel:open'),

  /* 隐藏精灵 */
  hideSprite: () => ipcRenderer.send('sprite:hide'),

  /* 面板里任务有变（完成 / 删除 / 重排）→ 通知精灵刷新它显示的那一条 */
  notifyTaskChanged: (payload) => ipcRenderer.send('task:changed', payload),

  /* 精灵启动时主动拉一次当前状态 */
  requestState: () => ipcRenderer.invoke('sprite:request-state'),

  /* ---- 主进程 → 精灵（订阅式）---- */

  /* 面板改完任务后，主进程会把最新状态推过来 */
  onTaskUpdate: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('task:update', handler);
    // 返回取消订阅函数，避免重复注册
    return () => ipcRenderer.removeListener('task:update', handler);
  },

  /* 告诉渲染层「我跑在桌面壳里」，网页版不会有这个对象 */
  isDesktop: true,
});
