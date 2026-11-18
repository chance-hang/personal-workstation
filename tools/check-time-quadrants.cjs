/* Automated acceptance uses an empty, dedicated Mock on port 4188 and disposable browser contexts. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync,spawn}=require('node:child_process');
const {once}=require('node:events');
const {chromium}=require('playwright');

const first='http://127.0.0.1:4188';
const second='http://localhost:4188';
const view='/?mockSync=1#time-quadrants';
const today='2026-11-16';
const yesterday='2026-11-15';
const oldId='quadrant-old-task';
const testTitle='核对项目交付清单';
const envOutput=process.env.QUADRANT_UI_OUTPUT;
let browser,server;
let checks=0;
const pass=label=>console.log('PASS '+(++checks)+' '+label);

function assertProtectedSource(){
  const baseline=execFileSync('git',['show','5274403c37fb293ffdd1791b4d7a737eb949735d:app.js'],{encoding:'utf8'}).replace(/\r\n/g,'\n');
  const source=fs.readFileSync('app.js','utf8').replace(/\r\n/g,'\n');
  const fromTo=(text,from,to)=>text.slice(text.indexOf(from),to?text.indexOf(to,text.indexOf(from)):undefined);
  const protectedAreas=[
    ['const _realLS = window.localStorage;','/* ============ 工具函数'],
    ['let S=load();','/* ============ 弹窗 ============ */'],
    ['const SYNC_KEY=','function noteUpdatedAt('],
    ['async function cloudPull(','function renderChangelog('],
    ["$('#exportBtn').onclick",'function mergeData(d)'],
    ['const POMO_KEY=','initFilters();\nrenderAll();'],
    ['/* 云同步初始化 */',null]
  ];
  for(const [from,to] of protectedAreas){
    assert(source.includes(from)&&baseline.includes(from));
    assert.equal(fromTo(source,from,to),fromTo(baseline,from,to),from);
  }
  pass('存储命名空间、保存与镜像、Gist/加密/登录、备份入口、番茄逻辑和云初始化代码一致');
}

const errors=[],external=[];
async function newPage(origin,settings={}){
  const context=await browser.newContext({timezoneId:'Asia/Shanghai',acceptDownloads:true,...settings});
  await context.route('**/*',route=>{
    const url=route.request().url();
    if(new URL(url).origin===origin)return route.continue();
    external.push(url);return route.abort();
  });
  const page=await context.newPage();
  page.setDefaultTimeout(8000);
  page.on('pageerror',error=>errors.push(error.message));
  await page.clock.install({time:new Date(today+'T03:00:00Z')});
  return page;
}
async function ready(page,url){
  await page.goto(url);
  await page.waitForFunction(()=>MOCK_SYNC&&syncActive()&&!syncBusy);
  assert(await page.locator('#reviewEnvNotice').isVisible());
}
async function assertCenteredAxes(page){
  const geometry=await page.evaluate(()=>{
    const rect=selector=>document.querySelector(selector).getBoundingClientRect();
    const cards=['2','1','4','3'].map(key=>rect('.quadrant-card[data-quadrant="'+key+'"]'));
    const x=rect('.quadrant-axis-x'),y=rect('.quadrant-axis-y');
    const lineStyle=axis=>getComputedStyle(document.querySelector('.quadrant-axis-'+axis),'::before');
    const arrowStyle=axis=>getComputedStyle(document.querySelector('.quadrant-axis-'+axis+' path'));
    const lineX=lineStyle('x'),lineY=lineStyle('y');
    const arrowX=rect('.quadrant-axis-x path'),arrowY=rect('.quadrant-axis-y path');
    const arrowStrokeX=parseFloat(arrowStyle('x').strokeWidth)/2,arrowStrokeY=parseFloat(arrowStyle('y').strokeWidth)/2;
    const labelX=rect('.quadrant-axis-label-x'),labelY=rect('.quadrant-axis-label-y');
    const near=(a,b)=>Math.abs(a-b)<.1;
    const centerX=(cards[0].left+cards[1].right)/2,centerY=(cards[0].top+cards[2].bottom)/2;
    return {
      equalCards:cards.every(card=>near(card.width,cards[0].width)&&near(card.height,cards[0].height)),
      centered:near((x.top+x.bottom)/2,centerY)&&near((y.left+y.right)/2,centerX),
      arrowsCentered:near((arrowX.top+arrowX.bottom)/2,centerY)&&near((arrowY.left+arrowY.right)/2,centerX),
      equalHalfAxes:near(centerX-x.left-parseFloat(lineX.left),x.right-parseFloat(lineX.right)-centerX)&&
        near(centerY-y.top-parseFloat(lineY.top),y.bottom-parseFloat(lineY.bottom)-centerY),
      endpointsAligned:near(x.left,cards[0].left)&&near(arrowX.right+arrowStrokeX,cards[1].right)&&
        near(arrowY.top-arrowStrokeY,cards[0].top)&&near(y.bottom,cards[2].bottom),
      openArrowheads:arrowStyle('x').fill==='none'&&arrowStyle('y').fill==='none',
      labelsClear:labelY.bottom<arrowY.top&&labelX.bottom<arrowX.top,
      noOverflow:document.documentElement.scrollWidth<=innerWidth+1,
      visibleRows:[...document.querySelectorAll('#quadrantGrid .quadrant-task')].filter(row=>row.offsetWidth).every(row=>{
        const box=row.getBoundingClientRect(),cell=row.closest('.quadrant-card').getBoundingClientRect();
        return box.right<=cell.right&&box.bottom<=cell.bottom;
      })
    };
  });
  assert(Object.values(geometry).every(Boolean),JSON.stringify(geometry));
}
async function submit(page,label){
  await page.getByRole('button',{name:label,exact:true}).click();
  await page.locator('#modalMask').waitFor({state:'hidden'});
}
async function startMock(){
  server=spawn(process.execPath,['tools/mock-sync-server.mjs'],{
    env:{...process.env,PORT:'4188',MOCK_PREVIEW_ONLY:'1',MOCK_BIND_HOST:'127.0.0.1'},
    stdio:['ignore','pipe','pipe'],windowsHide:true
  });
  const timeout=AbortSignal.timeout(6000);
  await Promise.race([
    once(server.stdout,'data',{signal:timeout}).then(([chunk])=>assert.match(String(chunk),/LOCAL_MOCK_SERVER_READY/)),
    once(server,'exit',{signal:timeout}).then(([code])=>{throw new Error('Dedicated Mock exited: '+code);})
  ]);
}

(async()=>{
  assertProtectedSource();
  await startMock();
  browser=await chromium.launch({headless:true,executablePath:process.env.QUADRANT_BROWSER||undefined});
  const a=await newPage(first,{viewport:{width:1366,height:900}});
  const b=await newPage(second,{viewport:{width:1366,height:900}});
  const redirect=await a.request.get(first+'/?t=1',{maxRedirects:0});
  assert.equal(redirect.status(),302);
  assert.match(redirect.headers().location,/mockSync=1/);
  const response=await a.request.get(first+view);
  assert.match(response.headers()['content-security-policy'],/connect-src 'self'/);
  const remote=await (await a.request.get(first+'/__mock_gists/local-mock')).json();
  assert.deepEqual(remote.files,{},'A fresh dedicated server is required');
  assert.equal((await a.request.get(first+'/.git/config')).status(),404);
  pass('独立预览强制 Mock，仅允许本源网络，Git 元数据不可经预览服务读取');
  const scopePage=await newPage(first,{viewport:{width:1440,height:1000}});
  await ready(scopePage,first+view);
  await scopePage.evaluate(day=>{
    sessionPasscode=null;
    clearTimeout(syncTimer);
    const task=(text,due,important,urgent)=>newMatterTodo(text,due,{timePlan:{important,urgent}});
    S.todos=[
      task('有计划 A',day,false,false),
      task('有计划 B',day,true,true),
      task('未排期 A','',true,true),
      task('未排期 B','',false,true),
      newMatterTodo('较早完成','2026-11-14',{done:true,completedAt:'2026-11-14T03:00:00.000Z'})
    ];
    renderAll();
  },today);
  const scope=scopePage.locator('#quadrantScope'),boardRows=scopePage.locator('#quadrantGrid .quadrant-task');
  assert.equal(await scope.inputValue(),'day');
  assert.equal(await boardRows.count(),2);
  await scope.selectOption('pending');
  assert.equal(await boardRows.count(),4);
  assert.match(await scopePage.locator('#quadrantScopeHint').textContent(),/显示 4 项未完成，其中 2 项未排期/);
  assert.equal(await boardRows.getByText('未排期 A').evaluate(el=>el.closest('[data-quadrant]').dataset.quadrant),'1');
  assert.equal(await boardRows.getByText('未排期 B').evaluate(el=>el.closest('[data-quadrant]').dataset.quadrant),'3');
  await assertCenteredAxes(scopePage);
  if(envOutput){
    await scopePage.screenshot({path:path.join(envOutput,'quadrant-scope-1440.png'),animations:'disabled'});
    await scopePage.setViewportSize({width:1440,height:1600});
    await scopePage.locator('#quadrantGrid').screenshot({path:path.join(envOutput,'quadrant-axes-desktop.png'),animations:'disabled'});
    await scopePage.setViewportSize({width:1440,height:1000});
  }
  await scopePage.locator('#quadrantDay').fill(yesterday);
  assert.equal(await scope.inputValue(),'day');
  assert.equal(await boardRows.count(),0);
  await scopePage.locator('#quadrantToday').click();
  assert.equal(await boardRows.count(),2);
  await scope.selectOption('unscheduled');
  assert.deepEqual((await boardRows.locator('.quadrant-task-title').allTextContents()).sort(),['未排期 A','未排期 B']);
  await scope.selectOption('all');
  assert.equal(await boardRows.count(),5);
  await scope.selectOption('pending');
  await scopePage.locator('#quadrantReviewTab').click();
  await scopePage.locator('#quadrantDay').fill(yesterday);
  await scopePage.locator('#quadrantBoardTab').click();
  assert.equal(await scope.inputValue(),'pending');
  assert.equal(await boardRows.count(),4);
  await scopePage.context().close();
  pass('默认按开始日期，全部未完成包含两条已分类未排期任务，各范围互通');

  const followPage=await newPage(first,{viewport:{width:1440,height:1000}});
  await ready(followPage,first+view);
  const nextDay='2026-11-17';
  await followPage.evaluate(({day,prior,nextDay})=>{
    sessionPasscode=null;clearTimeout(syncTimer);
    const task=(id,due,extra={})=>newMatterTodo(id,due,{
      id,date:prior,createdAt:prior+'T02:00:00.000Z',
      timePlan:{important:true,urgent:true},
      ...extra
    });
    S.todos=[
      ...Array.from({length:11},(_,i)=>task('跨日任务 '+String(i+1).padStart(2,'0'),prior)),
      task('已用时未排期',''),task('昨天重开未排期','',{completionEvents:[{action:'重新打开',at:prior+'T08:00:00+08:00'}]}),
      task('尚未排期',''),task('将来任务',nextDay),
      task('昨天已完成',prior,{done:true,completedAt:prior+'T05:00:00Z'}),
      task('已删除',prior,{deletedAt:prior+'T07:00:00Z'}),
      ...Array.from({length:12},(_,i)=>task('今天任务 '+String(i+1).padStart(2,'0'),day)),
      task('今天待分类',day,{timePlan:null})
    ];
    S.timeEntries=[
      {id:'worked-before',taskId:'已用时未排期',day:prior,minutes:20,quadrant:'1'},
      {id:'worked-now',taskId:'跨日任务 01',day,minutes:15,quadrant:'1'},
      {id:'worked-future-plan',taskId:'将来任务',day:prior,minutes:15,quadrant:'1'}
    ];
    renderAll();
  },{day:today,prior:yesterday,nextDay});
  const carry=followPage.locator('#quadrantGrid [data-quadrant=""] .quadrant-paged-list');
  const todayCell=followPage.locator('#quadrantGrid [data-quadrant="1"]');
  const list=followPage.locator('#quadrantTasks');
  const rows=area=>area.locator('.quadrant-task');
  const byId=(area,id)=>area.locator('[data-task-id="'+id+'"]');
  await followPage.locator('#quadrantToday').click();
  assert.match(await followPage.locator('#quadrantScopeHint').textContent(),/13 项跨日跟进/);
  assert.equal(await rows(carry).count(),10);
  const firstCarry=await rows(carry).evaluateAll(nodes=>nodes.map(node=>node.dataset.taskId));
  assert(firstCarry.includes('跨日任务 01'));
  assert.equal(await byId(followPage.locator('#quadrantGrid'),'跨日任务 01').count(),1);
  assert.equal(await byId(carry,'跨日任务 01').locator('.quadrant-task-alert').textContent(),'待开始');
  assert.equal(await byId(carry,'跨日任务 01').locator('.quadrant-original').textContent(),'原象限：重要且紧急');
  assert(await byId(carry,'跨日任务 01').getByText('计划 '+yesterday,{exact:false}).isVisible());
  assert.equal(await followPage.locator('#quadrantGrid').getByText(/尚未排期|昨天已完成|已删除|将来任务/).count(),0);
  assert(await carry.getByRole('button',{name:'上一页'}).isDisabled());
  await carry.getByRole('button',{name:'下一页'}).click();
  const lastCarry=await rows(carry).evaluateAll(nodes=>nodes.map(node=>node.dataset.taskId));
  assert.equal(lastCarry.length,4);
  assert(lastCarry.every(id=>!firstCarry.includes(id)));
  assert.equal(await byId(carry,'已用时未排期').locator('.quadrant-meta span').first().textContent(),'待开始');
  assert(await byId(carry,'今天待分类').locator('.quadrant-original').count()===0);
  assert(await carry.getByRole('button',{name:'下一页'}).isDisabled());
  if(envOutput){
    await carry.scrollIntoViewIfNeeded();
    await followPage.screenshot({path:path.join(envOutput,'quadrant-followup-desktop.png'),animations:'disabled'});
  }
  pass('按日期跟进只复用未完成任务，已记用时不重复，原象限、计划日和红色状态可见，未分类每页最多十条');

  assert.equal(await rows(todayCell).count(),3);
  assert.equal(await todayCell.locator('.quadrant-pagination').count(),0);
  await todayCell.getByRole('button',{name:'查看全部 12 项'}).click();
  assert(await list.isVisible());
  assert.equal(await rows(list).count(),10);
  assert.equal(await todayCell.getByRole('button',{name:'查看全部 12 项'}).getAttribute('aria-expanded'),'true');
  await list.getByRole('button',{name:'下一页'}).click();
  assert.equal(await rows(list).count(),2);
  await rows(list).last().getByRole('button',{name:'详情 / 分类'}).click();
  assert.equal(await followPage.locator('#matterImportant').inputValue(),'yes');
  await submit(followPage,'取消');
  await list.getByRole('button',{name:'收起列表'}).click();
  assert(!(await list.isVisible()));
  assert(await todayCell.getByRole('button',{name:'查看全部 12 项'}).evaluate(button=>document.activeElement===button));
  await assertCenteredAxes(followPage);
  pass('桌面象限最多三条预览，展开后在独立任务区分页，详情可操作，收起后还原焦点');

  await followPage.setViewportSize({width:390,height:844});
  if(await followPage.locator('body').evaluate(el=>el.classList.contains('nav-open')))await followPage.locator('#sideToggle').click();
  const unclassified=followPage.locator('.quadrant-cell-toggle[data-quadrant-key=""]');
  await unclassified.click();
  assert(await list.isVisible());
  assert.equal(await rows(list).count(),4);
  assert(await list.getByRole('button',{name:'下一页'}).isDisabled());
  if(envOutput){
    await list.locator('.quadrant-pagination').scrollIntoViewIfNeeded();
    await followPage.screenshot({path:path.join(envOutput,'quadrant-followup-mobile.png'),animations:'disabled'});
  }
  for(const id of lastCarry){
    if(id!=='今天待分类')await byId(list,id).locator('.matter-check').click();
  }
  // The final row on page two leaves the scope; the list must clamp without a manual page change.
  assert.equal(await rows(list).count(),1);
  await byId(list,'今天待分类').getByRole('button',{name:'详情 / 分类'}).click();
  await followPage.locator('#matterDueDate').fill(nextDay);
  await submit(followPage,'保存');
  assert.equal(await rows(list).count(),10);
  assert.equal(await list.locator('.quadrant-pagination').count(),0);
  await byId(list,'跨日任务 01').getByRole('button',{name:'详情 / 分类'}).click();
  await followPage.locator('#matterDueDate').fill(nextDay);
  await submit(followPage,'保存');
  assert.equal(await rows(list).count(),9);
  assert.equal(await byId(list,'跨日任务 01').count(),0);
  assert.equal(await followPage.evaluate(()=>S.todos.find(t=>t.id==='跨日任务 01').timePlan.important),true);
  pass('窄屏同样分页，勾选完成和改计划日期会移出跟进，数量变少时页码回到有效范围');

  await followPage.clock.setSystemTime(new Date(today+'T16:00:00Z'));
  await followPage.clock.runFor(60001);
  assert.equal(await followPage.locator('#quadrantDay').inputValue(),nextDay);
  assert.match(await followPage.locator('#quadrantScopeHint').textContent(),/跨日跟进/);
  await unclassified.click();
  assert.equal(await rows(list).count(),10);
  await list.getByRole('button',{name:'下一页'}).click();
  assert(await list.locator('.quadrant-original',{hasText:'重要且紧急'}).first().isVisible());
  assert.equal(await followPage.evaluate(plan=>S.todos.filter(t=>t.id.startsWith('今天任务 ')).every(t=>t.dueAt===plan),today),true);
  await followPage.locator('#quadrantReviewTab').click();
  assert(!(await followPage.locator('#quadrantReview').getByText('今天任务 01',{exact:true}).isVisible()));
  await followPage.context().close();
  pass('跨午夜后跟随今天的日期看板自动承接昨天任务，计划日和每日复盘口径保持原样');

  for(const scale of [1,1.25,1.5,2]){
    const axisPage=await newPage(first,{viewport:{width:1280,height:1000},deviceScaleFactor:scale});
    await ready(axisPage,first+view);
    for(const content of ['empty','top-heavy','bottom-heavy']){
      await axisPage.evaluate(({day,content})=>{
        sessionPasscode=null;clearTimeout(syncTimer);
        S.todos=content==='empty'?[]:Array.from({length:4},(_,index)=>newMatterTodo(
          index===0?'任务标题需要换行时仍保持坐标轴居中与四格边界对齐：逐项核对清单并记录本次验收结果':'模拟任务 '+index,
          day,{timePlan:{important:content==='top-heavy',urgent:true}}
        ));
        renderAll();
      },{day:today,content});
      await assertCenteredAxes(axisPage);
      if(envOutput&&scale===1.5&&content==='bottom-heavy')await axisPage.locator('#quadrantGrid').screenshot({
        path:path.join(envOutput,'quadrant-axes-long-tasks-150.png'),animations:'disabled'
      });
    }
    await axisPage.context().close();
  }
  pass('空任务、上下数量不均、长标题及 1/1.25/1.5/2 像素密度：四格等大、交点居中、正负轴段等长、两轴端点对齐、标签不重叠');


  await a.addInitScript(({oldId,today,testTitle})=>{
    if(!localStorage.getItem('lifeworkbench_v1')){
      localStorage.setItem('lifeworkbench_v1',JSON.stringify({
        version:3,todos:[{id:oldId,text:testTitle,date:today,done:false},{id:'undated',text:'未定日期待办',date:today,dueAt:'',done:false}],
        notes:[],habits:[],ledger:[],countdowns:[],worklog:[{id:'pomo-unrelated',date:today,text:'[番茄专注] 既有日志 · 25 分钟'}]
      }));
    }
  },{oldId,today,testTitle});
  await ready(a,first+view);
  assert(await a.locator('#quadrantGrid [data-quadrant=""] .quadrant-task').getByText(testTitle).isVisible());
  assert.equal(await a.evaluate(id=>S.todos.find(t=>t.id===id).timePlan,oldId),undefined);
  await a.locator('#quadrantScope').selectOption('unscheduled');
  assert(await a.locator('#quadrantGrid').getByText('未定日期待办').isVisible());
  await a.locator('#quadrantScope').selectOption('day');
  pass('旧待办未分类，空计划日期可从独立范围查看');

  const row=a.locator('#quadrantGrid [data-task-id="'+oldId+'"]');
  await row.getByRole('button',{name:'详情 / 分类'}).click();
  await a.locator('#matterImportant').selectOption('yes');
  await submit(a,'保存');
  assert.equal(await row.evaluate(el=>el.closest('[data-quadrant]').dataset.quadrant),'');
  await row.getByRole('button',{name:'详情 / 分类'}).click();
  await a.locator('#matterUrgent').selectOption('no');
  await a.locator('#matterPlanMinutes').fill('50');
  await submit(a,'保存');
  assert.equal(await row.evaluate(el=>el.closest('[data-quadrant]').dataset.quadrant),'2');
  assert(await row.getByText('计划用时 50 分钟',{exact:false}).isVisible());
  assert.equal(await a.evaluate(id=>todoDue(S.todos.find(t=>t.id===id)),oldId),today);
  assert.equal(await a.locator('#pomoTodo option[value="'+oldId+'"]').textContent(),testTitle);
  await a.locator('#matterListTab').click();
  assert(await a.locator('#noteList').getByText('重要不紧急').isVisible());
  await a.locator('#quadrantTab').click();
  pass('两项判断可分别留空，分类、计划日期与计划分钟独立，列表、看板、番茄使用同一 ID');

  await row.getByRole('button',{name:'记用时'}).click();
  assert.equal(await a.locator('#timeEntryTask').inputValue(),oldId);
  assert.equal(await a.locator('#timeEntryQuadrant').inputValue(),'2');
  await a.locator('#timeEntryMinutes').fill('35');
  await a.locator('#timeEntryNote').fill('校对 A|B\n复核签字 <完成>');
  await submit(a,'保存用时');
  assert(await a.locator('#quadrantReview').getByText('已记录 35 分钟').isVisible());
  assert.equal(await a.locator('#quadrantReview dd').allTextContents().then(x=>x.join('|')),'未记录|35 分钟|未记录|未记录|未记录');
  await a.locator('#quadrantAddTime').click();
  await a.locator('#timeEntryTask').selectOption(oldId);
  await a.locator('#timeEntryMinutes').fill('10');
  await a.locator('#timeEntryInterruption').check();
  await submit(a,'保存用时');
  assert(await a.locator('#quadrantReview').getByText('临时插入 1 条，共 10 分钟，已计入上方。').isVisible());
  assert(await a.locator('#quadrantReview').getByText('已记录 45 分钟').isVisible());
  pass('同任务同日可多段计时，临时插入只累计一次，计划和既有番茄日志不混入实际用时');

  await a.locator('#quadrantBoardTab').click();
  await row.getByRole('button',{name:'详情 / 分类'}).click();
  await a.locator('#matterUrgent').selectOption('yes');
  await submit(a,'保存');
  assert.equal(await row.evaluate(el=>el.closest('[data-quadrant]').dataset.quadrant),'1');
  await row.getByRole('button',{name:'完成 '+testTitle}).click();
  await a.locator('#quadrantReviewTab').click();
  assert(await a.locator('#quadrantReview').getByText('已完成',{exact:true}).isVisible());
  assert.equal(await a.locator('#quadrantReview dd').allTextContents().then(x=>x.join('|')),'未记录|45 分钟|未记录|未记录|未记录');
  pass('重新分类和任务完成后，历史实际用时仍保留记录时象限');

  await a.locator('#quadrantAddTime').click();
  await a.locator('#timeEntryTask').selectOption(oldId);
  await a.locator('#timeEntryDay').fill(yesterday);
  assert.equal(await a.locator('#timeEntryQuadrant').inputValue(),'');
  await a.locator('#timeEntryQuadrant').selectOption('3');
  await a.locator('#timeEntryMinutes').fill('8');
  await submit(a,'保存用时');
  assert(await a.locator('#quadrantReview').getByText(/回顾补记/).isVisible());
  assert(await a.locator('#quadrantReview').getByText('状态未记录',{exact:true}).isVisible());
  await a.locator('#quadrantReview').getByRole('button',{name:'写复盘'}).click();
  await a.locator('#timeReviewReason').fill('客户反馈尚未收齐');
  await a.locator('#timeReviewAdjustment').fill('先确认缺失项，再预约复核');
  await submit(a,'保存复盘');
  assert(await a.locator('#quadrantReview').getByText('客户反馈尚未收齐').isVisible());
  pass('历史补记默认未分类，自选发生时象限并保留发生日与首次录入日');

  await a.locator('#quadrantExport').click();
  await a.locator('#timeExportFrom').fill(today);
  await a.locator('#timeExportTo').fill(yesterday);
  await a.getByRole('button',{name:'下载 Markdown'}).click();
  assert(await a.locator('#timeDialogError').getByText(/结束日期/).isVisible());
  await a.locator('#timeExportFrom').fill(yesterday);
  await a.locator('#timeExportTo').fill(today);
  const downloadPromise=a.waitForEvent('download');
  await submit(a,'下载 Markdown');
  const download=await downloadPromise;
  const report=fs.readFileSync(await download.path(),'utf8');
  assert.match(download.suggestedFilename(),/\.md$/);
  assert(report.includes('## '+yesterday)&&report.includes('## '+today)&&!report.includes('## 2026-11-14'));
  assert(report.includes('| 重要不紧急 | 45 |')&&report.includes('| 重要且紧急 |  |'));
  assert(report.includes('客户反馈尚未收齐')&&report.includes('回顾补记')&&report.includes(oldId));
  assert(report.includes('校对 A\\|B<br>复核签字 &lt;完成&gt;'));
  pass('Markdown 按日期区间导出同一任务 ID、当前分类、历史用时及复盘，未记录的汇总留空');

  await a.evaluate(()=>cloudPush());
  await ready(b,second+view);
  assert.equal(await b.evaluate(()=>timeEntries().length),3);
  assert.equal(await b.evaluate(()=>S.dailyTimeReviews[0].adjustment),'先确认缺失项，再预约复核');
  assert.equal(await b.evaluate(id=>timeQuadrant(S.todos.find(task=>task.id===id)),oldId),'1');
  await b.locator('#quadrantDay').fill(yesterday);
  await b.locator('#quadrantReviewTab').click();
  await b.locator('#quadrantReview').getByRole('button',{name:'编辑用时'}).click();
  assert.equal(await b.locator('#timeEntryQuadrant').inputValue(),'3');
  await b.locator('#timeEntryMinutes').fill('12');
  await submit(b,'保存用时');
  const corrected=await b.evaluate(day=>timeEntries().find(entry=>entry.day===day),yesterday);
  assert.equal(corrected.recordedOn,today);
  assert.equal(corrected.quadrant,'3');
  await b.evaluate(()=>cloudPush());
  await a.evaluate(()=>cloudPull());
  assert.equal(await a.evaluate(day=>timeEntries().find(entry=>entry.day===day).minutes,yesterday),12);
  pass('双来源 Mock 同步设置、时间明细、复盘和更正，首次录入信息保留');

  await b.locator('#quadrantToday').click();
  await b.locator('#quadrantReview .quadrant-entry').filter({hasText:'· 10 分钟'}).getByRole('button',{name:'编辑用时'}).click();
  b.once('dialog',dialog=>dialog.accept());
  await submit(b,'删除记录');
  await b.evaluate(()=>cloudPush());
  await a.evaluate(()=>cloudPull());
  assert.equal(await a.evaluate(()=>timeEntries().length),2);
  assert.equal(await a.evaluate(()=>S.timeEntries.filter(entry=>entry.deletedAt).length),1);
  await a.reload();
  await a.waitForFunction(()=>MOCK_SYNC&&syncActive()&&!syncBusy);
  assert.equal(await a.evaluate(()=>timeEntries().length),2);
  assert.equal(await a.evaluate(()=>S.dailyTimeReviews.length),1);
  await a.waitForFunction(async()=>JSON.parse((await readLocalMirror('current'))?.json||'{}').timeEntries?.some(entry=>entry.deletedAt));
  const mirror=await a.evaluate(async()=>JSON.parse((await readLocalMirror('current')).json));
  assert.equal(mirror.timeEntries.length,3);
  assert.equal(mirror.dailyTimeReviews.length,1);
  pass('双端删除不会被旧副本复活，刷新与 IndexedDB 镜像保留数据');

  await a.locator('nav.tabbar a[data-p="me"]').click();
  await a.locator('#exportBtn').click();
  const backupPromise=a.waitForEvent('download');
  await submit(a,'下载文件');
  const backup=fs.readFileSync(await (await backupPromise).path(),'utf8');
  const backupJSON=JSON.parse(backup);
  assert.equal(backupJSON.todos.find(t=>t.id===oldId).timePlan.minutes,50);
  assert.equal(backupJSON.timeEntries.length,3);
  assert.equal(backupJSON.dailyTimeReviews.length,1);

  const c=await newPage(first);
  await ready(c,first+view);
  // Only synthetic state and this disposable page are used during backup import.
  const restore=async json=>{
    await c.locator('#importFile').setInputFiles({name:'test.json',mimeType:'application/json',buffer:Buffer.from(json)});
    await submit(c,'覆盖导入');
  };
  await c.evaluate(()=>{sessionPasscode=null;clearTimeout(syncTimer);});
  await restore(JSON.stringify({todos:[{id:oldId,text:testTitle,date:today,done:false}],worklog:[]}));
  assert.equal(await c.evaluate(()=>timeEntries().length),0);
  await c.locator('#mergeFile').setInputFiles({name:'test.json',mimeType:'application/json',buffer:Buffer.from(backup)});
  await submit(c,'好的');
  assert.equal(await c.evaluate(id=>timeQuadrant(S.todos.find(task=>task.id===id)),oldId),'1');
  assert.equal(await c.evaluate(()=>S.todos.find(t=>t.id==='quadrant-old-task').done),false);
  assert.equal(await c.evaluate(()=>timeEntries().length),2);
  await restore(backup);
  assert.equal(await c.evaluate(()=>timeEntries().length),2);
  assert.equal(await c.evaluate(()=>S.dailyTimeReviews.length),1);
  assert.equal(await c.evaluate(()=>S.todos.find(t=>t.id==='quadrant-old-task').done),true);
  pass('原 JSON 备份实际下载、旧版覆盖导入、合并补字段及新版覆盖还原通过');

  await c.locator('#quadrantTab').click();
  await c.locator('#quadrantScope').selectOption('all');
  await c.locator('#quadrantGrid [data-task-id="'+oldId+'"]').getByRole('button',{name:'详情 / 分类'}).click();
  await c.evaluate(id=>{
    const current=S.todos.find(task=>task.id===id);
    const remote={...current,dueAt:'2026-11-17',updatedAt:'2026-11-16T03:05:00.000Z'};
    delete remote.timePlan;
    applyPulledState({todos:[remote]});
  },oldId);
  await c.locator('#matterUrgent').selectOption('no');
  await submit(c,'保存');
  assert.deepEqual(await c.evaluate(id=>{
    const task=S.todos.find(task=>task.id===id);
    return [todoDue(task),timeQuadrant(task),timePlanOf(task).minutes];
  },oldId),['2026-11-17','2',50]);
  pass('详情打开期间收到新计划日期时，修改分类保留最新的计划日期和原计划用时');


  await ready(a,first+view);
  await a.locator('nav.tabbar a[data-p="today"]').click();
  await a.locator('#pomoTodo').selectOption('undated');
  await a.locator('#pomoPrimary').click();
  await a.clock.fastForward(25*60*1000+1000);
  const focus=await a.evaluate(()=>pomoState.history[0]);
  assert.equal(focus.taskId,'undated');
  assert.equal(focus.duration,25*60*1000);
  await a.locator('#pomoPrimary').click();
  await a.clock.fastForward(5*60*1000+1000);
  assert.equal(await a.evaluate(()=>pomoState.history.length),1);
  assert.equal(await a.evaluate(()=>timeEntries().length),2);
  await a.locator('[data-pomo-record]').click();
  await a.locator('#pomoWriteLog').check();
  await submit(a,'保存小结');
  await a.evaluate(()=>cloudPush());
  await b.evaluate(()=>cloudPull());
  assert.equal(await b.evaluate(()=>pomoState.history.length),0);
  assert(await b.evaluate(()=>S.worklog.some(record=>record.text.includes('[番茄专注] 未定日期待办'))));
  assert.equal(await b.evaluate(()=>timeEntries().length),2);
  pass('番茄工作段保留任务 ID，休息不进专注历史，可选工作日志跨端同步，手工用时合计保持不变');

  for(const width of [320,375,390,414,560,640,759,760,768,1024,1440]){
    const touch=width<760;
    const phone=await newPage(first,{viewport:{width,height:touch?844:1000},hasTouch:touch,isMobile:touch,deviceScaleFactor:1});
    await ready(phone,first+view);
    await phone.locator('#quadrantToday').click();
    const layout=await phone.evaluate(()=>{
      const control=$('#quadrantDay'),rect=sel=>$(sel).getBoundingClientRect();
      const items=['2','1','4','3'].map(key=>rect('.quadrant-card[data-quadrant="'+key+'"]'));
      const x=rect('.quadrant-axis-x'),y=rect('.quadrant-axis-y');
      const matrix=items[0].right<=y.left&&y.right<=items[1].left&&items[0].bottom<=x.top&&x.bottom<=items[2].top&&
        items[0].left===items[2].left&&items[1].left===items[3].left;
      const labels=[...$$('.quadrant-view-switch button,.quadrant-modes button,.quadrant-cell-toggle')].filter(el=>el.offsetWidth);
      const boundaries=['.quadrant-view-switch','.quadrant-toolbar','.quadrant-modes','#quadrantGrid'].map(rect);
      const aligned=boundaries.every(box=>Math.abs(box.left-boundaries[0].left)<.1&&Math.abs(box.right-boundaries[0].right)<.1);
      const actions=rect('.quadrant-actions'),heading=rect('#quadrantHeading');
      return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,matrix,aligned,
        actionsAligned:Math.abs(actions.right-boundaries[0].right)<.1&&heading.right<=actions.left,

        control:control.getBoundingClientRect().height,font:parseFloat(getComputedStyle(control).fontSize),
        board:$('#quadrantAddTime').getBoundingClientRect().height,filtersFit:rect('#quadrantScope').right<=innerWidth,
        axisWeight:[getComputedStyle($('.quadrant-axis-x'),'::before').height,getComputedStyle($('.quadrant-axis-y'),'::before').width],
        labelsFit:labels.every(el=>el.clientWidth>=el.scrollWidth&&el.getBoundingClientRect().height>=44)};
    });
    assert(layout.scrollWidth<=width+1&&layout.matrix&&layout.aligned&&layout.actionsAligned,JSON.stringify(layout));
    assert.deepEqual(layout.axisWeight,['2px','2px']);
    await assertCenteredAxes(phone);
    assert(layout.control>=44&&layout.board>=44&&layout.filtersFit&&layout.labelsFit&&(!touch||layout.font>=16),JSON.stringify(layout));
    const selectedTask=phone.locator('#quadrantTasks [data-task-id="'+oldId+'"]');
    if(touch){
      assert(await selectedTask.isVisible());
      const choice=key=>phone.locator('.quadrant-cell-toggle[data-quadrant-key="'+key+'"]');
      await choice('2').tap();
      assert.equal(await choice('2').getAttribute('aria-pressed'),'true');
      assert(await phone.locator('#quadrantTasks').getByText('暂无任务').isVisible());
      await choice('').tap();
      assert.equal(await phone.locator('#quadrantTasksHeading').innerText(),'未分类');
      await choice('1').tap();
      assert(await selectedTask.isVisible());
      await selectedTask.getByRole('button',{name:'详情 / 分类'}).tap();
      assert(await phone.locator('#matterImportant').isVisible());
      await submit(phone,'取消');
    }else{
      assert(!(await phone.locator('#quadrantTasks').isVisible()));
      assert(await phone.locator('#quadrantGrid [data-task-id="'+oldId+'"]').isVisible());
    }
    if(envOutput&&[320,390,560,760,1024,1440].includes(width)){
      await phone.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
      await phone.screenshot({path:path.join(envOutput,'quadrant-'+width+'.png'),animations:'disabled'});
      if(width===390){
        await phone.setViewportSize({width,height:1200});
        await phone.locator('#quadrantGrid').screenshot({path:path.join(envOutput,'quadrant-axes-mobile.png'),animations:'disabled'});
        await phone.setViewportSize({width,height:844});
      }
    }
    if(touch){
      await selectedTask.getByRole('button',{name:'记用时'}).tap();
      assert.equal(await phone.locator('#timeEntryTask').inputValue(),oldId);
    }else await phone.locator('#quadrantAddTime').click();
    const box=await phone.locator('#modalBox').boundingBox();
    assert(box.x>=0&&box.x+box.width<=width+1);
    if(envOutput&&width===390)await phone.screenshot({path:path.join(envOutput,'quadrant-record-390.png'),animations:'disabled'});
    if(width===390){
      await phone.setViewportSize({width,height:430});
      await phone.waitForFunction(()=>{
        const viewport=visualViewport,box=$('#modalBox').getBoundingClientRect();
        const footer=$('#timeDialogForm .btns').getBoundingClientRect();
        const scroll=$('.quadrant-dialog-scroll');
        const modalOnTop=document.elementFromPoint(box.left+16,box.top+16)?.closest('#modalBox');
        return modalOnTop&&box.bottom<=viewport.height&&footer.height>=44&&footer.bottom<=viewport.height&&scroll.scrollHeight>scroll.clientHeight;
      });
      await phone.locator('#timeEntryNote').fill('短视口下仍可填写备注');
      assert(await phone.locator('#timeDialogForm button[type=submit]').isVisible());
      if(envOutput)await phone.screenshot({path:path.join(envOutput,'quadrant-short-dialog-390.png'),animations:'disabled'});
    }
    await submit(phone,'取消');
    if(width===390){
      await phone.setViewportSize({width,height:844});
      await phone.evaluate(()=>{sessionPasscode=null;clearTimeout(syncTimer);});
      const complete=selectedTask.locator('.matter-check');
      await complete.tap();
      assert.equal(await complete.getAttribute('aria-pressed'),'false');
      await complete.tap();
      assert.equal(await complete.getAttribute('aria-pressed'),'true');
    }
    await phone.locator('#quadrantReviewTab').click();
    assert(await phone.locator('#quadrantReview').getByText('已记录 35 分钟').isVisible());
    if(envOutput&&width===390)await phone.screenshot({path:path.join(envOutput,'quadrant-review-390.png'),animations:'disabled',fullPage:true});
    await phone.context().close();
    pass(width+'px：切换栏与工具栏对齐、坐标轴方位、触控范围、任务切换、弹窗与复盘');
  }
  assert.deepEqual(external,[]);
  assert.deepEqual(errors,[]);
  pass('浏览器全程零外部请求、零页面脚本错误');
})().catch(error=>{console.error(error);process.exitCode=1;})
  .finally(async()=>{if(browser)await browser.close();server?.kill();});
