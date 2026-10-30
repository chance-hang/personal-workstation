/* Real mobile contexts on a disposable Mock backend. Never reset 4185 or 4173. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {chromium}=require('playwright');
const base='http://127.0.0.1:4186',output=process.env.BUDGET_OUTPUT;
const lan=Object.values(os.networkInterfaces()).flat().find(x=>x.family==='IPv4'&&!x.internal&&x.netmask!=='255.255.255.255')?.address;
const origins=new Set([base,'http://localhost:4186',...(lan?['http://'+lan+':4186']:[])]);
let browser,count=0;const pass=s=>{count++;console.log('PASS '+s)};
const reset=()=>fetch(base+'/__mock_gists/local-mock',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({files:{'data.json':{content:null}}})});
(async()=>{
 await reset();if(output)fs.mkdirSync(output,{recursive:true});browser=await chromium.launch({headless:true});
 const errors=[],external=[];
 async function open(width,origin=base){
  const mobile=width<760;
  const c=await browser.newContext({viewport:{width,height:mobile?844:1000},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:mobile?3:1,timezoneId:'Asia/Shanghai',...(mobile?{userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'}:{})});
  await c.route('**/*',r=>{if(origins.has(new URL(r.request().url()).origin))return r.continue();external.push(r.request().url());return r.abort()});
  await c.addInitScript(()=>{if(location.protocol==='http:')localStorage.setItem('wb_sidebar_open','0')});
  const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.clock.install({time:new Date('2026-10-30T06:00:00Z')});
  await p.goto(origin+(mobile?'/phone':'/?mockSync=1'));await p.waitForFunction(()=>syncActive()&&!syncBusy);
  assert.equal(new URL(p.url()).searchParams.get('mockSync'),'1');
  assert(await p.locator('script[src*="review-daily-budget-20261030-2"]').count());
  assert(await p.locator('link[href*="review-daily-budget-20261030-2"]').count());
  return {p,c,mobile};
 }
 const desktop=await open(1440),d=desktop.p;
 await d.evaluate(async()=>{
  clearTimeout(syncTimer);S=structuredClone(DEFAULT);S.budget=3100;
  S.ledger=[{id:'ui-prior',date:'2026-10-01',amount:2972,type:'expense',category:'餐饮'},{id:'ui-today',date:todayStr(),amount:8,type:'expense',category:'餐饮'}];
  renderAll();await cloudPush();
 });
 for(const width of [320,375,390,414,430,768,1440]){
  const origin=width===390&&lan?'http://'+lan+':4186':width===375?'http://localhost:4186':base;
  const {p,c,mobile}=await open(width,origin);
  assert.equal(await p.evaluate(()=>S.budget),3100,'new origin must receive monthly budget');
  assert.equal(await p.locator('#focusExpSub').innerText(),'占日预算 13%');
  assert(await p.locator('#focusExpSub').isVisible());assert(await p.locator('#reviewEnvNotice').isVisible());
  const button=p.locator('#focusBudgetToggle');
  assert.equal(await button.getAttribute('aria-expanded'),'false');assert(!(await p.locator('#focusBudgetDetails').isVisible()));
  const layout=await p.evaluate(()=>{
   const r=id=>document.getElementById(id).getBoundingClientRect();
   const left=r('focusBudgetToggle'),right=r('focusTodoSub'),num=r('focusExp'),todo=r('focusTodo');
   return {overflow:document.documentElement.scrollWidth>innerWidth,labels:Math.abs(left.top+left.height/2-right.top-right.height/2),numbers:Math.abs(num.top-todo.top),hit:left.height,width:left.width,card:document.querySelector('.focus').getBoundingClientRect().height};
  });
  assert(!layout.overflow&&layout.labels<=1&&layout.numbers<=1&&layout.hit>=44&&layout.width>=44,JSON.stringify({width,layout}));
  if(output&&[390,1440].includes(width))await p.screenshot({path:path.join(output,'budget-folded-'+width+'.png'),animations:'disabled'});
  if(mobile)await button.tap();else await button.click();
  assert.equal(await button.getAttribute('aria-expanded'),'true');assert.equal(await button.getAttribute('aria-label'),'占日预算 13%，收起日预算明细');
  assert(await p.locator('#focusDynamicBudget').isVisible());assert.equal(await p.locator('#focusDynamicBudget').innerText(),'动态日预算 ¥60');
  assert(await p.locator('#focusFixedBudget').isVisible());assert.equal(await p.locator('#focusFixedBudget').innerText(),'固定日预算 ¥100');
  const expanded=await p.evaluate(()=>{
   const panel=document.getElementById('focusBudgetDetails').getBoundingClientRect(),card=document.querySelector('.focus').getBoundingClientRect();
   return {fits:panel.left>=card.left&&panel.right<=card.right,overflow:document.documentElement.scrollWidth>innerWidth,height:card.height};
  });assert(expanded.fits&&!expanded.overflow&&expanded.height>layout.card);
  await p.evaluate(()=>renderFocusCard());assert.equal(await button.getAttribute('aria-expanded'),'true');
  if(output&&[390,1440].includes(width))await p.screenshot({path:path.join(output,'budget-expanded-'+width+'.png'),animations:'disabled'});
  if(mobile)await button.tap();else {await button.focus();await p.keyboard.press('Enter')}
  assert.equal(await button.getAttribute('aria-expanded'),'false');assert(!(await p.locator('#focusDynamicBudget').isVisible()));
  if(!mobile){await button.focus();await p.keyboard.press('Space');assert(await p.locator('#focusBudgetDetails').isVisible());assert(await button.evaluate(e=>getComputedStyle(e).outlineColor!== 'rgba(0, 0, 0, 0)'));}
  await p.reload();await p.waitForFunction(()=>syncActive()&&!syncBusy);
  assert.equal(await p.locator('#focusExpSub').innerText(),'占日预算 13%');assert.equal(await button.getAttribute('aria-expanded'),'false');
  pass(width+'px '+(mobile?'touch/mobile':'desktop')+' entry, budget receipt, alignment, expansion and refresh');
  if(output&&width===1440){
   // Self-contained component review page. No app or sync code, no production data.
   const card=await p.locator('.focus').evaluate(e=>e.outerHTML);
   const css=fs.readFileSync('styles.css','utf8');
   fs.writeFileSync(path.join(output,'daily-budget.preview.html'),'<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>日预算卡片交互预览</title><style>'+css+'body{padding:24px}.focus{max-width:900px;margin:auto}</style><body>'+card+'<script>document.getElementById("focusBudgetToggle").onclick=function(){const open=this.getAttribute("aria-expanded")!=="true";this.setAttribute("aria-expanded",String(open));this.setAttribute("aria-label",document.getElementById("focusExpSub").textContent+"，"+(open?"收起日预算明细":"展开日预算明细"));document.getElementById("focusBudgetDetails").hidden=!open}</script></body></html>');
  }
  await c.close();
 }
 // Receiving zero also matters: do not retain an old nonzero budget on a phone.
 const zero=await open(390,'http://localhost:4186');assert.equal(await zero.p.evaluate(()=>S.budget),3100);
 await d.evaluate(async()=>{S.budget=0;clearTimeout(syncTimer);await cloudPush()});
 await zero.p.evaluate(async()=>{clearTimeout(syncTimer);await cloudPull()});assert.equal(await zero.p.evaluate(()=>S.budget),0);assert.equal(await zero.p.locator('#focusExpSub').innerText(),'未设置月预算');
 await zero.p.locator('#focusBudgetToggle').tap();assert.equal(await zero.p.locator('#focusDynamicBudget').innerText(),'动态日预算 —');await zero.c.close();
 await d.evaluate(async()=>{S.budget=3100;clearTimeout(syncTimer);await cloudPush()});
 await desktop.c.close();pass('zero-budget setting remains explicit in a new mobile origin');
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);pass('no browser errors or production/external requests');
 await browser.close();browser=null;await reset();console.log('ALL '+count+' DAILY BUDGET UI GROUPS PASSED');
})().catch(async e=>{console.error(e);if(browser)await browser.close();process.exitCode=1});
