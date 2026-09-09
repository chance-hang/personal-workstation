# ACTIVE TASK

## 当前状态

Active

## 当前目标

执行“个人工作台 Test → Prod 发布架构”阶段 B：

**Prod 单文件结构机械拆分**

## 当前仓库

`hb27bp49vk-source/personal-workstation`

## 对应 Test 仓库

`hb27bp49vk-source/personal-workstation-test`

## 当前 Git remote 约定

本地 Prod Workspace 应为：

- `origin` → Prod
- `test` → Test

开始前执行 `git fetch origin` 与 `git fetch test`。

## 当前任务分支

`codex/prod-split-single-file`

## 本轮目标

把 Prod 当前单文件 `index.html` 机械拆分为：

- `index.html`
- `styles.css`
- `app.js`

核心原则：

**只改变文件组织，不改变正式版业务行为。**

本阶段不是 Test → Prod 功能发布，不把 Test 当前业务代码覆盖到 Prod。

## 开始前

1. 读取当前仓库 `AGENTS.md`。
2. 读取本文件。
3. 确认当前仓库为 `personal-workstation` 正式库。
4. 检查 `origin` 指向 `hb27bp49vk-source/personal-workstation`。
5. 检查 `test` 指向 `hb27bp49vk-source/personal-workstation-test`。
6. 执行 `git fetch origin`。
7. 执行 `git fetch test`。
8. 确认当前 `main` 已同步最新 `origin/main`。
9. 检查 `git status`；若不干净，停止并汇报，不自动清理。
10. 记录 Prod 当前 `main` HEAD SHA，作为回滚基线。
11. 在最新 Prod `main` 上创建/切换到 `codex/prod-split-single-file`。

## Test 的使用边界

本地 `test` remote 本轮仅用于：

- 确认 Test 仓库可读取；
- 在需要时对照已经完成的三文件拆分方式；
- 不得把 `test/main` 合并、rebase、cherry-pick 到 Prod；
- 不得直接用 Test 的 `index.html` / `styles.css` / `app.js` 覆盖 Prod。

本轮结构拆分必须以 **Prod 当前 `index.html` 自身内容** 为唯一业务来源。

## 本轮允许修改

仅当前 Prod 仓库：

- 修改 `index.html`
- 新增 `styles.css`
- 新增 `app.js`

不要修改 Test 仓库。

## B1. CSS 机械拆分

将 Prod `index.html` 中现有主 `<style>` 内容原样迁移到 `styles.css`。

要求：

- 保持原顺序和原内容
- 不重写选择器
- 不全局格式化
- 不清理重复样式
- `index.html` 改为正确引用 `styles.css`

## B2. JavaScript 机械拆分

将 Prod `index.html` 中现有主业务脚本原样迁移到 `app.js`。

要求：

- 保持脚本执行顺序
- 保持 DOM 初始化时机
- 保持正式登录行为
- 保持 Prod 无前缀 localStorage
- 保持现有 IndexedDB 镜像行为
- 保持 Gist 登录 / 同步逻辑
- 保持导入 / 导出逻辑
- 不引入 ES Module
- 不引入构建系统

## B3. HTML 收口

`index.html` 最终只保留页面结构与外链资源引用。

确保：

- `styles.css` 正确加载
- `app.js` 正确加载
- 原资源路径不变
- 原 DOM id / class / data 属性不变
- 不新增 `env.js`

## 必须保留的 Prod 行为

- Prod 无前缀 localStorage
- 正式 Gist 同步可用
- 正式账户登录逻辑
- 刷新后的登录提示 / 默认登录行为
- 现有 IndexedDB 镜像与恢复路径
- 导入 / 导出
- 页面初始化顺序
- 正式环境现有文案和保护逻辑

## 关于源码凭据

用户已明确这是个人项目，并接受现有源码凭据风险。

本轮：

- 不轮换
- 不迁移
- 不删除
- 不输出凭据内容
- 不把凭据复制到 Test
- 不因此阻塞结构迁移

## 本轮禁止

- 不同步 Test 新功能
- 不合并 `test/main`
- 不 cherry-pick Test 功能提交
- 不新增 `env.js`
- 不升级 IndexedDB 实现
- 不改变 localStorage key
- 不改变 Gist 协议
- 不改变登录流程
- 不改变导入 / 导出格式
- 不重构函数
- 不继续拆分 `app.js`
- 不引入 npm / Node / 框架
- 不全局格式化
- 不合并 Prod `main`

## 验证

至少完成：

1. 检查拆分前后 HTML / CSS / JS 对应关系，确认无遗漏或重复。
2. 浏览器直接打开 Prod `index.html`，确认页面可加载。
3. 控制台无因拆分新增的语法错误 / 资源加载错误。
4. 主要 Tab / 页面切换正常。
5. 刷新后的正式登录提示 / 默认登录行为与拆分前一致。
6. localStorage 正式数据仍能读取，不出现 `wbtest_` 前缀。
7. IndexedDB 初始化与镜像路径未改动。
8. 导入 / 导出入口正常。
9. Gist 登录 / 同步相关代码路径未改；如不适合真实数据验证，做静态路径核对并说明未实测项。
10. `git diff` 应主要表现为从 `index.html` 移出 CSS / JS 到两个新文件，而不是业务重写。

## 完成后

1. 检查 `git diff`。
2. commit 当前分支。
3. 推荐提交信息：`refactor: 拆分正式版单文件结构`
4. push `codex/prod-split-single-file` 到 GitHub。
5. 不合并 `main`。
6. 停止等待 ChatGPT Review。

## 汇报要求

用中文简短汇报：

- Prod 回滚基线 SHA
- 是否完成三文件拆分
- 修改了哪些文件
- 是否修改业务逻辑
- 正式登录 / localStorage / IndexedDB / Gist / 导入导出是否保持
- 做了哪些验证
- 哪些项目未实际验证及原因
- commit SHA
- push 是否成功
- 当前分支
