# v3.35.0 发布前审计（2026-11-19）

用户明确授权：重新审计，先备份正式版本与数据，再发布存款整合和年月支出分析。

来源为 review/finance-audit-20261119 的 f117df6d35c46fb94026f01898fcc74c77b4e136，正式基线为 f55c78c4f4b13e581f6e7716081c92e7f28afacd。发布分支 release/finance-v3.35.0，目标 main。发布准备仅增加版本、缓存标记、审计记录和真实备份兼容检查工具。

## 备份与恢复

私有备份目录：工作区 Backups/personal-workstation/finance-v3.35.0-20261119-112734，不提交 Git。

- formal-before-upgrade.bundle：包含正式 main 完整历史，git bundle verify 通过。
- formal-before-upgrade.zip：正式基线代码快照。
- formal-data-before-upgrade.json：从原 Edge 正式页面导出的 JSON，复制后 SHA-256 与用户下载原件一致；360 条账目，月预算 4500。
- manifest.json：记录代码及数据 SHA-256、基线、来源和发布证据。
- compatibility-check.json：正式数据副本的兼容检查结果，不包含原始账单明细。

代码如需恢复，使用基线创建正常回滚提交，禁止 force push；数据只有出现真实差异并确认恢复范围后才从私有 JSON 恢复，不能因回滚代码直接覆盖后来新增账单。

## 验证结果

在实际发布源码上执行以下 64 组检查，全部通过：

| 检查 | 组数 |
| --- | ---: |
| 存款、资产和目标整合 | 7 |
| 预算设置同步、双端 Mock 和虚拟验收交付 | 9 |
| 存款记账、历史余额、同步和导入导出 | 11 |
| 年月支出分析、均值及建议 | 7 |
| 待办开始与历史进度 | 4 |
| 事项进度 | 3 |
| 分页 | 7 |
| 金额隐私 | 10 |
| 正式数据副本兼容 | 6 |

兼容检查只向临时浏览器加载已导出的备份副本，并拦截外部请求。新版加载、进入分析、进入存款与手机宽度完整 JSON 导出后，ledger、budget、budgetCats、customCats、fundMgr、todos、notes、worklog、habits、moods、learning 均与备份一致。预算内支出与差旅费、报销排除口径均与升级前一致。原始三个旧资产条目保留为待核对，不自动转换或重复计入资产。

正式 localStorage 空前缀、IndexedDB 名称、Gist 端点、登录及加密外层协议保留。同步新增可选预算设置时间标记、存款及资产目标字段；合并导入保留分类预算标记。正式演示数据上传保护保留。检查未向正式站或真实 Gist 写入虚拟数据。

node --check app.js 与 git diff --check（CRLF 适配）通过。桌面与多种模拟手机宽度已测；iPhone 真机未测。真实 Gist 的多设备加密同步本轮使用 Mock 路径验证，未向正式 Gist 写入测试记录。

发布后需核对远端 main、Pages 构建结果和线上资源版本，并在原 Edge 页面复查预算、分类及账目数量。实际发布 SHA 与线上验证结果写入私有备份 manifest 和工作区交接记录。
