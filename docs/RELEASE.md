# RELEASE

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
