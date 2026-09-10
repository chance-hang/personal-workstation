# AGENTS.md

## 项目说明

这是“个人工作台”的正式版（Prod）仓库。

GitHub：`chance-hang/personal-workstation`
对应 Test：`chance-hang/personal-workstation-test`

本仓库是正式发布区域，不作为日常功能开发入口。

## 核心规则

1. 常规功能开发只在 Test 仓库进行。
2. Prod 不独立重新实现 Test 已完成的功能。
3. 只有经过 ChatGPT Review 和人工验收的 Test 版本，才允许发布到 Prod。
4. 发布时必须明确来源 Test commit / 分支与允许同步范围。
5. 环境专属行为必须保留，禁止无脑覆盖。
6. 除非 `docs/ACTIVE_TASK.md` 明确授权，不要修改正式业务代码。

## Git remote 约定

当前本地 Prod 工作区应配置：

- `origin` → `chance-hang/personal-workstation`
- `test` → `chance-hang/personal-workstation-test`

需要读取 Test 已验收版本时，通过：

`git fetch test`

获取 `test/main` 或指定 Test commit。

不要通过父目录跨 Workspace 直接操作另一个仓库。

## 开始任务前

优先读取：

1. `AGENTS.md`
2. `docs/ACTIVE_TASK.md`
3. ACTIVE_TASK 指向的说明或来源 commit

然后：

- 检查当前仓库和分支
- `git fetch origin`
- 如任务涉及 Test 来源，执行 `git fetch test`
- 检查 `git status`
- 如果工作区不干净，停止并汇报，不自动清理

## 正式环境必须保护

除非当前任务明确要求，否则不得改变：

- 正式账户登录逻辑
- 刷新后的登录提示 / 默认登录行为
- Prod 无前缀 localStorage 命名空间
- GitHub Gist 正式同步路径
- IndexedDB 镜像与恢复路径
- 导入 / 导出格式
- 页面初始化顺序
- 正式环境现有文案和保护逻辑

## 技术路线

当前项目为浏览器直接运行的轻量应用。

除非任务明确授权：

- 不引入 React / Vue / Angular
- 不引入 npm / Node 构建系统
- 不增加后端
- 不改存储方案
- 不改 Gist 加密同步协议
- 不擅自模块化或继续拆分 JS

## 完成任务时

必须用中文汇报：

- 修改了哪些文件
- 是否改变业务逻辑
- 是否涉及 localStorage / IndexedDB / Gist / 登录 / 导入导出
- 做了哪些验证
- 未验证项及原因
- commit SHA
- push 是否成功
- 当前分支

未经明确要求，不合并 `main`。

## Workflow 3.0 跨项目同步（2026-09-10）

本节把总控仓库 [`chance-hang/AI-Coding-Control-Center`](https://github.com/chance-hang/AI-Coding-Control-Center) 的跨项目规则同步到本仓库。它**不替代**本仓库既有 Prod 规则；冲突时本节服从上文"正式环境必须保护"与"核心规则"，最终由 ChatGPT 按 `GLOBAL_RULES.md §19` 恢复权威顺序裁决。

权威来源：

- [GLOBAL_RULES.md](https://github.com/chance-hang/AI-Coding-Control-Center/blob/main/GLOBAL_RULES.md)
- [docs/WORKFLOW.md](https://github.com/chance-hang/AI-Coding-Control-Center/blob/main/docs/WORKFLOW.md)
- [docs/EXECUTOR_HANDOFF.md](https://github.com/chance-hang/AI-Coding-Control-Center/blob/main/docs/EXECUTOR_HANDOFF.md)
- [docs/MULTI_DEVICE.md](https://github.com/chance-hang/AI-Coding-Control-Center/blob/main/docs/MULTI_DEVICE.md)
- [docs/DISASTER_RECOVERY.md](https://github.com/chance-hang/AI-Coding-Control-Center/blob/main/docs/DISASTER_RECOVERY.md)

### 角色与执行器抽象

- 用户：提出需求、批准发布、执行关键人工验收。
- ChatGPT：总控。读取 GitHub 事实、维护治理文件、Review Executor 推送结果、批准 Prod 发布。
- Executor：在真实本地仓库中执行明确任务的工程层。**Codex 与 Workbuddy 都是可替换 Executor**；Prod 发布执行不绑定单一 Executor。
- GitHub：对 Executor 中立的长期共享状态中心。

### ACTIVE_TASK / Task Queue 优先级模型

本仓库 `docs/ACTIVE_TASK.md` 必须为每条任务标注优先级：

| 优先级 | 含义 | Executor 允许行为 |
| --- | --- | --- |
| `P0 Active` | 当前唯一允许执行的任务 | Implementation、commit、push |
| `P1 Queued` | 下一任务 | 读取、规划、写文档；**不得提前 Implementation** |
| `P2 Backlog` | 未来任务 | 不主动执行 |

Executor 不得自行把 P1 / P2 提升为 P0。

### STOP 状态机

Executor 到达以下门槛必须立即 STOP：

| 状态 | 后续推进必须由谁激活 |
| --- | --- |
| `Awaiting ChatGPT Review` | ChatGPT |
| `Awaiting User Acceptance` | 用户 |
| `Blocked` | ChatGPT + 用户 |
| `Completed / Accepted` | ChatGPT 派发下一 Task 或执行发布 |

Prod 发布期间 Executor 完成 commit / push 后必须停在 `Awaiting ChatGPT Review`，不得自行推进到 Prod `main` 合并。

### 上下文高效指令与汇报

- ChatGPT → Executor 默认指令只给三件事：仓库绝对路径、动作（`clean-handoff-and-execute` / `takeover-only` 等）、读取入口（`AGENTS.md` / `docs/ACTIVE_TASK.md` / `docs/RELEASE.md`）。
- Executor 默认完成汇报只四件事：`commit SHA` / 测试验证 / `push 成功/失败` / `blocker`。
- 仅当新需求尚未进入 GitHub、高风险操作、异常恢复、需要用户决策时才展开长指令。

### 多电脑 / Executor 接管 / 云同步盘

- 每台电脑使用独立 Git clone；GitHub 负责跨设备同步。
- 同一个仓库同一时间只能有一个写入 Executor。
- dirty worktree 接管必须先保护前一执行器遗留工作；禁止直接 `reset --hard` / `clean -fd` / `checkout --`。
- 百度同步盘**不能视为 Git 状态同步机制**；不得让两个 Executor / 设备同时写同一 clone。
- 遇到 ref 异常先停止、检查 `git reflog` 与 `git fsck`，**不得** reset / clean / 重写历史。详细恢复流程见 [docs/DISASTER_RECOVERY.md §场景 E](https://github.com/chance-hang/AI-Coding-Control-Center/blob/main/docs/DISASTER_RECOVERY.md)。

### 与本仓库既有 Prod 规则的关系

- 上文"正式环境必须保护"、"核心规则"、"Git remote 约定"、"技术路线"仍然有效且优先。
- 本节只在不冲突范围内补充跨项目同步要求；冲突时按权威顺序由 ChatGPT 显式裁决，并在 `docs/ACTIVE_TASK.md` 标注。
