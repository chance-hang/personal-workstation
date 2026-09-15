# RELEASE HISTORY

## 2026-09-15 — 云同步推送管道修复（If-Match 400 + 大数组 base64 溢出）

类型：Prod 云同步推送（cloudPush）阻断修复。

背景：

- 用户录屏 + DevTools 截图确认：登录后状态「同步中」→「同步失败」，全程无错误提示，
  浏览器网络面板显示对 Gist 的 PATCH 连续返回 `400 Bad Request`。
- 云端 `data.json` 自 2026-09-14 15:53 起未再更新，说明推送管道整体中断。

根因：

1. GitHub Gist API 现在对带 `If-Match` 请求头的 PATCH 一律返回 `400 Bad Request`
   （实测：ETag 取自身为强格式且值正确也返回 400，不带该头则 200 通过）。
   工作台 `cloudPush` 每次推送都带 `If-Match` 做乐观锁，因此每次推送必失败。
   该错误既不是 401/403 也不含 decrypt 关键字，落入静默分支，只重试不提示。
2. `encryptState` 使用 `btoa(String.fromCharCode(...new Uint8Array(ct)))` 展开整个密文字节数组，
   线上实测超过约 120KB 即抛 `RangeError: Maximum call stack size exceeded`（150KB 必炸）。
   数据增长后会以同样方式静默失败，属定时炸弹。

结果：

- 移除 PATCH 的 `If-Match` 头；并发安全改由既有的「推送前先拉取云端并合并」流程承担，
  并保留注释说明不要再引入该头。
- 加解密的字节与 base64 互转改用仓库既有的分块 helper `_b64en` / `_b64de`，与 `_aesGcmEnc` 惯例一致。
- 实测 3MB 数据加密约 364ms；curl 对照实验：不带 `If-Match` 的 160KB PATCH 返回 200。
- `node --check app.js` 通过；首页脚本版本戳 bump 到 `app.js?v=prod-push-b64-fix-20260915-2`。
- 用户已明确授权发布到 Prod（跳过 ChatGPT Review 环节，由用户直接线上验收）。

关键提交：

- 验收来源提交：`9e5191ffb976e7d650837e7084b6780d79679301`
- Prod 发布提交：`9e5191ffb976e7d650837e7084b6780d79679301`


## 2026-09-15 — Prod 脚本缓存版本阻断修复

类型：Prod 发布缓存修复。

结果：

- 首页脚本引用切换到 `app.js?v=prod-token-fix-20260915-1`。
- 确保手机和电脑加载 Token 权限预检及“更新 Token”功能，而不是继续使用旧缓存脚本。
- 用户已明确授权发布到 Prod。

关键提交：

- 验收来源提交：`b79484c24fe4a333aa09abc450214e3a8ce77dfb`
- Prod 发布提交：`b79484c24fe4a333aa09abc450214e3a8ce77dfb`

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
