/* Production-mode release validation in a disposable local browser.
 * No real accounts/Gist, and external network is blocked before page load.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');
const {chromium}=require('playwright');
const base=process.env.MATTERS_BASE_URL||'http://127.0.0.1:4184';
assert(['127.0.0.1','localhost'].includes(new URL(base).hostname));assert.notEqual(new URL(base).port,'4173');
const source='f3021db50014024417394a8f2917a248e59199bc';
const read=file=>execFileSync('git',['show',source+':'+file],{encoding:'utf8'}).replace(/\r\n/g,'\n');
const app=fs.readFileSync('app.js','utf8').replace(/\r\n/g,'\n');
const reviewedVersion="version:'v3.23.0-review',date:'2026-10-30',modules:['事项','今日','历史'],status:'待验收'";
const releaseVersion="version:'v3.23.0',date:'2026-10-30',modules:['事项','今日','历史'],status:'已上线'";
assert(app.includes(releaseVersion));assert.equal(app.replace(releaseVersion,reviewedVersion),read('app.js'));
assert.equal(fs.readFileSync('styles.css','utf8').replace(/\r\n/g,'\n'),read('styles.css'));
assert.equal(fs.readFileSync('index.html','utf8').replace(/\r\n/g,'\n').replaceAll('prod-matters-20261030-1','review-matters-20261030-3'),read('index.html'));
let count=0,browser;function pass(name){count++;console.log('PASS '+name)}
pass('release app/HTML differ from accepted review only by version/status/cache; CSS identical');
const seed={version:3,todos:[
 {id:'prod-old-open',text:'发布检查旧待办',date:'2026-10-29',done:false},
 {id:'prod-old-done',text:'发布检查旧已完成',date:'2026-10-20',done:true},
 {id:'prod-new-done',text:'已有交付物保留',date:'2026-10-20',dueAt:'2026-11-01',done:true,completedAt:'2026-10-29T06:00:00Z',completionNote:'旧结果',deliverables:['https://example.com/test-result']}
],notes:[{id:'prod-note',content:'原有备忘正文\n第二行',title:'原有备忘',done:false,updatedAt:'2026-10-29T06:00:00Z'}],
habits:[],ledger:[],worklog:[],moods:{},countdowns:[],budget:0,customCats:{expense:[],income:[]},budgetCats:{},quickNotes:[],habitArchive:{},
learning:{directions:[],contents:[],plans:[],questions:[],reviews:[],mistakes:[],selftests:[]}};
(async()=>{
 browser=await chromium.launch({headless:true});const external=[],errors=[],responses=[];
 const guard=async ctx=>{
   ctx.on('page',p=>{p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>responses.push({url:r.url(),status:r.status()}))});
   await ctx.route('**/*',r=>{if(new URL(r.request().url()).origin===base)return r.continue();external.push(r.request().url());return r.abort()});
 };
 const c=await browser.newContext({viewport:{width:1280,height:1000},timezoneId:'Asia/Shanghai'});await guard(c);
 await c.addInitScript(data=>{
   if(location.protocol!=='http:')return;
   if(!window.localStorage.getItem('lifeworkbench_v1'))window.localStorage.setItem('lifeworkbench_v1',JSON.stringify(data));
   window.localStorage.setItem('wb_sidebar_open','0');
   window.localStorage.setItem('lifeworkbench_sync_profiles',JSON.stringify([{id:'prod-check',name:'发布保护验证',binId:'never-connect',masterKey:'local-placeholder-not-a-token',salt:'bG9jYWwtbW9jay1zYWx0'}]));
   window.localStorage.setItem('lifeworkbench_sync_current','prod-check');
   window.localStorage.setItem('lifeworkbench_pomodoro_mock_v1','mock-sentinel');
 },seed);
 const p=await c.newPage();await p.clock.install({time:new Date('2026-10-30T06:00:00Z')});
 await p.goto(base+'/');await p.locator('#loginPass').waitFor();
 assert(await p.evaluate(()=>!MOCK_SYNC&&!TEST_BUILD&&_LS_NS===''&&GITHUB_API==='https://api.github.com/gists'&&sessionPasscode===null&&POMO_KEY==='lifeworkbench_pomodoro_v1'));
 assert.equal(await p.locator('#aboutVer').innerText(),'v3.23.0');
 for(const asset of ['styles.css','app.js'])assert(responses.some(x=>x.url.includes(asset+'?v=prod-matters-20261030-1')&&x.status===200));
 pass('formal default storage, Gist target, login prompt, timer namespace and versioned assets');
 assert.equal(await p.locator('#reviewEnvNotice').isVisible(),false);
 const privacy=await p.locator('[data-module="cloudSync"] .privacy-box').innerText();assert(privacy.includes('AES-GCM')&&privacy.includes('HTTPS'));
 await p.evaluate(()=>closeModal());await p.evaluate(()=>openSyncSetup());assert.equal(await p.locator('#addAccBtn').count(),1);await p.evaluate(()=>closeModal());
 assert.equal(await p.locator('#focusTodo').innerText(),'0/0');
 assert.equal(await p.evaluate(()=>S.todos.find(x=>x.id==='prod-old-done').completedAt),undefined);
 assert.equal(await p.evaluate(()=>S.notes[0].content),'原有备忘正文\n第二行');
 pass('production UI has no mock banner; old records and unknown completion times remain intact');
 await p.locator('#todayGoTodo').click();await p.waitForTimeout(500);
 await p.locator('#todoList [data-id="prod-old-open"] [data-action="toggle"]').click();
 assert.equal(await p.locator('#focusTodo').innerText(),'1/1');
 const saved=await p.evaluate(()=>JSON.parse(window.localStorage.getItem('lifeworkbench_v1')));
 assert(saved.todos.find(x=>x.id==='prod-old-open').completedAt);
 assert.equal(await p.evaluate(()=>window.localStorage.getItem('lifeworkbench_pomodoro_mock_v1')),'mock-sentinel');
 const mirror=await p.evaluate(async()=>{await writeLocalMirror(stateJson(),true);return await readLocalMirror()});
 assert(JSON.parse(mirror.json).todos.find(x=>x.id==='prod-old-open').done);
 pass('formal task completion writes original localStorage and IndexedDB paths without touching Mock timer data');
 await p.reload();await p.locator('#loginPass').waitFor();await p.evaluate(()=>closeModal());
 assert(await p.evaluate(()=>S.todos.find(x=>x.id==='prod-old-open').done&&S.todos.find(x=>x.id==='prod-new-done').deliverables[0]==='https://example.com/test-result'));
 await p.evaluate(()=>goTab('me'));
 await p.locator('#exportBtn').click();
 const downloadPromise=p.waitForEvent('download');await p.locator('#expDl').click();const download=await downloadPromise;
 const exported=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
 assert.equal(exported.todos.length,3);assert(exported.todos.find(x=>x.id==='prod-old-open').completedAt);assert.equal(exported.notes[0].content,seed.notes[0].content);
 pass('formal refresh and original JSON export retain legacy records, completion metadata and references');
 await c.close();
 const empty=await browser.newContext();await guard(empty);const e=await empty.newPage();await e.goto(base+'/');await e.locator('#aboutVer').waitFor({state:'attached'});
 assert.equal(await e.evaluate(()=>S.todos.length+S.notes.length+S.habits.length+S.ledger.length+S.worklog.length),0);
 assert.equal(await e.locator('#focusTodo').innerText(),'0/0');assert.equal(await e.locator('#reviewEnvNotice').isVisible(),false);
 await empty.close();pass('fresh formal browser remains empty with no test/demo record injection');
 assert.deepEqual(external,[]);assert.deepEqual(errors,[]);pass('no real Gist requests, external network or uncaught errors');
 await browser.close();browser=null;console.log('ALL '+count+' PRODUCTION RELEASE GROUPS PASSED');
})().catch(async e=>{console.error(e);if(browser)await browser.close();process.exitCode=1});
