"""Build a self-contained, offline Mock preview without changing application files."""
from pathlib import Path
from html import escape
import argparse
import json
import re

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', required=True, type=Path)
parser.add_argument('--device-preview', action='store_true', help='Wrap the preview in an interactive phone/tablet size selector.')
args = parser.parse_args()
output = args.output.resolve()
if output.is_relative_to(ROOT):
    parser.error('Write the generated preview outside the repository checkout.')

html = (ROOT / 'index.html').read_text()
css = (ROOT / 'styles.css').read_text()
js = (ROOT / 'app.js').read_text()


def replace_once(text, old, new):
    if text.count(old) != 1:
        raise ValueError(f'Expected one source marker: {old[:70]}')
    return text.replace(old, new, 1)


# These substitutions affect only the generated preview, never the source app.
mock_marker = "new URLSearchParams(location.search).get('mockSync')==='1'"
if js.count(mock_marker) != 2:
    raise ValueError('Expected both Mock mode and timer storage selectors.')
js = js.replace(mock_marker, 'true')
js = replace_once(js, "const _LS_NS = '';", "const _LS_NS = 'review_pomodoro_offline_';")
js = replace_once(js, 'const _realLS = window.localStorage;', 'const _realLS = window.__reviewStorage;')
js = replace_once(js, "IDB_NAME='lifeworkbench_local_v1'", "IDB_NAME='review_pomodoro_offline_mirror_v1'")
js = replace_once(js, "const GITHUB_API=MOCK_SYNC?'/__mock_gists':'https://api.github.com/gists';", "const GITHUB_API='/__mock_gists';")
mock_profile = {
    'id': 'local-mock', 'name': '本地 Mock 验收库', 'binId': 'local-mock',
    'masterKey': 'local-mock-token', 'salt': 'bG9jYWwtbW9jay1zYWx0',
}
js, count = re.subn(r'const DEFAULT_PROFILE\s*=\s*\{.*?\};',
                    lambda _: 'const DEFAULT_PROFILE=' + json.dumps(mock_profile, ensure_ascii=False) + ';',
                    js, flags=re.S)
if count != 1:
    raise ValueError('Could not safely replace the default account for offline preview.')

bootstrap = r"""
/* Offline review adapter: no server, no production account, no external fetches. */
(() => {
  let store, persistent = true;
  try {
    store = window.localStorage;
    const probe = 'review_pomodoro_probe_' + Math.random().toString(36).slice(2);
    store.setItem(probe, '1');
    store.removeItem(probe);
  } catch (error) {
    persistent = false;
    const values = new Map();
    store = {
      getItem: key => values.has(String(key)) ? values.get(String(key)) : null,
      setItem: (key, value) => { values.set(String(key), String(value)); },
      removeItem: key => { values.delete(String(key)); },
      key: index => [...values.keys()][index] ?? null,
      get length() { return values.size; }
    };
  }
  window.__reviewStorage = store;
  document.getElementById('offlinePersistenceNote').textContent = persistent
    ? '记录仅保存在此浏览器；与正式数据隔离。'
    : '此预览无法持久保存，关闭后数据会丢失。';
  const sidebarKey = 'review_pomodoro_offline_wb_sidebar_open';
  if (store.getItem(sidebarKey) === null) store.setItem(sidebarKey, '0');

  let content = null, version = 0;
  const response = (status, body) => new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json', ETag: '"offline-' + version + '"' }
  });
  window.fetch = async (input, options = {}) => {
    const raw = typeof input === 'string' ? input : input.url;
    const url = new URL(raw, 'http://offline-review.invalid/');
    if (url.origin !== 'http://offline-review.invalid' || !url.pathname.startsWith('/__mock_gists/')) {
      throw new TypeError('离线待验收预览只允许本地 Mock 同步');
    }
    const method = (options.method || input.method || 'GET').toUpperCase();
    if (url.pathname === '/__mock_gists/local-mock/commits' && method === 'GET') return response(200, []);
    if (url.pathname !== '/__mock_gists/local-mock') return response(404, { message: 'Unknown offline mock endpoint' });
    if (method === 'GET') return response(200, { id: 'local-mock', files: content === null ? {} : { 'data.json': { content } } });
    if (method === 'PATCH') {
      try {
        const body = options.body ?? await input.text();
        const next = JSON.parse(body).files['data.json'].content;
        if (typeof next !== 'string') throw new Error('Invalid content');
        content = next; version += 1;
        return response(200, { id: 'local-mock', files: { 'data.json': { content } } });
      } catch (error) { return response(400, { message: 'Invalid offline mock payload' }); }
    }
    return response(405, { message: 'Unsupported offline mock operation' });
  };
})();
"""

html = replace_once(html, '<title>个人工作台</title>', '<title>个人工作台 · 番茄时钟待验收</title>')
html = replace_once(html, '<link rel="stylesheet" href="styles.css">', '<style>\n' + css + '\n.offline-review-notice{padding:10px 16px;text-align:center;background:#f8eee9;color:#824734;border-bottom:1px solid #ebd8d0;font-size:12px;line-height:1.8}.offline-review-notice span{display:block;font-size:11px}\n</style>')
html = replace_once(html, '<body>', '<body>\n<aside class="offline-review-notice"><b>番茄时钟 · 离线待验收</b> · 不连接正式账号或 Gist<span id="offlinePersistenceNote"></span></aside>')
html, count = re.subn(r'<script src="app\.js\?[^\"]+"></script>',
                    lambda _: '<script>\n' + bootstrap + '\n' + js + '\n</script>', html)
if count != 1:
    raise ValueError('Expected exactly one application script entry.')
if re.search(r'</script', bootstrap + js, re.I) or re.search(r'</style', css, re.I):
    raise ValueError('Source contains an embedded closing tag; escaping is required.')
if re.search(r'<script\b[^>]*\bsrc=|<link\b[^>]*\brel=[\"\']stylesheet', html, re.I):
    raise ValueError('Generated preview still references external application assets.')
if args.device_preview:
    embedded = escape(html, quote=True)
    html = '''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>番茄时钟 · 手机体验预览</title><style>
*{box-sizing:border-box}body{margin:0;background:#efefec;color:#1a1a1a;font-family:system-ui,"PingFang SC",sans-serif}
header{padding:14px 20px;background:white;border-bottom:1px solid #ddd;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
h1{font-size:17px;margin:0}p{font-size:12px;color:#666;margin:4px 0 0}.devices{display:flex;gap:6px;flex-wrap:wrap}
button{min-height:44px;min-width:60px;padding:8px 12px;border:1px solid #ddd;border-radius:9px;background:white;font:inherit;font-size:13px;cursor:pointer;touch-action:manipulation}
button[aria-pressed="true"]{background:#a95f4b;color:white;border-color:#a95f4b}button:focus-visible{outline:2px solid #a95f4b;outline-offset:2px}
.stage{padding:18px 12px;display:flex;justify-content:center;overflow:auto;align-items:flex-start}
iframe{box-sizing:content-box;width:390px;height:740px;max-width:calc(100% - 2px);flex:none;background:white;border:1px solid #d5d5d0;border-radius:18px;box-shadow:0 8px 28px #0001}
</style></head><body><header><div><h1>番茄时钟 · 手机体验预览</h1><p>可在电脑切换屏幕宽度、直接操作。此处仅预览布局，尚未经真机验收。</p></div>
<div class="devices" role="group" aria-label="预览设备尺寸">
<button data-width="390" data-height="740" aria-pressed="true">手机</button><button data-width="320" data-height="568" aria-pressed="false">小屏</button>
<button data-width="844" data-height="390" aria-pressed="false">横屏</button><button data-width="768" data-height="1024" aria-pressed="false">平板</button>
<button data-width="full" data-height="900" aria-pressed="false">桌面</button></div></header>
<main class="stage"><iframe id="reviewDevice" title="可交互的番茄时钟待验收页面" srcdoc="''' + embedded + '''"></iframe></main>
<script>
document.querySelectorAll('[data-width]').forEach(button=>button.onclick=()=>{
  const frame=document.getElementById('reviewDevice');
  frame.style.width=button.dataset.width==='full'?'100%':button.dataset.width+'px';
  frame.style.height=button.dataset.height+'px';
  document.querySelectorAll('[data-width]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
});
</script></body></html>'''
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(html)
print(f'Built offline review preview: {output} ({output.stat().st_size} bytes)')
