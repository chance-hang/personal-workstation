/* v3.25 release: isolated formal-mode checks + existing runtime fixtures.
 * Run from the release checkout. Only temporary browsers and a new loopback server.
 * Old version-specific whole-source assertions are replaced by the exact accepted-source comparison below.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawn,execFileSync}=require('node:child_process');
const {once}=require('node:events');
const {chromium}=require('playwright');
const accepted='084678fc67f88c2c0277f8c2aead9b2246b258b2';
const cache='prod-time-quadrants-20261116-1';
const base='http://127.0.0.1:4191';
const read=file=>fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
const original=file=>execFileSync('git',['show',accepted+':'+file],{encoding:'utf8'}).replace(/\r\n/g,'\n');
assert.equal(read('app.js').replace(/  \{version:'v3\.25\.0'[\s\S]*?\n  \]\},\n/,''),original('app.js'));
assert.equal(read('index.html').replaceAll(cache,'review-time-quadrants-5'),original('index.html'));
for(const file of ['styles.css','tools/mock-sync-server.mjs'])assert.equal(read(file),original(file));
console.log('PASS accepted-source comparison: only release notes and asset cache differ');
let server,browser,groups=1;
async function runFixture(file){
  let source=read(path.join('tools',file));
  if(file==='check-matter-convert.cjs'){
    source=source.slice(0,source.indexOf('const baseline='))+
      "let count=0,browser;const pass=name=>{count++;console.log('PASS '+name)};\n"+source.slice(source.indexOf('(async()=>{'));
  }else if(file==='check-prod-matters.cjs'){
    source=source.slice(0,source.indexOf("const source='c6e178f';"))+
      "let count=0,browser;function pass(name){count++;console.log('PASS '+name)};\n"+source.slice(source.indexOf('const seed='));
    source=source.replace("'v3.24.0'","'v3.25.0'");
  }else if(file==='check-matters.cjs'){
    source=source.slice(0,source.indexOf('const baseline='))+
      "let count=0,activeBrowser;function pass(name){count++;console.log('PASS '+name)};\n"+source.slice(source.indexOf('(async()=>{'));
  }else if(file==='check-daily-budget.cjs'){
    source=source.slice(0,source.indexOf('const baseline='))+
      "let count=0,browser;const pass=name=>{count++;console.log('PASS '+name)};\n"+source.slice(source.indexOf('const reset='));
  }else if(file==='check-daily-budget-ui.cjs'){
    source=source.replace(/^const lan=.*;$/m,'const lan=null;');
  }
  source=source.replaceAll('prod-budget-matters-20261116-1',cache)
    .replaceAll('4186','4191')
    .replaceAll('chromium.launch({headless:true})','chromium.launch({headless:true,executablePath:process.env.QUADRANT_BROWSER})');
  console.log('\n'+file+' runtime checks');
  const child=spawn(process.execPath,['-','--layout-only'],{
    env:{...process.env,MATTERS_BASE_URL:base,BUDGET_BASE_URL:base},
    stdio:['pipe','pipe','inherit'],windowsHide:true
  });
  let output='';
  child.stdout.on('data',chunk=>{output+=chunk;process.stdout.write(chunk)});
  child.stdin.end(source);
  const [code]=await once(child,'exit');
  assert.equal(code,0,file);
  groups+=(output.match(/^PASS /gm)||[]).length;
}
async function formalFeature(){
  browser=await chromium.launch({headless:true,executablePath:process.env.QUADRANT_BROWSER});
  const ctx=await browser.newContext({viewport:{width:1280,height:1000},timezoneId:'Asia/Shanghai',acceptDownloads:true});
  const external=[],errors=[];
  await ctx.route('**/*',route=>{
    if(new URL(route.request().url()).origin===base)return route.continue();
    external.push(route.request().url());return route.abort();
  });
  await ctx.addInitScript(()=>{
    if(location.protocol!=='http:'||localStorage.getItem('lifeworkbench_v1'))return;
    localStorage.setItem('lifeworkbench_v1',JSON.stringify({
      version:3,todos:[{id:'formal-quadrant',text:'发布模拟待办',date:'2026-11-16',done:false}],notes:[]
    }));
    localStorage.setItem('wb_sidebar_open','0');
  });
  const p=await ctx.newPage();p.on('pageerror',error=>errors.push(error.message));
  await p.clock.install({time:new Date('2026-11-16T03:00:00Z')});
  await p.goto(base+'/');await p.locator('#aboutVer').waitFor({state:'attached'});
  await p.evaluate(()=>{closeModal();goTab('notes');setTimeQuadrantView(true)});
  assert(await p.evaluate(()=>!MOCK_SYNC&&!TEST_BUILD&&_LS_NS===''));
  assert(!(await p.locator('#reviewEnvNotice').isVisible()));
  const row=p.locator('#quadrantGrid [data-task-id="formal-quadrant"]');
  await row.getByRole('button',{name:'详情 / 分类'}).click();
  await p.locator('#matterImportant').selectOption('yes');
  await p.locator('#matterUrgent').selectOption('no');
  await p.locator('#matterPlanMinutes').fill('40');
  await p.locator('#matterSave').click();
  await row.getByRole('button',{name:'记用时'}).click();
  await p.locator('#timeEntryMinutes').fill('25');
  await p.locator('#timeEntryNote').fill('正式模式的本地模拟验收');
  await p.getByRole('button',{name:'保存用时',exact:true}).click();
  await p.getByRole('button',{name:'写复盘',exact:true}).click();
  await p.locator('#timeReviewReason').fill('尚需复核');
  await p.locator('#timeReviewAdjustment').fill('次日优先处理');
  await p.getByRole('button',{name:'保存复盘',exact:true}).click();
  const snapshot=await p.evaluate(()=>JSON.parse(localStorage.getItem('lifeworkbench_v1')));
  assert.equal(snapshot.todos[0].timePlan.minutes,40);
  assert.equal(snapshot.timeEntries[0].minutes,25);
  assert.equal(snapshot.timeEntries[0].quadrant,'2');
  assert.equal(snapshot.dailyTimeReviews[0].reason,'尚需复核');
  const mirror=await p.evaluate(async()=>{await writeLocalMirror(stateJson(),true);return JSON.parse((await readLocalMirror()).json)});
  for(const key of ['timeEntries','dailyTimeReviews'])assert.deepEqual(mirror[key],snapshot[key]);
  console.log('PASS formal quadrant UI writes classification, effort and review to original localStorage/IndexedDB');groups++;
  await p.reload();await p.locator('#aboutVer').waitFor({state:'attached'});await p.evaluate(()=>closeModal());
  for(const key of ['timeEntries','dailyTimeReviews'])assert.deepEqual(await p.evaluate(key=>S[key],key),snapshot[key]);
  await p.evaluate(()=>{goTab('me');$('#exportBtn').click()});
  const downloadPromise=p.waitForEvent('download');await p.locator('#expDl').click();
  const downloaded=JSON.parse(fs.readFileSync(await (await downloadPromise).path(),'utf8'));
  for(const key of ['timeEntries','dailyTimeReviews'])assert.deepEqual(downloaded[key],snapshot[key]);
  const integrity=await p.evaluate(()=>{
    const original=S;
    try{
      const a={id:'merge-plan',text:'本机正文',updatedAt:'2026-11-16T03:00:00Z',timePlan:{important:true,urgent:false,minutes:30,updatedAt:'2026-11-16T04:00:00Z'}};
      const b={...a,text:'远端新正文',updatedAt:'2026-11-16T05:00:00Z',timePlan:{important:false,urgent:true,minutes:10,updatedAt:'2026-11-16T02:00:00Z'}};
      const base=structuredClone(DEFAULT);
      const one=(left,right)=>{S={...structuredClone(base),todos:[structuredClone(left)]};mergeState({todos:[structuredClone(right)]});return structuredClone(S.todos)};
      const ab=one(a,b),ba=one(b,a);
      S={...structuredClone(base),todos:ab,timeEntries:[{id:'segment',taskId:'merge-plan',day:'2026-11-16',minutes:25,quadrant:'2',updatedAt:'2026-11-16T04:00:00Z'}]};
      const before=stableNote(S.timeEntries);mergeState({todos:[b]});
      return {converges:stableNote(ab)===stableNote(ba),title:ab[0].text,important:ab[0].timePlan.important,legacyPreserves:before===stableNote(S.timeEntries),
        invalidDate:timeValidDay('2026-02-31'),futureStatus:timeTaskStatus(a,'2027-01-01')};
    }finally{S=original;}
  });
  assert.deepEqual(integrity,{converges:true,title:'远端新正文',important:true,legacyPreserves:true,invalidDate:false,futureStatus:'该日期未到'});
  console.log('PASS formal refresh/JSON backup and merge direction, old remote without fields, invalid dates and future status');groups++;
  assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
  console.log('PASS formal feature context has no external requests or browser errors');groups++;
  await ctx.close();await browser.close();browser=null;
}
(async()=>{
  server=spawn(process.execPath,['tools/mock-sync-server.mjs'],{
    env:{...process.env,PORT:'4191',MOCK_PREVIEW_ONLY:'0',MOCK_BIND_HOST:'127.0.0.1'},
    stdio:['ignore','pipe','inherit'],windowsHide:true
  });
  await Promise.race([
    once(server.stdout,'data',{signal:AbortSignal.timeout(6000)}).then(([data])=>assert.match(String(data),/LOCAL_MOCK_SERVER_READY/)),
    once(server,'exit').then(([code])=>{throw new Error('Dedicated release server exited '+code)})
  ]);
  for(const file of ['check-matter-convert.cjs','check-matters.cjs','check-prod-matters.cjs','check-matters-mock-boundary.cjs','check-matters-ui.cjs','check-daily-budget.cjs','check-daily-budget-ui.cjs'])await runFixture(file);
  await formalFeature();
  console.log('ALL '+groups+' RELEASE CHECK GROUPS PASSED');
})().catch(error=>{console.error(error);process.exitCode=1})
.finally(async()=>{if(browser)await browser.close();server?.kill()});
