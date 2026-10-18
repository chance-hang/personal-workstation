"""Build a self-contained, offline Mock preview without changing application files."""
from pathlib import Path
import argparse
import json
import re

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', required=True, type=Path)
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
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(html)
print(f'Built offline review preview: {output} ({output.stat().st_size} bytes)')
