# ACTIVE TASK

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

## 2026-11-16 P0：受控发布四象限时间管理 v3.25.0

状态：`P0 · Awaiting User Acceptance`（发布后正式网页业务验收）。用户已查看多轮预览并授权审计通过后发布。2026-11-17，正式 main 已发布 v3.25.0，GitHub Pages 部署及静态资源核验通过。下方 v3.24.0 的人工验收状态沿用原记录。

- 正式基线与回滚参照：`22d7a41417ebf8c8241c2f025c43deebc599921b`，已 fetch 并通过 GitHub API 核对。
- 已接受 Source：`review/time-quadrants` `084678fc67f88c2c0277f8c2aead9b2246b258b2`。
- 发布分支：`release/time-quadrants-v3.25.0`；目标 `main`。
- 范围：Source 的 app.js、index.html、styles.css、tools/mock-sync-server.mjs、tools/check-time-quadrants.cjs、docs/TIME_QUADRANTS_ACCEPTANCE.md。发布准备额外允许更新日志/资源缓存、tools/check-prod-time-quadrants.cjs、ACTIVE_TASK / RELEASE / RELEASE_HISTORY 和本轮审计文档。
- 保留正式登录、localStorage/IndexedDB 路径、Gist/加密协议及导入导出外层格式。新分类、用时和复盘字段按授权进入现有保存、同步和备份流程。番茄自动累计仍为第二阶段。
- 使用独立发布目录和临时浏览器；功能专项端口 4188，发布联合检查端口 4191；不操作用户 4187 预览和其他已有服务，不访问真实账户或 Gist。
- 完整历史 bundle `../prod-rollback-quadrants-22d7a41.bundle` 已验证可读。回滚须新提交，不强推，不自动回滚业务数据。
- 发布前审计通过：27 组功能专项 + 92 组联合发布检查，共 119 组；证据见 docs/RELEASE_AUDIT_V3_25.md。
- 发布内容提交 `36a5cf8a105ba14ae1662234eb51e85dcb8d9b62`，首次上线构建 `43988690742`。正式 HTML、CSS 和 JS 均为 HTTP 200，与发布 Git 对象逐字节一致。
- 真实账户跨设备与 iOS 真机验收仍待实际使用。

---

## 2026-11-16 P0：受控发布日预算与备忘转待办修复 v3.24.0

状态：`P0 · Awaiting User Acceptance`（发布后正式网页业务验收）。两项功能已发布，禁止自动启动其他任务。用户明确授权：自行审计，无问题后将这两个功能更新正式库。

- 基线：`6b54759f76818a1cdbf83c0138092f88fde9ef0c`。
- Source：`review/daily-budget` `0689b163129afd1e947d2c0f427757a23606e830`；`review/note-to-todo-visibility` `430da650c9725e31fdb7abbb615f3a9bcf9db87a`（业务修复 `cd153a5`）。
- 范围：两项已提交功能、必要缓存/版本元信息、验收与发布文档、联合验证适配；不包含其他分支。
- 保留正式登录、存储命名空间/IndexedDB、Gist/加密协议、导入导出与初始化顺序；Mock 月预算接收仅在 Mock 模式执行。
- 独立发布工作区与专用 4186 测试服务；不使用真实账户/Gist，不操作 4173/4185 验收数据。
- 96 组专项、联合回归、正式模式与代码边界检查全部通过；真机 Safari、系统键盘及真实账户业务验收留待用户发布后确认。

- 发布内容提交：`3c6072f4c6438bd1b964ec9b7ecc380904f5b19b`；main 与发布分支已推送并核对一致。
- Pages 构建为 built，对应本发布提交；线上 HTML/JS/CSS HTTP 200 且与发布文件逐字节一致。
- 不补记真机或真实账户人工验收通过。

---

以下为历史任务。


## 2026-10-30 当前 P0：受控发布事项整合 v3.23.0

`P0 · Awaiting User Acceptance`：v3.23.0 已按用户授权推送正式 main，Pages 部署及静态资源核验通过，等待正式网页业务验收。本节替代下方 review 阶段状态。

- 发布内容提交：`127bb5b29050b72462a6d7a8266d3c33cdf41fd1`；main 已包含该提交，业务文件与发布分支一致。
- GitHub Pages：构建 `41023103225` 已 `completed / success`，对应上述发布提交。
- 线上静态核验：正式首页、带 `prod-matters-20261030-1` 的 JS/CSS 均 HTTP 200；首页资源参数、脚本 v3.23.0 和样式 20px 勾选令牌匹配。
- 本地索引写入失败已恢复：全部 24 个目标文件、索引树和基线祖先关系均核对一致后完成有条件快进，无清理、重置或历史改写。
- 本次发布检查全部通过；发布后的真实账户业务操作与 iOS 原生选择器/键盘仍由用户确认，不自动标记验收通过。

- 用户接受的 Source：`review/unified-matters` `f3021db50014024417394a8f2917a248e59199bc`，现标记 `Release Ready`；不推断此前未独立测试的真机子项已自动通过。
- Prod 回滚基线：`8c65431be7e243d833ff0e51b9b8c8e768c43e9a`，远端已核对。
- 发布分支：`release/matters-v3.23.0`，从与 origin 同步后的 main 创建，仅快进集成上述 Source。
- 目标：用户已明确授权合并并推送 Prod `main`。
- 允许同步：Source 相对 Prod 的 14 个文件（应用三文件、事项/验收/令牌文档、相关 Mock/预览/验证工具和 `.gitignore`）；发布准备仅更新 v3.23.0/已上线展示、CSS/JS 缓存版本、发布治理文件、必要的正式模式验证及其元信息适配。
- 正式保留：登录/刷新行为、Prod localStorage 命名空间、Gist 路径与加密协议、IndexedDB、导入导出外层格式、初始化顺序、禁示例注入保护；保留已验收事项字段及合并逻辑。
- 数据边界：不读取或上传真实浏览器数据/Token/Gist，不迁移任何 Mock 数据；自动验证仅用独立 4184 和临时浏览器，不触碰用户 4173 验收数据。
- 回滚备份：checkout 外 `prod-rollback-matters-8c65431.bundle` 已验证包含原正式库完整历史；必要时以新回滚提交恢复代码，不重写历史或自动回滚用户数据。
- 检查：发布与 Source 仅元信息差异、正式模式/旧数据/登录/镜像验证、Mock 与界面回归、语法及 Git 检查；推送后核对 main 与 GitHub Pages 部署。
- 发布后等待正式网页人工验收；无 P1，不开展无关 P2。

---

以下为本次 review 开发和验收过程记录，不再作为阻止本轮已授权发布的门槛。

## 2026-10-30 当前任务：事项整合

`P0 · Awaiting User Acceptance`：事项 UI 精修及检查已完成，等待桌面与 iPhone 真机复验。

- 本轮基线：`review/unified-matters` 本地及 origin 均为 `b16fa2fc159d6627283a5cc47c86b587966824b8`。
- 用户明确授权优化：完成勾选图形、日期/时间/类型控件、列表动作、搜索标签和录入布局；参考成熟模块的字体、配色、圆角与间距，统一语义令牌。
- 范围仅限 UI、必要的图标/状态样式标记、缓存版本、相关验证/验收说明。不改变事项业务逻辑、数据字段、同步/登录/存储与导入导出；保留待验收模拟标识及隔离措施。
- 使用独立 `4184` 服务和临时浏览器检查，不重启或清空用户正在使用的 `4173` 模拟数据。完成后回到 `Awaiting User Acceptance`，不发布 main。
- 结果：25 组功能回归、8 组 Mock 隔离、6 种 UI 宽度检查通过；已查看手机/桌面渲染图。新增 `docs/UI_TOKENS.md` 和 `tools/check-matters-ui.cjs`；真实 iOS 原生控件与键盘仍待人工验收。

- 上一轮标识修复：只改 Mock 模式状态、持续环境标识、模拟管理入口/说明及相应验证；正式模式文案、凭据、存储、同步与登录分支保持。
- 上一轮标识修复基线：`a9505ff9be1ea5c89f9d1af2d5ed751f8d4ad7c8`。
- 自动检查使用独立 `4184` 端口服务，禁止清空或读取正在由用户验收的 `4173` 模拟数据。原事项范围不扩大，修正后仍待人工验收。
- 本轮结果：原 25 组检查与新增 8 组 Mock 标识/凭据/网络隔离检查通过；正式分支去除明确标记的 Mock 追加代码后与原保护区一致。未更新个人记忆文件。

- 此节为当前唯一任务；下方 2026-10-18 记录仅保留作历史，不代表当前状态，也不补记上次线上人工验收通过。
- 基线：Prod `origin/main` `8c65431be7e243d833ff0e51b9b8c8e768c43e9a`；分支 `review/unified-matters`。
- 授权开发、自检、review commit/push、本地 Mock 验收；未经人工验收和明确发布批准，不合并 `main`。
- 允许修改 `app.js`、`index.html`、`styles.css`、相关 `tools/*matters*` / 本地预览工具、验收文档和 `docs/RELEASE.md`；`.gitignore` 仅忽略本地界面设计记录。
- 范围：统一事项入口、备忘关联待办、快速录入、计划完成日期/时间、跨天跟进、状态/时间/关键词查询、实际完成时间/说明/交付物引用；首页、历史、日报、热力图、番茄待办选项的必要联动。
- 数据兼容：保留 `todos` / `notes` 数组及原字段，仅添加兼容字段，不捏造旧完成时间；授权事项按更新时间合并编辑/完成/删除状态，不更换同步协议。
- 必须保留：正式登录、刷新提示、原 localStorage 命名空间、Gist 路径/凭据/加密协议、IndexedDB 镜像路径、导入导出 JSON 外层结构、初始化顺序、番茄计时行为、正式禁示例保护。
- 交付物只保存说明、链接和路径引用，不上传附件；不访问正式账户/真实 Gist。只用隔离本地 Mock，拦截外部网络。
- 验证：旧数据、跨天、完成/重开、搜索、交付物、刷新、双源 Mock 同步、桌面/手机交互、本机及局域网验收地址。
- 自检：25 组集成/保护检查及原有 12 项备忘合并检查通过；离线预览录入/关联/完成/刷新隔离验证通过。电脑与 WLAN 手机 URL 已核验，详情见 `docs/MATTERS_ACCEPTANCE.md`。
- 状态为 `Awaiting User Acceptance`；本次仅提交/推送 review，尚无用户发布批准。无 P1；附件上传、系统通知、重复任务为 P2，不实施。

---

## 历史任务（已由上方任务替代）

最后更新：2026-10-18

## 当前状态

`Awaiting User Acceptance`：v3.22.0 已成功推送正式库 `main`，等待正式网页人工验收。

- 用户明确授权：可以，将当前待验收版本更新到正式库。
- 已验收 Source：`review/pomodoro-clock` `97900de1c8ad224c2c2c3a41cbcf8bdfff1a75b0`，标记 `Release Ready`。
- Prod 回滚基线：`18f6fb57b520dccd6f2941487ec5e634b4b80701`。
- 发布分支：`release/pomodoro-v3.22.0`，从已核对的 `origin/main` 创建，仅集成该 review。
- 目标：`main`；用户已授权且已完成推送。当前分支 `main`，发布内容提交为 `0b69618f1cfb3c5819b73d53195f4dc024a2f54b`，远端已核对一致。
- 发布范围：番茄时钟、关联待办、专注/休息、暂停与刷新恢复、本机记录与可选写日志、手机触控/悬浮条/弹窗/专注模式、离线预览工具及相关测试文档。
- 允许修改：`app.js`、`index.html`、`styles.css`、相关 `tools/*pomodoro*` / `tools/*review-preview*`、`docs/ACTIVE_TASK.md`、`docs/RELEASE.md`、`docs/RELEASE_HISTORY.md`、`docs/POMODORO_ACCEPTANCE.md`。
- 发布准备额外改动：版本/更新记录、CSS 与 JS 缓存参数、预览生成器对带版本 CSS 地址的支持、正式模式隔离验证；不扩大功能范围。
- 必须保留：正式登录、Gist 路径与加密协议、原 localStorage 命名空间、业务数据格式、IndexedDB 镜像和导入导出、原初始化顺序与正式禁演示数据保护。
- 验证仅使用隔离浏览器、本地 Mock 或离线适配；不使用正式账户、Token 或真实 Gist。正式模式检查阻止外部请求。
- 线上核验：当前环境对 GitHub Pages 与 GitHub API 返回代理 403，尚不能确认线上构建/页面更新；仍可通过原生 Git 读写正式库并核对远端提交。

## 验收与发布验证

用户已认可预览并明确批准正式发布。review 验证见 `docs/POMODORO_ACCEPTANCE.md`。

发布前检查全部通过：正式模式本机计时和旧数据保留、保护区代码一致性、14 组功能与 12 项合并检查、5 种设备触控模拟、单文件交互与尺寸切换、语法与差异检查。回滚 bundle 已验证可读且含完整原 Prod 历史。

发布分支已推送并快进合并至 `main`，未重写历史。所有发布前检查通过，回滚 bundle 已验证。等待用户确认正式网页；当前网络代理持续对 Pages 和部署 API 返回 403，线上构建结果尚未验证，不将人工验收标为通过。

## 优先级

- P0：本次受控发布已执行，等待正式版验收；不开展其他变更。
- 无 P1。
- P2：其他功能，不实施。
