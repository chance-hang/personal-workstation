/* Finance acceptance uses synthetic data and temporary profiles. No real accounts or Gists. */
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
const output=path.resolve('../../../output/finance-review-20261119');
const fixturePath=path.join(output,'虚拟数据.json');
const checks=[];
const pass=name=>{checks.push(name);console.log('PASS '+name)};
(async()=>{
 const fixture=JSON.parse(await fs.readFile(fixturePath,'utf8'));
 let server;
 const browser=await chromium.launch({executablePath:process.env.SAVINGS_BROWSER});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'Asia/Shanghai',reducedMotion:'reduce'});
  const external=[],errors=[];
  await context.route('**/*',route=>{
   if(route.request().url().startsWith('file:'))return route.continue();
   external.push(route.request().url());return route.abort();
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.clock.setFixedTime(new Date('2026-11-19T03:00:00Z'));
  await page.goto(pathToFileURL(path.join(output,'index.html')).href+'#expense-analysis');
  await page.waitForFunction(()=>typeof S!=='undefined'&&syncActive()&&!syncBusy);
  const initial=await page.evaluate(()=>({count:S.ledger.length,budget:S.budget,ns:_LS_NS,demo:S._demoSeeded,valid:svValidate(S),endpoint:GITHUB_API}));
  assert.deepEqual(initial,{count:113,budget:4500,ns:'review_finance_audit_20261119_',demo:true,valid:'',endpoint:'/__mock_gists'});
  assert.match(await page.locator('#budgetTxt').textContent(),/2,900.*4,500/);
  assert.match(await page.locator('#budgetExcl').textContent(),/1,800/);
  assert.match(await page.locator('#incomeExcl').textContent(),/1,800/);
  const baseline=await page.evaluate(()=>JSON.stringify([S.ledger,S.budget,S.customCats,S.budgetCats]));
  assert.match(await page.locator('#eaResults').innerText(),/2,114.29/);
  assert.match(await page.locator('#eaResults').innerText(),/2,400/);
  assert.match(await page.locator('#eaResults').innerText(),/1,050/);
  await page.locator('#eaMode').selectOption('year');
  assert.match(await page.locator('#eaResults').innerText(),/25,800/);
  assert.match(await page.locator('#eaResults').innerText(),/11,100/);
  assert.match(await page.locator('#eaResults').innerText(),/21,500/);
  assert.match(await page.locator('#eaResults').innerText(),/9,750/);
  assert.equal(await page.evaluate(()=>JSON.stringify([S.ledger,S.budget,S.customCats,S.budgetCats])),baseline);
  pass('preloaded isolated fixture; 113 ledger records; budget/excluded reimbursement and hand-calculated monthly/yearly figures');

  await page.locator('#moneyViewSwitch [data-v="savings"]').click();
  assert.equal(await page.locator('#svTotal').innerText(),'¥12,700');
  await page.locator('#svMode').selectOption('month');
  await page.locator('#svPeriod').fill('2026-11');await page.locator('#svPeriod').dispatchEvent('change');
  const nov=await page.evaluate(()=>svSummary('2026-11-01','2026-11-30'));
  assert.equal(nov.opening,1200000);assert.equal(nov.closing,1270000);assert.equal(nov.net,70000);assert.equal(nov.transfer,0);
  assert.equal(await page.evaluate(()=>JSON.stringify([S.ledger,S.budget,S.customCats,S.budgetCats])),baseline);
  pass('three virtual accounts, ¥12,700 total and ¥700 November net saving; transfer leaves ledger and total unchanged');

  const settings=await page.evaluate(fixture=>{
   const original=S,results={};
   function reset(value){S=structuredClone(value)}
   const legacy=structuredClone(fixture);delete legacy.ledgerSettingsUpdatedAt;
   reset(structuredClone(DEFAULT));mergeState(legacy);
   results.fresh=[S.budget,catInBudget('expense','虚拟差旅费'),S.ledger.length,S.customCats.expense.length];
   const good=structuredClone(S);
   mergeState(structuredClone(DEFAULT));
   results.stale=[S.budget,catInBudget('expense','虚拟差旅费')];
   reset(structuredClone(DEFAULT));S.customCats.expense=[{name:'虚拟差旅费',color:'#6a8db5'}];mergeState(legacy);
   results.partial=catInBudget('expense','虚拟差旅费');
   reset(structuredClone(DEFAULT));mergeData(legacy);
   results.imported=[S.budget,catInBudget('expense','虚拟差旅费')];
   reset(good);S.budget=0;ledgerSettingTouch('budget');
   const zero=structuredClone(S);mergeState(legacy);
   results.zero=S.budget;
   reset(good);mergeState(zero);results.zeroArrives=S.budget;
   reset(good);setCatBudget('expense','虚拟差旅费',true);
   const newer=structuredClone(S);mergeState(legacy);results.newer=catInBudget('expense','虚拟差旅费');
   reset(good);mergeState(newer);results.newerArrives=catInBudget('expense','虚拟差旅费');
   reset(newer);S.customCats.expense=[];ledgerSettingTouch('custom:expense:虚拟差旅费');
   const removed=structuredClone(S);mergeState(newer);results.deleted=S.customCats.expense.length;
   reset(newer);mergeState(removed);results.deletionArrives=S.customCats.expense.length;
   reset(good);S.budget=3000;S.ledgerSettingsUpdatedAt={budget:1795000000000};const a=structuredClone(S);
   S.budget=3500;const b=structuredClone(S);mergeState(a);const ba=S.budget;
   reset(a);mergeState(b);results.tied=[ba,S.budget];
   reset(good);S.ledger=[{id:'new-local',type:'income',category:'工资',date:'2026-11-19',amount:10}];mergeState(legacy);results.retained=S.ledger.some(x=>x.id==='new-local');
   S=original;save();renderAll();return results;
  },fixture);
  assert.deepEqual(settings,{fresh:[4500,false,113,1],stale:[4500,false],partial:false,imported:[4500,false],zero:0,zeroArrives:0,newer:true,newerArrives:true,deleted:0,deletionArrives:0,tied:[3500,3500],retained:true});
  pass('new-device bootstrap, stale zero protection, merge-import flags, deliberate zero, category changes/deletions and deterministic conflict resolution');


  server=spawn(process.execPath,['tools/mock-sync-server.mjs'],{env:{...process.env,PORT:'4223',MOCK_BIND_HOST:'0.0.0.0'},stdio:['ignore','pipe','inherit'],windowsHide:true});
  const [ready]=await once(server.stdout,'data',{signal:AbortSignal.timeout(6000)});
  assert.match(String(ready),/LOCAL_MOCK_SERVER_READY/);
  async function peer(host){
   const ctx=await browser.newContext();
   await ctx.route('**/*',route=>{
    if(new URL(route.request().url()).origin===host)return route.continue();
    external.push(route.request().url());return route.abort();
   });
   const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));
   await p.goto(host+'/?mockSync=1');
   await p.waitForFunction(()=>syncActive()&&!syncBusy);
   return p;
  }
  const a=await peer('http://127.0.0.1:4223');
  await a.evaluate(async fixture=>{S=structuredClone(fixture);save();clearTimeout(syncTimer);await cloudPush();clearTimeout(syncTimer)},fixture);
  const b=await peer('http://localhost:4223');
  assert.deepEqual(await b.evaluate(()=>[S.budget,catInBudget('expense','虚拟差旅费'),S.ledger.length,svAccounts().length]),[4500,false,113,3]);
  await b.evaluate(async()=>{S.budget=0;ledgerSettingTouch('budget');save();clearTimeout(syncTimer);await cloudPush();clearTimeout(syncTimer)});
  await a.evaluate(async()=>{clearTimeout(syncTimer);await cloudPush();clearTimeout(syncTimer)});
  assert.equal(await a.evaluate(()=>S.budget),0);
  await b.evaluate(async()=>{clearTimeout(syncTimer);await cloudPull({force:true});clearTimeout(syncTimer)});
  assert.equal(await b.evaluate(()=>S.budget),0);
  assert.equal(await b.evaluate(()=>catInBudget('expense','虚拟差旅费')),false);

  const formalContext=await browser.newContext();
  await formalContext.route('**/*',route=>{
   if(new URL(route.request().url()).origin==='http://127.0.0.1:4223')return route.continue();
   external.push(route.request().url());return route.abort();
  });
  const formal=await formalContext.newPage();
  formal.on('pageerror',e=>errors.push(e.message));
  await formal.goto('http://127.0.0.1:4223/');
  await formal.waitForFunction(()=>typeof S!=='undefined'&&typeof cloudPush==='function');
  assert.equal(await formal.evaluate(()=>MOCK_SYNC),false);
  await formal.evaluate(async fixture=>{S=structuredClone(fixture);await cloudPush()},fixture);
  assert.match(await formal.locator('#toast').textContent(),/阻止上传/);
  assert.equal(await formal.evaluate(()=>GITHUB_API),'https://api.github.com/gists');
  await formalContext.close();
  pass('synthetic fixture stays blocked by the production-mode upload guard');
  await a.context().close();await b.context().close();
  pass('two-origin real Mock pull/push: a fresh device receives budget, exclusions, 113 bills and three saving accounts; a deliberate zero survives stale-device push');

  // Save and reload the exact synthetic fixture through the ordinary storage path.
  await page.evaluate(fixture=>{S=structuredClone(fixture);save();renderAll()},fixture);
  await page.reload();await page.waitForFunction(()=>syncActive()&&!syncBusy);
  assert.equal(await page.evaluate(()=>S.budget),4500);
  assert.equal(await page.evaluate(()=>catInBudget('expense','虚拟差旅费')),false);
  assert.equal(await page.evaluate(()=>svSummary('2026-11-01','2026-11-30').closing),1270000);
  await page.evaluate(()=>{goTab('money');setMoneyView('analysis')});
  await page.locator('#amountPrivacyToggle').click();
  assert.doesNotMatch(await page.locator('#eaResults').innerText(),/¥/);
  await page.locator('#amountPrivacyToggle').click();
  pass('reload and privacy retain sample settings and saving balances');
  for(const width of [320,375,390,414,768,1440]){
   await page.setViewportSize({width,height:1000});
   await page.evaluate(()=>{document.body.classList.remove('nav-open');goTab('money');setMoneyView('analysis')});
   const overflow=await page.locator('#expenseAnalysisSec').evaluate(el=>el.getBoundingClientRect().right>document.documentElement.clientWidth+1);
   assert.equal(overflow,false,'analysis overflow at '+width);
   if(width===390||width===1440){
    await page.screenshot({path:path.join(output,'analysis-'+width+'.png'),animations:'disabled'});
    await page.locator('#moneyViewSwitch [data-v="savings"]').click();
    await page.screenshot({path:path.join(output,'savings-'+width+'.png'),animations:'disabled'});
   }
  }

  await page.evaluate(()=>goTab('me'));
  await page.locator('#exportBtn').click();
  const downloadPromise=page.waitForEvent('download');
  await page.locator('#expDl').click();
  const downloaded=await downloadPromise;
  const backup=JSON.parse(await fs.readFile(await downloaded.path(),'utf8'));
  assert.equal(backup.budget,4500);
  assert.equal(backup.customCats.expense.find(x=>x.name==='虚拟差旅费').inBudget,false);
  assert.equal(backup.ledger.length,113);
  assert.equal(backup.savingsEntries.length,8);
  assert(backup.ledgerSettingsUpdatedAt.budget);
  pass('ordinary JSON export keeps budget flags, setting timestamps and both finance ledgers');

  if(process.env.FINANCE_REVIEW_URL){
   const hostedContext=await browser.newContext({viewport:{width:390,height:1000}});
   const base=process.env.FINANCE_REVIEW_URL;
   await hostedContext.route('**/*',route=>{
    if(new URL(route.request().url()).origin===base)return route.continue();
    external.push(route.request().url());return route.abort();
   });
   const hosted=await hostedContext.newPage();hosted.on('pageerror',e=>errors.push(e.message));
   await hosted.goto(base+'/#savings');
   await hosted.waitForFunction(()=>syncActive()&&!syncBusy);
   assert.equal(await hosted.locator('#svTotal').innerText(),'¥12,700');
   await hosted.evaluate(()=>{S.savingsAccounts[0].openingCents=900000;save();renderSavings()});
   assert.equal(await hosted.locator('#svTotal').innerText(),'¥11,700');
   hosted.once('dialog',dialog=>dialog.accept());
   await hosted.locator('#reviewResetVirtual').click();
   await hosted.waitForFunction(()=>syncActive()&&!syncBusy&&S.savingsAccounts[0].openingCents===1000000);
   assert.equal(await hosted.locator('#svTotal').innerText(),'¥12,700');
   const attachment=await hosted.request.get(base+'/'+encodeURIComponent('虚拟数据.json'));
   assert.equal(attachment.status(),200);
   assert.match(attachment.headers()['content-disposition'],/attachment/);
   assert.equal((await attachment.json()).ledger.length,113);
   await hostedContext.close();
   pass('delivered localhost link preloads saving data, resets only its virtual fixture, and serves the JSON download');
  }
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  pass('six widths, screenshots, no external requests or browser errors');
  await fs.writeFile(path.join(output,'audit-checks.json'),JSON.stringify({checks,settings,initial,nov},null,2));
 }finally{await browser.close();server?.kill()}
})().catch(e=>{console.error(e);process.exitCode=1});
