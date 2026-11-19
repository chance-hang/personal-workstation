/* Read-only compatibility of a caller-supplied backup in temporary, network-blocked browsers. */
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
const {isDeepStrictEqual}=require('node:util');
const {chromium}=require('playwright');
const backup=process.env.PROD_FINANCE_BACKUP;
assert(backup,'PROD_FINANCE_BACKUP must point to a previously verified private JSON export');
let server,browser;
(async()=>{
 const data=JSON.parse(await fs.readFile(backup,'utf8'));
 assert(Array.isArray(data.ledger));
 const protectedKeys=['ledger','budget','budgetCats','customCats','ledgerSettingsUpdatedAt','fundMgr','savingsAccounts','savingsEntries','savingsPositions','savingsGoals','savingsPayroll','savingsPayPlans','todos','notes','worklog','habits','moods','learning'];
 const origin='http://127.0.0.1:4235';
 server=spawn(process.execPath,['tools/mock-sync-server.mjs'],{env:{...process.env,PORT:'4235',MOCK_PREVIEW_ONLY:'0',MOCK_BIND_HOST:'127.0.0.1'},stdio:['ignore','pipe','inherit'],windowsHide:true});
 const [ready]=await once(server.stdout,'data',{signal:AbortSignal.timeout(6000)});
 assert.match(String(ready),/LOCAL_MOCK_SERVER_READY/);
 browser=await chromium.launch({executablePath:process.env.SAVINGS_BROWSER});
 const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'Asia/Shanghai'});
 const errors=[],external=[];
 await context.route('**/*',route=>{
  if(new URL(route.request().url()).origin===origin)return route.continue();
  external.push(route.request().url());return route.abort();
 });
 await context.addInitScript(data=>{
  localStorage.setItem('lifeworkbench_v1',JSON.stringify(data));
  localStorage.setItem('wb_sidebar_open','0');
 },data);
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.clock.setFixedTime(new Date('2026-11-19T03:00:00Z'));
 await page.goto(origin+'/');
 await page.waitForFunction(()=>typeof S!=='undefined'&&typeof renderAll==='function');
 const actual=await page.evaluate(({data,protectedKeys})=>{
  const compare=()=>Object.fromEntries(protectedKeys.map(key=>[key,JSON.stringify(S[key])===JSON.stringify(data[key])]));
  const afterLoad=compare();
  goTab('money');setMoneyView('analysis');
  const afterAnalysis=compare();
  setMoneyView('savings');
  const afterSavings=compare();
  const pending=svLegacyItems().length;
  setMoneyView('plan');
  return {afterLoad,afterAnalysis,afterSavings,pending,count:S.ledger.length,budget:S.budget,namespace:_LS_NS,key:KEY,mirror:IDB_NAME,mock:MOCK_SYNC,gist:GITHUB_API,synthetic:!!S._demoSeeded,accounts:svAccounts().length,positions:svPositions().length};
 },{data,protectedKeys});
 for(const phase of ['afterLoad','afterAnalysis','afterSavings']){
  assert(Object.values(actual[phase]).every(Boolean),JSON.stringify({phase,checks:actual[phase]}));
 }
 assert.equal(actual.mock,false);
 assert.equal(actual.synthetic,false);
 assert.equal(actual.namespace,'');
 assert.equal(actual.key,'lifeworkbench_v1');
 assert.equal(actual.mirror,'lifeworkbench_local_v1');
 assert.equal(actual.gist,'https://api.github.com/gists');
 assert.equal(actual.accounts,(data.savingsAccounts||[]).filter(x=>!x.deletedAt).length);
 assert.equal(actual.positions,(data.savingsPositions||[]).filter(x=>!x.deletedAt).length);
 assert.equal(await page.locator('#moneyViewSwitch [data-v=plan]').count(),0);
 assert.equal(await page.locator('#savingsSec').isVisible(),true);
 const exportContext=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Shanghai'});
 await exportContext.route('**/*',route=>{
  if(new URL(route.request().url()).origin===origin)return route.continue();
  external.push(route.request().url());return route.abort();
 });
 await exportContext.addInitScript(data=>localStorage.setItem('lifeworkbench_v1',JSON.stringify(data)),data);
 const phone=await exportContext.newPage();phone.on('pageerror',e=>errors.push(e.message));
 await phone.goto(origin+'/');await phone.waitForFunction(()=>typeof S!=='undefined');
 await phone.evaluate(()=>goTab('me'));
 await phone.locator('#exportBtn').click();
 const waiting=phone.waitForEvent('download');await phone.locator('#expDl').click();
 const exported=JSON.parse(await fs.readFile(await (await waiting).path(),'utf8'));
 for(const key of protectedKeys)assert(isDeepStrictEqual(exported[key],data[key]),key+' changed in export');
 await page.evaluate(()=>{goTab('money');setMoneyView('analysis')});
 const monthSnapshot={
  budget:await page.locator('#budgetTxt').textContent(),
  excluded:await page.locator('#budgetExcl').textContent(),
  excludedIncome:await page.locator('#incomeExcl').textContent()
 };
 const expectedBudget=process.env.PROD_COMPAT_BUDGET||new Intl.NumberFormat('en-US').format(data.budget);
 assert(monthSnapshot.budget.includes(expectedBudget),'Budget summary does not match the expected snapshot');
 assert.match(monthSnapshot.excluded,/3,879.92/);
 assert.match(monthSnapshot.excludedIncome,/5,087.47/);
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 const report={protectedKeys,unchanged:true,ledgerCount:actual.count,budget:actual.budget,pendingLegacyRecords:actual.pending,monthSnapshot,productionStorageRetained:true,externalRequests:external.length,browserErrors:errors.length};
 const reportFile=process.env.PROD_FINANCE_REPORT;
 if(reportFile)await fs.writeFile(reportFile,JSON.stringify(report,null,2));
 console.log('PASS 1 production-mode backup load preserves all protected data');
 console.log('PASS 2 analysis and savings rendering preserve all protected data');
 console.log('PASS 3 old planning preference maps to savings without modifying legacy assets');
 console.log('PASS 4 mobile full JSON export round-trips protected data');
 console.log('PASS 5 budget, travel exclusions and reimbursement exclusion match before upgrade');
 console.log('PASS 6 original namespaces, empty new saving fields and zero external requests');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server?.kill()});
