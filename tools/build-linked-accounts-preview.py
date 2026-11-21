"""Build an isolated preview with virtual wallet, salary card, credit card and pocket."""
import argparse
import json
import subprocess
import sys
from datetime import date
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("--output-dir", required=True, type=Path)
parser.add_argument("--credit-setup", action="store_true")
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
out = args.output_dir.resolve()
out.mkdir(parents=True, exist_ok=True)
preview = out / "index.html"
day = date.today().replace(day=1).isoformat()
stamp = day + "T00:00:00.000Z"

accounts = [
    {"id": "wallet", "name": "虚拟钱包", "openingCents": 100000},
    {"id": "bank", "name": "虚拟工资卡", "openingCents": 500000},
    {"id": "credit", "name": "虚拟信用卡", "kind": "credit", "openingCents": -30000},
    {"id": "pocket", "name": "虚拟小荷包", "openingCents": 200000},
]
ledger = [
    {"id": "legacy", "type": "expense", "amount": 80, "category": "餐饮", "note": "未关联账户的旧账"},
    {"id": "cash-bill", "type": "expense", "amount": 120, "category": "餐饮", "accountId": "wallet", "note": "虚拟钱包支出"},
    {"id": "credit-bill", "type": "expense", "amount": 150, "category": "购物", "accountId": "credit", "note": "虚拟信用消费"},
    {"id": "salary-bill", "type": "income", "amount": 2000, "category": "工资", "accountId": "bank", "note": "虚拟收入"},
]
state = {
    "version": 3,
    "_demoSeeded": True,
    "budget": 4200,
    "ledger": [{**bill, "date": day} for bill in ledger],
    "savingsAccounts": [{**a, "openingDate": day, "updatedAt": stamp} for a in accounts],
    "savingsEntries": [{
        "id": "demo-pocket", "kind": "transfer", "accountId": "bank", "toAccountId": "pocket",
        "date": day, "amountCents": 80000, "updatedAt": stamp, "note": "虚拟新增存款",
        "payrollTag": {"pocketId": "pocket", "kind": "funding", "repayCents": 0},
    }],
    "savingsPayroll": {
        "pocketId": "pocket", "updatedAt": stamp, "directions": [
            {"id": "daily", "name": "日常开支", "saving": False},
            {"id": "save", "name": "小荷包储蓄", "saving": True},
        ],
        "rules": [
            {"id": "daily", "target": "daily", "method": "percent", "value": 65, "cond": "always"},
            {"id": "save", "target": "save", "method": "remainder", "value": 0, "cond": "always"},
        ],
    },
}
if args.credit_setup:
    state["savingsAccounts"] = [account for account in state["savingsAccounts"] if account["id"] != "credit"]
    next(bill for bill in state["ledger"] if bill["id"] == "credit-bill").pop("accountId")
    state["savingsPositions"] = [{"id": "credit-debt", "kind": "liability", "name": "虚拟信用卡",
                                 "amountCents": 45000, "updatedAt": stamp}]
subprocess.run([
    sys.executable, str(root / "tools/build-review-preview.py"), "--output", str(preview),
    "--label", "信用卡与流水编辑 · 虚拟数据" if args.credit_setup else "账户联动 · 虚拟数据",
    "--namespace", "review_credit_ledger_edit_20261121_" if args.credit_setup else "review_linked_accounts_20261121_",
], check=True)
html = preview.read_text(encoding="utf-8")
payload = json.dumps(state, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
seed = "const linkedAccountFixture=" + payload + ";\nif(!localStorage.getItem(KEY))localStorage.setItem(KEY,JSON.stringify(linkedAccountFixture));\n"
assert html.count("let S=load();") == 1
html = html.replace("let S=load();", seed + "let S=load();")
assert html.count("initFilters();\nrenderAll();") == 1
html = html.replace("initFilters();\nrenderAll();", """
initFilters();
renderAll();
goTab('money');
setMoneyView('entry');
""".strip())
html = html.replace('<span id="offlinePersistenceNote"></span>',
                    '<span id="offlinePersistenceNote"></span><p><a href="虚拟数据.json" download>下载虚拟数据</a> · <a href="验收说明.md">验收说明</a></p>')
preview.write_text(html, encoding="utf-8")
(out / "虚拟数据.json").write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
instructions = """# 账本与账户联动验收

这是隔离的虚拟账本。打开时有四个账户和四笔账单。

1. 存款页可核对：工资卡 6200 元、钱包 880 元、小荷包 2800 元、信用卡应还 450 元。总资产 9880 元、总负债 450 元、净资产 9430 元。
2. 在记账页的「扣款账户」点选信用卡并记 100 元支出。信用卡应还变为 550 元，总资产保持 9880 元。
3. 从「转账 / 还款」选择工资卡转入信用卡 200 元。工资卡与信用卡欠款各减 200 元，账本支出和净资产保持原值。
4. 在「存款」默认查询小荷包，可分别查看余额 2800 元和本月新增存钱 800 元。试用「记小荷包转入」可将一笔转账分成新增和补回。
5. 已关联账单可从账户流水查回原账单。选择「仅记账」则按普通账单处理。
6. 账户行右侧可直接点铅笔编辑，用红色斜线圆圈停用。停用后的账户保留余额和流水，可用绿色勾选圆圈重新启用。
"""
if args.credit_setup:
    instructions = """# 信用卡与账单明细验收

此预览使用虚拟账本。开始时只有一笔 450 元的旧信用卡负债。

1. 从「账本 → 记账 → 扣款账户」点「＋ 信用卡」，在「使用已有负债」选虚拟信用卡。保存后该卡直接成为当前扣款账户，负债总额仍为 450 元。
2. 用这张卡记 100 元支出。账本支出增加 100 元，应还增加到 550 元。
3. 在「账本 → 分析 → 账单明细」点这笔记录右侧的铅笔，把金额改为 120 元。账本支出和欠款同步多计 20 元。
"""
(out / "验收说明.md").write_text(instructions, encoding="utf-8")
