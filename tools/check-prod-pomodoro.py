"""Check production-mode isolation locally; never uses a real account or Gist."""
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
import json
import subprocess
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
BASELINE = '18f6fb57b520dccd6f2941487ec5e634b4b80701'
original = subprocess.check_output(['git', 'show', BASELINE + ':app.js'], cwd=ROOT)
current = (ROOT / 'app.js').read_bytes()


def unchanged(name, start, end):
    left, right = start.encode(), end.encode()
    before = original[original.index(left):original.index(right, original.index(left))]
    after = current[current.index(left):current.index(right, current.index(left))]
    assert before == after, name
    print('PASS protected source: ' + name, flush=True)


unchanged('business storage and IndexedDB', '/* ============ 数据层 ============ */', '/* ============ 弹窗 ============ */')
unchanged('login, credentials, Gist and encryption', 'const SYNC_KEY=', 'function renderChangelog')
unchanged('export and import', "$('#exportBtn').onclick", "$('#budgetBtn').onclick")
unchanged('production storage namespace and TEST_BUILD', 'const _realLS = window.localStorage;', '/* ============ 工具函数')
tail = b'initFilters();\r\nrenderAll();'
assert original[original.index(tail):] == current[current.index(tail):]
print('PASS protected source: existing initialization and cloud bootstrap order', flush=True)

seed = {
    'version': 3, 'todos': [{'id': 'release-existing-todo', 'text': '原有待办保留', 'done': False, 'date': '2026-10-18'}],
    'worklog': [{'id': 'release-existing-log', 'text': '原有日志保留', 'date': '2026-10-18', 'time': '09:00'}],
    'habits': [], 'ledger': [], 'budget': 0, 'moods': {}, 'notes': [], 'countdowns': [],
    'customCats': {'expense': [], 'income': []}, 'budgetCats': {}, 'quickNotes': [],
    'learning': {name: [] for name in ['directions', 'contents', 'plans', 'questions', 'reviews', 'mistakes', 'selftests']},
    'habitArchive': {}, 'updatedAt': 1792314000000,
}
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True)
    context = browser.new_context(viewport={'width': 1440, 'height': 1100}, timezone_id='Asia/Shanghai')
    seed_json = json.dumps(seed, ensure_ascii=False)
    context.add_init_script(
        "window.localStorage.setItem('wb_sidebar_open','0');"
        "if(!window.localStorage.getItem('lifeworkbench_v1'))window.localStorage.setItem('lifeworkbench_v1',"
        + json.dumps(seed_json, ensure_ascii=False) + ");"
        "window.localStorage.setItem('lifeworkbench_pomodoro_mock_v1','release-mock-sentinel');"
    )
    external, errors, responses = [], [], []

    def route(request_route):
        if urlparse(request_route.request.url).hostname != '127.0.0.1':
            external.append(request_route.request.url)
            request_route.abort()
        else:
            request_route.continue_()

    context.route('**/*', route)
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('response', lambda response: responses.append((response.url, response.status)))
    page.clock.install(time=datetime(2026, 10, 18, 9, tzinfo=timezone.utc))
    page.goto('http://127.0.0.1:4173/')
    assert page.evaluate("!MOCK_SYNC && !TEST_BUILD && _LS_NS === '' && GITHUB_API === 'https://api.github.com/gists' && sessionPasscode === null")
    assert page.evaluate("POMO_KEY === 'lifeworkbench_pomodoro_v1'")
    assert page.locator('#aboutVer').text_content() == 'v3.22.0'
    for asset in ['styles.css', 'app.js']:
        assert any(asset + '?v=prod-pomodoro-20261018-1' in url and status == 200 for url, status in responses), (asset, responses)
    print('PASS production default mode and versioned CSS/JS load', flush=True)

    page.locator('#pomoTodo').select_option('release-existing-todo')
    page.locator('#pomoPrimary').click()
    page.clock.fast_forward(60000)
    page.locator('#pomoPrimary').click()
    page.reload()
    expect(page.locator('#pomoPrimary')).to_have_text('继续专注')
    expect(page.locator('#pomoTime')).to_have_text('24:00')
    page.locator('#pomoPrimary').click()
    page.clock.fast_forward(24 * 60000 + 1000)
    expect(page.locator('#pomoCount')).to_have_text('1')
    assert page.evaluate("S.todos.length === 1 && S.todos[0].id === 'release-existing-todo' && !S.todos[0].done && S.worklog.length === 1 && S.worklog[0].id === 'release-existing-log'")
    assert page.evaluate("!S._demoSeeded && !('pomodoro' in S) && !('timer' in S)")
    assert page.evaluate("JSON.parse(window.localStorage.getItem('lifeworkbench_pomodoro_v1')).history.length === 1")
    assert page.evaluate("window.localStorage.getItem('lifeworkbench_pomodoro_mock_v1') === 'release-mock-sentinel'")
    assert not external, external
    assert not errors, errors
    print('PASS production local timer, existing-data preservation, Mock separation and no automatic log/demo data', flush=True)
    print('PASS no Gist/external requests and no uncaught JavaScript errors', flush=True)
    context.close()
    browser.close()
