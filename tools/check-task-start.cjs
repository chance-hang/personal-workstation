/* Task scheduling and historical progress with synthetic data in a disposable Mock. */
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
const {chromium}=require('playwright');

const origin='http://127.0.0.1:4209',remote='http://localhost:4209';
const errors=[],foreign=[];
let browser,server;
const pass=label=>console.log('PASS '+label);

async function pageAt(base,width,time){
  const mobile=width<760;
  const context=await browser.newContext({
    viewport:{width,height:950},isMobile:mobile,hasTouch:mobile,timezoneId:'Asia/Shanghai'
  });
  await context.route('**/*',route=>{
    if(new URL(route.request().url()).origin===base)return route.continue();
    foreign.push(route.request().url());return route.abort();
  });
  const page=await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  await page.clock.install({time:new Date(time)});
  await page.goto(base+'/?mockSync=1');
  await page.waitForFunction(()=>MOCK_SYNC&&syncActive()&&!syncBusy);
  return page;
}
async function changeDay(page,day){
  await page.locator('#quadrantDay').fill(day);
  await page.locator('#quadrantDay').dispatchEvent('change');
}
async function progress(page,id,value){
  await page.evaluate(id=>openMatter('todo',id),id);
  await page.locator('#matterProgress').fill(String(value));
  await page.locator('#matterSave').click();
}
async function push(page){
  await page.waitForFunction(()=>!syncBusy);
  await page.evaluate(async()=>{clearTimeout(syncTimer);await cloudPush()});
}
async function pull(page){
  await page.waitForFunction(()=>!syncBusy);
  await page.evaluate(async()=>{clearTimeout(syncTimer);await cloudPull()});
}

(async()=>{
  server=spawn(process.execPath,['tools/mock-sync-server.mjs'],{
    env:{...process.env,PORT:'4209',MOCK_PREVIEW_ONLY:'1',MOCK_BIND_HOST:'127.0.0.1'},
    stdio:['ignore','pipe','inherit'],windowsHide:true
  });
  const [ready]=await once(server.stdout,'data',{signal:AbortSignal.timeout(6000)});
  assert.match(String(ready),/LOCAL_MOCK_SERVER_READY/);
  browser=await chromium.launch({executablePath:process.env.QUADRANT_BROWSER});
  const p=await pageAt(origin,1440,'2026-11-18T03:00:00Z');
  await p.evaluate(()=>{clearTimeout(syncTimer);S=structuredClone(DEFAULT);save();renderAll()});
  assert.equal(await p.locator('#todoStartDate').inputValue(),'2026-11-18');
  await p.locator('#todoIn').fill('今天开始明天完成');
  await p.locator('#todoDueDate').fill('2026-11-19');
  await p.locator('#todoCategory').selectOption('work');
  await p.locator('#todoAdd').click();
  const id=await p.evaluate(()=>S.todos[0].id);
  const row=p.locator('#todoList [data-id="'+id+'"]');
  assert(await row.isVisible());
  assert.match(await row.innerText(),/待开始/);
  assert.match(await row.innerText(),/开始：2026-11-18/);
  await row.locator('[data-action=start]').click();
  assert.match(await row.innerText(),/进行中/);
  assert.match(await row.innerText(),/0%/);
  await progress(p,id,40);
  await p.locator('nav.tabbar [data-p=notes]').click();
  await p.locator('#quadrantTab').click();
  assert.equal(await p.locator('#quadrantScope').inputValue(),'day');
  await p.locator('#quadrantCategory').selectOption('work');
  assert.match(await p.locator('#quadrantCells').textContent(),/今天开始明天完成/);
  await changeDay(p,'2026-11-17');
  assert.doesNotMatch(await p.locator('#quadrantCells').textContent(),/今天开始明天完成/);
  await changeDay(p,'2026-11-18');
  assert.match(await p.locator('#quadrantCells').textContent(),/40%/);
  const firstDay=await p.evaluate(id=>S.todos.find(task=>task.id===id).progressHistory,id);
  pass('planned start is independent from due date; manual start supports 0%, category and date filters');

  await p.evaluate(()=>{
    const old={id:'legacy',text:'旧任务',done:false,dueAt:'2026-11-18',createdAt:'2026-11-17T03:00:00Z'};
    S.todos.push(old,newMatterTodo('未来开始','2026-11-25',{id:'future',plannedStart:'2026-11-23'}));
    persist();refreshMatters();
  });
  await p.locator('#quadrantCategory').selectOption('all');
  assert.equal(await p.evaluate(()=>Object.hasOwn(S.todos.find(task=>task.id==='legacy'),'plannedStart')),false);
  assert.match(await p.locator('#quadrantCells').textContent(),/旧任务/);
  assert.doesNotMatch(await p.locator('#quadrantCells').textContent(),/未来开始/);
  await p.evaluate(id=>openMatter('todo',id),id);
  await p.locator('#matterStartDate').fill('2026-11-20');
  await p.locator('#matterSave').click();
  assert.match(await p.locator('#matterEditError').textContent(),/不能早于/);
  await p.locator('#matterStartDate').fill('2026-11-18');
  await p.locator('#matterSave').click();
  await push(p);

  await p.clock.setSystemTime(new Date('2026-11-20T03:00:00Z'));
  await p.evaluate(()=>renderAll());
  await p.evaluate(()=>goTab('today'));
  assert.match(await row.innerText(),/进行中/);
  assert.match(await row.innerText(),/超出计划 1 天/);
  assert.doesNotMatch(await row.innerText(),/已逾期/);
  await progress(p,id,70);
  await p.evaluate(()=>{openMatters('pending');setTimeQuadrantView(true)});
  await changeDay(p,'2026-11-18');
  let board=p.locator('#quadrantCells');
  assert.match(await board.textContent(),/40%/);
  assert.doesNotMatch(await board.textContent(),/70%/);
  await changeDay(p,'2026-11-20');
  assert.match(await board.textContent(),/70%/);
  await push(p);
  pass('date validation, untouched legacy records, ongoing carryover and historical 40% after today changes to 70%');

  const b=await pageAt(remote,390,'2026-11-20T03:00:00Z');
  assert.equal(await b.evaluate(id=>S.todos.find(task=>task.id===id).completionProgress,id),70);
  const actual=await b.evaluate(id=>S.todos.find(task=>task.id===id).actualStartedAt,id);
  await b.evaluate(id=>openMatter('todo',id),id);
  // A concurrent update replaces the record while this form stays open.
  await progress(p,id,75);
  await push(p);
  await pull(b);
  await b.locator('#matterCompletionNote').fill('手机补充说明');
  await b.locator('#matterSave').click();
  assert.equal(await b.evaluate(id=>S.todos.find(task=>task.id===id).completionProgress,id),75);
  assert.equal(await b.evaluate(id=>S.todos.find(task=>task.id===id).actualStartedAt,id),actual);
  await push(b);await pull(p);
  await progress(p,id,100);
  await push(p);await pull(b);
  assert.equal(await b.evaluate(id=>matterState(S.todos.find(task=>task.id===id)),id),'已完成');
  const current=await b.evaluate(id=>S.todos.find(task=>task.id===id),id);
  assert(firstDay.every(event=>current.progressHistory.some(saved=>saved.id===event.id)));
  assert(current.progressHistory.some(event=>event.progress===75));
  assert.equal(current.plannedStart,'2026-11-18');
  assert.equal(current.dueAt,'2026-11-19');
  await p.reload();await p.waitForFunction(()=>!syncBusy);
  await p.evaluate(()=>{openMatters('pending');setTimeQuadrantView(true)});
  await changeDay(p,'2026-11-18');
  assert.match(await board.textContent(),/40%/);
  assert.match(await board.textContent(),/进行中/);
  assert.equal(await board.locator('[data-task-id="'+id+'"] .matter-check').first().getAttribute('aria-pressed'),'false');
  const report=await p.evaluate(()=>timeReport('2026-11-18','2026-11-20'));
  assert.match(report,/计划开始/);assert.match(report,/进度变更/);assert.match(report,/40/);assert.match(report,/75/);
  await p.evaluate(()=>$('#exportBtn').click());
  const [download]=await Promise.all([p.waitForEvent('download'),p.locator('#expDl').click()]);
  const backup=JSON.parse(await fs.readFile(await download.path(),'utf8'));
  assert.equal(backup.todos.find(task=>task.id===id).progressHistory.length,current.progressHistory.length);
  await p.evaluate(()=>openImportPaste());
  await p.locator('#ipText').fill(JSON.stringify(backup));
  await p.locator('#ipGo').click();await p.locator('#impOk').click();
  assert.deepEqual(await p.evaluate(id=>S.todos.find(task=>task.id===id),id),backup.todos.find(task=>task.id===id));
  pass('two-origin sync preserves history, form saves preserve incoming progress, completed tasks retain historical state and export');

  for(const width of [320,390,768]){
    const mobile=await pageAt(origin,width,'2026-11-20T03:00:00Z');
    const fits=async selectors=>assert(await mobile.evaluate(selectors=>selectors.every(selector=>{
      const r=$(selector).getBoundingClientRect();
      return r.width>0&&r.height>=44&&r.left>=0&&r.right<=innerWidth;
    })&&document.documentElement.scrollWidth<=innerWidth,selectors),'layout at '+width);
    await fits(['#todoStartDate','#todoDueDate','#todoCategory']);
    await mobile.locator('nav.tabbar [data-p=notes]').click();
    await mobile.locator('#matterCaptureKind').selectOption('todo');
    await fits(['#matterCaptureStart','#matterCaptureDate','#matterCaptureTime','#noteAdd']);
    await mobile.locator('#memoIn').fill('手机开始测试');
    await mobile.locator('#matterCaptureStart').fill('2026-11-20');
    await mobile.locator('#matterCaptureDate').fill('2026-11-21');
    await mobile.locator('#noteAdd').click();
    const created=await mobile.evaluate(()=>S.todos.find(task=>task.text==='手机开始测试'));
    assert.equal(created.plannedStart,'2026-11-20');
    await mobile.evaluate(id=>openMatter('todo',id),created.id);
    await fits(['#matterStartDate','#matterDueDate','#matterProgress']);
    if(process.env.TASK_START_OUTPUT&&width===390){
      await fs.mkdir(process.env.TASK_START_OUTPUT,{recursive:true});
      await mobile.screenshot({path:path.join(process.env.TASK_START_OUTPUT,'task-start-mobile.png'),animations:'disabled'});
    }
    await mobile.context().close();
  }
  assert.deepEqual(errors,[]);assert.deepEqual(foreign,[]);
  pass('320 / 390 / 768px capture and editor, zero browser errors or external requests');
})().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{await browser?.close();server?.kill()});
