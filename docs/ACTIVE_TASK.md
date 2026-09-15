# ACTIVE TASK

最后更新：2026-09-15（备忘同步时区修复发布）

## 当前状态

`Completed / Accepted`

- 当前 review 分支：`review/prod-note-tz-fix`
- 当前提交：`ede3523d67`
- 已完成 Prod 原生同步模型迁移验证，不再依赖 Test source 或 Test remote。
- 发布范围：仅在 Prod 原生 `app.js` 同步模型中等价适配备忘时间戳解析、UTC 写入、legacy `completed` 迁移与同 ID 冲突裁决；更新本任务门禁记录。
- 必须保留：Prod 登录、无前缀 localStorage、Gist、IndexedDB、导入导出、初始化顺序及其余业务逻辑。
- 禁止：直接 cherry-pick Test 提交、`_syncV2`、CRDT、字段级版本系统及任何无关业务改动。
- 目标分支：`main`；Prod 原生适配已完成自动验证、本地 Mock 人工验收，用户已确认通过并授权合并升级。

## 当前优先级

- `P0 Completed / Accepted`：备忘同步时区修复提交 `ede3523d67` 已推送并完成本地 Mock 验收，用户已确认通过并授权发布；禁止恢复 Test source 或 Test remote。
- 没有 P1 Queued。
- `P2 Backlog`：等待用户或项目负责人派发新发布任务；新发布到达前 Executor 不主动实施任何变更。

## STOP 状态机

按 `GLOBAL_RULES.md §10`：

- `Awaiting User Acceptance`：Codex 自检、自动验证和本地 Mock 验收完成后等待用户人工验收。
- `Blocked`：缺信息 / 冲突 / 依赖未到位。
- `Completed / Accepted`：用户人工验收通过，按用户授权进入下一 Task 或执行发布；ChatGPT Review 不是必要门禁。

Prod 发布期间 Executor 完成 commit / push 和必要自检后停在 `Awaiting User Acceptance`；用户明确同意发布后才可推进到 Prod `main` 合并。

## 当前结构

正式库当前采用：

- `index.html`
- `styles.css`
- `app.js`

## 长期角色

本仓库是正式发布区，不是日常开发入口。

常规流程：

Prod `review/*` 开发 → Codex 自检与自动验证 → 本地 Mock 验收 → 用户人工验收 → 按 `docs/RELEASE.md` 执行受控发布 → 用户确认 Prod 验收 → `Completed / Accepted`。ChatGPT 可提供建议，但不是发布门禁。已退休的 Test 仓库不再作为 source 或 remote。

## 当前要求

Executor 读取本文件后，如果没有新的 ChatGPT 指令或新的发布任务：

- 不创建新分支
- 不修改业务代码
- 不主动恢复或同步已退休的 Test 仓库
- 不从 Test remote 获取发布内容
- 不执行历史任务
- 不把 P2 Backlog 自行提升为 P0
- 保持 `main` 为当前稳定正式基线

下一次正式发布开始时，由用户或 Codex 更新本文件并把对应发布任务升为 `P0 Active`，并明确：

- Source Prod review commit
- 发布范围
- 必须保留的 Prod 差异
- 目标分支
- 验证要求
