/* Unified wealth acceptance uses synthetic fixtures and isolated browser storage only. */
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const output=path.resolve('../../../output/finance-review-20261119');
let browser,checks=0;
const pass=name=>{checks++;console.log('PASS '+name)};
(async()=>{
 browser=await chromium.launch({executablePath:process.env.SAVINGS_BROWSER});
 const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'Asia/Shanghai',reducedMotion:'reduce'});
 const errors=[],external=[];
 await context.route('**/*',r=>{if(r.request().url().startsWith('file:'))return r.continue();external.push(r.request().url());return r.abort()});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.clock.setFixedTime(new Date('2026-11-19T03:00:00Z'));
 await page.goto(pathToFileURL(path.join(output,'index.html')).href+'#savings');
 await page.waitForFunction(()=>syncActive()&&!syncBusy);
 const original=await page.evaluate(()=>JSON.stringify([S.ledger,S.fundMgr.assets,S.fundMgr.liabilities,S.fundMgr.goals]));
 assert.equal(await page.locator('#moneyViewSwitch button').count(),3);
 assert.equal(await page.locator('#moneyViewSwitch [data-v="plan"]').count(),0);
 assert.equal(await page.locator('#fmMonthSaved,#fmYearSaved,#fmAssets,#fmLiabs').count(),0);
 assert.deepEqual(await page.evaluate(()=>svWealth()),{deposit:1270000,other:500000,debt:200000,total:1770000,net:1570000});
 assert.equal(await page.locator('[data-position-review]').count(),1);
 assert.match(await page.locator('#svGoals').innerText(),/当前 ¥700/);
 assert.match(await page.locator('#svGoals').innerText(),/当前 ¥200/);
 assert.match(await page.locator('#svGoals').innerText(),/当前 ¥12,700/);
 assert.match(await page.locator('#svLegacyGoalsText').textContent(),/999/);
 pass('one savings entry, legacy duplicate balance editors removed, derived wealth and monthly/yearly goals correct');

 await page.locator('[data-position-review]').click();
 await page.locator('#svPositionKind').selectOption('linked');
 await page.locator('#svPositionAccount').selectOption('virtual-bank');
 await page.locator('#svPositionForm button[type=submit]').click();
 assert.equal(await page.locator('[data-position-review]').count(),0);
 assert.equal(await page.evaluate(()=>svWealth().total),1770000);
 assert.equal(await page.evaluate(()=>JSON.stringify([S.ledger,S.fundMgr.assets,S.fundMgr.liabilities,S.fundMgr.goals])),original);
 await page.locator('#svLinkedDetails summary').click();
 assert.match(await page.locator('#svLinkedAssets').innerText(),/已关联 虚拟工资卡/);
 pass('explicit old-asset association prevents double counting and keeps original balances, manual goals and ledger intact');

 await page.locator('#svEditGoals').click();
 await page.locator('#monthNetTargetCents').fill('2000');
 await page.locator('#yearNetTargetCents').fill('6000');
 await page.locator('#yearBalanceTargetCents').fill('20000');
 await page.locator('#svGoalsForm button[type=submit]').click();
 assert.match(await page.locator('#svGoals').innerText(),/¥2,000/);
 assert.deepEqual(await page.locator('#svGoals progress').evaluateAll(nodes=>nodes.map(n=>n.value)),[35,200/6000*100,63.5]);
 assert.equal(await page.evaluate(()=>S.fundMgr.goals.monthGoal),1000);
 pass('goals edit only targets; progress derives from net deposits and current balance, with legacy targets retained');

 async function flow(kind,amount,to){
  await page.locator('#svKind').selectOption(kind);
  await page.locator('#svAccount').selectOption('virtual-bank');
  if(to)await page.locator('#svToAccount').selectOption(to);
  await page.locator('#svAmount').fill(amount);await page.locator('#svDate').fill('2026-11-19');
  await page.locator('#svSave').click();
 }
 await flow('deposit','100');
 assert.equal(await page.evaluate(()=>svWealth().deposit),1280000);
 assert.match(await page.locator('#svGoals').innerText(),/当前 ¥800/);
 const wealth=await page.evaluate(()=>svWealth());
 await flow('transfer','100','virtual-wechat');
 assert.deepEqual(await page.evaluate(()=>svWealth()),wealth);
 assert.match(await page.locator('#svGoals').innerText(),/当前 ¥800/);
 assert.equal(await page.evaluate(()=>S.ledger.length),113);
 pass('deposit updates goals and net worth; internal transfer adds neither savings progress nor ledger income');

 await page.locator('#svAddAsset').click();
 await page.locator('#svPositionName').fill('虚拟其他资产');
 await page.locator('#svPositionAmount').fill('1000');
 await page.locator('#svPositionForm button[type=submit]').click();
 assert.equal(await page.evaluate(()=>svWealth().other),600000);
 const addedId=await page.evaluate(()=>svPositions().find(x=>x.name==='虚拟其他资产').id);
 await page.locator('[data-position-delete="'+addedId+'"]').click();
 await page.locator('#svDeleteConfirm button[type=submit]').click();
 assert.equal(await page.evaluate(()=>svWealth().other),500000);
 const stale=await page.evaluate(id=>{
  const tomb=S.savingsPositions.find(x=>x.id===id),saved=JSON.stringify(S.savingsPositions);
  mergeState({savingsPositions:[{...tomb,deletedAt:undefined,updatedAt:'2025-01-01T00:00:00Z'}]});
  return {removed:!svPositions().some(x=>x.id===id),same:JSON.stringify(S.savingsPositions)===saved};
 },addedId);
 assert(stale.removed);
 await page.locator('[data-position-edit="virtual-fund"]').click();
 await page.evaluate(()=>{
  mergeState({savingsPositions:[{...S.savingsPositions.find(x=>x.id==='virtual-fund'),amountCents:600000,updatedAt:'2026-11-20T00:00:00Z'}]});
 });
 await page.locator('#svPositionAmount').fill('7000');
 await page.locator('#svPositionForm button[type=submit]').click();
 assert.match(await page.locator('#svDialogError').innerText(),/已更新/);
 await page.locator('#svDialogCancel').click();
 pass('other assets use validated edits and tombstones; stale sync or an old open form cannot overwrite newer values');

 const transport=await page.evaluate(()=>{
  const snapshot=structuredClone(S),kept=JSON.stringify([S.ledger,S.savingsEntries,S.fundMgr]);
  S=structuredClone(DEFAULT);mergeState(snapshot);
  const fresh={wealth:svWealth(),goals:svGoals(),legacy:svLegacyItems().length};
  const goal=structuredClone(S.savingsGoals);
  mergeData({savingsGoals:{...goal,monthNetTargetCents:1,updatedAt:'2025-01-01T00:00:00Z'},savingsPositions:snapshot.savingsPositions});
  const olderIgnored=S.savingsGoals.monthNetTargetCents===goal.monthNetTargetCents;
  S=snapshot;save();renderAll();
  return {fresh,olderIgnored,kept:JSON.stringify([S.ledger,S.savingsEntries,S.fundMgr])===kept};
 });
 assert.equal(transport.fresh.wealth.total,1880000);
 assert.equal(transport.fresh.goals.monthNetTargetCents,200000);
 assert.equal(transport.fresh.legacy,0);
 assert(transport.olderIgnored&&transport.kept);
 await page.reload();await page.waitForFunction(()=>syncActive()&&!syncBusy);
 assert.equal(await page.evaluate(()=>svWealth().total),1880000);
 assert.equal(await page.evaluate(()=>S.savingsGoals.monthNetTargetCents),200000);
 await page.locator('#svEditGoals').click();await page.evaluate(()=>setAmountPrivacy(true));
 assert.equal(await page.locator('#svGoalsForm').count(),0);
 assert(await page.locator('#svEditGoals').isDisabled());
 assert(await page.locator('#svAddAsset').isDisabled());
 assert.match(await page.locator('#svAllocation').innerText(),/已隐藏/);
 assert.doesNotMatch(await page.locator('#svWealth').innerText(),/[0-9]/);
 await page.locator('#amountPrivacyToggle').click();
 pass('new asset and goal fields survive merge/export-shaped data, reject stale goals, reload correctly, and honor privacy');

 for(const width of [320,375,390,414,768,1440]){
  await page.setViewportSize({width,height:1000});
  await page.evaluate(()=>{document.body.classList.remove('nav-open');goTab('money');setMoneyView('savings')});
  const overflow=await page.locator('#savingsSec').evaluate(sec=>sec.getBoundingClientRect().right>document.documentElement.clientWidth+1);
  assert(!overflow,'savings overflow '+width);
  const short=await page.locator('#savingsSec button:visible').evaluateAll(nodes=>nodes.filter(n=>n.getBoundingClientRect().height<44).map(n=>n.textContent));
  assert.deepEqual(short,[]);
  if(width===390||width===1440)await page.screenshot({path:path.join(output,'unified-savings-'+width+'.png'),animations:'disabled'});
 }
 await page.evaluate(()=>{const saved=S;S=structuredClone(DEFAULT);renderMoney();S=saved;renderMoney()});
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 pass('six widths, empty old data, visible controls at least 44px and zero browser errors/external requests');
 await page.setViewportSize({width:390,height:1000});
 await page.locator('#svGoalsCard').scrollIntoViewIfNeeded();
 await page.screenshot({path:path.join(output,'unified-goals-390.png'),animations:'disabled'});
 await page.locator('#svWealthCard').scrollIntoViewIfNeeded();
 await page.screenshot({path:path.join(output,'unified-wealth-390.png'),animations:'disabled'});
 console.log('UNIFIED SAVINGS GROUPS '+checks);
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>browser?.close());
