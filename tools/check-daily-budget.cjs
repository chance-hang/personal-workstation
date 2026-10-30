/* Synthetic data and disposable browsers on a dedicated local Mock only. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {chromium}=require('playwright');
const base=process.env.BUDGET_BASE_URL||'http://127.0.0.1:4186';
const output=process.env.BUDGET_OUTPUT;
assert(['127.0.0.1','localhost'].includes(new URL(base).hostname));
assert.equal(new URL(base).port,'4186','Only the dedicated budget test backend may be reset');
const normalize=s=>s.replace(/\r\n/g,'\n');
const baseline=normalize(execFileSync('git',['show','6b54759:app.js'],{encoding:'utf8'}));
const source=normalize(fs.readFileSync('app.js','utf8'));
const omit=s=>s.replace(/function renderFocusCard\(\)\{[\s\S]*?(?=\/\* ============ 账本)/,'');
const unchanged=source
 .replace('renderFundManager();renderAssets();renderFocusCard();','renderFundManager();renderAssets();')
 .replace('renderTodayStat();renderFocusCard();renderPies(flowFiltered())','renderTodayStat();renderPies(flowFiltered())')
 .replace("renderMonthStat();renderFocusCard();toast('预算已更新')","renderMonthStat();toast('预算已更新')");
assert.equal(omit(unchanged),omit(baseline),'All JS outside the budget card and three refresh calls must remain identical');
assert.equal(normalize(fs.readFileSync('styles.css','utf8')),normalize(execFileSync('git',['show','6b54759:styles.css'],{encoding:'utf8'})));
let count=0,browser;
const pass=name=>{count++;console.log('PASS '+name)};
pass('all other JS, persistence, login, Gist, import/export, bootstrap and CSS unchanged');
const reset=()=>fetch(base+'/__mock_gists/local-mock',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({files:{'data.json':{content:null}}})});
(async()=>{
 await reset();if(output)fs.mkdirSync(output,{recursive:true});
 browser=await chromium.launch({headless:true});
 const c=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'Asia/Shanghai'});
 const errors=[],external=[];
 await c.route('**/*',r=>{if(new URL(r.request().url()).origin===base)return r.continue();external.push(r.request().url());return r.abort()});
 c.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
 await c.addInitScript(()=>{if(location.protocol==='http:')window.localStorage.setItem('wb_sidebar_open','0')});
 const p=await c.newPage();await p.clock.install({time:new Date('2026-10-30T06:00:00Z')});
 await p.goto(base+'/?mockSync=1');await p.waitForFunction(()=>syncActive()&&!syncBusy);
 const record=(date,amount,type='expense',category='餐饮')=>({id:date+'-'+type+'-'+amount,date,amount,type,category,note:'合成预算验证'});
 async function scenario(name,date,budget,ledger,expected,extra={}){
   await p.clock.setSystemTime(new Date(date+'T06:00:00Z'));
   await p.evaluate(({budget,ledger,extra})=>{sessionPasscode=null;clearTimeout(syncTimer);S={...structuredClone(DEFAULT),budget,ledger,...extra};renderAll()},{budget,ledger,extra});
   const actual=await p.evaluate(()=>['focusExp','focusExpSub','focusDynamicBudget','focusFixedBudget'].map(id=>document.getElementById(id).textContent));
   assert.deepEqual(actual,expected,name);pass(name);
 }
 await scenario('underspending is capped at fixed daily allowance','2026-10-30',3100,[record('2026-10-30',8)],['¥8','占动态日预算 8%','动态日预算 ¥100','固定日预算 ¥100']);
 await scenario('remaining includes today; overspending percentage is not truncated','2026-10-30',3100,[record('2026-10-01',3080),record('2026-10-30',8)],['¥8','占动态日预算 133%','动态日预算 ¥6','固定日预算 ¥100']);
 await scenario('round display only, retain full precision in percentage','2026-10-30',1000,[record('2026-10-01',964),record('2026-10-30',10)],['¥10','占动态日预算 77%','动态日预算 ¥13','固定日预算 ¥32.26']);
 await scenario('zero spending still shows both allowances','2026-10-30',3100,[],['¥0','占动态日预算 0%','动态日预算 ¥100','固定日预算 ¥100']);
 await scenario('unset budget avoids division by zero','2026-10-30',0,[record('2026-10-30',8)],['¥8','未设置月预算','动态日预算 —','固定日预算 —']);
 for(const total of [3100,3200])await scenario('exhausted or exceeded month budget '+total,'2026-10-30',3100,[record('2026-10-30',total)],['¥'+total.toLocaleString('zh-CN'),'月预算已用尽','动态日预算 ¥0','固定日预算 ¥100']);
 await scenario('fractional currency cannot leave a floating-point phantom balance','2026-10-30',0.9,[record('2026-10-30',0.3),record('2026-10-30',0.6)],['¥0.9','月预算已用尽','动态日预算 ¥0','固定日预算 ¥0.03']);
 await scenario('last day has one remaining day','2026-10-31',3100,[record('2026-10-01',3040),record('2026-10-31',10)],['¥10','占动态日预算 20%','动态日预算 ¥50','固定日预算 ¥100']);
 await scenario('first day counts every day of current month','2026-10-01',3100,[record('2026-10-01',50)],['¥50','占动态日预算 51%','动态日预算 ¥98.39','固定日预算 ¥100']);
 await scenario('leap February has 29 days','2028-02-28',2900,[record('2028-02-01',2700),record('2028-02-28',20)],['¥20','占动态日预算 22%','动态日预算 ¥90','固定日预算 ¥100']);
 await scenario('ordinary February has 28 days','2026-02-28',2800,[record('2026-02-01',2750),record('2026-02-28',10)],['¥10','占动态日预算 25%','动态日预算 ¥40','固定日预算 ¥100']);
 await scenario('30-day month','2026-04-29',3000,[record('2026-04-01',2900),record('2026-04-29',20)],['¥20','占动态日预算 50%','动态日预算 ¥40','固定日预算 ¥100']);
 await scenario('income and excluded default/custom categories do not consume budget','2026-10-30',3100,[record('2026-10-30',8),record('2026-10-30',9000,'income'),record('2026-10-30',9000,'expense','购物'),record('2026-10-30',9000,'expense','专项')],['¥8','占动态日预算 8%','动态日预算 ¥100','固定日预算 ¥100'],{budgetCats:{购物:false},customCats:{expense:[{name:'专项',inBudget:false}],income:[]}});
 await scenario('ledger prior-month overrun is respected','2026-10-30',3100,[record('2026-09-01',3150),record('2026-10-01',3032),record('2026-10-30',8)],['¥8','占动态日预算 160%','动态日预算 ¥5','固定日预算 ¥100']);
 await scenario('other months cannot consume current remaining budget','2026-10-30',3100,[record('2026-09-01',100),record('2026-11-01',9000),record('2026-10-30',8)],['¥8','占动态日预算 8%','动态日预算 ¥100','固定日预算 ¥100']);
 await p.evaluate(()=>{$('#budgetBtn').click();$('#bIn').value='6200';$('#bSave').click()});
 assert.equal(await p.locator('#focusFixedBudget').innerText(),'固定日预算 ¥200');assert.equal(await p.locator('#focusExpSub').innerText(),'占动态日预算 4%');pass('budget modal save updates home immediately');
 await p.evaluate(()=>{openCatManager('expense');const sw=document.querySelector('.budgetSw[data-cat="餐饮"]');sw.checked=false;sw.dispatchEvent(new Event('change'));closeModal()});
 assert.equal(await p.locator('#focusExp').innerText(),'¥0');assert.equal(await p.locator('#focusExpSub').innerText(),'占动态日预算 0%');pass('category budget toggle updates home immediately');
 await scenario('ledger-save setup','2026-10-30',3100,[record('2026-10-01',3080)],['¥0','占动态日预算 0%','动态日预算 ¥10','固定日预算 ¥100']);
 await p.evaluate(()=>{curType='expense';curCat='餐饮';$('#amtIn').value='8';$('#dateIn').value=todayStr();$('#amtSave').click()});
 assert.equal(await p.locator('#focusExp').innerText(),'¥8');assert.equal(await p.locator('#focusDynamicBudget').innerText(),'动态日预算 ¥6');pass('saving an expense immediately reduces the dynamic allowance');
 await scenario('midnight setup','2026-10-30',3100,[record('2026-10-01',3040)],['¥0','占动态日预算 0%','动态日预算 ¥30','固定日预算 ¥100']);
 await p.clock.setSystemTime(new Date('2026-10-30T15:59:40Z'));await p.clock.runFor(60000);
 assert.equal(await p.locator('#focusDynamicBudget').innerText(),'动态日预算 ¥60');pass('existing minute refresh adjusts allowance across local midnight');
 await p.clock.setSystemTime(new Date('2026-10-31T15:59:40Z'));await p.clock.runFor(60000);
 assert.equal(await p.locator('#focusFixedBudget').innerText(),'固定日预算 ¥103.33');assert.equal(await p.locator('#focusDynamicBudget').innerText(),'动态日预算 ¥103.33');pass('month rollover recomputes days and resets monthly consumption');
 await scenario('rendering does not write derived fields','2026-10-30',3100,[record('2026-10-30',8)],['¥8','占动态日预算 8%','动态日预算 ¥100','固定日预算 ¥100']);
 const snapshot=await p.evaluate(()=>JSON.stringify(S));await p.evaluate(()=>{renderFocusCard();renderFocusCard()});assert.equal(await p.evaluate(()=>JSON.stringify(S)),snapshot);pass('daily budgets remain derived values without state mutation');
 await p.evaluate(()=>persist());await p.reload();await p.waitForFunction(()=>syncActive()&&!syncBusy);
 assert.equal(await p.locator('#focusExpSub').innerText(),'占动态日预算 8%');pass('reload recalculates allowances from existing budget and ledger');
 for(const width of [320,375,390,414,768,1440]){
   await p.setViewportSize({width,height:width<760?844:1000});
   const layout=await p.evaluate(()=>{const nodes=['focusExpSub','focusDynamicBudget','focusFixedBudget'].map(id=>document.getElementById(id));return {overflow:document.documentElement.scrollWidth>innerWidth,items:nodes.map(e=>{const r=e.getBoundingClientRect(),c=e.closest('.f-item').getBoundingClientRect();return {fits:r.right<=c.right+1&&r.left>=c.left-1,text:e.scrollWidth<=e.clientWidth+1}})}});
   assert(!layout.overflow&&layout.items.every(x=>x.fits&&x.text),JSON.stringify({width,layout}));
   if(output&&[390,1440].includes(width))await p.screenshot({path:path.join(output,'daily-budget-'+width+'.png'),animations:'disabled'});
 }
 pass('six viewport widths keep all budget text within card');
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);pass('no browser errors and no external network requests');
 await c.close();await browser.close();browser=null;await reset();console.log('ALL '+count+' DAILY BUDGET GROUPS PASSED');
})().catch(async e=>{console.error(e);if(browser)await browser.close();process.exitCode=1});
