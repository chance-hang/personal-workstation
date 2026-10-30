/* UI checks use a dedicated Mock service and synthetic records, never user data. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {chromium}=require('playwright');
const base=process.env.MATTERS_BASE_URL||'http://127.0.0.1:4184';
const output=process.env.MATTERS_UI_OUTPUT;
assert(['127.0.0.1','localhost'].includes(new URL(base).hostname));
assert.notEqual(new URL(base).port,'4173');
const normalize=s=>s.replace(/\r\n/g,'\n');
const before=normalize(execFileSync('git',['show','b16fa2fc159d6627283a5cc47c86b587966824b8:app.js'],{encoding:'utf8'}));
const after=normalize(fs.readFileSync('app.js','utf8'));
const stripUi=s=>s.replace("version:'v3.23.0-review',date:'2026-10-30',modules:['事项','今日','历史'],status:'待验收'","version:'v3.23.0',date:'2026-10-30',modules:['事项','今日','历史'],status:'已上线'").replace(/function matterRow\([\s\S]*?(?=function matterRowsHtml)/,'').replace(/^\$\('#matterCaptureKind'\)\.onchange=.*$/m,'');
assert.equal(stripUi(before),stripUi(after),'All business/storage/sync/login code outside row markup and capture presentation must stay identical');
console.log('PASS business, persistence, login, synchronization and import/export source unchanged');
if(output)fs.mkdirSync(output,{recursive:true});
let browser;
(async()=>{
 browser=await chromium.launch({headless:true});
 const errors=[],external=[];
 for(const width of [320,375,390,414,768,1440]){
   const touch=width<760;
   const c=await browser.newContext({viewport:{width,height:touch?844:1050},isMobile:touch,hasTouch:touch,deviceScaleFactor:1,timezoneId:'Asia/Shanghai'});
   c.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
   await c.route('**/*',r=>{if(new URL(r.request().url()).origin===base)return r.continue();external.push(r.request().url());return r.abort()});
   await c.addInitScript(()=>{if(location.protocol==='http:')window.localStorage.setItem('wb_sidebar_open','0')});
   const p=await c.newPage();await p.clock.install({time:new Date('2026-10-30T06:00:00Z')});
   await p.goto(base+'/?mockSync=1');await p.waitForFunction(()=>syncActive()&&!syncBusy);
   await p.evaluate(()=>{
     sessionPasscode=null;clearTimeout(syncTimer);S=structuredClone(DEFAULT);
     S.todos=[newMatterTodo('核对项目交付清单',todayStr()),newMatterTodo('整理客户反馈并更新方案',todayStr())];
     matterSetDone(S.todos[1],true);
     S.notes=[{id:'ui-note',title:'下次沟通要点',content:'记录客户反馈，下次沟通时确认验收时间。',done:false,createdAt:noteTime(),updatedAt:noteTime()}];
     renderAll();
   });
   const row=await p.evaluate(()=>{
     const e=document.querySelector('.matter-row.is-done'),button=e.querySelector('.matter-check'),mark=e.querySelector('.matter-check-mark');
     return {hit:button.getBoundingClientRect().width,visual:mark.getBoundingClientRect().width,background:getComputedStyle(button).backgroundColor,stroke:mark.querySelector('svg')!==null,heading:parseFloat(getComputedStyle(document.querySelector('.matter-group-heading')).fontSize),title:parseFloat(getComputedStyle(e.querySelector('b')).fontSize)};
   });
   assert.equal(row.hit,44);assert.equal(row.visual,20);assert.equal(row.background,'rgba(0, 0, 0, 0)');assert(row.stroke&&row.heading<row.title);
   const due=await p.evaluate(()=>['todoDueDate','todoDueTime','todoNoDue'].map(id=>{const e=document.getElementById(id),r=e.getBoundingClientRect();return {id,height:r.height,bottom:r.bottom,font:parseFloat(getComputedStyle(e).fontSize),appearance:getComputedStyle(e).appearance}}));
   due.forEach(x=>assert.equal(x.height,44,JSON.stringify({width,...x})));
   assert(Math.abs(due[0].bottom-due[1].bottom)<1);
   if(touch)assert(due[0].font>=16&&due[1].font>=16);
   await p.locator('#todayGoTodo').click();await p.waitForTimeout(600);
   if(output&&width===390)await p.screenshot({path:path.join(output,'matters-ui-phone-today.png'),animations:'disabled'});
   await p.evaluate(()=>openMatters('all'));
   const capture=await p.evaluate(()=>{
     const a=document.getElementById('matterCaptureKind').getBoundingClientRect(),b=document.getElementById('noteAdd').getBoundingClientRect(),label=document.querySelector('.matter-search>span');
     return {selectHeight:a.height,buttonHeight:b.height,bottomGap:Math.abs(a.bottom-b.bottom),searchHeight:label.getBoundingClientRect().height,nowrap:getComputedStyle(label).whiteSpace,overflow:document.documentElement.scrollWidth>innerWidth};
   });
   assert.equal(capture.selectHeight,44);assert.equal(capture.buttonHeight,44);assert(capture.bottomGap<1);assert.equal(capture.nowrap,'nowrap');assert(capture.searchHeight<25);assert(!capture.overflow,JSON.stringify({width,...capture}));
   await p.locator('#matterCaptureKind').selectOption('todo');
   const planned=await p.evaluate(()=>['matterCaptureKind','matterCaptureDate','matterCaptureTime','noteAdd'].map(id=>({id,height:document.getElementById(id).getBoundingClientRect().height})));
   planned.forEach(x=>assert.equal(x.height,44,JSON.stringify({width,...x})));
   assert(await p.locator('#matterCapture').evaluate(e=>e.classList.contains('is-todo')));
   await p.locator('#matterCaptureKind').selectOption('note');
   assert(await p.locator('#reviewEnvNotice').isVisible());
   if(output&&(width===390||width===1440)){
     await p.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
     await p.screenshot({path:path.join(output,width===390?'matters-ui-phone-hub.png':'matters-ui-desktop-hub.png'),animations:'disabled'});
   }
   await p.evaluate(()=>openMatter('todo',S.todos[1].id));
   const modal=await p.locator('#modalBox').boundingBox();assert(modal.x>=0&&modal.x+modal.width<=width+1);
   const dates=await p.evaluate(()=>['matterDueDate','matterDueTime','matterStatus'].map(id=>document.getElementById(id).getBoundingClientRect().height));dates.forEach(h=>assert.equal(h,44));
   if(output&&width===390)await p.screenshot({path:path.join(output,'matters-ui-phone-detail.png'),animations:'disabled'});
   await p.evaluate(()=>closeModal());
   await c.close();console.log('PASS '+width+'px '+(touch?'touch':'desktop')+': compact check, equal-height controls, aligned layout, single-line search, dialog and Mock notice');
 }
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
 await browser.close();browser=null;
 console.log('PASS zero page errors or external requests; all 6 layout groups passed');
})().catch(async e=>{console.error(e);if(browser)await browser.close();process.exitCode=1});
