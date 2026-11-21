/* Account linkage and sync in isolated synthetic browser sessions. */
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
const {chromium}=require('playwright');
const origin='http://127.0.0.1:4238';
const errors=[],external=[];
let browser,server;
const pass=label=>console.log('PASS '+label);
const view=(p,id)=>p.evaluate(id=>{goTab('money');setMoneyView(id)},id);
const money=async(p,id)=>p.evaluate(id=>svBalance(svAccounts().find(a=>a.id===id)),id);
const wealth=p=>p.evaluate(()=>svWealth());
const save=(p,id)=>p.locator('#'+id+' button[type=submit]').click();
const totals=p=>p.evaluate(()=>({month:monthSum('2026-11'),budget:budgetExpOf('2026-11'),rows:S.ledger.length}));
const accountChoice=(p,id,group='ledgerAccount')=>p.locator('#'+group+' input[type=radio][value="'+id+'"]');
const checkedAccount=(p,group='ledgerAccount')=>p.locator('#'+group+' input:checked').inputValue();

async function chooseAccount(page,id,group){
  const control=accountChoice(page,id,group);
  await page.locator('label[for="'+await control.getAttribute('id')+'"]').click();
}

async function open(width=1280){
  const context=await browser.newContext({viewport:{width,height:950},timezoneId:'Asia/Shanghai',reducedMotion:'reduce'});
  await context.addInitScript(()=>localStorage.setItem('wb_sidebar_open','0'));
  await context.route('**/*',route=>{
    if(new URL(route.request().url()).origin===origin)return route.continue();
    external.push(route.request().url());return route.abort();
  });
  const page=await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  await page.clock.setFixedTime(new Date('2026-11-21T05:00:00Z'));
  await page.goto(origin+'/?mockSync=1');
  await page.waitForFunction(()=>syncActive()&&!syncBusy);
  return page;
}
async function addBill(page,type,account,amount,note,date='2026-11-21'){
  await page.locator('.money-head [data-t="'+type+'"]').click();
  await chooseAccount(page,account);
  await page.locator('#amtIn').fill(String(amount));
  await page.locator('#ledgerNoteIn').fill(note);
  await page.locator('#dateIn').fill(date);
  await page.locator('#amtSave').click();
}
async function sync(page,direction){
  await page.waitForFunction(()=>!syncBusy);
  await page.evaluate(async direction=>{
    clearTimeout(syncTimer);
    if(direction==='push')await cloudPush();else await cloudPull();
    clearTimeout(syncTimer);
  },direction);
}

(async()=>{
  server=spawn(process.execPath,['tools/mock-sync-server.mjs'],{
    env:{...process.env,PORT:'4238',MOCK_PREVIEW_ONLY:'1',MOCK_BIND_HOST:'127.0.0.1'},
    stdio:['ignore','pipe','inherit'],windowsHide:true
  });
  const [ready]=await once(server.stdout,'data',{signal:AbortSignal.timeout(8000)});
  assert.match(String(ready),/LOCAL_MOCK_SERVER_READY/);
  browser=await chromium.launch({executablePath:process.env.SAVINGS_BROWSER});
  const p=await open();
  await p.evaluate(()=>{
    clearTimeout(syncTimer);S=structuredClone(DEFAULT);
    S.ledger=[{id:'old-bill',date:'2026-11-02',type:'expense',category:'餐饮',amount:80,note:'原账未关联'}];
    S.budget=4200;
    S.savingsAccounts=[
      {id:'bank',name:'虚拟工资卡',openingDate:'2026-11-01',openingCents:500000},
      {id:'wallet',name:'虚拟钱包',openingDate:'2026-11-01',openingCents:100000},
      {id:'pocket',name:'虚拟小荷包',openingDate:'2026-11-01',openingCents:200000}
    ];
    renderAll();
  });
  await view(p,'savings');await p.locator('#svAddAccount').click();
  await p.locator('#svAccountName').fill('虚拟信用卡');
  await p.locator('#svAccountKind').selectOption('credit');
  await p.locator('#svOpeningAmount').fill('300');
  await p.locator('#svOpeningDate').fill('2026-11-01');
  await save(p,'svAccountForm');
  const card=await p.evaluate(()=>svAccounts().find(svIsCredit).id);
  assert.equal(await money(p,'wallet'),100000);
  assert.equal(await money(p,card),-30000);
  assert.deepEqual(await wealth(p),{deposit:800000,other:0,debt:30000,total:800000,net:770000});
  assert.equal(await p.evaluate(()=>Object.hasOwn(S.ledger[0],'accountId')),false);
  await p.evaluate(()=>{
    S.savingsPositions=[{id:'duplicate',kind:'liability',name:'旧信用卡欠款',amountCents:30000}];
    renderSavings();
  });
  assert.equal((await wealth(p)).debt,60000);
  await p.locator('[data-position-edit=duplicate]').click();
  await p.locator('#svPositionKind').selectOption('linked');
  await p.locator('#svPositionAccount').selectOption(card);
  await save(p,'svPositionForm');
  assert.equal((await wealth(p)).debt,30000);
  assert.deepEqual(await p.evaluate(()=>[S.savingsPositions[0].kind,S.savingsPositions[0].amountCents]),['linked',30000]);
  pass('legacy ledger and balances stay intact; credit debt is a liability and an explicitly linked old debt is not counted twice');

  await view(p,'entry');
  await addBill(p,'expense','wallet',120,'虚拟钱包支出');
  assert.equal(await money(p,'wallet'),88000);
  await addBill(p,'expense',card,150,'虚拟信用消费');
  assert.equal(await money(p,card),-45000);
  assert.match(await p.locator('#ledgerAccountHint').textContent(),/信用卡欠款/);
  await addBill(p,'income','bank',2000,'虚拟入账');
  assert.equal(await money(p,'bank'),700000);
  assert.equal(await accountChoice(p,card).count(),0);
  assert.equal(await p.getByRole('group',{name:'收款账户'}).count(),1);
  await p.locator('.money-head [data-t=expense]').click();
  assert.equal(await checkedAccount(p),card);
  assert.equal(await p.getByRole('group',{name:'扣款账户'}).count(),1);
  await p.locator('.money-head [data-t=income]').click();
  assert.equal(await checkedAccount(p),'bank');
  assert.deepEqual(await totals(p),{month:{inc:2000,exp:350},budget:350,rows:4});
  pass('income and expenses update selected accounts, preserve budget logic, and remember separate choices');

  const prior=await wealth(p),before=await totals(p);
  await p.locator('#ledgerTransfer').click();
  await p.locator('#svEditAccount').selectOption('bank');
  await p.locator('#svEditTo').selectOption(card);
  await p.locator('#svEditAmount').fill('200');
  await save(p,'svTransferForm');
  assert.equal(await money(p,'bank'),680000);
  assert.equal(await money(p,card),-25000);
  const repaid=await wealth(p);
  assert.equal(repaid.net,prior.net);
  assert.equal(prior.total-repaid.total,20000);
  assert.equal(prior.debt-repaid.debt,20000);
  assert.deepEqual(await totals(p),before);
  await view(p,'savings');
  await p.locator('#svFilterAccount').selectOption(card);
  assert.match(await p.locator('#svFlows').textContent(),/信用卡还款/);
  assert.match(await p.locator('#svFlows').textContent(),/账本支出/);
  assert.match(await p.locator('#svCreditDebts').textContent(),/250/);
  pass('repayment reduces both balances while preserving net worth and ledger spending; account activity shows both movements');

  await p.locator('#fmSetPocket').click();
  assert.equal(await p.locator('#fmPocketAccount option[value="'+card+'"]').count(),0);
  await p.locator('#fmPocketAccount').selectOption('pocket');
  await p.locator('#fmOpeningPending').fill('100');
  await save(p,'fmEditForm');
  await view(p,'entry');await p.locator('#ledgerTransfer').click();await p.locator('#svQuickPocket').click();
  await p.locator('#fmEntryOther').selectOption('bank');
  await p.locator('#fmEntryAmount').fill('800');
  await p.locator('#fmEntryRepay').fill('100');
  await save(p,'fmEditForm');
  assert.deepEqual(await p.evaluate(()=>fmPocketMetrics()),{pending:0,monthly:80000,yearly:80000});
  assert.equal(await money(p,'pocket'),290000);
  assert.deepEqual(await totals(p),before);
  await view(p,'savings');await p.locator('#svFilterAccount').selectOption('pocket');
  assert.match(await p.locator('#svStats').textContent(),/新增存钱¥800/);
  assert.match(await p.locator('#svStats').textContent(),/已补回¥100/);
  await p.locator('#svMode').selectOption('year');
  const november=p.locator('#svMonths tr').filter({hasText:'11月'});
  assert.deepEqual(await november.locator('td').allTextContents(),['¥800','¥0','¥100','¥2,900']);
  pass('the same pocket transfer records new savings and repayment, and monthly and annual statistics exclude repayment from progress');

  await view(p,'entry');await addBill(p,'expense','wallet',999,'不应保存');
  assert.match(await p.locator('#toast').textContent(),/余额不足/);
  await addBill(p,'expense','wallet',1,'不应保存','2026-10-30');
  assert.match(await p.locator('#toast').textContent(),/起始日/);
  assert.deepEqual(await totals(p),before);
  const bill=await p.evaluate(()=>S.ledger.find(e=>e.note==='虚拟信用消费'));
  await sync(p,'push');
  const other=await open(390);
  assert.equal(await money(other,card),-25000);
  await other.evaluate(id=>editLedgerById(id),bill.id);
  assert.equal(await checkedAccount(other,'elAccount'),card);
  await other.locator('#elType').selectOption('income');
  assert.equal(await accountChoice(other,card,'elAccount').count(),0);
  assert.equal(await checkedAccount(other,'elAccount'),'');
  await other.locator('#elType').selectOption('expense');
  await chooseAccount(other,card,'elAccount');
  await other.locator('#elAmt').fill('180');
  await other.locator('#elSave').click();
  assert.equal(await money(other,card),-28000);
  await sync(other,'push');await sync(p,'pull');
  assert.equal(await money(p,card),-28000);
  await other.evaluate(()=>goTab('history'));
  other.once('dialog',d=>d.accept());
  await other.locator('.hist-row[data-hid="'+bill.id+'"] .hr-del').click();
  assert.equal(await money(other,card),-10000);
  await sync(other,'push');await sync(p,'pull');
  assert.equal(await money(p,card),-10000);
  await p.evaluate(old=>mergeData({ledger:[old]}),bill);
  assert.equal(await p.evaluate(id=>S.ledger.some(row=>row.id===id),bill.id),false);
  assert.equal(await money(p,card),-10000);
  pass('invalid cash movements stay out, and linked edits and deletions propagate across Mock devices without stale revival');

  await view(p,'entry');
  await chooseAccount(p,'');
  const unlinked=accountChoice(p,'');
  await unlinked.focus();
  await unlinked.press('ArrowRight');
  assert.equal(await checkedAccount(p),'bank');
  await p.evaluate(()=>{
    S.savingsAccounts.push({id:'long-name',name:'很长的虚拟扣款账户名称用来验证手机屏幕空间'.repeat(3),openingDate:'2026-11-01',openingCents:0});
    renderMoney();
  });
  for(const width of [320,375,414,768]){
    await p.setViewportSize({width,height:950});
    const measured=await p.locator('#moneyFormSec').evaluate(el=>({
      fit:el.scrollWidth<=el.clientWidth+1,
      buttons:[...el.querySelectorAll('#ledgerTransfer, #ledgerAccount .cat-chip')].map(e=>e.getBoundingClientRect().height)
    }));
    assert(measured.fit&&measured.buttons.every(h=>h>=43.99),JSON.stringify({width,measured}));
  }
  await p.locator('#ledgerTransfer').click();
  await p.evaluate(()=>setAmountPrivacy(true));
  assert.equal(await p.locator('#svTransferForm').count(),0);
  assert.equal(await p.locator('#ledgerTransfer').isDisabled(),true);
  assert.equal(await unlinked.isDisabled(),true);
  pass('account picker and transfer shortcut fit small screens and respect amount privacy');

  await p.evaluate(()=>{
    setAmountPrivacy(false);
    S.savingsPayroll.pocketId='pocket';
    S.savingsPayroll.directions=[{id:'daily',name:'日常开支',saving:false}];
    S.savingsPayroll.rules=[{id:'daily-rule',target:'daily',method:'fixed',value:200,cond:'always'}];
    const learning=lnData();
    learning.directions=[{id:'compact-dir',name:'一个有较长名称的虚拟方向',active:true}];
    learning.questions=[{id:'compact-question',directionId:'compact-dir',title:'模拟问题',status:'solved',answer:'已记录答案'}];
    renderSavings();
  });
  await p.setViewportSize({width:320,height:950});
  await view(p,'savings');
  const wallet=p.locator('#svAccounts .sv-account-row').filter({hasText:'虚拟钱包'});
  const edit=wallet.getByRole('button',{name:'编辑',exact:true});
  const turnOff=wallet.getByRole('button',{name:'停用',exact:true});
  const positions=await Promise.all([edit.boundingBox(),turnOff.boundingBox()]);
  assert(positions.every(box=>box&&box.width>=43.99&&box.height>=43.99));
  assert.equal(positions[0].y,positions[1].y);
  assert.equal(await wallet.evaluate(row=>row.scrollWidth<=row.clientWidth+1),true);
  assert.equal(await wallet.locator('strong').evaluate(amount=>amount.parentElement.getBoundingClientRect().height<=70),true);
  await edit.click();
  assert.equal(await p.locator('#svAccountName').inputValue(),'虚拟钱包');
  await p.locator('#svDialogCancel').click();
  const oldBalance=await money(p,'wallet');
  await turnOff.click();
  assert.match(await wallet.textContent(),/已停用/);
  assert.equal(await accountChoice(p,'wallet').count(),0);
  assert.equal(await money(p,'wallet'),oldBalance);
  await wallet.getByRole('button',{name:'启用',exact:true}).click();
  assert.equal(await accountChoice(p,'wallet').count(),1);

  await p.evaluate(()=>{
    $('#svAllocationPlan').open=true;
    $('#fmRulePanel').open=true;
  });
  await p.locator('#fmRules').getByRole('button',{name:'编辑',exact:true}).click();
  assert.equal(await p.locator('#fmRuleValue').inputValue(),'200');
  await p.locator('#svDialogCancel').click();
  await p.locator('#svFilterAccount').selectOption('');
  assert.equal(await p.locator('#svFlows').getByRole('button',{name:'编辑账单',exact:true}).count()>0,true);

  await p.evaluate(()=>{goTab('learning');lnOpenDir('compact-dir');});
  const learningHead=p.locator('.ln-direction-head');
  await learningHead.getByRole('button',{name:'停用',exact:true}).click();
  assert.match(await learningHead.textContent(),/已停用/);
  await learningHead.getByRole('button',{name:'启用',exact:true}).click();
  await learningHead.getByRole('button',{name:'编辑',exact:true}).click();
  assert.equal(await p.locator('#lnDirName').inputValue(),'一个有较长名称的虚拟方向');
  await p.evaluate(()=>closeModal());
  await p.locator('.ln-group-tab[data-g=knowledge]').click();
  const question=p.locator('.ln-item').filter({hasText:'模拟问题'});
  await question.getByRole('button',{name:'编辑',exact:true}).click();
  assert.equal(await p.locator('#modalBox h4').textContent().then(text=>text.includes('编辑问题')),true);
  await p.evaluate(()=>closeModal());
  await question.getByRole('button',{name:'删除',exact:true}).click();
  assert.equal(await p.locator('#lnCfm').isVisible(),true);
  await p.locator('#modalBox').getByRole('button',{name:'取消',exact:true}).click();
  assert.equal(await question.count(),1);
  assert.equal(await learningHead.evaluate(row=>row.scrollWidth<=row.clientWidth+1),true);
  pass('compact account and learning controls fit one row at 320px; edit, suspend, enable and delete confirmation still work');
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
})().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{await browser?.close();server?.kill();});
