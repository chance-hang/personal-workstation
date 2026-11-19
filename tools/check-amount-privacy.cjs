/* Synthetic finance data in an isolated browser and loopback mock backend. */
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {chromium}=require('playwright');

const origin='http://127.0.0.1:4197';
const url=origin+'/?mockSync=1';
const output=process.env.AMOUNT_PRIVACY_OUTPUT;
const privateText=/¥••••/;
const privateNumbers=/(?:8,?641\.25|12,?789\.51|94,?731\.82|38,?791|73,?853|97,?231|57,?301|98,?032|61,?013|4,?331\.93|7\.38\s*万元|3,?722\.31)/;
const errors=[],external=[];
let browser,checks=0;
const pass=label=>console.log('PASS '+(++checks)+' '+label);
const show=(p,selector)=>p.locator(selector).innerText();
const setTab=(p,tab)=>p.evaluate(tab=>goTab(tab),tab);
const toggle=p=>p.getByRole('button',{name:'金额隐私',exact:true});
const hasNoAmounts=txt=>assert.doesNotMatch(txt,privateNumbers);

async function makePage(width,context){
  const mobile=width<760;
  if(!context){
    context=await browser.newContext({
      viewport:{width,height:mobile?860:1000},isMobile:mobile,hasTouch:mobile,timezoneId:'Asia/Shanghai'
    });
    await context.route('**/*',route=>{
      const href=route.request().url();
      if(new URL(href).origin===origin)return route.continue();
      external.push(href);return route.abort();
    });
    await context.addInitScript(()=>{if(location.protocol==='http:')localStorage.setItem('wb_sidebar_open','0')});
  }
  const p=await context.newPage();
  p.on('pageerror',error=>errors.push(error.message));
  await p.clock.install({time:new Date('2026-11-17T03:00:00Z')});
  await p.goto(url);
  await p.waitForFunction(()=>MOCK_SYNC&&syncActive()&&!syncBusy);
  return p;
}
async function seed(p){
  await p.evaluate(()=>{
    sessionPasscode=null;
    clearTimeout(syncTimer);
    S=structuredClone(DEFAULT);
    const date=todayStr();
    S.budget=38791;
    S.ledger=[
      {id:'synthetic-expense',date,type:'expense',category:'餐饮',amount:8641.25,note:'测试餐费 98032'},
      {id:'synthetic-income',date,type:'income',category:'工资',amount:94731.82,note:'测试到账'}
    ];
    S.todos=[newMatterTodo('合成报价 USD 4331.93 · 报销 3 笔',date,{id:'synthetic-todo'})];
    const fm=ensureFundMgr();
    fm.income=73853;
    fm.rules[0].value=61013;
    fm.goals={monthGoal:12789.51,monthSaved:124.25,yearGoal:57301,yearSaved:1771};
    fm.assets=[{id:'asset-fixture',name:'测试账户',amount:97231}];
    fm.liabilities=[{id:'debt-fixture',name:'测试负债',amount:3722.31}];
    save();
    renderAll();
  });
}
async function getDownload(p,selector){
  const [download]=await Promise.all([p.waitForEvent('download'),p.locator(selector).click()]);
  return fs.readFile(await download.path(),'utf8');
}
async function screenshot(p,name){
  if(output)await p.screenshot({path:path.join(output,name+'.png'),animations:'disabled'});
}

(async()=>{
  if(output)await fs.mkdir(output,{recursive:true});
  browser=await chromium.launch({headless:true,executablePath:process.env.QUADRANT_BROWSER});
  const p=await makePage(1440),ctx=p.context();
  await seed(p);
  assert.equal(await toggle(p).getAttribute('aria-pressed'),'false');
  assert.match(await show(p,'#focusExp'),/8,641\.25/);
  assert.match(await show(p,'#focusExpSub'),/%/);
  assert.equal(await p.locator('#fmIncome').inputValue(),'73853');
  const data=await p.evaluate(()=>stateJson());
  await p.locator('#focusBudgetToggle').click();
  await p.evaluate(()=>{$('#amtIn').value='1777.48'});
  await toggle(p).focus();
  await p.keyboard.press('Space');
  assert.equal(await toggle(p).getAttribute('aria-pressed'),'true');
  assert.match(await show(p,'#focusExp'),privateText);
  assert.equal(await show(p,'#focusExpSub'),'预算比例已隐藏');
  hasNoAmounts(await show(p,'#focusBudgetDetails'));
  assert.equal(await p.locator('#amtIn').inputValue(),'');
  assert(await p.locator('#amtIn').isDisabled());
  assert(await p.locator('#amtSave').isDisabled());
  pass('keyboard toggle masks the homepage, open budget details and a ledger draft');

  await p.evaluate(()=>{
    const probe=document.createElement('div');
    probe.id='privacy-probe';
    probe.innerHTML='<span title="预算：3722.31">估算 7.38 万元，项目 2 项，报销 3 笔</span><input value="USD 4331.93">';
    document.body.append(probe);
  });
  const probe=p.locator('#privacy-probe');
  assert.equal(await probe.locator('span').getAttribute('title'),'预算：••••');
  assert.equal(await probe.locator('span').innerText(),'估算••••，项目 2 项，报销 3 笔');
  assert(!(await probe.locator('input').isVisible()));
  await setTab(p,'notes');
  hasNoAmounts(await p.locator('#noteList').innerText());
  assert.match(await p.locator('#noteList').innerText(),/报销 3 笔/);
  pass('late-rendered text, title hints and editors are covered while ordinary counts remain');

  await setTab(p,'money');
  await p.evaluate(()=>setMoneyView('analysis'));
  const financialReadouts=['#todayStat','#monthStat','#budgetTxt','#budgetHint','#flowSum','#flowList','#flowPie','#flowPieBudget','#catChart','#fmResultGrid','#fmTransferSummary','#fmHistoryList','#svGoals','#svWealth','#svOtherAssets','#svDebts','#svAllocation','#svLegacyAssets','#svLegacyGoalsText'];
  for(const selector of financialReadouts)hasNoAmounts(await p.locator(selector).textContent());
  assert.match(await show(p,'#flowList'),/测试餐费 ••••/);
  assert.match(await show(p,'#monthStat'),privateText);
  assert.match(await show(p,'#flowPie'),/金额图表已隐藏/);
  assert.match(await show(p,'#catChart'),/支出图表已隐藏/);
  assert.equal(await p.locator('#flowPie svg,#flowPieBudget svg,#svAllocation svg').count(),0);
  assert.equal(await p.locator('#budgetBar').evaluate(e=>e.style.width),'0px');
  await screenshot(p,'amount-privacy-ledger-desktop');
  await p.evaluate(()=>setMoneyView('plan'));
  await p.locator('#svAllocationPlan > summary').click();
  await p.locator('#fmRulePanel > summary').click();
  for(const selector of ['#fmIncome','#svEditGoals','#svAddAsset','#svAddDebt']){
    assert(await p.locator(selector).isDisabled(),selector);
    if(selector==='#fmIncome')assert.equal(await p.locator(selector).inputValue(),'',selector);
  }
  assert.match(await show(p,'#fmRules'),/隐藏分配规则/);
  assert.match(await show(p,'#svAllocation'),/资产配置已隐藏/);
  pass('ledger, budget, income, rules, savings and assets mask values and remove proportional charts');

  await setTab(p,'history');
  hasNoAmounts(await show(p,'#hisList'));
  assert.match(await show(p,'#hisList'),privateText);
  assert.match(await show(p,'#hisStat'),privateText);
  await p.locator('#hisExport').click();
  const history=p.locator('#hisExpText');
  assert.match(await history.inputValue(),privateText);
  hasNoAmounts(await history.inputValue());
  hasNoAmounts(await getDownload(p,'#hisDl'));
  await p.evaluate(()=>closeModal());
  await setTab(p,'today');
  await p.evaluate(()=>generateDailyReport(todayStr()));
  assert.match(await p.locator('#reportText').inputValue(),privateText);
  hasNoAmounts(await getDownload(p,'#reportDl'));
  await p.evaluate(()=>closeModal());
  for(const id of ['exportBtn','budgetBtn']){
    await p.evaluate(id=>document.getElementById(id).click(),id);
    assert.match(await show(p,'#toast'),/请先关闭金额隐私/);
  }
  assert.equal(await p.evaluate(()=>stateJson()),data);
  pass('history and daily report Markdown are redacted and complete backup and budget editing are guarded');

  const reports=await p.evaluate(()=>{
    const snapshot=structuredClone(S);
    snapshot.notes=[{id:'preview-note',content:'甲'.repeat(55)+'3722.31元'}];
    return {
      quadrants:timeReport(todayStr(),todayStr()),
      versions:renderSyncHistoryPreview(snapshot)
    };
  });
  assert.match(reports.quadrants,/合成报价 ••••/);
  assert.match(reports.versions,/测试餐费 ••••/);
  assert.match(reports.versions,/甲••••/);
  hasNoAmounts(reports.quadrants);
  hasNoAmounts(reports.versions);
  pass('quadrant export and sync history preview cover recognized amounts and ledger notes');

  const second=await makePage(1440,ctx);
  assert.equal(await toggle(second).getAttribute('aria-pressed'),'true');
  await toggle(second).click();
  await p.waitForFunction(()=>!amountPrivacy);
  assert.equal(await p.locator('#amtIn').inputValue(),'1777.48');
  assert.equal(await probe.locator('span').getAttribute('title'),'预算：3722.31');
  assert.equal(await probe.locator('span').innerText(),'估算 7.38 万元，项目 2 项，报销 3 笔');
  assert(await probe.locator('input').isVisible());
  assert.equal(await p.evaluate(()=>stateJson()),data);
  assert.match(await p.locator('#flowList').textContent(),/测试餐费 98032/);
  assert.equal(await p.locator('#fmIncome').inputValue(),'73853');
  await p.evaluate(()=>document.getElementById('exportBtn').click());
  await second.waitForFunction(()=>!amountPrivacy);
  await toggle(second).click();
  await p.waitForFunction(()=>amountPrivacy&&!$('#expDl'));
  await p.reload();
  await p.waitForFunction(()=>MOCK_SYNC&&syncActive()&&!syncBusy);
  assert.equal(await toggle(p).getAttribute('aria-pressed'),'true');
  assert.match(await show(p,'#focusExp'),privateText);
  assert.equal(await p.evaluate(()=>S.ledger[0].amount),8641.25);
  assert.equal(await p.evaluate(()=>Object.hasOwn(S,'amountPrivacy')||Object.hasOwn(S,'wb_amount_privacy')),false);
  await toggle(p).click();
  await p.evaluate(()=>document.getElementById('exportBtn').click());
  const backup=JSON.parse(await getDownload(p,'#expDl'));
  assert.equal(backup.ledger[0].amount,8641.25);
  assert.equal(backup.budget,38791);
  await ctx.close();
  pass('reload and second tab keep the setting locally, toggling restores values and the original backup format');

  for(const width of [320,390,768]){
    const mobile=await makePage(width);
    await seed(mobile);
    const button=toggle(mobile);
    if(width<760)await button.tap();else await button.click();
    const geometry=await mobile.evaluate(()=>{
      const rect=$('#amountPrivacyToggle').getBoundingClientRect();
      return {fits:rect.left>=0&&rect.right<=innerWidth,hit:rect.height,overflow:document.documentElement.scrollWidth>innerWidth};
    });
    assert(geometry.fits&&!geometry.overflow&&geometry.hit>=44,JSON.stringify({width,geometry}));
    assert.match(await show(mobile,'#focusExp'),privateText);
    if(width===390)await screenshot(mobile,'amount-privacy-home-mobile');
    await mobile.context().close();
    pass(width+'px layout, touch target and amount masking');
  }
  assert.deepEqual(errors,[]);
  assert.deepEqual(external,[]);
  pass('no page errors and no external requests');
  console.log('ALL '+checks+' AMOUNT PRIVACY GROUPS PASSED');
})().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{await browser?.close()});
