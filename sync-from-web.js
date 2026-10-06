/* sync-from-web.js —— 把网页版（my-site）的共享前端资源同步到桌面版
 *
 * 用法：node sync-from-web.js
 *
 * 同步的文件（以 my-site 为唯一源头，桌面版不要独立修改这两个文件）：
 *   style.css  —— 7 套主题完整样式
 *   theme.js   —— 主题选择器 + data-theme 切换逻辑
 *
 * 改主题/样式的正确流程：改 my-site → 验证 → 跑本脚本同步到桌面版。
 */
const fs = require('fs');
const path = require('path');

const WEB_DIR = 'E:/wordbuddy工作空间/my-site';
const FILES = ['style.css', 'theme.js'];

let ok = true;
FILES.forEach((name) => {
  const src = path.join(WEB_DIR, name);
  const dest = path.join(__dirname, 'src', name);
  try {
    fs.copyFileSync(src, dest);
    console.log('  已同步', name);
  } catch (err) {
    ok = false;
    console.error('  同步失败', name, '：', err.message);
  }
});

if (ok) console.log('同步完成。');
else { console.error('存在失败项，请检查 my-site 路径。'); process.exit(1); }
