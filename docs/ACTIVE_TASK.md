# ACTIVE TASK

最后更新：2026-10-18

## 当前状态

`P0 Active`：发布已验收的番茄时钟与手机体验优化（v3.22.0）。

- 用户明确授权：可以，将当前待验收版本更新到正式库。
- 已验收 Source：`review/pomodoro-clock` `97900de1c8ad224c2c2c3a41cbcf8bdfff1a75b0`，标记 `Release Ready`。
- Prod 回滚基线：`18f6fb57b520dccd6f2941487ec5e634b4b80701`。
- 发布分支：`release/pomodoro-v3.22.0`，从已核对的 `origin/main` 创建，仅集成该 review。
- 目标：`main`；用户已授权发布，无需重复请求批准。
- 发布范围：番茄时钟、关联待办、专注/休息、暂停与刷新恢复、本机记录与可选写日志、手机触控/悬浮条/弹窗/专注模式、离线预览工具及相关测试文档。
- 允许修改：`app.js`、`index.html`、`styles.css`、相关 `tools/*pomodoro*` / `tools/*review-preview*`、`docs/ACTIVE_TASK.md`、`docs/RELEASE.md`、`docs/RELEASE_HISTORY.md`、`docs/POMODORO_ACCEPTANCE.md`。
- 发布准备额外改动：版本/更新记录、CSS 与 JS 缓存参数、预览生成器对带版本 CSS 地址的支持、正式模式隔离验证；不扩大功能范围。
- 必须保留：正式登录、Gist 路径与加密协议、原 localStorage 命名空间、业务数据格式、IndexedDB 镜像和导入导出、原初始化顺序与正式禁演示数据保护。
- 验证仅使用隔离浏览器、本地 Mock 或离线适配；不使用正式账户、Token 或真实 Gist。正式模式检查阻止外部请求。
- 线上核验：当前环境对 GitHub Pages 与 GitHub API 返回代理 403，尚不能确认线上构建/页面更新；仍可通过原生 Git 读写正式库并核对远端提交。

## 验收与发布验证

用户已认可预览并明确批准正式发布。review 验证见 `docs/POMODORO_ACCEPTANCE.md`。

发布前检查全部通过：正式模式本机计时和旧数据保留、保护区代码一致性、14 组功能与 12 项合并检查、5 种设备触控模拟、单文件交互与尺寸切换、语法与差异检查。回滚 bundle 已验证可读且含完整原 Prod 历史。

发布前重跑必要检查，备份 Prod 基线并检查保护区代码，保存发布说明后推送发布分支，再更新 `main`。发布后状态为 `Awaiting User Acceptance`，等待用户确认正式网页；不擅自将尚未完成的线上人工验收标为通过。

## 优先级

- P0：本次受控发布。
- 无 P1。
- P2：其他功能，不实施。
