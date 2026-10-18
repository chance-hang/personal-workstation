"""Touch-device emulation for the offline review app; this is not a real Safari test."""
from datetime import datetime, timezone
from pathlib import Path
import argparse
import subprocess
import sys
import tempfile
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--screenshots', type=Path)
args = parser.parse_args()
if args.screenshots:
    args.screenshots.mkdir(parents=True, exist_ok=True)

with tempfile.TemporaryDirectory(prefix='pomo-mobile-') as tmp:
    preview, devices_html = Path(tmp) / 'app.html', Path(tmp) / 'devices.html'
    build = [sys.executable, str(ROOT / 'tools/build-review-preview.py')]
    subprocess.run(build + ['--output', str(preview)], check=True)
    subprocess.run(build + ['--device-preview', '--output', str(devices_html)], check=True)
    html = preview.read_text()
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True)
        errors, unexpected = [], []
        device_names = ['iPhone SE', 'iPhone 13', 'iPhone 14 Pro Max', 'Pixel 7', 'iPad Mini']
        url = 'https://mobile-review.example.test/'

        def route_document(route):
            if route.request.url == url:
                route.fulfill(status=200, content_type='text/html; charset=utf-8', body=html)
            else:
                unexpected.append(route.request.url)
                route.abort()

        for name in device_names:
            device = p.devices[name]
            context = browser.new_context(**device, locale='zh-CN', timezone_id='Asia/Shanghai')
            context.route('**/*', route_document)
            page = context.new_page()
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.clock.install(time=datetime(2026, 10, 18, 9, tzinfo=timezone.utc))
            page.goto(url)
            page.wait_for_function('syncActive() && !syncBusy')
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), name
            assert 'user-scalable=no' not in page.locator('meta[name="viewport"]').get_attribute('content')
            for selector in ['#pomoPrimary', '#pomoFocusView', '[data-pomo-mode="focus"]']:
                assert page.locator(selector).bounding_box()['height'] >= 44, (name, selector)
            for selector in ['#pomoTask', '#pomoTodo', '#pomoFocusMinutes']:
                assert page.locator(selector).evaluate('el=>parseFloat(getComputedStyle(el).fontSize)') >= 16, (name, selector)

            title = '手机上的专注任务：整理本周计划'
            page.locator('#pomoTask').fill(title)
            # Reload before blur: input must already be saved.
            page.reload()
            page.wait_for_function('syncActive() && !syncBusy')
            expect(page.locator('#pomoTask')).to_have_value(title)
            page.locator('#pomoPrimary').tap()
            page.clock.fast_forward(1000)
            expect(page.locator('#pomoTime')).to_have_text('24:59')
            page.locator('#tabbar [data-p="notes"]').tap()
            if device['viewport']['width'] < 760:
                expect(page.locator('#pomoMini')).to_be_visible()
                assert page.locator('#pomoMini').bounding_box()['y'] + page.locator('#pomoMini').bounding_box()['height'] <= page.locator('#tabbar').bounding_box()['y']
                page.locator('#pomoMiniToggle').tap()
                expect(page.locator('#pomoMiniToggle')).to_have_text('继续')
                before = page.locator('#pomoMiniTime').inner_text()
                page.clock.fast_forward(60000)
                expect(page.locator('#pomoMiniTime')).to_have_text(before)
                page.locator('#pomoMiniToggle').tap()
                if name == 'iPhone 13' and args.screenshots:
                    page.screenshot(path=str(args.screenshots / 'mobile-floating-timer.png'))
                page.locator('#pomoMiniOpen').tap()
            else:
                expect(page.locator('#pomoMini')).to_be_hidden()
                page.locator('#tabbar [data-p="today"]').tap()

            page.locator('#pomoFocusView').tap()
            expect(page.locator('#pomoMini')).to_be_hidden()
            assert page.locator('#page-today').evaluate("el=>getComputedStyle(el).animationName") == 'none'
            assert page.locator('#pomoSection').evaluate("el=>getComputedStyle(el).backgroundColor") == 'rgb(245, 245, 243)'
            if device['viewport']['width'] < 600:
                expect(page.locator('#pomoTodo')).to_be_hidden()
                controls = page.locator('#pomoPrimary').bounding_box()
                assert controls['y'] >= 0 and controls['y'] + controls['height'] <= page.evaluate('visualViewport.height'), (name, controls)
            if name == 'iPhone 13' and args.screenshots:
                page.screenshot(path=str(args.screenshots / 'mobile-focus.png'))

            page.locator('#pomoStop').tap()
            expect(page.locator('#pomoMini')).to_be_hidden()
            page.locator('#pomoStopNote').fill('手机输入小结，按钮需要保持可操作。')
            # Emulate the visual viewport resize reported by a soft keyboard.
            page.evaluate("""() => {
              Object.defineProperty(visualViewport,'height',{configurable:true,value:280});
              visualViewport.dispatchEvent(new Event('resize'));
            }""")
            page.wait_for_function("parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pomo-viewport-height')) === 280")
            dialog = page.locator('#modalBox').bounding_box()
            assert dialog['y'] >= 0 and dialog['y'] + dialog['height'] <= 281, (name, dialog)
            page.locator('#pomoConfirmStop').tap()
            page.evaluate("delete visualViewport.height;visualViewport.dispatchEvent(new Event('resize'))")
            expected_y = page.evaluate('pomoFocusReturnY')
            page.locator('#pomoFocusView').tap()
            assert abs(page.evaluate('scrollY') - expected_y) < 3, (name, expected_y, page.evaluate('scrollY'))

            page.locator('[data-pomo-record]').tap()
            assert page.locator('#pomoSummary').evaluate('el=>parseFloat(getComputedStyle(el).fontSize)') >= 16
            page.locator('#pomoSummary').fill('补充小结也能正常保存。')
            page.locator('#pomoSaveSummary').tap()
            page.locator('#pomoSettings summary').tap()
            page.locator('#pomoFocusMinutes').fill('1')
            page.locator('#pomoSettingsSave').tap()
            page.locator('#pomoPrimary').tap()
            # Simulate suspension by moving wall time without firing timer callbacks.
            page.clock.set_system_time(datetime.fromtimestamp((page.evaluate('Date.now()') + 120000) / 1000, tz=timezone.utc))
            page.evaluate("document.dispatchEvent(new Event('visibilitychange'))")
            expect(page.locator('#pomoCount')).to_have_text('1')
            assert page.evaluate('pomoState.timer === null')
            if device['viewport']['width'] < 760:
                page.set_viewport_size({'width': 844, 'height': 390})
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
                page.locator('#pomoFocusView').tap()
                page.locator('#pomoSection').evaluate('el=>el.scrollTop=200')
                exit_button = page.locator('#pomoFocusView').bounding_box()
                assert exit_button['y'] >= 0 and exit_button['y'] + exit_button['height'] < 390
                if name == 'iPhone 13' and args.screenshots:
                    page.screenshot(path=str(args.screenshots / 'mobile-landscape.png'))
                page.locator('#pomoFocusView').tap()
            print(f'PASS {name}: {device["viewport"]}, touch targets, input, drafts, timer, dialogs, focus and return from suspension', flush=True)
            context.close()

        # Verify that the desktop device selector changes the actual iframe viewport
        # without restarting or resetting the current focus session.
        context = browser.new_context(viewport={'width': 1440, 'height': 1050})
        context.route('**/*', lambda route: (unexpected.append(route.request.url), route.abort())[-1])
        host = context.new_page()
        host.on('pageerror', lambda error: errors.append(str(error)))
        host.set_content(devices_html.read_text(), wait_until='load')
        frame = host.frame_locator('#reviewDevice')
        frame.locator('#pomoPrimary').click()
        timer_id = frame.locator('body').evaluate('()=>pomoState.timer.id')
        device_frame = host.locator('#reviewDevice').element_handle().content_frame()
        for width in ['320', '844', '768', 'full', '390']:
            host.locator('[data-width="' + width + '"]').click()
            device_frame.wait_for_function("width=>width==='full'?innerWidth>1000:innerWidth===Number(width)", arg=width)
            frame_width = frame.locator('body').evaluate('()=>innerWidth')
            assert (frame_width == int(width) if width != 'full' else frame_width > 1000), (width, frame_width)
            assert frame.locator('body').evaluate('()=>pomoState.timer.id') == timer_id
        if args.screenshots:
            host.screenshot(path=str(args.screenshots / 'mobile-preview-on-desktop.png'))
        print('PASS desktop interactive phone/small-screen/landscape/tablet selector preserves timer state', flush=True)
        assert not errors, errors
        assert not unexpected, unexpected
        print('PASS no external requests or uncaught JavaScript errors; Chromium emulation only, no real-device claim', flush=True)
        context.close()
        browser.close()
