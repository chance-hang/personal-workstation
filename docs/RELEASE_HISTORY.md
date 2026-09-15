# RELEASE HISTORY

## 2026-09-15 — Token 写入权限阻断修复

类型：Prod 云同步凭据与登录恢复修复。

结果：

- 移除源码中的硬编码 GitHub Token，默认账户保留 Gist ID，Token 改由账户管理输入。
- 登录前预检 Gist 访问权限，区分 Token 无效、无 `gist` 权限、Passcode 错误和网络失败。
- 账户管理增加“更新 Token”，验证成功后才保存，电脑端和手机端均适用。
- `node --check app.js`、凭据字面量检查和 `git diff --check` 通过。
- 用户已明确授权发布到 Prod。

关键提交：

- 验收来源提交：`cb389abae7bfdbc9f97cc0cc662cf8fd52fc91f9`
- Prod 发布提交：`cb389abae7bfdbc9f97cc0cc662cf8fd52fc91f9`

## 2026-09-15 — Prod 云同步重新登录入口

类型：Prod 云同步登录恢复体验修复。

结果：

- 认证或解密失败后清除失效会话，保留账户配置并停止失效重试。
- 云同步设置、账户管理和手动同步均可直接进入“重新登录”。
- 未修改 Gist 加密协议、同步数据结构、localStorage 命名空间或 IndexedDB 路径。
- `node --check app.js`、源码断言和 `git diff --check` 通过。
- CUA 自动化浏览器拦截本地/局域网地址；用户明确授权后仍完成 Prod 发布，电脑/手机人工地址另行验证。

关键提交：

- 验收来源提交：`4006e0e3b4576801421063763dd8ae009c153fd0`
- Prod 发布提交：`4006e0e3b4576801421063763dd8ae009c153fd0`

## 2026-09-15 — 备忘同步时区修复

类型：Prod 备忘同步修复。

结果：

- `noteUpdatedAt()` 对无时区旧时间戳改按本地时间语义解析，修复 UTC+X 环境下完成状态被回滚的问题。
- 自动验证通过：跨时区 5/5、双端收敛仿真 15/15、HTTP 冒烟 13/13。
- 用户完成本地 Mock 双端人工验收 5/5，并确认通过升级 Prod。
- ChatGPT Review 非必要发布门禁；本次以 Codex 自检、自动验证和用户人工验收为准。

关键提交：

- 验收来源提交：`ede3523d67`
- Prod 发布集成提交：`3374cd9`

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
