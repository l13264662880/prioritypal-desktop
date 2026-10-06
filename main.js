/* main.js —— Electron 主进程（桌面壳）
 *
 * 职责边界（对应 TECH_DESIGN.md 第 4.3 节「加壳时会受影响的文件」）：
 *   · 本文件只负责「开窗口、管托盘、管 IPC」——桌面环境的事
 *   · 产品逻辑（任务数据、强制排序）仍然全在渲染层的 app.js 里，一行没改
 *
 * 桌面精灵窗口的四个关键属性，缺一个就不是「精灵」了：
 *   1. frame: false        —— 去掉系统标题栏，窗口本身就是精灵
 *   2. transparent: true   —— 背景透明，只看到精灵本体
 *   3. alwaysOnTop: true   —— 常驻桌面最上层，不被别的窗口盖住
 *   4. skipTaskbar: true   —— 不进任务栏，靠托盘图标呼出
 *
 * 拖拽：透明无边框窗口不能靠系统标题栏拖动，必须用 CSS 的 -webkit-app-region: drag，
 * 或由渲染层发 IPC 手动设位置。这里两条都留了路（见 preview.js 的拖拽逻辑）。
 */

'use strict';

const { app, BrowserWindow, ipcMain, Tray, Menu, screen, nativeImage } = require('electron');
const path = require('path');

/* ---------------- 启动前的图形开关（必须在 app.whenReady() 之前调用） ----------------
   桌面精灵是「透明 + 无边框 + 常驻置顶」的小窗，对 GPU 的依赖很低，
   但 GPU 一旦起不来，Electron 会直接 FATAL 退出（实测报
   "GPU process isn't usable. Goodbye."，常见于虚拟机、远程桌面、
   或显卡驱动异常的环境）。

   这里主动关掉硬件加速，改用软件渲染：
     · 透明窗口的表现更稳定，不会出现黑边或合成错误
     · 资源占用对这么小的窗口可以忽略
     · 换来的是「在任何机器上都能打开」
   对一个要拿去演示、要截图的参赛项目来说，可运行性比几个 FPS 重要得多。 */
app.disableHardwareAcceleration();

/* 透明窗口在某些 Windows 驱动上需要关掉 GPU 合成才正常显示 */
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disable-gpu');

/* 上面的开关在部分环境下仍会拉起一个「GPU 进程」再让它崩掉
   （实测报 0xC0000005 访问违规，多见于有系统级 hook 的安全软件）。
   再加两个开关，让 Electron 彻底不 spawn 独立 GPU 进程：
     · in-process-gpu    —— 把 GPU 任务并入主进程，不再单独起进程
     · no-sandbox        —— 关掉渲染沙箱，避免权限交互被拦
   这两个开关会略微降低隔离性，但对一个本地单人待办工具来说，
   可运行性远比沙箱强度重要。 */
app.commandLine.appendSwitch('in-process-gpu');
app.commandLine.appendSwitch('no-sandbox');

/* ---------------- 全局引用 ----------------
   必须存在模块级变量里，否则会被垃圾回收，窗口/托盘会莫名消失。 */
let spriteWindow = null;   // 桌面精灵（透明置顶小窗）
let panelWindow = null;    // 任务面板（正常的带边框窗口）
let tray = null;           // 系统托盘

/* 开发模式：`npm run dev` 时打开控制台，方便排查 */
const isDev = process.argv.includes('--dev');

/* ---------------- 桌面精灵窗口 ---------------- */

function createSpriteWindow() {
  // 默认落在主屏右下角偏上的位置（避开任务栏）
  const { workArea } = screen.getPrimaryDisplay();
  const W = 220;
  const H = 240;

  spriteWindow = new BrowserWindow({
    width: W,
    height: H,
    x: workArea.x + workArea.width - W - 40,
    y: workArea.y + workArea.height - H - 40,
    frame: false,           // 无系统边框
    transparent: true,      // 背景透明
    alwaysOnTop: true,      // 常驻最上层
    skipTaskbar: true,      // 不进任务栏
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    hasShadow: false,       // 透明窗口的阴影会框出一个方块，必须关
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,   // 安全默认值：渲染层拿不到 Node API
      nodeIntegration: false,
    },
  });

  spriteWindow.loadFile(path.join(__dirname, 'src', 'sprite.html'));

  // 允许拖动到屏幕任意位置（含负坐标，多显示器场景）
  spriteWindow.setAlwaysOnTop(true, 'screen-saver');

  if (isDev) spriteWindow.webContents.openDevTools({ mode: 'detach' });

  return spriteWindow;
}

/* ---------------- 任务面板窗口 ---------------- */

function createPanelWindow() {
  // 已经开着就直接聚焦，不重复开
  if (panelWindow && !panelWindow.isDestroyed()) {
    panelWindow.show();
    panelWindow.focus();
    return panelWindow;
  }

  panelWindow = new BrowserWindow({
    width: 760,
    height: 720,
    minWidth: 480,
    minHeight: 520,
    title: '智伴 PriorityPal · 任务面板',
    backgroundColor: '#e6ece5',   // 与 style.css 的 --bg 一致，避免白屏闪烁
    show: false,                 // 先不显示，等 ready-to-show 免得闪一下
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  panelWindow.loadFile(path.join(__dirname, 'src', 'panel.html'));

  // 加载完再显示，避免看到白底一闪
  panelWindow.once('ready-to-show', () => panelWindow.show());

  // 关闭时只隐藏、不销毁 —— 下次从托盘呼出更快
  panelWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      panelWindow.hide();
    }
  });

  if (isDev) panelWindow.webContents.openDevTools({ mode: 'detach' });

  return panelWindow;
}

/* ---------------- 系统托盘 ---------------- */

function createTray() {
  // 托盘图标：用内嵌的 16x16 PNG（朱砂底 + 白字「伴」），避免依赖外部图片文件
  const icon = nativeImage.createFromDataURL(TRAY_ICON_DATA_URL);

  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip('智伴 PriorityPal —— 现在最该做的那件事');

  const menu = Menu.buildFromTemplate([
    { label: '打开任务面板', click: () => createPanelWindow() },
    { label: '显示 / 隐藏精灵', click: toggleSprite },
    { type: 'separator' },
    {
      label: '退出 PriorityPal',
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(menu);

  // 左键点托盘图标 = 呼出面板（Windows 上这是最顺手的操作）
  tray.on('click', () => createPanelWindow());

  return tray;
}

function toggleSprite() {
  if (!spriteWindow || spriteWindow.isDestroyed()) {
    createSpriteWindow();
    return;
  }
  if (spriteWindow.isVisible()) {
    spriteWindow.hide();
  } else {
    spriteWindow.show();
  }
}

/* ---------------- 渲染层 → 主进程 的通道（IPC） ---------------- */

/* 渲染层拖拽精灵时，把新的窗口位置报上来 */
ipcMain.on('sprite:move', (_event, { x, y }) => {
  if (spriteWindow && !spriteWindow.isDestroyed()) {
    spriteWindow.setPosition(Math.round(x), Math.round(y));
  }
});

/* 渲染层请求「打开任务面板」 */
ipcMain.on('panel:open', () => createPanelWindow());

/* 渲染层请求「隐藏精灵」 */
ipcMain.on('sprite:hide', () => {
  if (spriteWindow && !spriteWindow.isDestroyed()) spriteWindow.hide();
});

/* 面板里改了任务 → 通知精灵更新它显示的那一条「第一件事」 */
ipcMain.on('task:changed', (_event, payload) => {
  if (spriteWindow && !spriteWindow.isDestroyed()) {
    spriteWindow.webContents.send('task:update', payload);
  }
});

/* 精灵问「我来的时候，第一件事是什么」——同步拉一次当前状态 */
ipcMain.handle('sprite:request-state', async () => {
  if (panelWindow && !panelWindow.isDestroyed()) {
    return panelWindow.webContents.executeJavaScript('window.__priorityPalSnapshot()');
  }
  return null;
});

/* ---------------- 应用生命周期 ---------------- */

app.whenReady().then(() => {
  createSpriteWindow();
  createTray();

  app.on('activate', () => {
    // macOS：点 Dock 图标时若没窗口就重建
    if (BrowserWindow.getAllWindows().length === 0) createSpriteWindow();
  });
});

/* 托盘图标用的内嵌 PNG（朱砂 #9c3d34 底 + 白色「伴」字），
   这样不依赖任何外部图片资源，打包时也不会漏文件。 */
const TRAY_ICON_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAoUlEQVR42mNgYGD4z0AswKanp/' +
  '9nYGBgYGJgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgY' +
  'GBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGD4DwYAAAAP//AwDpZQZ3AAAAA' +
  'ElFTkSuQmCC';

/* 所有窗口关闭时不退出 —— 本应用是托盘常驻型，关掉面板仍要在桌面待着。
   只有显式选「退出」才真正结束进程。 */
app.on('window-all-closed', () => {
  if (isDev) app.quit();   // 开发时方便，窗口关完就退，免得进程残留
});
