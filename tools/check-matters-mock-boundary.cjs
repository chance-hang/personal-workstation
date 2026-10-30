/* Dedicated local service only. Never uses the user acceptance port or real credentials. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=process.env.MATTERS_BASE_URL||'http://127.0.0.1:4184';
assert(['127.0.0.1','localhost'].includes(new URL(base).hostname));
assert.notEqual(new URL(base).port,'4173','Use a dedicated test service');
let browser,count=0;
function pass(name){count++;console.log('PASS '+name)}
(async()=>{
 browser=await chromium.launch({headless:true});
 const ctx=await browser.newContext({viewport:{width:1280,height:900},timezoneId:'Asia/Shanghai'});
 const requests=[],external=[],errors=[];
 const guard=async c=>{
   c.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
   await c.route('**/*',r=>{
     const u=new URL(r.request().url());
     if(u.origin!==base){external.push(u.origin);return r.abort()}
     requests.push({method:r.request().method(),path:u.pathname});return r.continue();
   });
 };
 await guard(ctx);
 await ctx.addInitScript(()=>{
   if(location.protocol!=='http:')return;
   localStorage.setItem('wb_sidebar_open','0');
   localStorage.setItem('lifeworkbench_sync_profiles',JSON.stringify([{id:'formal-sentinel',binId:'never-connect',masterKey:'not-a-real-token'}]));
   localStorage.setItem('lifeworkbench_sync_current','formal-sentinel');
   localStorage.setItem('wb_sync_trust_v1','{}');
   window.__boundaryReads=[];const original=Storage.prototype.getItem;
   Storage.prototype.getItem=function(key){window.__boundaryReads.push(String(key));return original.call(this,key)};
 });
 const p=await ctx.newPage();await p.goto(base+'/?mockSync=1');await p.waitForFunction(()=>syncActive()&&!syncBusy);
 await p.locator('#syncStatus').filter({hasText:'本地模拟同步完成'}).waitFor({state:'attached'});
 assert(await p.evaluate(()=>MOCK_SYNC&&GITHUB_API==='/__mock_gists'&&currentProfile().id==='local-mock'));
 assert(await p.locator('#reviewEnvNotice').isVisible());
 assert(await p.locator('#reviewEnvNotice').innerText().then(s=>s.includes('待验收')&&s.includes('未连接正式云端')));
 pass('persistent acceptance banner and mock-only account/API');
 await p.evaluate(()=>goTab('me'));
 assert.equal(await p.locator('#syncStatus').innerText(),'本地模拟同步完成');
 const privacy=await p.locator('[data-module="cloudSync"] .privacy-box').innerText();
 assert(privacy.includes('不连接正式 GitHub Gist')&&privacy.includes('不执行正式加密'));
 assert(!/AES-GCM|HTTPS|仅持有 Passcode/.test(privacy));
 assert.equal(await p.locator('#syncHistoryBtnDirect').isVisible(),false);
 pass('cloud section uses accurate mock labels and hides production recovery');
 await p.locator('#syncBtn').click();
 assert(await p.locator('#modalBox').innerText().then(s=>s.includes('本地模拟验收')&&s.includes('未连接正式云端')&&s.includes(base+'/__mock_gists/local-mock')));
 for(const id of ['loginPass','accMK','addAccBtn','importAccBtn','exportAccBtn','syncHistoryBtn','exportQRBtn'])assert.equal(await p.locator('#'+id).count(),0,id);
 await p.locator('#mockSyncNow').click();await p.waitForFunction(()=>!syncBusy);
 assert.equal(await p.locator('#syncStatus2').innerText(),'本地模拟同步完成');
 pass('mock management has no production credentials/import/recovery controls');
 for(const [state,label] of [['off','本地模拟未连接'],['sync','本地模拟同步中'],['err','本地模拟同步失败'],['ok','本地模拟同步完成']]){
   await p.evaluate(s=>setSyncStatus(s),state);
   assert.equal(await p.locator('#syncStatus').innerText(),label);assert.equal(await p.locator('#syncStatus2').innerText(),label);
 }
 await p.evaluate(()=>closeModal());
 await p.locator('#syncNowBtnDirect').click();await p.waitForFunction(()=>!syncBusy);
 assert.equal(await p.locator('#syncStatus').innerText(),'本地模拟同步完成');
 await p.evaluate(()=>renderAccountManager());
 assert.equal(await p.locator('#addAccBtn').count(),0);await p.evaluate(()=>closeModal());
 pass('all status states, direct sync and account entry stay explicitly local');
 for(const width of [320,375,768,1440]){
   await p.setViewportSize({width,height:844});await p.waitForTimeout(80);
   const b=await p.locator('#reviewEnvNotice').boundingBox();assert(b&&b.x>=0&&b.x+b.width<=width+1);
 }
 await p.reload();await p.waitForFunction(()=>syncActive()&&!syncBusy);
 assert(await p.locator('#reviewEnvNotice').isVisible());assert.equal(await p.locator('#syncStatus').innerText(),'本地模拟同步完成');
 pass('environment notice survives resizing and refresh');
 const reads=await p.evaluate(()=>window.__boundaryReads.filter(k=>['lifeworkbench_sync_profiles','lifeworkbench_sync_current','wb_sync_trust_v1','wb_devkey_v1'].includes(k)));
 assert.deepEqual(reads,[]);
 assert(requests.some(r=>r.path==='/__mock_gists/local-mock'&&r.method==='GET'));
 assert(requests.some(r=>r.path==='/__mock_gists/local-mock'&&r.method==='PATCH'));
 assert(requests.every(r=>['/','/app.js','/styles.css','/__mock_gists/local-mock'].includes(r.path)),JSON.stringify(requests));
 pass('request audit contains only local assets/mock GET/PATCH; no stored production credentials read');
 await ctx.close();
 const formal=await browser.newContext();await guard(formal);
 const f=await formal.newPage();await f.goto(base+'/');await f.waitForTimeout(200);
 assert(await f.evaluate(()=>!MOCK_SYNC&&GITHUB_API==='https://api.github.com/gists'&&_LS_NS===''&&sessionPasscode===null));
 assert.equal(await f.locator('#reviewEnvNotice').isVisible(),false);
 assert.equal(await f.locator('#syncStatus').innerText(),'未开启');
 const formalText=await f.locator('[data-module="cloudSync"] .privacy-box').innerText();assert(formalText.includes('AES-GCM')&&formalText.includes('HTTPS'));
 await f.evaluate(()=>openSyncSetup());assert.equal(await f.locator('#addAccBtn').count(),1);
 await formal.close();
 pass('formal labels, login/account controls and storage namespace retain original behavior');
 assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
 pass('zero external requests and zero uncaught errors');
 await browser.close();browser=null;console.log('ALL '+count+' MOCK BOUNDARY GROUPS PASSED');
})().catch(async e=>{console.error(e);if(browser)await browser.close();process.exitCode=1});
