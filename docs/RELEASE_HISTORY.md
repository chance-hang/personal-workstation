# RELEASE HISTORY

## 2026-09-15 — 备忘同步时区修复

类型：Prod 备忘同步修复。

结果：

- `noteUpdatedAt()` 对无时区旧时间戳改按本地时间语义解析，修复 UTC+X 环境下完成状态被回滚的问题。
- 自动验证通过：跨时区 5/5、双端收敛仿真 15/15、HTTP 冒烟 13/13。
- 用户完成本地 Mock 双端人工验收 5/5，并确认通过升级 Prod。
- ChatGPT Review 非必要发布门禁；本次以 Codex 自检、自动验证和用户人工验收为准。

关键提交：

- 验收来源提交：`ede3523d67`
- Prod 发布提交：待合并后记录

## 2026-09-09 — Prod 结构迁移基线

类型：架构迁移，不是 Test 功能发布。

结果：

- Prod 从单文件 `index.html` 机械拆分为：
  - `index.html`
  - `styles.css`
  - `app.js`
- 拆分通过 ChatGPT Review。
- 拆分已合并到 Prod `main`。
- 用户已完成人工验收并确认正式版可正常使用。

关键提交：

- 结构拆分提交：`2361b340527e186b210fbb549ba7a465ff2b5dd6`

说明：

此记录用于建立后续 Test → Prod 受控发布的正式基线。以后每次发布都应追加：Source Test commit、Prod 发布提交、发布范围、验收结果与必要回滚信息。
