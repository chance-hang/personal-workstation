/* Synthetic records and two browser origins on a disposable loopback Mock. */
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
const {chromium}=require('playwright');

const origin='http://127.0.0.1:4207',second='http://localhost:4207';
const beforeMidnight='2026-11-17T15:58:00Z',afterMidnight='2026-11-17T16:02:00Z';
const errors=[],external=[];
let server,browser;

async function open(base,width,time){
  const mobile=width<760;
  const context=await browser.newContext({
    viewport:{width,height:900},isMobile:mobile,hasTouch:mobile,timezoneId:'Asia/Shanghai'
  });
  await context.route('**/*',route=>{
    if(new URL(route.request().url()).origin===base)return route.continue();
    external.push(route.request().url());return route.abort();
  });
  const page=await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  await page.clock.install({time:new Date(time)});
  await page.goto(base+'/?mockSync=1');
  await page.waitForFunction(()=>MOCK_SYNC&&syncActive()&&!syncBusy);
  return page;
}

async function editProgress(page,id,value){
  await page.evaluate(id=>openMatter('todo',id),id);
  await page.locator('#matterProgress').fill(String(value));
  await page.locator('#matterSave').click();
}

(async()=>{
  server=spawn(process.execPath,['tools/mock-sync-server.mjs'],{
    env:{...process.env,PORT:'4207',MOCK_PREVIEW_ONLY:'1',MOCK_BIND_HOST:'127.0.0.1'},
    stdio:['ignore','pipe','inherit'],windowsHide:true
  });
  const [ready]=await once(server.stdout,'data',{signal:AbortSignal.timeout(6000)});
  assert.match(String(ready),/LOCAL_MOCK_SERVER_READY/);
  browser=await chromium.launch({executablePath:process.env.QUADRANT_BROWSER});
  const page=await open(origin,390,beforeMidnight);
  await page.evaluate(()=>{
    clearTimeout(syncTimer);S=structuredClone(DEFAULT);
    S.todos=[
      newMatterTodo('计划内推进',todayStr(),{id:'dated',timePlan:{important:true,urgent:false}}),
      newMatterTodo('未排期推进','',{id:'undated'}),
      newMatterTodo('先做远期任务','2026-11-25',{id:'future'}),
      newMatterTodo('旧未完成',todayStr(),{id:'legacy-open'}),
      newMatterTodo('旧已完成','2026-11-16',{id:'legacy-done',done:true,completedAt:'2026-11-16T06:00:00Z'})
    ];
    persist();refreshMatters();
  });
  const task=id=>page.locator('#todoList .matter-row[data-id="'+id+'"]');
  const continued=page.locator('#home-todo-continued-rows');
  assert.deepEqual(await page.evaluate(()=>S.todos.slice(3).map(matterProgressOf)),[0,100]);
  assert.match(await task('legacy-open').innerText(),/0%/);
  assert.equal(await task('legacy-open').locator('.matter-badge').textContent(),'待完成');
  await task('dated').locator('[data-action=edit]').click();
  assert.equal(await page.locator('#matterProgress').inputValue(),'0');
  await page.locator('#matterProgress').fill('101');
  assert.equal(await page.locator('#matterProgress').evaluate(e=>e.validity.rangeOverflow),true);
  await page.locator('#matterProgress').fill('45');
  assert.equal(await page.locator('#matterStatus option:checked').textContent(),'进行中');
  await page.locator('#matterSave').click();
  assert.deepEqual(await task('dated').locator('.matter-badge').allTextContents(),['进行中']);
  await page.evaluate(()=>openMatters('pending'));
  assert.equal(await page.locator('#noteList [data-id=dated] .matter-badge').textContent(),'进行中');
  await page.evaluate(()=>openMatters('completed'));
  assert.equal(await page.locator('#noteList [data-id=dated]').count(),0);
  await page.evaluate(()=>goTab('today'));
  assert.match(await task('dated').innerText(),/45%/);
  await editProgress(page,'undated',60);
  await editProgress(page,'future',20);
  assert.equal(await continued.count(),0);
  assert.equal(await page.locator('#focusTodo').textContent(),'0/2');
  console.log('PASS legacy defaults, range validation, mobile editing, separate daily count');

  await page.clock.fastForward(4*60*1000);
  await page.waitForFunction(()=>todayStr()==='2026-11-18'&&$('#home-todo-continued-rows'));
  assert.equal(await continued.locator('.matter-row').count(),3);
  assert.match(await task('dated').innerText(),/已逾期.*2026-11-17/s);
  assert.deepEqual(await task('dated').locator('.matter-badge').allTextContents(),['进行中','已逾期']);
  assert.match(await task('future').innerText(),/2026-11-25/);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('nav.tabbar [data-p=notes]').click();
  await page.locator('#quadrantTab').click();
  await page.locator('#quadrantScope').selectOption('day');
  assert.equal(await page.locator('#quadrantDay').inputValue(),'2026-11-18');
  const rows=page.locator('#quadrantCells');
  assert.match(await rows.locator('[data-task-id=dated]').first().textContent(),/进行中.*已逾期/s);
  assert.match(await rows.textContent(),/45%/);assert.match(await rows.textContent(),/60%/);assert.match(await rows.textContent(),/20%/);
  assert.equal(await page.evaluate(()=>S.todos.length),5);
  console.log('PASS local midnight updates home and date board, without copying tasks or changing due dates');

  await page.evaluate(async()=>{clearTimeout(syncTimer);await cloudPush()});
  const desktop=await open(second,1440,afterMidnight);
  assert.equal(await desktop.locator('#home-todo-continued-rows .matter-row').count(),3);
  const backup=await desktop.evaluate(()=>JSON.parse(stateJson()));
  assert.equal(backup.todos.find(task=>task.id==='dated').completionProgress,45);
  assert.equal(backup.todos.find(task=>task.id==='undated').progressStartedOn,'2026-11-17');
  await page.reload();await page.waitForFunction(()=>!syncBusy);
  await page.evaluate(()=>goTab('today'));
  assert.match(await task('dated').innerText(),/45%/);
  await editProgress(page,'dated',100);
  assert.match(await task('dated').innerText(),/100%/);
  assert.deepEqual(await task('dated').locator('.matter-badge').allTextContents(),['已完成']);
  assert.equal(await continued.locator('[data-id=dated]').count(),0);
  assert.equal(await page.evaluate(()=>todoCompletedDay(S.todos.find(task=>task.id==='dated'))),'2026-11-18');
  await task('dated').locator('[data-action=toggle]').click();
  assert.match(await continued.locator('[data-id=dated]').innerText(),/45%/);
  await page.evaluate(()=>openMatter('todo','dated'));
  await page.locator('#matterStatus').selectOption('done');
  assert.equal(await page.locator('#matterProgress').inputValue(),'100');
  await page.locator('#matterSave').click();
  assert.match(await task('dated').innerText(),/100%/);
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  console.log('PASS Mock sync, JSON, reload, 100% completion and reopening to last partial progress');
})().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{await browser?.close();server?.kill()});
