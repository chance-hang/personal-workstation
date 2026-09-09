# AGENTS.md

## 项目说明

这是“个人工作台”的正式版（Prod）仓库。

GitHub：`hb27bp49vk-source/personal-workstation`
对应 Test：`hb27bp49vk-source/personal-workstation-test`

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

- `origin` → `hb27bp49vk-source/personal-workstation`
- `test` → `hb27bp49vk-source/personal-workstation-test`

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
