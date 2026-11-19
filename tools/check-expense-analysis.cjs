/* Synthetic ledger checks with a temporary Mock origin and browser profile. */
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');

const port=Number(process.env.EXPENSE_ANALYSIS_TEST_PORT||4213);
const origin='http://127.0.0.1:'+port;
const errors=[],external=[];
let server,browser,checks=0;
const pass=name=>{checks++;console.log('PASS '+name)};
const inCat='测试日常',outCat='测试额外';
const entry=(id,date,amount,category=inCat,type='expense')=>({id,date,amount,category,type,note:''});
const rows=[
  entry('old-in','2024-12-10',500),entry('old-out','2024-12-10',100,outCat),
  ...Array.from({length:12},(_,i)=>{
    const month='2025-'+String(i+1).padStart(2,'0');
    return [entry(month+'-in',month+'-15',100),entry(month+'-out',month+'-15',20,outCat)];
  }).flat(),
  entry('july-in','2026-07-11',300),entry('july-out','2026-07-11',75,outCat),
  entry('oct-in','2026-10-04',400),entry('oct-out','2026-10-04',50,outCat),
  entry('now-in','2026-11-19',900),entry('now-out','2026-11-19',33,outCat),
  entry('income','2026-10-04',2000,inCat,'income'),
  entry('future','2026-11-20',9999),entry('bad-day','2026-09-31',9999)
];

async function pageAt(width,offline){
  const context=await browser.newContext({viewport:{width,height:920},timezoneId:'Asia/Shanghai',reducedMotion:'reduce'});
  await context.addInitScript(()=>localStorage.setItem('wb_sidebar_open','0'));
  await context.route('**/*',route=>{
    if(route.request().url().startsWith(origin+'/')||route.request().url().startsWith('file:'))return route.continue();
    external.push(route.request().url());return route.abort();
  });
  const page=await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  await page.clock.setFixedTime(new Date('2026-11-19T03:00:00Z'));
  await page.goto(offline?pathToFileURL(offline).href+'#expense-analysis':origin+'/?mockSync=1#expense-analysis');
  await page.waitForFunction(()=>typeof S!=='undefined'&&typeof syncActive==='function'&&syncActive()&&!syncBusy);
  return page;
}

async function load(page,records){
  await page.evaluate(({records,outCat})=>{
    clearTimeout(syncTimer);
    S=structuredClone(DEFAULT);
    S.ledger=records;
    S.budgetCats[outCat]=false;
    renderAll();
  },{records,outCat});
}

function table(page,i=0){return page.locator('#eaResults table').nth(i)}
async function amounts(page,index,row){
  return table(page,index).locator('tbody tr').filter({hasText:row}).locator('td').allTextContents();
}

(async()=>{
  server=spawn(process.execPath,['tools/mock-sync-server.mjs'],{
    env:{...process.env,PORT:String(port),MOCK_PREVIEW_ONLY:'1',MOCK_BIND_HOST:'127.0.0.1'},
    stdio:['ignore','pipe','pipe'],windowsHide:true
  });
  const [ready]=await once(server.stdout,'data',{signal:AbortSignal.timeout(8000)});
  assert.match(String(ready),/LOCAL_MOCK_SERVER_READY/);
  browser=await chromium.launch({executablePath:process.env.SAVINGS_BROWSER||undefined});
  const page=await pageAt(1280);
  assert.equal(await page.locator('#expenseAnalysisSec').isVisible(),true);
  assert.deepEqual(await amounts(page,0,'平均月支出'),['—','—','—']);
  assert.match(await page.locator('#eaResults').innerText(),/暂无支出记录/);
  pass('analysis deep link and honest empty state');

  await load(page,rows);
  assert.deepEqual(await amounts(page,1,/^11 月/),['¥900','¥33','¥933']);
  assert.deepEqual(await amounts(page,1,/^10 月/),['¥400','¥50','¥450']);
  assert.deepEqual(await amounts(page,1,/^9 月/),['—','—','—']);
  assert.equal(await table(page,1).locator('tbody tr').count(),11);
  assert.deepEqual(await amounts(page,0,'平均月支出'),['¥160','¥31','¥191']);
  assert.deepEqual(await amounts(page,0,'2026年12月预算建议'),['¥266.67','¥48.33','¥315']);
  await page.locator('#eaYear').selectOption('2025');
  assert.equal(await table(page,1).locator('tbody tr').count(),12);
  assert.deepEqual(await amounts(page,1,/^12 月/),['¥100','¥20','¥120']);
  assert.deepEqual(await amounts(page,0,'2026年12月预算建议'),['¥266.67','¥48.33','¥315']);
  pass('monthly actuals, grouping by category, history query, sample windows and future exclusion');

  await page.locator('#eaMode').selectOption('year');
  assert.equal(await page.locator('#eaYear').isVisible(),false);
  assert.deepEqual(await amounts(page,1,/^2026 年/),['¥1,600','¥158','¥1,758']);
  assert.deepEqual(await amounts(page,0,'平均年支出'),['¥850','¥170','¥1,020']);
  assert.deepEqual(await amounts(page,0,'2027年预算建议'),['¥1,200','¥240','¥1,440']);
  assert.match(await table(page,1).locator('tbody').innerText(),/有记录 1\/12 月/);
  pass('annual actuals, recorded month coverage, annual averages and full-year estimate preference');

  await load(page,[entry('fraction1','2026-10-15',0.1),entry('fraction2','2026-10-15',0.25),entry('correction','2026-10-15',-0.05),entry('extra','2026-10-16',0.1,outCat),entry('too-old','2025-10-15',999)]);
  assert.deepEqual(await amounts(page,0,'2027年预算建议'),['¥3.6','¥1.2','¥4.8']);
  assert.match(await page.locator('#eaResults').innerText(),/估算/);
  assert.equal(await page.evaluate(()=>expenseAnalysisModel('2026-12-31').month.next),'2027年1月');
  assert.equal(await page.evaluate(()=>expenseAnalysisModel('2026-10-31').month.suggestion.included),99900);
  await load(page,[entry('too-old','2025-10-15',999)]);
  assert.deepEqual(await amounts(page,0,'2027年预算建议'),['—','—','—']);
  pass('annualized fallback, cent precision, 12-month cutoff and December rollover');

  await load(page,rows);
  await page.locator('#eaMode').selectOption('month');
  await page.locator('#eaYear').selectOption('2026');
  await page.evaluate(()=>editLedgerById('oct-in'));
  await page.locator('#elAmt').fill('500');
  await page.locator('#elSave').click();
  assert.deepEqual(await amounts(page,1,/^10 月/),['¥500','¥50','¥550']);
  const stored=await page.evaluate(()=>S.budget);
  await page.locator('#flowFrom').fill('2026-11-01');
  assert.deepEqual(await amounts(page,1,/^10 月/),['¥500','¥50','¥550']);
  assert.equal(await page.evaluate(()=>S.budget),stored);
  await page.evaluate(name=>{setCatBudget('expense',name,true);renderMoney()},outCat);
  assert.deepEqual(await amounts(page,1,/^10 月/),['¥550','¥0','¥550']);
  pass('ledger edits recompute, category changes regroup history, existing budget and filters stay independent');

  await page.locator('#moneyViewSwitch [data-v="savings"]').click();
  assert.equal(await page.locator('#expenseAnalysisSec').isVisible(),false);
  await page.locator('#amountPrivacyToggle').click();
  assert.doesNotMatch(await page.locator('#eaResults').textContent(),/¥/);
  await page.locator('#moneyViewSwitch [data-v="analysis"]').click();
  assert.match(await page.locator('#eaResults').innerText(),/支出分析已隐藏/);
  await page.locator('#amountPrivacyToggle').click();
  assert.deepEqual(await amounts(page,1,/^10 月/),['¥550','¥0','¥550']);
  pass('savings tab separation and privacy purges derived amounts even when offscreen');

  const forecastRows=rows.filter(x=>x.id!=='future'&&x.id!=='bad-day');
  await load(page,forecastRows);
  await page.evaluate(()=>{S.budget=4500;renderMonthStat()});
  const advice=page.locator('#budgetAdviceLabel');
  const mark=page.locator('#budgetAdviceMark');
  const warning=page.locator('#budgetWarnLabel');
  const before=await page.evaluate(()=>JSON.stringify(S));
  await page.locator('#mNext').click();
  assert.equal(await page.locator('#mLabel').textContent(),'2026年12月');
  assert.equal(await advice.textContent(),'建议预算 ¥266.67');
  assert.deepEqual(await amounts(page,0,'2026年12月预算建议'),['¥266.67','¥48.33','¥315']);
  assert.equal(await page.locator('#budgetTxt').textContent(),'¥0 / ¥4,500');
  assert.equal(await warning.textContent(),'');
  assert.equal(await page.locator('#budgetWarnTiming').isVisible(),true);
  const position=await mark.evaluate(el=>parseFloat(el.parentElement.parentElement.style.getPropertyValue('--budget-advice-position')));
  assert(Math.abs(position-266.67/4500*100)<0.001);
  await page.locator('#mNext').click();
  assert.equal(await advice.isVisible(),false);
  await page.locator('#mPrev').click();
  assert.equal(await advice.textContent(),'建议预算 ¥266.67');
  assert.equal(await page.evaluate(()=>JSON.stringify(S)),before);
  pass('next-month marker agrees with budgeted suggestion and does not write ledger or budget');

  await page.evaluate(()=>{S.budget=500;renderMonthStat()});
  assert.match(await page.locator('#budgetTxt').textContent(),/¥100（已扣上月 ¥400）/);
  assert.equal(await mark.isVisible(),true);
  assert.match(await mark.getAttribute('class'),/outside/);
  assert.match(await advice.textContent(),/高于本月可用预算/);
  await page.evaluate(()=>{S.budget=400;renderMonthStat()});
  assert.equal(await mark.isVisible(),false);
  assert.match(await advice.textContent(),/高于本月可用预算/);
  await page.evaluate(()=>{S.budget=0;renderMonthStat()});
  assert.equal(await advice.isVisible(),false);
  assert.equal(await advice.textContent(),'');
  await load(page,[]);
  await page.evaluate(()=>{S.budget=4500;renderMonthStat()});
  assert.equal(await advice.isVisible(),false);
  pass('above-scale, unset budget and missing history do not show a misleading marker');

  await page.clock.setFixedTime(new Date('2026-12-01T05:00:00Z'));
  await load(page,[...forecastRows,entry('dec-out','2026-12-01',1000,outCat)]);
  await page.evaluate(()=>{S.budget=4500;renderMonthStat()});
  assert.equal(await advice.textContent(),'建议预算 ¥266.67');
  assert.match(await warning.textContent(),/^警戒 /);
  assert.equal(await page.locator('#budgetWarnTiming').isVisible(),false);
  assert.doesNotMatch(await page.locator('#budgetHint').textContent(),/达到建议/);
  await page.evaluate(record=>{S.ledger.push(record);renderMonthStat()},entry('dec-in','2026-12-01',266.67));
  assert.match(await page.locator('#budgetHint').textContent(),/已达到建议预算/);
  assert.match(await page.locator('#budgetHint').textContent(),/预算内剩余/);
  await page.locator('#amountPrivacyToggle').click();
  assert.equal(await advice.textContent(),'');
  assert.equal(await mark.isVisible(),false);
  assert.equal(await mark.evaluate(el=>el.parentElement.parentElement.style.getPropertyValue('--budget-advice-position')),'');
  await page.locator('#amountPrivacyToggle').click();
  assert.equal(await advice.textContent(),'建议预算 ¥266.67');
  await page.clock.setFixedTime(new Date('2027-01-31T05:00:00Z'));
  await page.evaluate(()=>{curMonth=new Date();renderMonthStat()});
  await page.locator('#mNext').click();
  assert.equal(await page.locator('#mLabel').textContent(),'2027年2月');
  pass('month rollover keeps the threshold, only budgeted spending triggers it, privacy clears it, and month-end navigation works');

  const capture=await pageAt(390);
  const screenshotRows=[
    entry('aug','2026-08-01',4708.55),
    entry('sep','2026-09-01',2293.61),
    entry('oct','2026-10-01',3920.17),
    entry('nov','2026-11-01',1695.74),
    entry('nov-travel','2026-11-01',3879.92,outCat)
  ];
  await load(capture,screenshotRows);
  await capture.evaluate(()=>{S.budget=4500;renderMonthStat()});
  await capture.locator('#mNext').click();
  await capture.locator('#moneyViewSwitch [data-v="entry"]').click();
  assert.equal(await capture.locator('#dateIn').inputValue(),'2026-11-19');
  await capture.locator('#amtIn').fill('5799');
  await capture.locator('#amtSave').click();
  await capture.locator('#moneyViewSwitch [data-v="analysis"]').click();
  assert.equal(await capture.locator('#mLabel').textContent(),'2026年11月');
  assert.match(await capture.locator('#flowPieRange').textContent(),/2026-11-01 ~ 2026-11-30/);
  assert.match(await capture.locator('#flowPie').textContent(),/11,374\.66/);
  assert.match(await capture.locator('#flowPieBudget').textContent(),/7,494\.74/);
  assert.deepEqual(await amounts(capture,1,/^11 月/),['¥7,494.74','¥3,879.92','¥11,374.66']);
  assert.equal(await capture.locator('#budgetWarnLabel').textContent(),'警戒 ¥2,850');
  await capture.locator('#mNext').click();
  assert.match(await capture.locator('#budgetTxt').textContent(),/¥1,505.26（已扣上月 ¥2,994.74）/);
  assert.match(await capture.locator('#budgetAdviceLabel').textContent(),/建议预算 ¥3,640.78（高于本月可用预算）/);
  assert.equal(await capture.locator('#budgetAdviceMark.outside').isVisible(),true);
  await capture.context().close();
  pass('saving from the next-month preview reveals the recorded month in both charts and restores the daily warning');

  for(const width of [320,375,414,768]){
    const mobile=await pageAt(width);
    await load(mobile,forecastRows);
    const measured=await mobile.locator('#expenseAnalysisSec').evaluate(sec=>({
      right:sec.getBoundingClientRect().right,viewport:document.documentElement.clientWidth,
      heights:[...sec.querySelectorAll('select')].map(x=>x.getBoundingClientRect().height),
      scrolls:[...sec.querySelectorAll('.ea-scroll')].map(x=>[x.scrollWidth,x.clientWidth])
    }));
    assert(measured.right<=measured.viewport+1,JSON.stringify({width,measured}));
    assert(measured.heights.every(h=>h>=44),JSON.stringify({width,measured}));
    assert(measured.scrolls.every(([content,viewport])=>content<=viewport+1),JSON.stringify({width,measured}));
    await mobile.evaluate(()=>{S.budget=4500;renderMonthStat()});
    const rects=await mobile.locator('.budget-bar-wrap').evaluate(wrap=>{
      const advice=wrap.querySelector('#budgetAdviceLabel').getBoundingClientRect();
      const warning=wrap.querySelector('#budgetWarnLabel').getBoundingClientRect();
      const {left,right}=wrap.getBoundingClientRect();
      return {fits:advice.left>=left-1&&advice.right<=right+1,belowWarning:advice.top>=warning.bottom};
    });
    assert.deepEqual(rects,{fits:true,belowWarning:true},String(width));
    await mobile.locator('#mNext').click();
    assert.equal(await mobile.locator('#budgetAdviceLabel').textContent(),'建议预算 ¥266.67');
    await mobile.context().close();
  }
  pass('320/375/414/768 widths, separated budget labels, fully visible cells and 44px controls');

  if(process.env.EXPENSE_ANALYSIS_PREVIEW){
    const offline=await pageAt(390,process.env.EXPENSE_ANALYSIS_PREVIEW);
    assert.equal(await offline.locator('#expenseAnalysisSec').isVisible(),true);
    assert.match(await offline.locator('#eaResults').innerText(),/暂无支出记录/);
    await load(offline,rows);
    assert.deepEqual(await amounts(offline,0,'2026年12月预算建议'),['¥266.67','¥48.33','¥315']);
    await offline.context().close();
    pass('offline review opens directly and computes the same result');
  }
  assert.deepEqual(errors,[]);
  assert.deepEqual(external,[]);
  console.log('Expense analysis checks passed: '+checks);
})().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{
  await browser?.close();
  server?.kill();
});
