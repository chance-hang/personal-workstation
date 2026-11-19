"""Build a self-contained payroll preview with an isolated, synthetic ledger."""
import argparse
import json
import subprocess
import sys
from datetime import date
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("--output-dir", required=True, type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
out = args.output_dir.resolve()
out.mkdir(parents=True, exist_ok=True)
preview = out / "index.html"

today = date.today()
month = today.replace(day=1).isoformat()
stamp = today.isoformat() + "T00:00:00.000Z"
directions = [
    {"id": "daily", "name": "日常开支", "saving": False},
    {"id": "fund", "name": "基金投资", "saving": False},
    {"id": "pocket", "name": "小荷包储蓄", "saving": True},
    {"id": "fixed", "name": "固定预留", "saving": False},
]
rules = [
    {"id": "daily", "target": "daily", "method": "fixed", "value": 4200, "cond": "always"},
    {"id": "fund", "target": "fund", "method": "fixed", "value": 1500, "cond": "gt", "threshold": 7500},
    {"id": "rest", "target": "pocket", "method": "remainder", "value": 0, "cond": "always"},
    {"id": "new", "target": "fixed", "method": "fixed", "value": 300, "cond": "always"},
]
state = {
    "version": 3, "_demoSeeded": True, "budget": 4500,
    "ledger": [{"id": "demo-bill", "date": month, "category": "餐饮", "type": "expense", "amount": 120, "note": "虚拟日常账"}],
    "savingsAccounts": [
        {"id": "virtual-pocket", "name": "虚拟小荷包", "openingDate": month, "openingCents": 200000, "updatedAt": stamp},
        {"id": "virtual-salary", "name": "虚拟工资卡", "openingDate": month, "openingCents": 900000, "updatedAt": stamp},
    ],
    "savingsEntries": [
        {"id": "demo-emergency", "kind": "withdraw", "accountId": "virtual-pocket", "date": month, "amountCents": 80000,
         "note": "虚拟应急取用", "payrollTag": {"kind": "emergency", "pocketId": "virtual-pocket", "repayCents": 0}, "updatedAt": stamp},
    ],
    "savingsPayroll": {"pocketId": "virtual-pocket", "directions": directions, "rules": rules, "updatedAt": stamp},
    "fundMgr": {"income": 9000, "directions": directions, "rules": rules, "assets": [], "liabilities": []},
}

subprocess.run([
    sys.executable, str(root / "tools/build-review-preview.py"), "--output", str(preview),
    "--label", "发薪分配与小荷包 · 虚拟数据", "--namespace", "review_payroll_pocket_20261119_",
], check=True)
html = preview.read_text(encoding="utf-8")
payload = json.dumps(state, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
seed = "const payrollFixture=" + payload + ";\nif(!localStorage.getItem(KEY))localStorage.setItem(KEY,JSON.stringify(payrollFixture));\n"
assert html.count("let S=load();") == 1
html = html.replace("let S=load();", seed + "let S=load();")
assert html.count("initFilters();\nrenderAll();") == 1
html = html.replace("initFilters();\nrenderAll();", """
initFilters();
renderAll();
goTab('money');
setMoneyView('savings');
document.getElementById('svAllocationPlan').open=true;
""".strip())
notice = '<p><a href="虚拟数据.json" download>下载虚拟数据</a> · <a href="验收说明.md">验收说明</a></p>'
html = html.replace('<span id="offlinePersistenceNote"></span>', '<span id="offlinePersistenceNote"></span>' + notice)
preview.write_text(html, encoding="utf-8")
(out / "虚拟数据.json").write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
(out / "验收说明.md").write_text("""# 发薪分配与小荷包验收

这是与正式账本隔离的虚拟数据。默认打开「账本 → 存款 → 发薪分配计划」。

1. 工资 9000 元。日常 4200 元、基金 1500 元、固定预留 300 元，剩余储蓄 3000 元。
2. 点「设为本月目标」。小荷包已有一笔应急取用 800 元，本次建议转入 3800 元。
3. 点「记小荷包转入」，选择「虚拟工资卡」。新增 3000 元，补回 800 元，保存后目标完成 3000 元、待补为零；只生成一笔互转。
4. 在「管理分配规则」新增固定金额或比例，预览会重新算；已保存的月目标要再次确认才会更新。
5. 在「存钱目标」点「设年目标」，可采用估算值或手动填写。含一次性奖金的月份不参与后续常规月份的估算。
""", encoding="utf-8")
