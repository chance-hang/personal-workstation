"""Verify the actual single-file deliverable without a server or adjacent assets."""
from datetime import datetime, timezone
from pathlib import Path
import argparse
import subprocess
import sys
import tempfile
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--screenshot', type=Path)
args = parser.parse_args()

with tempfile.TemporaryDirectory(prefix='pomodoro-preview-') as tmp:
    preview = Path(tmp) / 'review.html'
    subprocess.run([sys.executable, str(ROOT / 'tools/build-review-preview.py'), '--output', str(preview)], check=True)
    html = preview.read_text()
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True)
        errors, requests = [], []
        context = browser.new_context(viewport={'width': 1440, 'height': 1100})

        def deny_network(route):
            requests.append(route.request.url)
            route.abort()

        context.route('**/*', deny_network)
        page = context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.clock.install(time=datetime(2026, 10, 18, 9, tzinfo=timezone.utc))
        # About:blank has no base directory and denies localStorage. This reproduces
        # an isolated HTML viewer, instead of relying on the working HTTP server.
        page.set_content(html, wait_until='load')
        page.wait_for_function('syncActive() && !syncBusy')
        assert page.evaluate('MOCK_SYNC === true')
        assert page.evaluate("currentProfile().name === '本地 Mock 验收库'")
        assert page.locator('script[src], link[rel="stylesheet"]').count() == 0
        assert page.locator('#tabbar svg').first.bounding_box()['width'] < 30
        assert page.locator('body').evaluate("el=>getComputedStyle(el).backgroundColor") == 'rgb(245, 245, 243)'
        expect(page.locator('#offlinePersistenceNote')).to_contain_text('关闭后数据会丢失')
        expect(page.locator('#pomoTime')).to_have_text('25:00')
        print('PASS isolated single-HTML rendering: styles, icons, scripts and storage fallback', flush=True)

        page.locator('#pomoTask').fill('检查可直接打开的待验收网页')
        page.locator('#pomoPrimary').click()
        page.clock.fast_forward(60000)
        expect(page.locator('#pomoTime')).to_have_text('24:00')
        page.locator('#pomoPrimary').click()
        page.clock.fast_forward(60000)
        expect(page.locator('#pomoTime')).to_have_text('24:00')
        page.locator('#pomoPrimary').click()
        page.clock.fast_forward(24 * 60000 + 1000)
        expect(page.locator('#pomoCount')).to_have_text('1')
        expect(page.locator('#pomoPrimary')).to_have_text('开始短休息')
        page.locator('[data-pomo-record]').click()
        page.locator('#pomoSummary').fill('单文件预览计时与小结可用。')
        page.locator('#pomoWriteLog').check()
        page.locator('#pomoSaveSummary').click()
        expect(page.locator('#wlList')).to_contain_text('单文件预览计时与小结可用。')
        page.wait_for_function('!syncBusy')
        page.evaluate('async () => { clearTimeout(syncTimer); await cloudPush(); }')
        assert page.evaluate("async () => { const d=await (await fetch('/__mock_gists/local-mock')).json(); return !!d.files['data.json'].content; }")
        assert page.evaluate("async () => { try { await fetch('https://api.github.com/gists'); return false; } catch(e) { return true; } }")
        assert page.evaluate("_LS_NS === 'review_pomodoro_offline_' && IDB_NAME === 'review_pomodoro_offline_mirror_v1'")
        print('PASS interactive timer, pause, completion, summary and in-page Mock sync; external fetch blocked', flush=True)

        for width in [390, 1440]:
            page.set_viewport_size({'width': width, 'height': 1100})
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        page.locator('[data-pomo-mode="focus"]').click()
        page.locator('#pomoFocusView').click()
        page.keyboard.press('Escape')
        if args.screenshot:
            args.screenshot.parent.mkdir(parents=True, exist_ok=True)
            page.locator('#pomoSection').screenshot(path=str(args.screenshot))
        print('PASS single-file desktop/mobile layout and focus mode', flush=True)
        context.close()

        # Exercise persistence and reload on an isolated origin as well. Cloud
        # Chromium blocks file: navigation by policy; fulfill this document from
        # memory so no server or neighboring resource files can mask a failure.
        files = browser.new_context(viewport={'width': 390, 'height': 1100})
        document_url = 'https://offline-review.example.test/'
        files.route('**/*', lambda route: route.fulfill(status=200, content_type='text/html; charset=utf-8', body=html)
                    if route.request.url == document_url else deny_network(route))
        file_page = files.new_page()
        file_page.on('pageerror', lambda error: errors.append(str(error)))
        file_page.goto(document_url)
        file_page.wait_for_function('syncActive() && !syncBusy')
        file_page.evaluate("window.localStorage.setItem('lifeworkbench_v1', 'production-sentinel')")
        file_page.locator('#pomoTask').fill('打开文件也能正常计时')
        file_page.locator('#pomoPrimary').click()
        file_page.reload()
        expect(file_page.locator('#pomoPrimary')).to_have_text('暂停一下')
        assert file_page.evaluate("window.localStorage.getItem('lifeworkbench_v1')") == 'production-sentinel'
        assert file_page.evaluate("window.localStorage.getItem('review_pomodoro_offline_lifeworkbench_pomodoro_mock_v1') !== null")
        print('PASS standalone document load, refresh recovery and production-storage isolation', flush=True)
        files.close()
        assert not errors, errors
        assert not requests, requests
        print('PASS zero external network requests and zero uncaught script errors', flush=True)
        browser.close()
