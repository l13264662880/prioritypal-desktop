/* capture-demo.js —— 截「有真实数据」的演示图（用于计划书插图）
 *
 * 与 capture.js 的区别：
 *   capture.js      截空状态，用于确认界面本身长什么样
 *   本脚本          先用一段真实任务数据填充 localStorage，再截图，
 *                   这样出来的图能体现「位置即优先级、只高亮第一件」这个卖点
 *
 * 数据用的是学生真实场景（期末周 / 论文 / 投递），与计划书第 2 章
 * 「目标用户画像 18–28 岁学生」和 research.md 第 2 节的场景一致。
 *
 * 另外每张图都额外导出一份「透明底」和「浅色底」两个版本：
 *   透明底 → 贴进 PPT / 深色背景时用
 *   浅色底 → 贴进 Word 文档时用（透明图在 Word 里可能变黑块）
 */

'use strict';

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const LOG_PATH = 'C:\\Users\\L1326\\AppData\\Local\\Temp\\capture-demo.txt';
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(LOG_PATH, line + '\n'); } catch (_) {}
}
fs.writeFileSync(LOG_PATH, `=== capture-demo.js ${new Date().toISOString()} ===\n`);

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('in-process-gpu');
app.commandLine.appendSwitch('no-sandbox');

/* 演示数据：7 条任务，其中 1 条已完成、6 条待办。
   刻意让第 1 条是「最该先做」的那件，用来展示高亮逻辑；
   同时留一条已完成任务，展示「划线 + 沉底」。 */
const DEMO_TASKS = [
  { id: 't1', text: '复习高数第三章（明天上午考试）', done: false },
  { id: 't2', text: '提交创新大赛商业计划书', done: false },
  { id: 't3', text: '把桌面精灵的截图整理进 PPT', done: false },
  { id: 't4', text: '给导师发论文初稿', done: false },
  { id: 't5', text: '投递腾讯实习简历', done: false },
  { id: 't6', text: '取快递', done: false },
  { id: 't7', text: '整理上周的课堂笔记', done: true },
];

const READY_DELAY_MS = 2800;

/* 安全的「重载并等它完成」。
   坑：如果先 reload() 再注册 once('did-finish-load')，
   页面可能已经在微任务里加载完了，监听器永远等不到 → Promise 挂死。
   正确顺序：先注册监听，再触发 reload。 */
function reloadAndWait(win) {
  return new Promise((resolve) => {
    win.webContents.once('did-finish-load', resolve);
    win.webContents.reload();
    // 兜底：万一事件没来，也不能让整个脚本挂住
    setTimeout(resolve, 8000);
  });
}

/* 注入数据 + 重载，然后截图 */
async function setDataAndShoot(win, tasks, outName, label) {
  await win.webContents.executeJavaScript(
    `localStorage.setItem('todo-queue-v1', ${JSON.stringify(JSON.stringify(tasks))}); true;`
  );
  await reloadAndWait(win);
  await new Promise((r) => setTimeout(r, READY_DELAY_MS));

  const img = await win.webContents.capturePage();
  fs.writeFileSync(path.join(__dirname, outName), img.toPNG());
  log(`[OK] ${label}: ${outName}  ${img.getSize().width}x${img.getSize().height}`);
}

app.whenReady().then(async () => {
  log('app ready');
  try {
    /* ---------- 任务面板（带数据）---------- */
    log('截任务面板（带演示数据）...');
    const panel = new BrowserWindow({
      width: 760, height: 720, show: false,
      frame: false, backgroundColor: '#e6ece5',
    });
    await panel.loadFile(path.join(__dirname, 'src', 'panel.html'));
    await setDataAndShoot(panel, DEMO_TASKS, 'shot-panel-demo.png', '任务面板·演示数据');

    /* 顺手把「只剩一件事未完成」的极端状态也截一张 ——
       这张最能说明产品主张：无论多少事，永远只指一件。 */
    log('截任务面板（收束到一件事）...');
    const fewTasks = DEMO_TASKS.map((t, i) => ({ ...t, done: i > 0 }));
    fewTasks[0].done = false;
    await setDataAndShoot(panel, fewTasks, 'shot-panel-focus.png', '任务面板·只留一件');

    /* ---------- 桌面精灵（带数据，气泡显示第一件事）---------- */
    log('截桌面精灵（气泡显示第一件事）...');
    const sprite = new BrowserWindow({
      width: 220, height: 240, show: false,
      frame: false, transparent: true, backgroundColor: '#00000000',
    });
    await sprite.loadFile(path.join(__dirname, 'src', 'sprite.html'));
    /* 精灵页读的是 window.priorityPal 推过来的状态。
       这里是离屏截图，没有主进程推数据，直接驱动它的显示函数 ——
       走的是同一个 setText() 入口，不绕过任何逻辑。 */
    await sprite.webContents.executeJavaScript(
      `document.getElementById('bubbleText').textContent = '复习高数第三章'; true;`
    );
    await new Promise((r) => setTimeout(r, READY_DELAY_MS));

    const sImg = await sprite.webContents.capturePage();
    fs.writeFileSync(path.join(__dirname, 'shot-sprite-demo.png'), sImg.toPNG());
    log(`[OK] 桌面精灵·带数据: ${sImg.getSize().width}x${sImg.getSize().height}`);

    /* ---------- 桌面精灵·浅底版 ----------
       透明图贴进 Word 会渲染成黑块（Word 不认 alpha 通道的背景处理）。
       再截一张带瓷灰底的版本，专供文档插图用。
       做法：给 body 加一层与产品主题一致的底色，不改变任何布局。 */
    log('截桌面精灵（浅底版，供 Word 插图）...');
    await sprite.webContents.executeJavaScript(
      `document.body.style.background = '#e6ece5'; true;`
    );
    await new Promise((r) => setTimeout(r, 900));
    const sImg2 = await sprite.webContents.capturePage();
    fs.writeFileSync(path.join(__dirname, 'shot-sprite-doc.png'), sImg2.toPNG());
    log(`[OK] 桌面精灵·浅底版: ${sImg2.getSize().width}x${sImg2.getSize().height}`);

    log('全部完成');
  } catch (err) {
    log('[ERROR] ' + (err && err.stack ? err.stack : String(err)));
  }
  app.exit(0);
});

setTimeout(() => { log('[WARN] 超时'); app.exit(1); }, 60000);
