"""Run against the repository's local Mock server. Requires Python Playwright + Chromium.

Uses disposable browser storage, blocks external requests, and advances the browser
clock instead of weakening production timer durations. Writes only to local Mock.
"""
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
import argparse
import json
from playwright.sync_api import sync_playwright, expect

parser = argparse.ArgumentParser()
parser.add_argument('--screenshots', type=Path)
args = parser.parse_args()
if args.screenshots:
    args.screenshots.mkdir(parents=True, exist_ok=True)

MOCK_URL = 'http://127.0.0.1:4173/?mockSync=1'
KEY = 'lifeworkbench_pomodoro_mock_v1'
passed = []


def check(name):
    passed.append(name)
    print('PASS ' + name, flush=True)


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True)
    context = browser.new_context(viewport={'width': 1440, 'height': 1150})
    context.add_init_script("window.localStorage.setItem('wb_sidebar_open','0')")
    errors, external = [], []

    def route(request_route):
        if urlparse(request_route.request.url).hostname not in ('127.0.0.1', 'localhost'):
            external.append(request_route.request.url)
            request_route.abort()
        else:
            request_route.continue_()

    context.route('**/*', route)

    def open_page(at=None):
        page = context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.clock.install(time=at or datetime(2026, 10, 18, 9, tzinfo=timezone.utc))
        page.goto(MOCK_URL)
        page.wait_for_function('syncActive() && !syncBusy')
        return page

    a = open_page()
    expect(a.locator('#pomoTime')).to_have_text('25:00')
    expect(a.locator('#pomoCount')).to_have_text('0')
    assert a.evaluate("moduleCfg[0].id === 'pomodoro'")
    merge_checks = a.evaluate('runProdNoteMergeChecks()')
    assert merge_checks and all(result['ok'] for result in merge_checks), merge_checks
    initial_log_ids = set(a.evaluate('S.worklog.map(x=>x.id)'))
    check(f'defaults, module registration and {len(merge_checks)} existing merge checks')

    # Bind a real todo through the UI, without using demo/seed paths.
    a.locator('#todoIn').fill('番茄验收：完成一章阅读')
    a.locator('#todoAdd').click()
    todo_id = a.evaluate("S.todos.findLast(x=>x.text==='番茄验收：完成一章阅读').id")
    a.locator('#pomoTodo').select_option(todo_id)
    expect(a.locator('#pomoTask')).to_have_value('番茄验收：完成一章阅读')
    a.locator('#pomoPrimary').click()
    expect(a.locator('#pomoTodo')).to_be_disabled()
    expect(a.locator('#pomoSettingsSave')).to_be_disabled()
    a.clock.fast_forward(61000)
    expect(a.locator('#pomoTime')).to_have_text('23:59')
    a.locator('#pomoPrimary').click()
    paused = a.locator('#pomoTime').inner_text()
    a.clock.fast_forward(600000)
    expect(a.locator('#pomoTime')).to_have_text(paused)
    a.reload()
    a.wait_for_function('syncActive() && !syncBusy')
    expect(a.locator('#pomoPrimary')).to_have_text('继续专注')
    expect(a.locator('#pomoTime')).to_have_text(paused)
    check('todo binding, elapsed time, pause and paused refresh recovery')

    a.locator('#pomoPrimary').click()
    b = open_page(datetime.fromtimestamp(a.evaluate('Date.now()') / 1000, tz=timezone.utc))
    a.clock.fast_forward(24 * 60000)
    expect(a.locator('#pomoCount')).to_have_text('1')
    expect(a.locator('#pomoMinutes')).to_have_text('25 分钟')
    expect(a.locator('#pomoPrimary')).to_have_text('开始短休息')
    b.wait_for_function('pomoState.history.length === 1')
    b.evaluate('pomoTick(); pomoTick()')
    assert a.evaluate('pomoState.timer === null && pomoState.history.length === 1')
    assert not a.evaluate('S.todos.find(x=>x.id===' + json.dumps(todo_id) + ').done')
    assert set(a.evaluate('S.worklog.map(x=>x.id)')) == initial_log_ids
    first_log_id = 'pomo-' + a.evaluate('pomoState.history[0].id')
    check('completion exactly once across tabs, manual next phase, todo remains uncompleted')
    b.close()

    a.locator('[data-pomo-record]').first.click()
    a.locator('#pomoSummary').fill('读完第一节，下一轮整理要点。')
    a.locator('#pomoWriteLog').check()
    a.locator('#pomoSaveSummary').click()
    a.locator('[data-pomo-record]').first.click()
    expect(a.locator('#pomoWriteLog')).to_be_disabled()
    a.locator('#pomoSaveSummary').click()
    assert a.evaluate('S.worklog.filter(x=>x.id===' + json.dumps(first_log_id) + ').length') == 1
    expect(a.locator('#wlList')).to_contain_text('读完第一节')
    a.wait_for_function('!syncBusy')
    a.evaluate('async () => { clearTimeout(syncTimer); await cloudPush(); }')
    cloud = context.request.get('http://127.0.0.1:4173/__mock_gists/local-mock').json()
    from urllib.parse import unquote
    remote = json.loads(unquote(json.loads(cloud['files']['data.json']['content'])['ct']))
    assert any(x['id'] == first_log_id for x in remote['worklog'])
    assert 'pomodoro' not in remote and 'timer' not in remote
    check('optional summary log, duplicate prevention and existing Mock upload')

    a.locator('#pomoPrimary').click()
    a.clock.fast_forward(5 * 60000 + 1000)
    expect(a.locator('#pomoCount')).to_have_text('1')
    expect(a.locator('#pomoPrimary')).to_have_text('开始专注')
    for completed in range(2, 5):
        a.locator('[data-pomo-mode="focus"]').click()
        a.locator('#pomoPrimary').click()
        a.clock.fast_forward(25 * 60000 + 1000)
        expect(a.locator('#pomoCount')).to_have_text(str(completed))
    expect(a.locator('#pomoPrimary')).to_have_text('开始长休息')
    expect(a.locator('#pomoTime')).to_have_text('15:00')
    a.locator('#pomoPrimary').click()
    a.locator('#pomoStop').click()
    expect(a.locator('#pomoPrimary')).to_have_text('开始专注')
    check('short break completion, fourth-round long break and skip break')

    a.locator('#pomoTodo').select_option('')
    a.locator('#pomoTask').fill('整理工作计划')
    a.locator('#pomoPrimary').click()
    a.clock.fast_forward(125000)
    a.locator('#pomoStop').click()
    a.locator('#pomoReason').select_option(label='任务已完成')
    a.locator('#pomoStopNote').fill('已整理出三个重点。')
    a.locator('#pomoConfirmStop').click()
    expect(a.locator('#pomoCount')).to_have_text('4')
    expect(a.locator('#pomoMinutes')).to_have_text('102 分钟')
    expect(a.locator('#pomoHistory')).to_contain_text('任务已完成')
    assert a.evaluate("pomoState.history.at(-1).status === 'interrupted'")
    check('early finish preserves actual focus time, reason and summary without extra tomato')

    a.locator('#pomoSettings summary').click()
    for invalid in ['0', '1.5', '181']:
        a.locator('#pomoFocusMinutes').fill(invalid)
        a.locator('#pomoSettingsSave').click()
        assert a.evaluate('pomoState.settings.focus') == 25
    a.locator('#pomoFocusMinutes').fill('1')
    a.locator('#pomoShortMinutes').fill('2')
    a.locator('#pomoLongMinutes').fill('3')
    a.locator('#pomoSoundEnabled').uncheck()
    a.locator('#pomoSettingsSave').click()
    expect(a.locator('#pomoTime')).to_have_text('01:00')
    a.locator('#pomoPrimary').click()
    a.clock.fast_forward(30000)
    a.reload()
    a.wait_for_function('syncActive() && !syncBusy')
    expect(a.locator('#pomoTime')).to_have_text('00:30')
    # Jump wall time with no timer callbacks: equivalent to suspension, then reload.
    a.clock.set_system_time(datetime.fromtimestamp((a.evaluate('Date.now()') + 600000) / 1000, tz=timezone.utc))
    a.reload()
    a.wait_for_function('syncActive() && !syncBusy')
    expect(a.locator('#pomoCount')).to_have_text('5')
    expect(a.locator('#pomoTime')).to_have_text('02:00')
    a.reload()
    expect(a.locator('#pomoCount')).to_have_text('5')
    assert a.evaluate('pomoState.timer === null')
    check('settings bounds, running refresh and suspended-page expiry without duplicate credit')

    a.locator('[data-pomo-mode="focus"]').click()
    a.locator('#pomoPrimary').click()
    expect(a.locator('#pomoTime')).to_have_text('01:00')
    a.locator('#pomoFocusView').click()
    assert a.locator('body').evaluate("el=>el.classList.contains('pomo-focus')")
    a.keyboard.press('Escape')
    assert not a.locator('body').evaluate("el=>el.classList.contains('pomo-focus')")
    a.locator('#tabbar [data-p="notes"]').click()
    a.clock.fast_forward(30000)
    a.locator('#tabbar [data-p="today"]').click()
    expect(a.locator('#pomoTime')).to_have_text('00:30')
    a.locator('#pomoStop').click()
    a.locator('#pomoConfirmStop').click()
    check('focus mode, Escape and countdown across page navigation')

    a.evaluate("window.localStorage.setItem('lifeworkbench_pomodoro_v1','production-sentinel')")
    a.locator('#pomoPrimary').click()
    a.locator('#pomoPrimary').click()
    assert a.evaluate("window.localStorage.getItem('lifeworkbench_pomodoro_v1')") == 'production-sentinel'
    a.locator('#pomoStop').click()
    a.locator('#pomoConfirmStop').click()
    a.evaluate("() => { const original=Storage.prototype.setItem; window.restorePomoStorage=()=>{Storage.prototype.setItem=original}; Storage.prototype.setItem=function(k,v){if(k==='lifeworkbench_pomodoro_mock_v1')throw new DOMException('quota','QuotaExceededError');return original.call(this,k,v)} }")
    a.locator('#pomoPrimary').click()
    expect(a.locator('#pomoStorageError')).to_be_visible()
    assert a.evaluate('pomoState.timer === null')
    a.evaluate('window.restorePomoStorage()')
    check('Mock/production storage isolation and failed writes never start an unsaved timer')

    # Today's metrics must reset at midnight even with no active timer.
    a.clock.set_system_time(datetime(2026, 10, 19, 0, 0, 1, tzinfo=timezone.utc))
    a.clock.fast_forward(1000)
    expect(a.locator('#pomoCount')).to_have_text('0')
    expect(a.locator('#pomoMinutes')).to_have_text('0 分钟')
    check('daily statistics refresh at midnight')

    a.locator('#tabbar [data-p="me"]').click()
    a.locator('#clearBtn').click()
    a.locator('#cIn').fill('清空')
    a.locator('#cOk').click()
    assert a.evaluate('window.localStorage.getItem(' + json.dumps(KEY) + ')') is None
    assert a.evaluate('pomoState.history.length === 0 && pomoState.timer === null')
    assert a.evaluate("window.localStorage.getItem('lifeworkbench_pomodoro_v1')") == 'production-sentinel'
    check('explicit clear-all also clears this mode\'s local timer and history')

    # Screenshot a fresh context so synthetic acceptance records are not presented as user data.
    clean = browser.new_context(viewport={'width': 1440, 'height': 1150})
    clean.add_init_script("window.localStorage.setItem('wb_sidebar_open','0')")
    clean.route('**/*', route)
    view = clean.new_page()
    view.on('pageerror', lambda error: errors.append(str(error)))
    view.goto(MOCK_URL)
    view.locator('#pomoTask').fill('读完一章，整理三个要点')
    if args.screenshots:
        view.locator('#pomoSection').screenshot(path=str(args.screenshots / 'pomodoro-desktop.png'))
    view.locator('#pomoFocusView').click()
    if args.screenshots:
        view.screenshot(path=str(args.screenshots / 'pomodoro-focus.png'))
    view.keyboard.press('Escape')
    if args.screenshots:
        view.set_viewport_size({'width': 390, 'height': 1100})
        view.locator('#pomoSection').screenshot(path=str(args.screenshots / 'pomodoro-mobile.png'))
    for width in [375, 390, 768]:
        view.set_viewport_size({'width': width, 'height': 1100})
        assert view.evaluate('document.documentElement.scrollWidth <= innerWidth')
        view.locator('#pomoPrimary').click()
        expect(view.locator('#pomoPrimary')).to_have_text('暂停一下')
        view.locator('#pomoPrimary').click()
        view.locator('#pomoStop').click()
        view.locator('#pomoConfirmStop').click()
    check('desktop, mobile and tablet layout plus touch-sized UI interactions')
    clean.close()

    # Corrupt records remain intact and do not stop unrelated application startup.
    corrupt = browser.new_context()
    corrupt.route('**/*', route)
    corrupt.add_init_script("window.localStorage.setItem('wb_sidebar_open','0');window.localStorage.setItem('lifeworkbench_pomodoro_mock_v1','{broken')")
    broken = corrupt.new_page()
    broken.on('pageerror', lambda error: errors.append(str(error)))
    broken.goto(MOCK_URL)
    expect(broken.locator('#pomoStorageError')).to_be_visible()
    expect(broken.locator('#pomoPrimary')).to_be_disabled()
    expect(broken.locator('#todoIn')).to_be_enabled()
    assert broken.evaluate('window.localStorage.getItem(' + json.dumps(KEY) + ')') == '{broken'
    check('corrupt timer storage remains untouched; other modules remain available')
    corrupt.close()

    assert not errors, errors
    assert not external, external
    check('zero uncaught JavaScript errors and zero external requests')
    context.close()
    browser.close()
print(f'{len(passed)} functional checks passed', flush=True)
