"""Create deterministic synthetic finance fixtures and an isolated, preloaded offline review."""
from pathlib import Path
import json
import subprocess
import sys

root=Path(__file__).resolve().parents[1]
out=root.parents[2]/'output'/'finance-review-20261119'
out.mkdir(parents=True,exist_ok=True)
state={
 'version':3,'_demoSeeded':True,
 'todos':[],'habits':[],'notes':[],'worklog':[],'countdowns':[],'moods':{},'habitArchive':{},
 'timeEntries':[],'dailyTimeReviews':[],'quickNotes':[],
 'learning':{k:[] for k in ['directions','contents','plans','questions','reviews','mistakes','selftests']},
 'budget':4500,'budgetCats':{'交通':True},
 'customCats':{'expense':[{'name':'虚拟差旅费','color':'#6a8db5','inBudget':False}],'income':[]},
 'ledgerSettingsUpdatedAt':{'budget':1795000000000,'custom:expense:虚拟差旅费':1795000000000},
 'ledger':[],'savingsAccounts':[],'savingsEntries':[]
}
def bill(date,amount,category,type='expense',note='虚拟验收'):
 state['ledger'].append({'id':'virtual-ledger-'+str(len(state['ledger'])),'date':date,'amount':amount,'category':category,'type':type,'note':note})
for year in [2025,2026]:
 for month in range(1,13 if year==2025 else 11):
  if year==2026 and month==4:continue
  date=f'{year}-{month:02d}-10'
  bill(date,8000,'工资','income')
  bill(date,1000+month*100,'餐饮')
  bill(date,500,'居住')
  bill(date,600+month*50,'虚拟差旅费')
  bill(date,600+month*50,'报销','income')
bill('2026-11-02',8000,'工资','income')
for amount,category in [(1200,'餐饮'),(800,'居住'),(900,'购物'),(1800,'虚拟差旅费')]:bill('2026-11-10',amount,category)
bill('2026-11-12',1800,'报销','income')
# A cleared correction exercises signed legacy ledger records.
bill('2026-10-16',50,'购物',note='虚拟更正原记录')
bill('2026-10-17',-50,'购物',note='虚拟退款冲减')
for id,name,date,balance in [
 ('virtual-bank','虚拟工资卡','2025-12-01',1000000),
 ('virtual-cash','虚拟现金','2026-02-01',50000),
 ('virtual-wechat','虚拟微信','2026-06-01',0)]:
 state['savingsAccounts'].append({'id':id,'name':name,'openingDate':date,'openingCents':balance,'archived':False,'updatedAt':'2026-11-18T00:00:00Z'})
for date,kind,account,amount,to in [
 ('2025-12-10','deposit','virtual-bank',200000,None),
 ('2026-01-10','withdraw','virtual-bank',100000,None),
 ('2026-02-10','transfer','virtual-bank',20000,'virtual-cash'),
 ('2026-06-10','transfer','virtual-bank',10000,'virtual-wechat'),
 ('2026-10-10','deposit','virtual-bank',50000,None),
 ('2026-11-05','deposit','virtual-bank',100000,None),
 ('2026-11-06','withdraw','virtual-bank',30000,None),
 ('2026-11-07','transfer','virtual-bank',20000,'virtual-wechat')]:
 record={'id':'virtual-sv-'+str(len(state['savingsEntries'])),'date':date,'kind':kind,'accountId':account,'amountCents':amount,'note':'纯虚拟验收','updatedAt':'2026-11-18T00:00:00Z'}
 if to:record['toAccountId']=to
 state['savingsEntries'].append(record)
state['savingsPositions']=[
 {'id':'virtual-fund','kind':'asset','name':'虚拟基金估值','amountCents':500000,'updatedAt':'2026-11-19T00:00:00Z'},
 {'id':'virtual-debt','kind':'liability','name':'虚拟信用卡待还','amountCents':200000,'updatedAt':'2026-11-19T00:00:00Z'}
]
state['savingsGoals']={'monthNetTargetCents':100000,'yearNetTargetCents':500000,'yearBalanceTargetCents':1500000,'updatedAt':'2026-11-19T00:00:00Z'}
# Legacy duplicate is deliberately left for manual association, so it never doubles assets.
state['fundMgr']={'income':8000,'assets':[{'id':'old-bank','name':'虚拟工资卡（旧资产）','amount':11700}],'liabilities':[],'goals':{'monthGoal':1000,'yearGoal':15000,'monthSaved':999,'yearSaved':9999}}
fixture=out/'虚拟数据.json'
fixture.write_text(json.dumps(state,ensure_ascii=False,indent=2),encoding='utf-8')
preview=out/'index.html'
subprocess.run([sys.executable,str(root/'tools/build-review-preview.py'),'--output',str(preview),'--label','存款与支出分析 · 虚拟数据','--namespace','review_finance_unified_20261119_'],check=True)
html=preview.read_text('utf-8')
payload=json.dumps(state,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c')
seed="""const reviewVirtualFixture=PAYLOAD;
function loadReviewVirtualFixture(){
  localStorage.setItem(KEY,JSON.stringify(reviewVirtualFixture));
  localStorage.setItem('virtual_fixture_loaded','v2');
}
if(!localStorage.getItem('virtual_fixture_loaded'))loadReviewVirtualFixture();
"""
assert html.count('let S=load();')==1
html=html.replace('let S=load();',seed.replace('PAYLOAD',payload)+'\nlet S=load();')
notice='<p><a href="虚拟数据.json" download>下载虚拟 JSON</a> · <a href="验收说明.md">查看验收数值</a> · <button id="reviewResetVirtual" type="button">重置虚拟数据</button></p>'
html=html.replace('<span id="offlinePersistenceNote"></span>','<span id="offlinePersistenceNote"></span>'+notice)
html=html.replace('initFilters();\nrenderAll();',"""document.getElementById('reviewResetVirtual').onclick=()=>{
 if(!confirm('将此虚拟验收页重置为初始样例，确定继续？'))return;
 loadReviewVirtualFixture();location.reload();
};
initFilters();
renderAll();""")
preview.write_text(html,encoding='utf-8')
print(json.dumps({'preview':str(preview),'fixture':str(fixture),'ledgerCount':len(state['ledger']),'savingsEntries':len(state['savingsEntries'])},ensure_ascii=False))
