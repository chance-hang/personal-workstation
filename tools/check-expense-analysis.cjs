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

async function pageAt(width,offline,formal=false){
  const context=await browser.newContext({viewport:{width,height:920},timezoneId:'Asia/Shanghai',reducedMotion:'reduce'});
  await context.addInitScript(()=>localStorage.setItem('wb_sidebar_open','0'));
  await context.route('**/*',route=>{
    if(route.request().url().startsWith(origin+'/')||route.request().url().startsWith('file:'))return route.continue();
    external.push(route.request().url());return route.abort();
  });
  const page=await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  await page.clock.setFixedTime(new Date('2026-11-19T03:00:00Z'));
  await page.goto(offline?pathToFileURL(offline).href+'#expense-analysis':origin+(formal?'/?releaseCheck=1':'/?mockSync=1#expense-analysis'));
  await page.waitForFunction(()=>typeof S!=='undefined'&&typeof renderAll==='function');
  if(!formal)await page.waitForFunction(()=>syncActive()&&!syncBusy);
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
    env:{...process.env,PORT:String(port),MOCK_PREVIEW_ONLY:'0',MOCK_BIND_HOST:'127.0.0.1'},
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
  await load(page,[entry('refund','2026-10-15',-25),entry('regular','2026-10-16',2,outCat)]);
  await page.locator('#eaMode').selectOption('month');
  assert.deepEqual(await amounts(page,0,'平均月支出'),['¥-25','¥2','¥-23']);
  assert.deepEqual(await amounts(page,0,'2026年12月预算建议'),['¥0','¥2','¥2']);
  pass('annualized fallback, cent precision, refunds, 12-month cutoff and December rollover');

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

  await page.locator('#moneyViewSwitch [data-v="plan"]').click();
  assert.equal(await page.locator('#expenseAnalysisSec').isVisible(),false);
  await page.locator('#amountPrivacyToggle').click();
  assert.doesNotMatch(await page.locator('#eaResults').textContent(),/¥/);
  await page.locator('#moneyViewSwitch [data-v="analysis"]').click();
  assert.match(await page.locator('#eaResults').innerText(),/支出分析已隐藏/);
  await page.locator('#amountPrivacyToggle').click();
  assert.deepEqual(await amounts(page,1,/^10 月/),['¥550','¥0','¥550']);
  pass('fund-planning tab separation and privacy purges derived amounts even when offscreen');

  for(const width of [320,375,414,768]){
    const mobile=await pageAt(width);
    await load(mobile,rows);
    const measured=await mobile.locator('#expenseAnalysisSec').evaluate(sec=>({
      right:sec.getBoundingClientRect().right,viewport:document.documentElement.clientWidth,
      heights:[...sec.querySelectorAll('select')].map(x=>x.getBoundingClientRect().height),
      scrolls:[...sec.querySelectorAll('.ea-scroll')].map(x=>[x.scrollWidth,x.clientWidth])
    }));
    assert(measured.right<=measured.viewport+1,JSON.stringify({width,measured}));
    assert(measured.heights.every(h=>h>=44),JSON.stringify({width,measured}));
    assert(measured.scrolls.every(([content,viewport])=>content<=viewport+1),JSON.stringify({width,measured}));
    await mobile.context().close();
  }
  pass('320/375/414/768 widths, fully visible cells and 44px controls');

  const formal=await pageAt(390,null,true);
  const contract=await formal.evaluate(()=>({mock:MOCK_SYNC,key:KEY,mirror:IDB_NAME,gist:GITHUB_API,empty:S.ledger.length}));
  assert.deepEqual(contract,{mock:false,key:'lifeworkbench_v1',mirror:'lifeworkbench_local_v1',gist:'https://api.github.com/gists',empty:0});
  await formal.locator('[data-p="money"]').first().evaluate(button=>button.click());
  await formal.locator('#moneyViewSwitch [data-v="analysis"]').click();
  assert.equal(await formal.locator('#expenseAnalysisSec').isVisible(),true);
  assert.equal(await formal.locator('#moneyViewSwitch [data-v="savings"]').count(),0);
  await formal.context().close();
  pass('production entry renders with an empty ledger, original storage and Gist mode, and only the authorized analysis module');

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
