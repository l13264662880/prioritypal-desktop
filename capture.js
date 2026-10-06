/* capture.js —— 用 Electron 自己的能力给桌面精灵截图
 *
 * 为什么不用系统截图工具：
 *   1. 系统截屏在沙箱里被拦（Add-Type / .NET 运行时加载受限）
 *   2. Electron 的 webContents.capturePage() 截的是**渲染结果**本身，
 *      透明背景、圆角、动画当前帧都能如实抓到，比截全屏再裁剪更干净
 *
 * 用法：electron capture.js [精灵窗|面板|两个]
 * 产出：shot-sprite.png / shot-panel.png 落在脚本同目录
 */

'use strict';

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

/* 日志同时写控制台和文件。
   为什么要写文件：在某些启动方式下，Electron 的 stdout 会被上层吞掉，
   控制台什么都看不到。落盘是唯一可靠的取证方式。 */
const LOG_PATH = path.join(__dirname, 'capture-log.txt');

/* 双保险：同一份日志同时写 __dirname 和一个绝对兜底路径。
   如果进程被以奇怪的工作目录拉起，至少有一份能落到我们能找到的地方。 */
const FALLBACK_LOG = 'C:\\Users\\L1326\\AppData\\Local\\Temp\\capture-fallback.txt';

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(LOG_PATH, line + '\n'); } catch (_) { /* 忽略 */ }
  try { fs.appendFileSync(FALLBACK_LOG, line + '\n'); } catch (_) { /* 忽略 */ }
}

function startLog() {
  const head = `=== capture.js 启动 ${new Date().toISOString()} ===\n`
             + `__dirname = ${__dirname}\n`
             + `process.argv = ${JSON.stringify(process.argv)}\n`
             + `cwd = ${process.cwd()}\n`;
  console.log(head);
  try { fs.writeFileSync(LOG_PATH, head); } catch (_) {}
  try { fs.writeFileSync(FALLBACK_LOG, head); } catch (_) {}
}

startLog();
log('Electron 已加载，版本 ' + process.versions.electron);

/* 关键：这台机器上 GPU 进程起不来会直接 FATAL，必须先关掉（同 main.js） */
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('in-process-gpu');
app.commandLine.appendSwitch('no-sandbox');

/* 透明窗口截图时，如果页面还没渲染完就抓，会得到一张全透明的空图。
   这里留足等待时间，让内联 SVG、字体、动画都就位。 */
const READY_DELAY_MS = 2600;

function makeWindow(width, height) {
  return new BrowserWindow({
    width,
    height,
    show: false,               // 不显示也能截图（离屏渲染）
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
  });
}

async function shoot(win, outName, label) {
  await new Promise((resolve) => setTimeout(resolve, READY_DELAY_MS));

  const image = await win.webContents.capturePage();
  if (image.isEmpty()) {
    log(`[FAIL] ${label}: 截到空图`);
    return false;
  }

  const outPath = path.join(__dirname, outName);
  fs.writeFileSync(outPath, image.toPNG());
  const size = image.getSize();
  log(`[OK] ${label}: ${outName}  ${size.width}x${size.height}  ${fs.statSync(outPath).size} bytes`);
  return true;
}

app.whenReady().then(async () => {
  log('app ready');
  const okList = [];

  try {
    // ---- 桌面精灵（220x240，与 main.js 里的窗口尺寸一致）----
    log('开始截桌面精灵...');
    const sprite = makeWindow(220, 240);
    await sprite.loadFile(path.join(__dirname, 'src', 'sprite.html'));
    log('sprite.html 已加载');
    okList.push(await shoot(sprite, 'shot-sprite.png', '桌面精灵'));

    // ---- 任务面板（760x720，与 main.js 里的窗口尺寸一致）----
    log('开始截任务面板...');
    const panel = makeWindow(760, 720);
    await panel.loadFile(path.join(__dirname, 'src', 'panel.html'));
    log('panel.html 已加载');
    okList.push(await shoot(panel, 'shot-panel.png', '任务面板'));
  } catch (err) {
    log('[ERROR] ' + (err && err.stack ? err.stack : String(err)));
  }

  log(`完成：${okList.filter(Boolean).length}/${okList.length} 张截图成功`);
  app.exit(0);
});

/* 兜底：万一 whenReady 没触发，也要留下痕迹 */
setTimeout(() => {
  log('[WARN] 超时退出，whenReady 可能未触发');
  app.exit(1);
}, 40000);

