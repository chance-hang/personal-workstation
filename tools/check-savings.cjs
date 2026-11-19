/* Savings checks use only synthetic records, temporary browsers and an isolated Mock. */
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
const {chromium}=require('playwright');
const port=Number(process.env.SAVINGS_TEST_PORT||4211);
const origin=`http://127.0.0.1:${port}`,remote=`http://localhost:${port}`;
const errors=[],foreign=[];
let browser,server,checks=0;
const pass=label=>{checks++;console.log('PASS '+label);};
async function pageAt(base,width=1280,mock=true){
  const context=await browser.newContext({viewport:{width,height:960},isMobile:width<760,hasTouch:width<760,timezoneId:'Asia/Shanghai'});
  await context.addInitScript(()=>window.localStorage.setItem('wb_sidebar_open','0'));
  await context.route('**/*',route=>{
    if(new URL(route.request().url()).origin===base)return route.continue();
    foreign.push(route.request().url());return route.abort();
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install({time:new Date('2026-11-18T03:00:00Z')});
  await page.goto(base+(mock?'/?mockSync=1':'/'));
  await page.waitForFunction(()=>typeof S!=='undefined'&&typeof renderAll==='function');
  if(mock)await page.waitForFunction(()=>syncActive()&&!syncBusy);
  return page;
}
async function savings(p){await p.evaluate(()=>{goTab('money');setMoneyView('savings')});}
async function addAccount(p,name,date,amount){
  await p.locator('#svAddAccount').click();
  await p.locator('#svAccountName').fill(name);await p.locator('#svOpeningDate').fill(date);await p.locator('#svOpeningAmount').fill(amount);
  await p.locator('#svAccountForm button[type=submit]').click();
  assert.equal(await p.locator('#svAccountForm').count(),0);
  return p.evaluate(name=>svAccounts().find(a=>a.name===name).id,name);
}
async function addEntry(p,kind,account,amount,date,note='',to=''){
  await p.locator('#svKind').selectOption(kind);await p.locator('#svAccount').selectOption(account);
  if(to)await p.locator('#svToAccount').selectOption(to);
  await p.locator('#svAmount').fill(amount);await p.locator('#svDate').fill(date);await p.locator('#svNote').fill(note);
  const before=await p.evaluate(()=>svEntries().map(e=>e.id));
  await p.locator('#svSave').click();
  return p.evaluate(ids=>svEntries().find(e=>!ids.includes(e.id))?.id,before);
}
async function summary(p,from,to,id=''){return p.evaluate(({from,to,id})=>svSummary(from,to,id),{from,to,id});}
async function push(p){await p.waitForFunction(()=>!syncBusy);await p.evaluate(async()=>{clearTimeout(syncTimer);await cloudPush();clearTimeout(syncTimer)});}
async function pull(p){await p.waitForFunction(()=>!syncBusy);await p.evaluate(async()=>{clearTimeout(syncTimer);await cloudPull();clearTimeout(syncTimer)});}
async function monthly(p,period){
  await p.locator('#svMode').selectOption('month');await p.locator('#svPeriod').fill(period);await p.locator('#svPeriod').dispatchEvent('change');
}
(async()=>{
  server=spawn(process.execPath,['tools/mock-sync-server.mjs'],{env:{...process.env,PORT:String(port),MOCK_PREVIEW_ONLY:'0',MOCK_BIND_HOST:'0.0.0.0'},stdio:['ignore','pipe','pipe'],windowsHide:true});
  server.stderr.on('data',chunk=>process.stderr.write(chunk));
  const [ready]=await once(server.stdout,'data',{signal:AbortSignal.timeout(8000)});assert.match(String(ready),/LOCAL_MOCK_SERVER_READY/);
  browser=await chromium.launch({executablePath:process.env.SAVINGS_BROWSER||undefined});
  const p=await pageAt(origin);
  await p.evaluate(()=>{clearTimeout(syncTimer);S=structuredClone(DEFAULT);S.ledger=[{id:'legacy-ledger',date:'2026-11-18',type:'income',amount:123,category:'工资',note:'旧收支'}];save();renderAll()});
  const legacy=await p.evaluate(()=>JSON.stringify(S.ledger));
  await savings(p);
  assert.match(await p.locator('#svTotal').innerText(),/尚未记录/);
  assert.equal(await p.locator('#moneyFormSec').isVisible(),false);
  assert.equal(await p.locator('#svEntryForm').isVisible(),false);
  pass('empty savings, no injected examples, dedicated ledger view');

  const bank=await addAccount(p,'工资卡','2025-12-01','1000');
  const cash=await addAccount(p,'现金','2026-02-01','500');
  const wx=await addAccount(p,'微信','2026-03-01','0');
  await addEntry(p,'deposit',bank,'0.10','2025-12-15');
  await addEntry(p,'deposit',bank,'0.20','2025-12-15');
  const withdraw=await addEntry(p,'withdraw',bank,'100','2026-01-05','外部取出');
  const deposit=await addEntry(p,'deposit',bank,'500','2026-02-10','二月结余');
  const transfer=await addEntry(p,'transfer',bank,'200','2026-02-12','转到现金',cash);
  assert(deposit&&withdraw&&transfer);
  const feb=await summary(p,'2026-02-01','2026-02-28');
  assert.deepEqual(feb,{recorded:true,opening:90030,added:50000,deposit:50000,withdraw:0,transfer:0,closing:190030,net:50000});
  assert.equal((await summary(p,'2026-02-01','2026-02-28',cash)).transfer,20000);
  assert.equal((await summary(p,'2026-02-01','2026-02-28',cash)).net,0);
  assert.equal(await p.evaluate(()=>JSON.stringify(S.ledger)),legacy);
  pass('exact cents, transfers counted once, middle-of-month opening isolated, ordinary ledger preserved');

  const year=await summary(p,'2026-01-01','2026-12-31');
  assert.equal(year.opening,100030);assert.equal(year.added,50000);assert.equal(year.net,40000);assert.equal(year.closing,190030);
  assert.equal((await summary(p,'2026-11-01','2026-11-30')).closing,190030);
  assert.equal((await summary(p,'2025-11-01','2025-11-30')).recorded,false);
  assert.equal((await summary(p,'2026-12-01','2026-12-31')).recorded,false);
  await p.locator('#svMode').selectOption('year');await p.locator('#svPeriod').fill('2026');await p.locator('#svPeriod').dispatchEvent('change');
  assert.equal(await p.locator('#svMonths tbody tr').count(),12);
  assert.match(await p.locator('#svMonths tbody tr').last().innerText(),/未到期/);
  await p.locator('#svFilterAccount').selectOption(cash);
  assert.match(await p.locator('#svStats').innerText(),/互转净额/);
  await p.locator('#svFilterAccount').selectOption('');
  pass('cross-year opening, annual totals, monthly carry-forward, no fabricated past or future balances');

  assert.equal(await addEntry(p,'withdraw',bank,'99999','2026-11-01'),undefined);
  assert.match(await p.locator('#svEntryError').innerText(),/余额不足/);
  assert.equal(await addEntry(p,'transfer',bank,'1','2026-01-01','',bank),undefined);
  assert.match(await p.locator('#svEntryError').innerText(),/不同账户/);
  assert.equal(await addEntry(p,'deposit',bank,'1.234','2026-01-01'),undefined);
  assert.match(await p.locator('#svEntryError').innerText(),/两位小数/);
  assert.equal(await addEntry(p,'deposit',cash,'1','2026-01-01'),undefined);
  assert.match(await p.locator('#svEntryError').innerText(),/起始日期/);
  assert.equal(await p.evaluate(()=>svDay('2026-02-30')),false);
  assert.equal(await p.evaluate(()=>svCents('1e3')),null);
  assert.equal(await p.evaluate(()=>svCents('0')),null);
  pass('overspending, self-transfer, decimals, opening date, invalid calendar and exponent input rejected');
  const historicGuard=await p.evaluate(()=>{
    const saved=S;
    const account={id:'guard',name:'历史校验',openingDate:'2026-01-01',openingCents:0};
    const entry=(id,kind,amount,date)=>({id,kind,amountCents:amount,date,accountId:'guard'});
    S={...structuredClone(DEFAULT),savingsAccounts:[account],savingsEntries:[entry('first','deposit',10000,'2026-01-02'),entry('use','withdraw',8000,'2026-01-03'),entry('later','deposit',10000,'2026-01-04')]};
    const before=stateJson(),original=S.savingsEntries[0];
    const deleted=svPut('savingsEntries',{...original,deletedAt:'2026-11-18T00:00:00Z'});
    const edited=svPut('savingsEntries',{...original,amountCents:5000});
    const unchanged=stateJson()===before;
    S=saved;renderSavings();return {deleted,edited,unchanged};
  });
  assert.match(historicGuard.deleted,/2026-01-03.*余额不足/);assert.match(historicGuard.edited,/2026-01-03.*余额不足/);assert(historicGuard.unchanged);
  pass('historical deletion or edit cannot overdraw an earlier day even when the latest balance is positive');

  await monthly(p,'2026-02');
  await p.locator(`[data-sv-edit="${deposit}"]`).click();await p.locator('#svEditAmount').fill('600');await p.locator('#svEditForm button[type=submit]').click();
  assert.equal((await summary(p,'2026-11-01','2026-11-30')).closing,200030);
  await p.locator(`[data-sv-delete="${transfer}"]`).click();await p.locator('#svDeleteConfirm button[type=submit]').click();
  assert.equal((await summary(p,'2026-02-01','2026-02-28')).closing,200030);
  assert.equal((await summary(p,'2026-02-01','2026-02-28',cash)).closing,50000);
  assert(await p.evaluate(id=>S.savingsEntries.find(e=>e.id===id).deletedAt,transfer));
  await p.locator(`[data-sv-toggle="${wx}"]`).click();assert.equal(await p.locator(`#svAccount option[value="${wx}"]`).count(),0);
  assert.match(await p.locator('#svAccounts').innerText(),/已停用/);
  await p.locator(`[data-sv-toggle="${wx}"]`).click();
  pass('historical edit recomputes later balances, transfer deletion is atomic, archived accounts retain history');

  await p.locator('#svAmount').fill('789.12');await p.locator('#svNote').fill('余额12345元');
  await p.locator('#amountPrivacyToggle').click();
  assert.match(await p.locator('#svTotal').innerText(),/••••/);assert.equal(await p.locator('#svEntryForm').isVisible(),false);
  assert.equal(await p.locator('#svAddAccount').isDisabled(),true);
  assert.doesNotMatch(await p.locator('#savingsSec').innerText(),/2,000\.3|600|789\.12|12345/);
  await p.locator('#amountPrivacyToggle').click();assert.equal(await p.locator('#svAmount').inputValue(),'789.12');
  await p.locator('#svAddAccount').click();await p.locator('#svAccountName').focus();
  await p.keyboard.press('Shift+Tab');assert.equal(await p.evaluate(()=>document.activeElement.textContent),'保存');
  await p.keyboard.press('Escape');assert.equal(await p.locator('#svAccountForm').count(),0);
  pass('amount privacy covers form, totals and history; draft retained; keyboard dialog navigation');

  await push(p);const b=await pageAt(remote,390);await savings(b);
  assert.equal((await summary(b,'2026-11-01','2026-11-30')).closing,200030);
  assert.equal(await b.evaluate(id=>!!S.savingsEntries.find(e=>e.id===id).deletedAt,transfer),true);
  await monthly(b,'2026-02');await b.locator(`[data-sv-edit="${deposit}"]`).click();
  await p.locator(`[data-sv-edit="${deposit}"]`).click();await p.locator('#svEditNote').fill('电脑新备注');await p.locator('#svEditForm button[type=submit]').click();await push(p);await pull(b);
  await b.locator('#svEditAmount').fill('700');await b.locator('#svEditForm button[type=submit]').click();
  assert.match(await b.locator('#svDialogError').innerText(),/重新打开/);await b.locator('#svDialogCancel').click();
  await b.locator(`[data-sv-edit="${deposit}"]`).click();await b.locator('#svEditAmount').fill('700');await b.locator('#svEditForm button[type=submit]').click();await push(b);await pull(p);
  assert.equal((await summary(p,'2026-11-01','2026-11-30')).closing,210030);
  const merge=await p.evaluate(id=>{
    const record=S.savingsEntries.find(e=>e.id===id),old={...record,updatedAt:'2020-01-01T00:00:00Z',amountCents:1};
    const current=svMergeRecords([record],[old]),reverse=svMergeRecords([old],[record]);
    const deleted={...record,deletedAt:record.updatedAt};
    return {same:stableNote(current)===stableNote(reverse),amount:current[0].amountCents,deleted:!!svMergeRecords([record],[deleted])[0].deletedAt};
  },deposit);
  assert.deepEqual(merge,{same:true,amount:70000,deleted:true});
  pass('two-origin Mock sync, tombstones, stale edit detection, deterministic timestamp merge');

  await p.reload();await p.waitForFunction(()=>syncActive()&&!syncBusy);await savings(p);
  assert.equal((await summary(p,'2026-11-01','2026-11-30')).closing,210030);
  const local=await p.evaluate(()=>JSON.parse(localStorage.getItem(KEY)));
  assert.equal(local.savingsAccounts.length,3);assert(local.savingsEntries.some(e=>e.deletedAt));
  await p.evaluate(async()=>{await writeLocalMirror(stateJson(),true)});
  assert.equal(await p.evaluate(async()=>JSON.parse((await readLocalMirror()).json).savingsAccounts.length),3);
  await p.evaluate(()=>goTab('me'));await p.locator('#exportBtn').click();
  const downloadPromise=p.waitForEvent('download');await p.locator('#expDl').click();const download=await downloadPromise;
  const backup=JSON.parse(await fs.readFile(await download.path(),'utf8'));
  assert.deepEqual(backup.savingsEntries,local.savingsEntries);
  await p.evaluate(backup=>{const old=structuredClone(S);S=structuredClone(DEFAULT);mergeData(backup);const result=svValidate(S);if(result)throw Error(result);if(svEntries().length!==backup.savingsEntries.filter(e=>!e.deletedAt).length)throw Error('import lost entries');S=old;renderAll()},backup);
  pass('refresh, unchanged localStorage and IndexedDB paths, full JSON export and merge import preserve records');

  await savings(p);await monthly(p,'2026-02');
  await p.evaluate(()=>{
    const original=svEntries().find(e=>e.kind==='deposit');
    for(let i=0;i<43;i++)S.savingsEntries.push({...original,id:'page-'+i,date:'2026-02-20',amountCents:1});
    renderSavings();
  });
  assert.equal(await p.locator('#svFlows .sv-flow').count(),20);await p.locator('#svNext').click();
  assert.equal(await p.locator('#svFlows .sv-flow').count(),20);
  await p.locator('#svSearch').fill('does-not-exist');assert.equal(await p.locator('#svFlows .sv-flow').count(),0);await p.locator('#svSearch').fill('');
  await p.locator('#svMode').selectOption('year');
  for(const width of [320,375,390,414,768,1440]){
    await p.setViewportSize({width,height:960});
    await p.evaluate(()=>document.body.classList.remove('nav-open'));
    await p.clock.runFor(350);
    const sizes=await p.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth,buttons:[...document.querySelectorAll('#savingsSec button')].filter(e=>e.getBoundingClientRect().height>0).every(e=>e.getBoundingClientRect().height>=44)}));
    if(sizes.scroll>sizes.width){
      console.log('OVERFLOW',await p.evaluate(()=>['.app','main','header.topbar','.topbar-row','.topbar-row>div','.greet','#moneyViewSwitch','#savingsSec','.sv-shell','.sv-pagination'].map(sel=>{const el=document.querySelector(sel),r=el.getBoundingClientRect(),c=getComputedStyle(el);return {sel,width:r.width,right:r.right,display:c.display,min:c.minWidth,flex:c.flex,grid:c.gridTemplateColumns}})));
      if(process.env.SAVINGS_ARTIFACTS){await fs.mkdir(process.env.SAVINGS_ARTIFACTS,{recursive:true});await p.screenshot({path:path.join(process.env.SAVINGS_ARTIFACTS,'overflow.png'),fullPage:true});}
    }
    assert(sizes.scroll<=sizes.width,`page overflow at ${width}: ${sizes.scroll}`);assert(sizes.buttons,`small buttons at ${width}`);
  }
  if(process.env.SAVINGS_ARTIFACTS){
    await fs.mkdir(process.env.SAVINGS_ARTIFACTS,{recursive:true});
    for(const width of [390,1440]){await p.setViewportSize({width,height:960});await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:path.join(process.env.SAVINGS_ARTIFACTS,`savings-${width}.png`),animations:'disabled'});}
  }
  pass('filtered pagination and six viewport widths without page overflow or undersized savings buttons');

  const prod=await pageAt(origin,390,false);
  assert.equal(await prod.evaluate(()=>MOCK_SYNC),false);assert.equal(await prod.evaluate(()=>svAccounts().length),0);assert.equal(await prod.evaluate(()=>svEntries().length),0);
  assert.equal(await prod.evaluate(()=>KEY),'lifeworkbench_v1');assert.equal(await prod.evaluate(()=>IDB_NAME),'lifeworkbench_local_v1');
  assert.equal(await prod.evaluate(()=>GITHUB_API),'https://api.github.com/gists');
  assert.deepEqual(errors,[]);assert.deepEqual(foreign,[]);
  pass('production remains empty, original storage and cloud protocol retained, no external requests or page errors');
  if(process.env.SAVINGS_PREVIEW){
    const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,timezoneId:'Asia/Shanghai'});
    await context.route('**/*',route=>{
      if(route.request().url().startsWith('file:'))return route.continue();
      foreign.push(route.request().url());return route.abort();
    });
    const offline=await context.newPage();offline.on('pageerror',e=>errors.push(e.message));
    await offline.clock.install({time:new Date('2026-11-18T03:00:00Z')});
    await offline.goto(pathToFileURL(process.env.SAVINGS_PREVIEW).href+'#savings');
    await offline.waitForFunction(()=>MOCK_SYNC&&syncActive()&&!syncBusy);
    assert(await offline.locator('#savingsSec').isVisible());
    const account=await addAccount(offline,'离线验收卡','2026-11-01','500');
    await addEntry(offline,'deposit',account,'25.50','2026-11-18');
    assert.equal((await summary(offline,'2026-11-01','2026-11-30')).closing,52550);
    await offline.reload();await offline.waitForFunction(()=>syncActive()&&!syncBusy);
    assert.equal((await summary(offline,'2026-11-01','2026-11-30')).closing,52550);
    assert.equal(await offline.evaluate(()=>_LS_NS),'review_savings_20261118_');
    assert.deepEqual(errors,[]);assert.deepEqual(foreign,[]);
    pass('standalone offline preview opens savings, records cents, reloads and isolates storage without external requests');
  }
  console.log(`ALL ${checks} SAVINGS GROUPS PASSED`);
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();server?.kill();});
