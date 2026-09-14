# ACTIVE TASK

最后更新：2026-09-14（Prod 受控发布：备忘同步完成状态回滚修复）

## 当前状态

`Blocked`

- 来源分支：`test/codex/fix-note-sync-completion-rollback`
- 来源提交：`a5a8a650664004aa60626e04090a560d2f11f709`
- 发布范围：仅受控合入该来源提交的 `app.js` 备忘时间戳解析、UTC 写入与内置校验变更；更新本任务门禁记录。
- 必须保留：Prod 登录、无前缀 localStorage、Gist、IndexedDB、导入导出、初始化顺序及其余业务逻辑。
- 禁止：`_syncV2`、CRDT、字段级版本系统及任何无关业务改动。
- 阻塞原因：该提交无法直接应用到当前 Prod；其上下文依赖 Test 的 `_syncV2` / CRDT 同步层，与本次禁止项冲突。未合入业务代码，等待经审核的 Prod 兼容来源提交。
- 目标分支：`main`；验证通过后才允许部署。

## 当前优先级

- `P0 Blocked`：`a5a8a650664004aa60626e04090a560d2f11f709` 与 Prod 当前同步实现不兼容，禁止移植其 `_syncV2` / CRDT 依赖。
- 没有 P1 Queued。
- `P2 Backlog`：等待 ChatGPT 派发新发布任务；新发布到达前 Executor 不主动实施任何变更。

## STOP 状态机

按 `GLOBAL_RULES.md §10`：

- `Awaiting ChatGPT Review`：commit / push 完成后等 ChatGPT Review diff。
- `Awaiting User Acceptance`：Review 通过后等用户人工验收。
- `Blocked`：缺信息 / 冲突 / 依赖未到位。
- `Completed / Accepted`：用户人工验收通过，ChatGPT 派发下一 Task 或执行发布。

Prod 发布期间 Executor 完成 commit / push 后必须停在 `Awaiting ChatGPT Review`，不得自行推进到 Prod `main` 合并。

## 当前结构

正式库当前采用：

- `index.html`
- `styles.css`
- `app.js`

## 长期角色

本仓库是正式发布区，不是日常开发入口。

常规流程：

Test 开发 → ChatGPT Review → 人工验收 → Test 标记 Release Ready → Prod 通过 `test` remote 获取指定 Test commit → 按 `docs/RELEASE.md` 执行受控发布 → Executor commit / push → `Awaiting ChatGPT Review` → 用户人工验收 → `Completed / Accepted` → ChatGPT 更新 `docs/RELEASE_HISTORY.md` 并恢复 `docs/RELEASE.md` 为 `Idle`。

## 当前要求

Executor 读取本文件后，如果没有新的 ChatGPT 指令或新的发布任务：

- 不创建新分支
- 不修改业务代码
- 不主动同步 Test
- 不合并 `test/main`
- 不执行历史任务
- 不把 P2 Backlog 自行提升为 P0
- 保持 `main` 为当前稳定正式基线

下一次正式发布开始时，由 ChatGPT 更新本文件并把对应发布任务升为 `P0 Active`，并明确：

- Source Test commit
- 发布范围
- 必须保留的 Prod 差异
- 目标分支
- 验证要求
