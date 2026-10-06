/* day12-skill-shot.js —— 截取项目里的 SKILL.md 文件内容（Day 12 第二张截图）
 * 读取 frontend-filter-checklist/SKILL.md，包进一个带「文件路径标题」的 HTML，截图。
 */
'use strict';
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const SKILL = 'E:/wordbuddy工作空间/.workbuddy/skills/frontend-filter-checklist/SKILL.md';
const OUT = path.join(__dirname, 'day12-skill.png');
const TMP = path.join(__dirname, '_day12-skill-preview.html');

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('in-process-gpu');
app.commandLine.appendSwitch('no-sandbox');

app.whenReady().then(async () => {
  try {
    const content = fs.readFileSync(SKILL, 'utf8');
    const esc = content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>SKILL.md</title></head>
<body style="margin:0;background:#f5f5f0;font-family:Consolas,'Courier New',monospace;">
  <div style="background:#dee1e6;padding:10px 16px;font-family:system-ui,'Segoe UI',sans-serif;font-size:14px;color:#202124;border-bottom:1px solid #b9bcc0;">
    <b>frontend-filter-checklist/SKILL.md</b>
    <span style="color:#5f6368;margin-left:10px;">E:\\wordbuddy工作空间\\.workbuddy\\skills\\frontend-filter-checklist\\SKILL.md</span>
  </div>
  <pre style="margin:0;padding:20px 24px;font-size:14px;line-height:1.7;color:#202124;white-space:pre-wrap;word-break:break-word;">${esc}</pre>
</body></html>`;
    fs.writeFileSync(TMP, html);

    const win = new BrowserWindow({ width: 920, height: 1500, show: true });
    await win.loadFile(TMP);
    await new Promise((r) => setTimeout(r, 800));

    const img = await win.webContents.capturePage();
    if (img.isEmpty()) { console.log('[FAIL] 空图'); app.exit(1); return; }
    fs.writeFileSync(OUT, img.toPNG());
    console.log('[OK] SKILL.md 截图 ' + img.getSize().width + 'x' + img.getSize().height);
    fs.unlinkSync(TMP);
    app.exit(0);
  } catch (err) {
    console.log('[ERROR] ' + (err && err.stack ? err.stack : String(err)));
    app.exit(1);
  }
});

setTimeout(() => { console.log('[WARN] 超时'); app.exit(1); }, 30000);
