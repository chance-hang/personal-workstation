/* List pagination acceptance with disposable browser profiles and a dedicated loopback server. */
const assert=require('node:assert/strict');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
const {chromium}=require('playwright');

const origin='http://127.0.0.1:4195';
const output=process.env.MATTERS_PAGINATION_OUTPUT;
const errors=[],external=[];
let server,browser,checks=0;
const pass=label=>console.log('PASS '+(++checks)+' '+label);

async function makePage(width,mobile=false){
  const context=await browser.newContext({viewport:{width,height:mobile?950:1000},timezoneId:'Asia/Shanghai',isMobile:mobile,hasTouch:mobile});
  await context.route('**/*',route=>{
    const url=route.request().url();
    if(new URL(url).origin===origin)return route.continue();
    external.push(url);return route.abort();
  });
  await context.addInitScript(()=>{if(location.protocol==='http:')localStorage.setItem('wb_sidebar_open','0')});
  const page=await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  await page.clock.install({time:new Date('2026-11-17T03:00:00Z')});
  await page.goto(origin+'/?mockSync=1');
  await page.waitForFunction(()=>MOCK_SYNC&&syncActive()&&!syncBusy);
  await page.evaluate(()=>{
    sessionPasscode=null;clearTimeout(syncTimer);S=structuredClone(DEFAULT);
    const day=todayStr();
    S.todos=[
      ...Array.from({length:13},(_,i)=>newMatterTodo((i<11?'筛选待办 ':'今日待办 ')+i,day,{id:'open-'+i})),
      ...Array.from({length:2},(_,i)=>newMatterTodo('将来待办 '+i,'2026-11-19',{id:'future-'+i})),
      ...Array.from({length:18},(_,i)=>newMatterTodo('已完成事项 '+i,day,{
        id:'done-'+i,done:true,completedAt:(i<13?day:'2026-11-16')+'T02:00:00Z'
      }))
    ];
    S.notes=[
      ...Array.from({length:12},(_,i)=>({
        id:'memo-open-'+i,title:'未归档备忘 '+i,content:'未归档原始正文 '+i,createdAt:'2026-11-15T02:00:00Z',updatedAt:'2026-11-15T02:00:00Z',done:false
      })),
      ...Array.from({length:14},(_,i)=>({
        id:'memo-archived-'+i,title:'已归档备忘 '+i,content:(i===13?'跨页专属关键词':'已归档原始正文 '+i),createdAt:'2026-11-16T02:00:00Z',updatedAt:'2026-11-16T02:00:00Z',done:true
      }))
    ];
    S.todos[0].sourceNoteId='memo-open-0';
    renderAll();
  });
  await page.locator('nav.tabbar a[data-p="notes"]').click();
  return page;
}

(async()=>{
  server=spawn(process.execPath,['tools/mock-sync-server.mjs'],{
    env:{...process.env,PORT:'4195',MOCK_PREVIEW_ONLY:'1',MOCK_BIND_HOST:'127.0.0.1'},stdio:['ignore','pipe','inherit'],windowsHide:true
  });
  await Promise.race([
    once(server.stdout,'data',{signal:AbortSignal.timeout(6000)}).then(([data])=>assert.match(String(data),/LOCAL_MOCK_SERVER_READY/)),
    once(server,'exit').then(([code])=>{throw new Error('Dedicated pagination server exited '+code)})
  ]);
  browser=await chromium.launch({headless:true,executablePath:process.env.QUADRANT_BROWSER});
  const p=await makePage(1440);
  const rows=p.locator('#noteList .matter-row'),tab=key=>p.locator('#matterViews [data-view="'+key+'"]');
  const next=p.locator('#matterNextPage'),prev=p.locator('#matterPrevPage'),status=p.locator('#matterPageStatus');
  assert.equal(await p.locator('#matterViews button').first().getAttribute('data-view'),'pending');
  assert.equal(await tab('pending').getAttribute('aria-pressed'),'true');
  assert.equal(await rows.count(),10);
  assert(await prev.isDisabled());
  const initialIds=await rows.evaluateAll(els=>els.map(el=>el.dataset.id));
  await next.click();
  assert.equal(await status.innerText(),'第 2 / 2 页 · 11–15 条');
  assert.equal(await rows.count(),5);
  assert(await rows.evaluateAll((els,ids)=>els.every(el=>!ids.includes(el.dataset.id)),initialIds));
  assert(await next.isDisabled());
  assert(await p.locator('#matterResult').evaluate(el=>document.activeElement===el));
  await prev.click();
  assert.deepEqual(await rows.evaluateAll(els=>els.map(el=>el.dataset.id)),initialIds);
  pass('default pending view is first, displays ten rows per page and paginates without repeats');

  const result=p.locator('#matterResult');
  for(const [key,total,pages] of [['today',26,3],['completed',18,2],['all',58,6]]){
    await tab(key).click();
    assert((await result.innerText()).endsWith(total+' 条'));
    assert.equal(await rows.count(),10);
    assert.equal(await status.innerText(),'第 1 / '+pages+' 页 · 1–10 条');
  }
  assert.equal(await rows.filter({has:p.locator('[aria-pressed="true"]')}).count(),0);
  assert.equal(await p.locator('#noteList [data-id="memo-open-0"]').count(),0);
  pass('today, completed and all views paginate their original result sets; unfinished remains first in all');

  await tab('notes').click();
  assert((await result.innerText()).endsWith('26 条'));
  assert(await p.locator('#noteList [data-id="memo-open-0"]').isVisible());
  assert.equal(await rows.filter({hasText:'未归档原始正文'}).count(),10);
  await next.click();
  assert.deepEqual(await p.locator('#noteList h3').allTextContents(),['未归档2 条','已归档8 条']);
  assert.equal(await status.innerText(),'第 2 / 3 页 · 11–20 条');
  if(output){
    await p.locator('#matterPagination').scrollIntoViewIfNeeded();
    await p.screenshot({path:path.join(output,'matters-notes-desktop.png'),animations:'disabled'});
  }
  await next.click();
  assert.equal(await rows.count(),6);
  await p.locator('#matterSearch').fill('跨页专属关键词');
  assert.equal(await rows.count(),1);
  assert(await p.locator('#noteList [data-id="memo-archived-13"]').isVisible());
  assert(!(await p.locator('#matterPagination').isVisible()));
  await p.locator('#matterSearch').fill('');
  assert.equal(await status.innerText(),'第 1 / 3 页 · 1–10 条');
  await next.click();
  assert.equal(await p.locator('.matter-filters').evaluate(el=>el.open),true);
  await p.locator('#matterDateBy').selectOption('created');
  await p.locator('#matterFrom').fill('2026-11-16');
  assert.equal(await status.innerText(),'第 1 / 2 页 · 1–10 条');
  assert.equal(await p.locator('#noteList h3').first().innerText(),'已归档\n10 条');
  await p.locator('#matterTo').fill('2026-11-15');
  assert(!(await p.locator('#matterPagination').isVisible()));
  await p.locator('#matterReset').click();
  assert.equal(await status.innerText(),'第 1 / 3 页 · 1–10 条');
  pass('unarchived memos precede archived, keyword and date search cover all results and reset the page');

  await tab('pending').click();
  await p.locator('#matterSearch').fill('筛选待办');
  await next.click();
  assert.equal(await rows.count(),1);
  await rows.locator('.matter-check').click();
  assert.equal(await rows.count(),10);
  assert(!(await p.locator('#matterPagination').isVisible()));
  await p.locator('#matterSearch').fill('');
  await p.locator('#memoIn').fill('本次分页新建的备忘');
  await p.locator('#noteAdd').click();
  assert.equal(await tab('notes').getAttribute('aria-pressed'),'true');
  assert(await rows.getByText('本次分页新建的备忘',{exact:true}).first().isVisible());
  pass('finishing the last row on a page clamps the list; a new memo is shown in its result page');
  await p.context().close();

  for(const width of [320,390]){
    const m=await makePage(width,true);
    await m.locator('#matterViews [data-view="notes"]').tap();
    const footer=m.locator('#matterPagination');
    const layout=await footer.evaluate(el=>{
      const box=el.getBoundingClientRect();
      const buttons=[...el.querySelectorAll('button')];
      return {fits:box.right<=innerWidth&&el.scrollWidth<=el.clientWidth,
        touch:buttons.every(button=>button.getBoundingClientRect().height>=44),
        scroll:document.documentElement.scrollWidth<=innerWidth+1};
    });
    assert(Object.values(layout).every(Boolean),JSON.stringify(layout));
    await m.locator('#matterNextPage').tap();
    assert.equal(await m.locator('#matterPageStatus').innerText(),'第 2 / 3 页 · 11–20 条');
    if(output&&width===390){
      await footer.scrollIntoViewIfNeeded();
      await m.screenshot({path:path.join(output,'matters-notes-mobile.png'),animations:'disabled'});
    }
    await m.locator('#matterPrevPage').tap();
    assert.equal(await m.locator('#matterPageStatus').innerText(),'第 1 / 3 页 · 1–10 条');
    await m.context().close();
    pass(width+'px touch: page controls fit and operate in both directions');
  }
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  pass('no browser errors or external requests');
})().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{if(browser)await browser.close();server?.kill()});
