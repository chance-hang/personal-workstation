/* Dedicated Mock only. Uses synthetic records and blocks all external requests. */
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const fs=require('node:fs');
const {chromium}=require('playwright');
const base=process.env.MATTERS_BASE_URL||'http://127.0.0.1:4184';
assert(['127.0.0.1','localhost'].includes(new URL(base).hostname));assert.notEqual(new URL(base).port,'4173');
const baseline='6b54759f76818a1cdbf83c0138092f88fde9ef0c';
const original=execFileSync('git',['show',baseline+':app.js'],{encoding:'utf8'}).replace(/\r\n/g,'\n');
const source=fs.readFileSync('app.js','utf8').replace(/\r\n/g,'\n');
let count=0,browser;const pass=name=>{count++;console.log('PASS '+name)};
for(const [name,start,end] of [
 ['storage namespace','const _realLS = window.localStorage;','/* ============ 工具函数'],
 ['data layer and IndexedDB','/* ============ 数据层 ============ */','/* ============ 弹窗 ============ */'],
 ['Gist, encryption and push','const SYNC_KEY=','function noteUpdatedAt('],
 ['pull, credentials and login','async function cloudPull(','function renderChangelog('],
 ['import/export',"$('#exportBtn').onclick","$('#budgetBtn').onclick"],
 ['cloud bootstrap','initFilters();\nrenderAll();',null]
]){
 const part=s=>s.slice(s.indexOf(start),end?s.indexOf(end,s.indexOf(start)):s.length);
 assert(original.includes(start)&&source.includes(start));assert.equal(part(source),part(original),name);
}
assert.equal(fs.readFileSync('styles.css','utf8').replace(/\r\n/g,'\n'),execFileSync('git',['show',baseline+':styles.css'],{encoding:'utf8'}).replace(/\r\n/g,'\n'));
pass('six protected source regions and all CSS identical to production baseline');
(async()=>{
 await fetch(base+'/__mock_gists/local-mock',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({files:{'data.json':{content:null}}})});
 browser=await chromium.launch({headless:true});const errors=[],external=[];
 const c=await browser.newContext({viewport:{width:1280,height:1000},timezoneId:'Asia/Shanghai'});
 await c.addInitScript(()=>{if(location.protocol==='http:')window.localStorage.setItem('wb_sidebar_open','0')});
 await c.route('**/*',r=>{const u=new URL(r.request().url());if(['127.0.0.1','localhost'].includes(u.hostname)&&u.port===new URL(base).port)return r.continue();external.push(u.origin);return r.abort()});
 c.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
 const p=await c.newPage();await p.clock.install({time:new Date('2026-10-30T06:00:00Z')});
 await p.goto(base+'/?mockSync=1');await p.waitForFunction(()=>syncActive()&&!syncBusy);
 await p.evaluate(()=>{
   sessionPasscode=null;clearTimeout(syncTimer);S=structuredClone(DEFAULT);
   S.notes=Array.from({length:7},(_,i)=>({id:'convert-'+i,title:'转换验证 '+i,content:'完整备忘正文 '+i+'\n第二行需要保留',createdAt:noteTime(),updatedAt:noteTime(),done:false}));
   S.todos=Array.from({length:9},(_,i)=>({id:'past-'+i,text:'原逾期待办 '+i,date:'2026-09-01',done:false}));
   refreshMatters();openMatters('notes');
 });
 const row=id=>p.locator('#noteList .matter-row').filter({has:p.locator('[data-action="convert"]')}).filter({hasText:'转换验证 '+id});
 await row(0).locator('[data-action="convert"]').click();
 assert.equal(await p.locator('#matterDueDate').inputValue(),'2026-10-30');assert.equal(await p.locator('#matterSave').innerText(),'确认安排');
 assert.equal(await p.evaluate(()=>S.todos.some(x=>x.sourceNoteId==='convert-0')),false);
 await p.locator('#matterCancel').click();
 assert.equal(await p.evaluate(()=>S.todos.some(x=>x.sourceNoteId==='convert-0')),false);
 pass('new conversion defaults to today; cancel creates no task');
 await p.locator('.matter-filters').evaluate(e=>e.open=true);await p.locator('#matterType').selectOption('note');
 await p.locator('#matterDateBy').selectOption('created');await p.locator('#matterFrom').fill('2026-10-30');await p.locator('#matterTo').fill('2026-10-30');await p.locator('#matterSearch').fill('完整备忘正文 0');
 await p.locator('#noteList [data-action="convert"]').click();await p.locator('#matterSave').click();
 assert(await p.evaluate(()=>matterView==='pending'&&document.querySelector('#matterType').value==='all'&&!document.querySelector('#matterSearch').value&&!document.querySelector('#matterFrom').value&&!document.querySelector('#matterTo').value));
 assert.equal(await p.locator('#noteList [data-id="note-task:convert-0"]').count(),1);
 assert.equal(await p.locator('#todoList [data-id="note-task:convert-0"]').count(),1);
 assert.equal(await p.locator('#focusTodo').innerText(),'0/1');
 assert(await p.evaluate(()=>S.todos.find(x=>x.sourceNoteId==='convert-0').details==='完整备忘正文 0\n第二行需要保留'&&S.notes.find(x=>x.id==='convert-0').content==='完整备忘正文 0\n第二行需要保留'));
 pass('confirmation clears stale filters, switches to pending and shows task on home despite nine overdue records');
 await p.waitForTimeout(650);
 const viewport=await p.locator('#noteList [data-id="note-task:convert-0"]').evaluate(e=>({top:e.getBoundingClientRect().top,header:document.querySelector('header.topbar').getBoundingClientRect().bottom}));
 assert(viewport.top>=viewport.header-2,JSON.stringify(viewport));
 await p.evaluate(()=>matterConvert('convert-0'));await p.locator('#matterCancel').click();
 assert.equal(await p.evaluate(()=>S.todos.filter(x=>x.sourceNoteId==='convert-0').length),1);
 pass('new task is scrolled below sticky header; repeated conversion does not duplicate');
 await p.evaluate(()=>{S.todos.push(...Array.from({length:12},(_,i)=>newMatterTodo('原今日待办 '+i,todayStr())));refreshMatters();openMatters('notes')});
 await row(1).locator('[data-action="convert"]').click();await p.locator('#matterDueTime').fill('17:00');await p.locator('#matterSave').click();
 assert.equal(await p.locator('#todoList [data-id="note-task:convert-1"]').count(),1);assert.equal(await p.locator('#todoList .matter-row').count(),8);
 assert.equal(await p.locator('#focusTodo').innerText(),'0/14');
 pass('recent timed arrangement stays in the eight-row home preview with many existing today tasks');
 await p.evaluate(()=>{S.todos.push(...Array.from({length:55},(_,i)=>newMatterTodo('以后待办 '+i,'2026-11-01')));refreshMatters();openMatters('notes')});
 await row(2).locator('[data-action="convert"]').click();await p.locator('#matterDueDate').fill('2026-12-15');await p.locator('#matterSave').click();
 assert(await p.evaluate(()=>matterLimit>=80));assert.equal(await p.locator('#noteList [data-id="note-task:convert-2"]').count(),1);
 assert.equal(await p.locator('#todoList [data-id="note-task:convert-2"]').count(),0);
 pass('future task is revealed beyond the first 40 rows without incorrectly appearing on today home');
 await p.evaluate(()=>openMatters('notes'));await row(3).locator('[data-action="convert"]').click();
 await p.locator('#matterDueShortcuts [data-days="none"]').click();await p.locator('#matterSave').click();
 assert.equal(await p.locator('#noteList [data-id="note-task:convert-3"]').count(),1);assert.equal(await p.locator('#todoList [data-id="note-task:convert-3"]').count(),0);
 assert.equal(await p.evaluate(()=>todoDue(S.todos.find(x=>x.sourceNoteId==='convert-3'))),'');
 pass('explicit no-date choice remains visible in pending and does not count as a today plan');
 await p.evaluate(()=>{const old=newMatterTodo('已删除的关联事项','2026-09-02',{id:'note-task:convert-4',sourceNoteId:'convert-4',deletedAt:noteTime()});S.todos.push(old);refreshMatters();openMatters('notes')});
 const tombstone=await p.evaluate(()=>JSON.stringify(S.todos.find(x=>x.id==='note-task:convert-4')));
 await row(4).locator('[data-action="convert"]').click();await p.locator('#matterCancel').click();
 assert.equal(await p.evaluate(()=>JSON.stringify(S.todos.find(x=>x.id==='note-task:convert-4'))),tombstone);
 await row(4).locator('[data-action="convert"]').click();await p.locator('#matterSave').click();
 assert.equal(await p.evaluate(()=>S.todos.filter(x=>x.id==='note-task:convert-4').length),1);
 assert(await p.evaluate(()=>!S.todos.find(x=>x.id==='note-task:convert-4').deletedAt));
 pass('cancel does not restore a deleted task; confirmation restores the same ID exactly once');
 await p.evaluate(()=>matterConvert('convert-3'));await p.locator('#matterDueDate').fill('2026-10-30');await p.locator('#matterTitle').fill('合并期间保存仍有效');
 await p.evaluate(()=>{S=structuredClone(S);S.todos.find(x=>x.id==='note-task:convert-3').updatedAt='2026-10-30T06:00:05.000Z'});
 await p.locator('#matterSave').click();
 assert(await p.evaluate(()=>{const x=S.todos.find(x=>x.id==='note-task:convert-3');return x.text==='合并期间保存仍有效'&&x.dueAt===todayStr()&&Date.parse(x.updatedAt)>Date.parse('2026-10-30T06:00:05.000Z')}));
 assert.equal(await p.locator('#todoList [data-id="note-task:convert-3"]').count(),1);
 pass('save writes by ID after a sync replaces array objects and keeps a monotonic updatedAt');
 await p.evaluate(()=>openMatters('notes'));await row(5).locator('[data-action="convert"]').click();await p.locator('#matterStatus').selectOption('done');await p.locator('#matterSave').click();
 assert.equal(await p.evaluate(()=>matterView),'completed');assert.equal(await p.locator('#noteList [data-id="note-task:convert-5"]').count(),1);
 pass('explicit completion during arrangement navigates to completed rather than hiding the saved task');
 await p.evaluate(()=>{persist()});await p.reload();await p.waitForFunction(()=>syncActive()&&!syncBusy);
 assert(await p.evaluate(()=>S.todos.find(x=>x.sourceNoteId==='convert-0').dueAt===todayStr()&&S.notes.find(x=>x.id==='convert-0').content.includes('第二行')));
 const second=await c.newPage();await second.clock.install({time:new Date('2026-10-30T06:00:00Z')});
 await p.evaluate(async()=>{clearTimeout(syncTimer);await cloudPush()});
 await second.goto(base.replace('127.0.0.1','localhost')+'/?mockSync=1');await second.waitForFunction(()=>syncActive()&&!syncBusy);
 assert(await second.evaluate(()=>liveTodos().some(x=>x.sourceNoteId==='convert-0'&&todoDue(x)===todayStr())));
 await second.evaluate(()=>openMatters('pending'));
 assert.equal(await second.locator('#noteList [data-id="note-task:convert-0"]').count(),1);
 assert.notEqual(await second.locator('#focusTodo').innerText(),'0/0');
 pass('refresh and a second isolated origin retain the arranged date and original memo');
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);pass('no uncaught errors or requests to production services');
 await c.close();await browser.close();browser=null;
 await fetch(base+'/__mock_gists/local-mock',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({files:{'data.json':{content:null}}})});
 console.log('ALL '+count+' CONVERSION GROUPS PASSED');
})().catch(async e=>{console.error(e);if(browser)await browser.close();process.exitCode=1});
