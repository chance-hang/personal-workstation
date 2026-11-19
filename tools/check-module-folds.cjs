/* Test layout preferences and navigation in temporary browsers with synthetic data. */
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
const {chromium}=require('playwright');
const base='http://127.0.0.1:4237';
const url=base+'/?mockSync=1';
const pages=['today','money','heat','history','notes','learning','me'];
const errors=[],external=[];
const log=message=>console.log('PASS '+message);
let browser,server;
const tab=(page,name)=>page.locator('nav.tabbar a[data-p="'+name+'"]').click();
const toggle=(page,id)=>page.locator('[data-fold-toggle="'+id+'"]');
const expanded=(page,id)=>toggle(page,id).getAttribute('aria-expanded');
const openNative=(page,id)=>page.locator('#'+id).evaluate(el=>el.open);

async function launchPage(context){
  const page=await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  await page.clock.setFixedTime(new Date('2026-11-19T06:00:00Z'));
  await page.goto(url);
  await page.waitForFunction(()=>typeof moduleFoldPanels!=='undefined'&&moduleFoldPanels.size>0&&syncActive()&&!syncBusy);
  return page;
}
async function openSettings(page){
  await tab(page,'me');
  await page.locator('#moduleFoldSettingsBtn').click();
  await page.locator('#moduleFoldGlobal').waitFor();
}
async function setOverride(page,scope,id,value){
  await page.locator('#moduleFoldPage').selectOption(scope);
  await page.locator('[data-fold-default="'+id+'"]').selectOption(value);
}

(async()=>{
  server=spawn(process.execPath,['tools/mock-sync-server.mjs'],{
    env:{...process.env,PORT:'4237',MOCK_PREVIEW_ONLY:'1',MOCK_BIND_HOST:'127.0.0.1'},
    stdio:['ignore','pipe','inherit'],windowsHide:true
  });
  const [ready]=await once(server.stdout,'data',{signal:AbortSignal.timeout(8000)});
  assert.match(String(ready),/LOCAL_MOCK_SERVER_READY/);
  browser=await chromium.launch({executablePath:process.env.SAVINGS_BROWSER});
  const context=await browser.newContext({viewport:{width:1280,height:1000},timezoneId:'Asia/Shanghai',reducedMotion:'reduce'});
  await context.addInitScript(()=>localStorage.setItem('wb_sidebar_open','0'));
  await context.route('**/*',route=>{
    if(new URL(route.request().url()).origin===base)return route.continue();
    external.push(route.request().url());return route.abort();
  });
  const page=await launchPage(context);
  const coverage=await page.evaluate(()=>({
    missing:[...document.querySelectorAll('.page :is([data-module],[data-fold-part])')]
      .filter(el=>!moduleFoldPanels.has(el.dataset.module||el.dataset.foldPart)).map(el=>el.outerHTML.slice(0,140)),
    total:moduleFoldPanels.size,
    primary:document.querySelectorAll('.page [data-module]').length,
    pageKeys:[...new Set([...moduleFoldPanels.values()].map(panel=>panel.page))],
    closed:[...moduleFoldPanels.values()].filter(panel=>panel.native?!panel.el.open:panel.el.hasAttribute('data-panel-folded')).map(panel=>panel.id)
  }));
  assert.deepEqual(coverage.missing,[]);
  assert.deepEqual(coverage.pageKeys,pages);
  assert.deepEqual(coverage.closed,[]);
  assert(coverage.total>coverage.primary&&coverage.primary>=25);
  log('all '+coverage.total+' module sections are covered across all seven pages and start open');

  await page.locator('#todoIn').fill('临时草稿');
  await toggle(page,'todos').focus();
  await page.keyboard.press('Space');
  assert.equal(await expanded(page,'todos'),'false');
  assert.equal(await page.locator('#todoIn').isVisible(),false);
  await tab(page,'heat');await tab(page,'today');
  assert.equal(await expanded(page,'todos'),'false');
  await toggle(page,'todos').press('Enter');
  assert.equal(await page.locator('#todoIn').inputValue(),'临时草稿');
  assert.equal(await page.evaluate(()=>localStorage.getItem(MODULE_FOLD_KEY)),null);
  log('keyboard folding, tab switching, and reopening keep drafts without changing defaults');

  const protectedState=await page.evaluate(()=>{
    S.ledger=[{id:'virtual-ledger-folds',date:'2026-11-10',type:'expense',category:'餐饮',amount:66,note:'虚拟'}];
    S.budget=4500;
    S.budgetCats={'虚拟差旅':false};
    persist();
    return JSON.stringify([S.ledger,S.budget,S.budgetCats,S.modules,S.savingsPayPlans]);
  });
  await openSettings(page);
  await page.locator('#moduleFoldGlobal').selectOption('closed');
  await setOverride(page,'today','todos','open');
  await setOverride(page,'money','savings','open');
  await setOverride(page,'money','payrollPlan','closed');
  await page.locator('#moduleFoldDone').click();
  assert.equal(await expanded(page,'dataManage'),'false');
  assert.equal(await page.locator('#moduleFoldSettingsBtn').isVisible(),true);
  assert.equal(await page.evaluate(()=>JSON.stringify([S.ledger,S.budget,S.budgetCats,S.modules,S.savingsPayPlans])),protectedState);
  assert.equal(await page.evaluate(()=>JSON.parse(stateJson()).moduleFoldPrefs),undefined);
  await page.reload();
  await page.waitForFunction(()=>syncActive()&&!syncBusy);
  assert.equal(await expanded(page,'todos'),'true');
  assert.equal(await expanded(page,'pomodoro'),'false');
  assert.equal(await openNative(page,'pomoSettings'),false);
  await tab(page,'money');
  await page.locator('#moneyViewSwitch [data-v="savings"]').click();
  assert.equal(await expanded(page,'savings'),'true');
  assert.equal(await openNative(page,'svAllocationPlan'),false);
  await page.locator('#svAllocationPlan > summary').press('Enter');
  assert.equal(await openNative(page,'svAllocationPlan'),true);
  assert.equal(await openNative(page,'fmRulePanel'),false);
  log('global and per-module defaults survive reload, including native nested panels; business data and export format stay intact');

  await tab(page,'today');
  await page.locator('#todayGoMoney').click();
  assert.equal(await expanded(page,'moneyForm'),'true');
  assert.equal(await page.locator('#amtIn').isVisible(),true);
  assert.equal(await expanded(page,'monthOverview'),'false');
  await page.locator('#sideToggle').click();
  await page.locator('.side-item[data-mod="flowList"]').click();
  assert.equal(await page.locator('#page-money').getAttribute('data-money-view'),'analysis');
  assert.equal(await expanded(page,'flowList'),'true');
  assert.equal(await expanded(page,'flowBudgetPie'),'false');
  await page.locator('#sideToggle').click();
  await tab(page,'today');
  await page.locator('#todayGoLearning').click();
  assert.equal(await expanded(page,'learning'),'true');
  await tab(page,'today');
  await page.locator('#todayOpenMatters').click();
  assert.equal(await expanded(page,'notes'),'true');
  assert.equal(await expanded(page,'mattersList'),'true');
  await page.locator('#quadrantTab').click();
  assert.equal(await expanded(page,'quadrants'),'true');
  assert.equal(await expanded(page,'mattersList'),'true');
  assert.equal(await page.locator('#matterListView').isVisible(),false);
  await tab(page,'today');
  await page.locator('#todayGoPomodoro').click();
  assert.equal(await page.locator('#pomoPrimary').isVisible(),true);
  await page.locator('#pomoFocusView').click();
  assert.equal(await toggle(page,'pomodoro').isDisabled(),true);
  await page.keyboard.press('Escape');
  assert.equal(await toggle(page,'pomodoro').isEnabled(),true);
  log('quick links and sidebar reveal only the requested module; timer focus and alternate workspaces still work');

  const sameBrowser=await launchPage(context);
  assert.equal(await expanded(sameBrowser,'pomodoro'),'false');
  await openSettings(page);
  await setOverride(page,'today','pomodoro','open');
  await sameBrowser.waitForFunction(()=>document.querySelector('[data-fold-toggle="pomodoro"]').ariaExpanded==='true');
  await setOverride(page,'today','pomodoro','inherit');
  await sameBrowser.waitForFunction(()=>document.querySelector('[data-fold-toggle="pomodoro"]').ariaExpanded==='false');
  log('another tab sees the changed default; restoring inheritance follows global');
  await page.locator('#moduleFoldDone').click();

  await openSettings(page);
  await page.locator('#moduleFoldGlobal').selectOption('open');
  await page.locator('#moduleFoldPage').selectOption('money');
  for(const width of [320,375,414,768]){
    await page.setViewportSize({width,height:900});
    const size=await page.locator('#modalBox').evaluate(el=>({
      content:el.scrollWidth,view:el.clientWidth,left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right,
      control:el.querySelector('.module-fold-row select').getBoundingClientRect().height
    }));
    assert(size.content<=size.view+1&&size.left>=-1&&size.right<=width+1&&size.control>=44,JSON.stringify({width,size}));
  }
  await page.locator('#moduleFoldDone').click();
  assert.equal(await page.locator('#moduleFoldSettingsBtn').evaluate(el=>el===document.activeElement),true);
  await tab(page,'today');
  assert(await toggle(page,'todos').evaluate(el=>el.getBoundingClientRect().height>=44));
  assert.deepEqual(errors,[]);
  assert.deepEqual(external,[]);
  log('320/375/414/768px settings fit, focus returns, no browser errors or external calls');
})().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{await browser?.close();server?.kill();});
