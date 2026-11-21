# RELEASE

## 正式发布与回滚约定

用户于 2026-11-21 确认此约定适用于每次正式升级。

1. 发布前读取正式 `main` 的当前提交并备份完整源码，另从正式浏览器导出当时的完整数据 JSON。记录两个备份的时间、路径与 SHA-256，确认文件可读，源码可恢复，隔离环境能加载数据。
2. 推送前准备回到原正式源码的本地回滚提交，并核对源码树与原版本一致。源码和数据备份、回滚点都核实后才能推送。用户正式数据保存在备份目录，不提交到仓库。
3. 上线后核对正式版本与关键功能，并比对升级前后的数据。页面或代码异常先回退源码。发现数据异常时，先保全当前状态，再核对受影响数据和发布后的新增记录，确认恢复范围后使用备份恢复。

## 2026-11-21 v3.37.1 信用卡入口与账单编辑

- 用户验收并授权升级。源提交 b7ce9ca，发布分支 release/workstation-v3.37.1，回滚基线 c2738c39345e97fbbc6d44dd6641591085997779。
- 支持从记账页添加信用卡，显式选择旧负债时一次保存账户和关联；账单明细复用现有编辑流程。
- 发布前备份与核验记录位于工作区 Backups/personal-workstation/workstation-v3.37.1-20261121。

---

## 2026-11-21 v3.37.0 账户与账本联动

- 用户已验收并授权复核、备份后发布正式 main。来源为 review/linked-accounts-20261121，界面验收 e3a349c，审计加固 9c75712。发布分支 release/workstation-v3.37.0。
- 范围为日常收支点选账户、信用卡负债和转账还款、小荷包实际存钱统计，以及列表行内图标。给旧账补选账户时保留旧分类。
- 账目保存可选账户关联及变更标记，存储命名空间、登录、加密和备份外层格式沿用原机制。既有流水无需迁移。
- 代码回滚基线 2dd59ccce99d38558debf5eeddcfafbda28dc404。发布前源码 bundle、ZIP 和正式 JSON 备份及校验记录位于工作区 Backups/personal-workstation/workstation-v3.37.0-20261121。

---

## 2026-11-19 v3.36.0 三项优化发布

- 用户明确批准将预算建议标记、发薪分配与小荷包、全站折叠一并升级正式 main。
- 回滚基线 99e60022134e5d4a715683221c399d653dd1b5ad。发薪和折叠来源 f28c3e8，预算标记与反馈修复来源 9fc1337，发布分支 release/workstation-v3.36.0。
- 折叠默认展开，偏好只保存在当前浏览器。小荷包需自行指定账户，历史数据保留。新计划与存款流水沿用原存储，合并导入和云同步识别新字段，登录和加密协议不变。
- 发布前备份代码 bundle、ZIP 和正式 JSON，核验 SHA-256。备份和上线核验报告保存在工作区 Backups/personal-workstation/workstation-v3.36.0-20261119。
- 合并发布候选通过 58 组检查：支出分析与预算条 11、折叠 6、发薪与小荷包 7、存款 11、事项分页 7、金额隐私 10、正式备份副本兼容 6。副本比对包含全部旧账目、分类预算、账户流水、资产及原目标。未用真实 Gist 写入测试数据，未测 iPhone 真机。

---

## 2026-11-19 存款整合与支出分析 v3.35.0 发布

- P0 Active。用户明确要求重新审计，备份正式库版本与数据后升级。
- 来源 review/finance-audit-20261119 / f117df6d35c46fb94026f01898fcc74c77b4e136，发布分支 release/finance-v3.35.0，目标正式 main。
- 正式回滚基线 f55c78c4f4b13e581f6e7716081c92e7f28afacd。代码 bundle 和 ZIP 已落盘并校验，发布前正式数据 JSON 备份及兼容性校验为推送前必需步骤。
- 范围含存款与资产目标整合、年月支出分析、预算分类同步修复、合并导入与备份接入、专项检查、缓存版本及文档。
- 原账单、预算分类和 fundMgr 旧记录保留。新增的存款账户/流水、资产负债与目标字段沿用现有存储及加密备份外层格式；登录和正式 Gist 端点沿用原机制。
- 仅在临时浏览器对合成数据和已导出的正式备份副本进行本地验证，正式备份文件不入 Git。数据备份未确认前不推送。
- 备份目录为工作区 Backups/personal-workstation/finance-v3.35.0-20261119-112734。证据见 docs/RELEASE_AUDIT_V3_35.md。

---

## 2026-11-18 C「稳步推进」图标 v3.32.0

用户选定 C 并明确授权直接发布。来源为本聊天验收的 `logo-options/logo-c.svg`，发布分支为 `release/logo-c-v3.32.0`，目标为 `main`。

- 正式基线及回滚点 `177752c5946b3df11387e99f3140e326000fe970`。完整回滚 bundle `../prod-rollback-logo-c-177752c.bundle` 已验证。
- 范围为选定图标的 SVG、ICO、PNG，页面图标声明、手机桌面 manifest、Mock 静态资源白名单和版本说明。
- 验证覆盖文件尺寸与 ICO 格式、SVG 原稿一致性、子路径资源、手机桌面声明、页面启动和图标 HTTP 响应。
- 手机系统可能缓存已添加的桌面图标，现有桌面快捷方式的更新行为以系统为准。

---


## 2026-11-18 待办开始日期与历史进度 v3.31.0

用户已验收并确认发布。来源为 `review/task-start-dates` 的 `67a3a86`，发布分支为 `release/task-start-v3.31.0`，目标为 `main`。

- 正式基线及回滚点 `5274403c37fb293ffdd1791b4d7a737eb949735d`。完整回滚 bundle `../prod-rollback-task-start-5274403.bundle` 已验证。
- 发布范围为开始日期录入、手动开始、统一状态、日期看板、进度历史与事件合并，以及验收脚本、缓存和版本说明。
- 旧记录的开始日期与缺失历史留空。JSON 备份保存新增字段，沿用登录、同步协议和存储路径。Markdown 增加开始与进度信息。
- 验收覆盖手机、历史查询、跨日、双端模拟同步、并发编辑、导入导出和既有四象限。

---

## 2026-11-17 首页待办与跨日进度 v3.30.0

用户已授权发布。来源为 `review/home-todo-visibility` 的 `a199fff`，发布分支为 `release/home-todo-progress-v3.30.0`，目标为 `main`。

- 正式基线及回滚点 `2f2f6242b36b0e46c0ae74e18c6636e4b6f6f7c4`。完整回滚 bundle `../prod-rollback-home-todo-2f2f624.bundle` 已验证。
- 发布范围为首页待办分组和展开、完成进度与进行中状态、四象限跨日跟进、配套回归脚本和版本说明。
- 进度沿用待办记录和原备份结构。旧记录无需迁移，登录、同步协议和存储路径沿用现有实现。跨日跟进保留原计划日期和待办 ID。
- 发布核查覆盖手机窄屏、跨午夜、完成与重开、备忘转待办、刷新、双端模拟同步、四象限与分页。

---

## 2026-11-17 事项类型与四象限筛选 v3.29.0

用户已验收并确认通过发布审计后上线。来源为 `review/matter-categories` 的 `a10fe73`，发布分支为 `release/matter-categories-v3.29.0`，目标为 `main`。

- 正式基线及回滚点 `5a3b2ea926af08e394ddb1d2db98e856d010df71`，完整回滚 bundle `../prod-rollback-matter-categories-5a3b2ea.bundle` 已验证。
- 发布范围为工作、娱乐、学习、生活四种类型的录入和编辑、备忘转待办继承、四象限筛选、对应样式和版本说明。
- 类型是待办与备忘的可选字段，旧记录按未设置类型显示。沿用登录、存储、同步协议和 JSON 备份格式，无整库迁移。
- 发布核查覆盖类型筛选与跨日跟进、窄屏、双端模拟同步、旧记录、刷新和备份。正式模式使用空白临时浏览器验证。

---

## 2026-11-17 全局金额隐私 v3.28.0

用户已确认发布。来源为 `review/amount-privacy` 的 `c588e45`，发布分支为 `release/amount-privacy-v3.28.0`，目标为 `main`。

- 正式基线及回滚点 `a6b507fe9cb6bf8fbc266f67290ba5cca60f8bb4`，完整回滚 bundle 已验证。
- 发布范围为顶部隐私开关、金额与图表遮盖、报表脱敏和备份入口保护，以及缓存版本、更新说明和验收记录。开关使用独立浏览器偏好，沿用现有登录、IndexedDB、Gist 和备份格式。
- 在独立本地 Mock 上验收开关、手机布局、跨标签页、刷新、脱敏导出和原始账目保留。验收步骤见 `docs/AMOUNT_PRIVACY_ACCEPTANCE.md`。

---

## 2026-11-17 事项列表分页与未完成优先 v3.27.0

状态：`P0 · Awaiting User Acceptance`（正式网页人工验收）。2026-11-17，v3.27.0 已推送正式 main，GitHub Pages 部署成功。

- Source `review/matters-pagination` / `e8a6a56be7dae9fff02d90ad3391e2a4f3e9f351`。发布分支 `release/matters-pagination-v3.27.0`，目标 `main`。
- 正式基线及回滚点 `a23fbed1d06b80c53731f4a0ec168c4f94b4240a`。完整回滚 bundle `../prod-rollback-matters-pagination-a23fbed.bundle` 已验证。
- 发布范围为事项页待办优先、备忘分组、分页、转待办定位、相应样式和测试，以及更新说明、资源缓存和发布文档。数据字段、登录、同步和四象限沿用原规则。
- 7 组事项分页、31 组四象限专项及 92 组发布回归通过。覆盖备忘转换定位、全量搜索、末页缩减、窄屏翻页以及正式模式行为。仅使用合成数据和临时 Chromium。
- 发布提交 `08b06e2ed08628c7e0297f4189bbb485c2f2c16b`。[GitHub Pages 构建 44000605347](https://github.com/chance-hang/personal-workstation/actions/runs/44000605347) 成功。正式站 HTML、CSS、JS 均返回 HTTP 200，与发布提交逐字节一致。

---

## 2026-11-17 四象限跨日跟进与分页 v3.26.0

状态：`P0 · Awaiting User Acceptance`（正式网页人工验收）。2026-11-17，v3.26.0 已推送正式 main，GitHub Pages 部署成功。

- Source `review/quadrant-followup` / `068b4fae0778f30a4b9dd80534dcc46b5891e570`。发布分支 `release/quadrant-followup-v3.26.0`，目标 `main`。
- 正式基线及回滚点 `4b68c96b2d4205780b0ab035a447c7b143aa8418`。已验证完整回滚 bundle `../prod-rollback-quadrant-followup-4b68c96.bundle`。
- 发布范围为已验收的看板跨日分组、分页与日期跟随，以及专项验证、v3.26.0 更新说明、资源版本和发布记录。保留待办、日志及分类的存储结构，沿用每日复盘、导出、登录与同步逻辑。
- 31 组四象限专项及 92 组发布回归通过。本地 Chromium 验证覆盖跨日、翻页、11 种屏宽、正式模式、既有事项和日预算。未接入真实账号或进行 iOS 真机验证。
- 发布提交 `211afe90d7784a3e213b1edd8fd3da75b3ff87d7`。[GitHub Pages 构建 43998167707](https://github.com/chance-hang/personal-workstation/actions/runs/43998167707) 成功。正式站 HTML、CSS、JS 均返回 HTTP 200，与发布提交逐字节一致。

---

## 2026-11-17 四象限坐标轴修正 v3.25.1

状态：`P0 · Awaiting User Acceptance`（正式网页人工验收）。2026-11-17，v3.25.1 已推送正式 main，GitHub Pages 部署成功。

- Source `review/quadrant-axis-endpoints` / `89a77784ea7fe485d718c52f70f3ea71d703e38c`。发布分支 `release/quadrant-axes-v3.25.1`，目标 `main`。
- 正式基线及回滚点 `1f89f642af8b114f9f26e2e69e769cbffe3c59cf`。已验证完整回滚 bundle `../prod-rollback-quadrant-axes-1f89f64.bundle`。
- 发布范围为 HTML 箭头、坐标轴样式、四象限专项验证脚本，以及 v3.25.1 更新说明和资源缓存版本。CSS 与验收版一致。登录、同步、存储和四象限业务逻辑沿用 v3.25.0。
- 发布版通过 27 组专项、正式模式冒烟与源码范围检查。临时浏览器覆盖 11 种屏宽和 4 种像素密度，未使用真实账户。
- 发布提交 `3a7c47069b83f7a2bf1988251556da8d3d41cf40`。[43995404216 构建](https://github.com/chance-hang/personal-workstation/actions/runs/43995404216) 成功。正式站的 HTML、CSS、JS 均返回 HTTP 200，与发布提交文件逐字节一致。

---

## 2026-11-16 发布清单：四象限时间管理 v3.25.0

状态：`Awaiting User Acceptance`（发布后正式网页业务验收）。用户已授权，2026-11-17 已发布正式 main，GitHub Pages 部署和静态资源检查通过。

- 正式基线与回滚参照：`22d7a41417ebf8c8241c2f025c43deebc599921b`，已 fetch 并通过 GitHub API 核对。
- 已接受 Source：`review/time-quadrants` `084678fc67f88c2c0277f8c2aead9b2246b258b2`。
- 发布分支：`release/time-quadrants-v3.25.0`；目标 `main`。
- 范围：Source 的 app.js、index.html、styles.css、tools/mock-sync-server.mjs、tools/check-time-quadrants.cjs、docs/TIME_QUADRANTS_ACCEPTANCE.md。发布准备额外允许更新日志/资源缓存、tools/check-prod-time-quadrants.cjs、ACTIVE_TASK / RELEASE / RELEASE_HISTORY 和本轮审计文档。
- 保留正式登录、localStorage/IndexedDB 路径、Gist/加密协议及导入导出外层格式。新分类、用时和复盘字段按授权进入现有保存、同步和备份流程。番茄自动累计仍为第二阶段。
- 使用独立发布目录和临时浏览器；功能专项端口 4188，发布联合检查端口 4191；不操作用户 4187 预览和其他已有服务，不访问真实账户或 Gist。
- 完整历史 bundle `../prod-rollback-quadrants-22d7a41.bundle` 已验证可读。回滚须新提交，不强推，不自动回滚业务数据。
- 发布前审计通过：27 组功能专项 + 92 组联合发布检查，共 119 组；证据见 docs/RELEASE_AUDIT_V3_25.md。
- 发布内容提交 `36a5cf8a105ba14ae1662234eb51e85dcb8d9b62`。GitHub Pages 首次上线构建 `43988690742` 成功，线上应用三文件与发布提交相符。详见 docs/RELEASE_AUDIT_V3_25.md。
- 真实账户跨设备与 iOS 真机验收仍待实际使用。

---

## 2026-11-16 日预算与备忘安排修复 v3.24.0

用户在本聊天明确授权审计通过后更新两个功能到正式库。

- Source：`review/daily-budget` `0689b16`、`review/note-to-todo-visibility` `430da65`；基线 `6b54759`。
- 发布分支：`release/budget-matters-v3.24.0`，目标 `main`。
- 范围：上述两分支功能、v3.24.0 更新说明、HTML 资源缓存版本、联合测试基线适配及发布文档；不引入其他分支。
- 正式登录、localStorage/IndexedDB、Gist/加密、导入导出与初始化顺序保留；Mock 月预算接收仅在 MOCK_SYNC 分支生效。
- 回滚：已验证完整历史 bundle `/workspace/daily-budget-review/prod-rollback-6b54759.bundle`；若需回滚，创建新提交，不强推、不自动回滚业务数据。
- 正式资源缓存：`prod-budget-matters-20261116-1`。
- 专用测试端口 4186，临时浏览器与合成数据；无真实账户/Gist 操作，不操作 4173/4185 验收数据。
- 真机 Safari/系统键盘和真实账户业务操作由用户在发布后核对。
- 当前：已发布正式 main，发布内容提交 `3c6072f4c6438bd1b964ec9b7ecc380904f5b19b`；Pages 构建 built，线上 HTML/JS/CSS HTTP 200 且逐字节匹配。等待发布后业务验收。具体证据见 `docs/RELEASE_AUDIT_V3_24.md`。

---

以下为历史发布记录。


## 2026-10-30 当前发布清单：事项整合 v3.23.0

- 执行结果：已推送正式 `main`；发布内容提交 `127bb5b29050b72462a6d7a8266d3c33cdf41fd1`。
- Pages 构建 `41023103225` 成功；正式 HTML/JS/CSS 均 HTTP 200，版本 v3.23.0 与正式缓存参数已核对。
- 状态：`Awaiting User Acceptance`（正式网页业务验收），不再等待 review 发布批准。

- 用户本轮明确同意发布；Source `review/unified-matters` `f3021db50014024417394a8f2917a248e59199bc` 为 `Release Ready`。
- 基线/回滚参照：`8c65431be7e243d833ff0e51b9b8c8e768c43e9a`。
- 发布分支：`release/matters-v3.23.0`；目标 `main`；只允许已接受的事项整合和 UI/Mock 标识修正。
- Source 文件白名单：`.gitignore`、`app.js`、`index.html`、`styles.css`、`docs/ACTIVE_TASK.md`、`docs/LOCAL_ACCEPTANCE.md`、`docs/MATTERS_ACCEPTANCE.md`、`docs/RELEASE.md`、`docs/UI_TOKENS.md`、`tools/build-review-preview.py`、`tools/mock-sync-server.mjs`、`tools/check-matters.cjs`、`tools/check-matters-mock-boundary.cjs`、`tools/check-matters-ui.cjs`。
- 发布准备额外允许：`docs/RELEASE_HISTORY.md`、`tools/check-prod-matters.cjs`；原文件仅改正式版本展示、资源缓存参数及相应测试元信息。
- 禁止修改：正式登录/凭据、Gist 路径及加密协议、原存储与 IndexedDB 路径、导入导出外层结构、初始化顺序、自动示例保护；禁止把 Mock 数据推到正式云端。
- 回滚 bundle 已创建并验证，路径位于本次聊天输出目录，文件名 `prod-rollback-matters-8c65431.bundle`；采用新提交回滚，不强推历史。
- 推荐提交：`release: publish unified matters v3.23.0`。
- 用户已授权本轮发布，无需再次确认 main 合并；正式页面与真机的最终业务验收保留为发布后事项。

以下待验收/禁止发布描述为历史记录，以本节为当前授权。

## 2026-10-30 事项整合 review（当前）

- 状态：`Awaiting User Acceptance`，非 `Release Ready`，尚未发布。
- Source 分支：`review/unified-matters`；基线/回滚参照：`8c65431be7e243d833ff0e51b9b8c8e768c43e9a`。
- 允许范围：待办与备忘整合、必要统计/历史/日报/热力/番茄选项联动、事项更新时间合并、review 工具和验收说明；详见 `docs/ACTIVE_TASK.md` 当前节。
- 受保护的登录、存储命名空间、IndexedDB、Gist 路径及加密、导入导出外层格式和云初始化顺序保持。
- 开发与自检不等于发布批准；用户尚未人工验收，本次不得合并或推送 `main`。
- 自检与人工清单：`docs/MATTERS_ACCEPTANCE.md`。

以下 Idle 和旧版发布流程仅为原有记录；当前以本节为准。

## 当前状态

Awaiting Prod Acceptance — v3.22.0 已推送正式 `main`。

发布内容提交：`0b69618f1cfb3c5819b73d53195f4dc024a2f54b`，发布分支与远端 `main` 已核对一致。正式网页与构建状态受当前环境代理 403 限制，尚未确认，待用户人工验收。

用户已明确授权发布。发布源为 `review/pomodoro-clock` `97900de1c8ad224c2c2c3a41cbcf8bdfff1a75b0`；Prod 回滚基线为 `18f6fb57b520dccd6f2941487ec5e634b4b80701`。

- 发布分支：`release/pomodoro-v3.22.0`；目标 `main`。
- 允许范围：本 Source 的应用页面、番茄与手机交互、离线预览和验证工具及说明；发布额外更新 v3.22.0 展示、资源缓存参数、预览生成器和正式模式检查。
- 禁止：改变正式登录、原存储命名空间/数据格式、Gist 协议、IndexedDB、导入导出、自动产生演示数据或同步 Mock 数据到正式库。
- 必要验证：语法、源保护区一致性、正式模式无测试数据/外连、本地 Mock 功能与同步合并回归、单文件和手机交互验证。
- 推荐提交信息：`release: publish pomodoro clock v3.22.0`。
- 回滚备份：checkout 外的 `prod-rollback-18f6fb5.bundle`，保存原 Prod 历史；必要时通过新回滚提交恢复，不重写远端历史。
- 验收结论与具体提交见 `docs/ACTIVE_TASK.md`、`docs/POMODORO_ACCEPTANCE.md`；推送后仍需正式页面人工验收。

## 仓库角色

- 当前仓库：`chance-hang/personal-workstation`（Prod）
- 验收来源：本 Prod 仓库的 `review/*` 分支与本地 Mock 云同步

本地 Prod Workspace 约定：

- `origin` → Prod
- 不配置 Test remote；review 分支从 Prod `main` 创建

## 标准发布流程

只有当 review 分支已经过：

1. Codex 完成开发、必要自检并 push；
2. 用户人工验收通过；
3. review 验收证据明确标记 `Release Ready`；

才允许在 Prod 开始发布。

Prod 发布前必须：

1. 读取 `AGENTS.md`、`docs/ACTIVE_TASK.md` 和本文件；
2. `git fetch origin`；
3. 确认 review 分支与 Prod `main` 的基线关系；
4. 检查 `git status`，工作区必须干净；
5. 确认当前 `main` 与 `origin/main` 同步；
6. 确认 review commit、Mock 验收证据与允许修改范围一致；
7. 从最新 Prod `main` 创建独立发布分支；
8. 只同步发布清单明确允许的内容。

## 禁止的发布方式

- 不直接从已退休的 Test 仓库同步或合并。
- 不把整个 Test 仓库覆盖 Prod。
- 不因为“review 已通过”就默认所有文件都可同步。
- 不覆盖 Prod 环境专属配置或正式行为。
- 不在 Prod 重新设计或重新实现 Test 已完成的产品需求。

如果 Test 与 Prod 在同一业务文件中存在环境差异，应以“保留 Prod 环境行为 + 引入已验收 Test 功能”为目标完成最小受控同步，并由 Codex 完成自检后交用户人工验收。ChatGPT Review 可选，不构成发布门禁。

## 每次发布任务必须明确

- Source review commit
- Source review branch（通常为 `review/*`）
- Prod 回滚基线 SHA
- 允许修改文件
- 禁止修改文件
- 必须保留的 Prod 行为
- 验证清单
- 发布分支名
- 推荐 commit message

## Prod 必须长期保留

除非发布任务明确授权：

- 正式账户登录逻辑
- 刷新后的登录提示 / 默认登录行为
- Prod 无前缀 localStorage
- 正式 Gist 同步
- IndexedDB 正式镜像 / 恢复路径
- 导入 / 导出格式
- 页面初始化顺序
- 正式环境文案和保护逻辑

## 发布完成后

1. push 发布分支；
2. 等待用户明确同意发布后再合并 `main`；
3. 用户进行 Prod 人工验收；
4. 验收通过后记录 `docs/RELEASE_HISTORY.md`；
5. Prod `docs/ACTIVE_TASK.md` 回到无任务状态。
