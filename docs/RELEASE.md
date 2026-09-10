# RELEASE

## 当前状态

Idle

当前没有待发布版本。

## 仓库角色

- 当前仓库：`chance-hang/personal-workstation`（Prod）
- 对应 Test：`chance-hang/personal-workstation-test`

本地 Prod Workspace 约定：

- `origin` → Prod
- `test` → Test

## 标准发布流程

只有当 Test 已经过：

1. Codex 完成开发并 push；
2. ChatGPT Review 通过；
3. 用户人工验收通过；
4. Test `docs/RELEASE.md` 明确标记 `Release Ready`；

才允许在 Prod 开始发布。

Prod 发布前必须：

1. 读取 `AGENTS.md`、`docs/ACTIVE_TASK.md` 和本文件；
2. `git fetch origin`；
3. `git fetch test`；
4. 检查 `git status`，工作区必须干净；
5. 确认当前 `main` 与 `origin/main` 同步；
6. 确认来源 Test commit 与 Test `RELEASE.md` 完全一致；
7. 从最新 Prod `main` 创建独立发布分支；
8. 只同步发布清单明确允许的内容。

## 禁止的发布方式

- 不直接执行 `git merge test/main`。
- 不把整个 Test 仓库覆盖 Prod。
- 不因为“Test 已通过”就默认所有文件都可同步。
- 不覆盖 Prod 环境专属配置或正式行为。
- 不在 Prod 重新设计或重新实现 Test 已完成的产品需求。

如果 Test 与 Prod 在同一业务文件中存在环境差异，应以“保留 Prod 环境行为 + 引入已验收 Test 功能”为目标完成最小受控同步，并等待 ChatGPT Review。

## 每次发布任务必须明确

- Source Test commit
- Source Test branch（通常为 `main`）
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
2. 停止等待 ChatGPT Review；
3. Review 通过后再合并 `main`；
4. 用户进行 Prod 人工验收；
5. 验收通过后，由 ChatGPT 更新 `docs/RELEASE_HISTORY.md`；
6. Prod `docs/ACTIVE_TASK.md` 回到无任务状态。
