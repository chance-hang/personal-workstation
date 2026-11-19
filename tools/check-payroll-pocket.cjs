/* End-to-end payroll and savings checks using synthetic data and a loopback Mock. */
const assert=require('node:assert/strict');
const {once}=require('node:events');
const {spawn}=require('node:child_process');
const {chromium}=require('playwright');
const origin='http://127.0.0.1:4236';
const when=new Date('2026-11-19T05:00:00Z');
const errors=[],external=[];
let browser,server;
const save=p=>p.locator('#fmEditForm button[type=submit]').click();
const text=(p,id)=>p.locator('#'+id).textContent();
const log=label=>console.log('PASS '+label);

async function open(width){
  const context=await browser.newContext({viewport:{width,height:960},timezoneId:'Asia/Shanghai',reducedMotion:'reduce'});
  await context.route('**/*',route=>{
    if(new URL(route.request().url()).origin===origin)return route.continue();
    external.push(route.request().url());return route.abort();
  });
  const p=await context.newPage();
  p.on('pageerror',error=>errors.push(error.message));
  await p.clock.setFixedTime(when);
  await p.goto(origin+'/?mockSync=1#savings');
  await p.waitForFunction(()=>syncActive()&&!syncBusy);
  assert.equal(await p.locator('#svAllocationPlan').evaluate(el=>el.open),true);
  return p;
}

(async()=>{
  server=spawn(process.execPath,['tools/mock-sync-server.mjs'],{
    env:{...process.env,PORT:'4236',MOCK_PREVIEW_ONLY:'1',MOCK_BIND_HOST:'127.0.0.1'},
    stdio:['ignore','pipe','inherit'],windowsHide:true
  });
  const [ready]=await once(server.stdout,'data',{signal:AbortSignal.timeout(8000)});
  assert.match(String(ready),/LOCAL_MOCK_SERVER_READY/);
  browser=await chromium.launch({executablePath:process.env.SAVINGS_BROWSER});
  const p=await open(1024);
  const protectedData=await p.evaluate(()=>{
    clearTimeout(syncTimer);
    S=structuredClone(DEFAULT);
    S.ledger=[{id:'b1',date:'2026-11-10',category:'餐饮',type:'expense',amount:120,note:'虚拟流水'}];
    S.budget=4500;
    S.budgetCats={'虚拟差旅':false};
    S.savingsAccounts=[
      {id:'pocket',name:'虚拟小荷包',openingDate:'2026-11-01',openingCents:200000},
      {id:'salary',name:'虚拟工资卡',openingDate:'2026-11-01',openingCents:600000}
    ];
    ensureFundMgr();
    renderAll();
    return JSON.stringify([S.ledger,S.budget,S.budgetCats,S.fundMgr]);
  });
  await p.locator('#fmSetPocket').click();
  await p.locator('#fmPocketAccount').selectOption('pocket');
  await p.locator('#fmOpeningPending').fill('200');
  await save(p);
  assert.equal(await p.evaluate(()=>svBalance(fmPocket())),200000);
  assert.match(await text(p,'fmTransferSummary'),/待补回¥200/);
  assert.equal(await p.locator('#fmRulePanel').evaluate(el=>el.open),true);
  await p.locator('#fmAddDir').click();
  await p.locator('#fmDirectionName').fill('固定支出');
  await save(p);
  await p.locator('#fmAddRule').click();
  await p.locator('#fmRuleTarget').selectOption({label:'固定支出'});
  await p.locator('#fmRuleValue').fill('300');
  await save(p);
  await p.locator('#fmIncome').fill('9000');
  assert.match(await text(p,'fmResultGrid'),/固定支出¥300/);
  assert.match(await text(p,'fmTransferSummary'),/测算月目标¥3,000/);
  assert.equal(await p.evaluate(()=>fmPlan('2026-11')),undefined);
  await p.locator('#fmCalc').click();
  assert.match(await text(p,'svGoals'),/本月新增存钱¥0 \/ ¥3,000/);
  assert.match(await text(p,'fmHistoryList'),/2026-11 · 目标 ¥3,000/);
  assert.equal(protectedData,await p.evaluate(()=>JSON.stringify([S.ledger,S.budget,S.budgetCats,S.fundMgr])));
  log('old remainder no longer swallows a new fixed rule; confirmation saves the month and preserves existing data');

  await p.locator('#fmAddRule').click();
  await p.locator('#fmRuleMethod').selectOption('remainder');
  await save(p);
  assert.match(await text(p,'fmPreviewStatus'),/多条剩余规则/);
  assert.equal(await p.locator('#fmCalc').isDisabled(),true);
  await p.locator('#fmRules .fm-list-row').filter({hasText:'全部剩余'}).filter({hasText:'自由支配'}).getByRole('button').click();
  await p.locator('#fmRemoveRule').click();
  await p.locator('#fmIncome').fill('4000');
  assert.match(await text(p,'fmPreviewStatus'),/分配超过工资/);
  assert.equal(await p.locator('#fmCalc').isDisabled(),true);
  await p.locator('#fmIncome').fill('9000');
  assert.match(await text(p,'fmPreviewStatus'),/已确认本月目标 ¥3,000/);
  await p.locator('#fmAddRule').click();
  await p.locator('#fmRuleTarget').selectOption({label:'固定支出'});
  await p.locator('#fmRuleMethod').selectOption('percent');
  await p.locator('#fmRuleValue').fill('10');
  await p.locator('#fmRuleCond').selectOption('gte');
  await p.locator('#fmRuleThreshold').fill('10000');
  await save(p);
  assert.match(await text(p,'fmResultGrid'),/固定支出¥300/);
  await p.locator('#fmIncome').fill('10000');
  assert.match(await text(p,'fmResultGrid'),/固定支出¥1,300/);
  await p.locator('#fmRules .fm-list-row').filter({hasText:'10%'}).getByRole('button').click();
  await p.locator('#fmRuleEnabled').uncheck();
  await save(p);
  assert.match(await text(p,'fmResultGrid'),/固定支出¥300/);
  await p.locator('#fmIncome').fill('9000');
  assert.match(await text(p,'svGoals'),/本月新增存钱¥0 \/ ¥3,000/);
  log('rule conditions, percentages and disabling work; conflicts and new previews cannot overwrite the saved target');

  await p.locator('#fmRecordOut').click();
  await p.locator('#fmEntryAmount').fill('600');
  await p.locator('#fmEntryDate').fill('2026-11-15');
  await save(p);
  assert.match(await text(p,'fmTransferSummary'),/本次建议转入¥3,800/);
  await p.locator('#fmRecordIn').click();
  assert.equal(await p.locator('#fmEntryAmount').inputValue(),'3000');
  assert.equal(await p.locator('#fmEntryRepay').inputValue(),'800');
  await p.locator('#fmEntryOther').selectOption('salary');
  await p.locator('#fmEntryRepay').fill('801');
  await save(p);
  assert.match(await text(p,'svDialogError'),/补回超过待补金额/);
  await p.locator('#fmEntryRepay').fill('800');
  await save(p);
  assert.deepEqual(await p.evaluate(()=>fmPocketMetrics()),{pending:0,monthly:300000,yearly:300000});
  assert.deepEqual(await p.evaluate(()=>[svBalance(fmPocket()),svBalance(svAccounts().find(a=>a.id==='salary')),S.savingsEntries.length]),[520000,220000,2]);
  assert.match(await text(p,'svGoals'),/本月新增存钱¥3,000 \/ ¥3,000/);
  assert.equal(protectedData,await p.evaluate(()=>JSON.stringify([S.ledger,S.budget,S.budgetCats,S.fundMgr])));
  log('opening debt and emergency withdrawals are tracked separately; one transfer records new savings and repayment without changing the ledger');

  await p.locator('#svEditGoals').click();
  assert.equal(await p.locator('#fmYearAmount').inputValue(),'6000');
  await p.locator('#fmUseEstimate').click();
  await save(p);
  assert.match(await text(p,'svGoals'),/本年累计新增¥3,000 \/ ¥6,000/);
  await p.evaluate(()=>{
    S.savingsPayPlans.push({id:'2026-10',targetCents:1000000,bonus:true,updatedAt:'2026-10-25T05:00:00Z'});
    persist();renderSavings();
  });
  assert.match(await text(p,'svGoals'),/年末预计新增¥6,000/);
  await p.clock.setFixedTime(new Date('2026-12-01T05:00:00Z'));
  await p.evaluate(()=>renderSavings());
  assert.equal(await p.locator('#fmIncome').inputValue(),'');
  assert.match(await text(p,'fmHistoryList'),/2026-11 · 目标 ¥3,000/);
  assert.match(await text(p,'svGoals'),/本月新增存钱¥0 \/ 未设置/);
  await p.clock.setFixedTime(when);
  await p.evaluate(()=>renderSavings());
  log('annual estimate excludes exceptional salary months, and new months do not reuse old wages');

  await p.locator('#fmRecordIn').click();
  await p.locator('#fmEntryAmount').fill('9461.25');
  await p.evaluate(()=>setAmountPrivacy(true));
  assert.equal(await p.locator('#fmEditForm').count(),0);
  assert.equal(await p.locator('#fmIncome').inputValue(),'');
  assert.doesNotMatch(await text(p,'svAllocationPlan'),/9,461\.25|3,800|6,000/);
  assert.equal(await p.locator('#fmRecordIn').isDisabled(),true);
  await p.locator('#amountPrivacyToggle').click();
  log('amount privacy clears the visible payroll preview and closes a pocket entry draft');

  await p.evaluate(async()=>{clearTimeout(syncTimer);await cloudPush();clearTimeout(syncTimer)});
  const other=await open(390);
  const sync=await other.evaluate(()=>({pocket:fmPocket()?.id,month:fmPlan('2026-11')?.targetCents,year:fmPlan('2026')?.targetCents,actual:fmPocketMetrics(),rule:fmSettings().rules.some(r=>r.value===300)}));
  assert.deepEqual(sync,{pocket:'pocket',month:300000,year:600000,actual:{pending:0,monthly:300000,yearly:300000},rule:true});
  const imported=await other.evaluate(()=>{
    const payroll={...S.savingsPayroll,rules:[],updatedAt:'2020-01-01T00:00:00Z'};
    mergeData({savingsPayroll:payroll,savingsPayPlans:[{id:'2026-11',targetCents:1,updatedAt:'2020-01-01T00:00:00Z'}]});
    return [fmPlan('2026-11').targetCents,fmSettings().rules.some(r=>r.value===300)];
  });
  assert.deepEqual(imported,[300000,true]);
  log('Mock sends the pocket setup, rule, snapshots and tagged transactions to another device; stale imports keep current values');

  for(const width of [320,375,414,768]){
    await other.setViewportSize({width,height:960});
    const metrics=await other.locator('#svAllocationPlan').evaluate(el=>({
      fits:el.scrollWidth<=el.clientWidth+1,
      controls:[...el.querySelectorAll('button,input:not([type="checkbox"]),summary')].filter(e=>e.getClientRects().length).map(e=>e.getBoundingClientRect().height)
    }));
    assert(metrics.fits&&metrics.controls.every(h=>h>=44),JSON.stringify({width,metrics}));
  }
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  log('320, 375, 414 and 768px controls fit; no browser errors or external requests');
})().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{await browser?.close();server?.kill();});
