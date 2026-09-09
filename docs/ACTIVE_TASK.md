# ACTIVE TASK

## 当前状态

Waiting for Human Acceptance

## 当前目标

阶段 B「Prod 单文件结构机械拆分」已完成 Codex 实施、GitHub push、ChatGPT Review，并已合并到 `main`。

当前不再执行新的 Codex 代码任务，等待正式版浏览器人工验收。

## 已完成

- Prod 从单文件 `index.html` 拆分为：
  - `index.html`
  - `styles.css`
  - `app.js`
- 结构拆分已通过 ChatGPT Review。
- 分支 `codex/prod-split-single-file` 已合并到 `main`。
- 正式库仍保持独立 Workspace。
- 本地 `test` remote 继续指向 `hb27bp49vk-source/personal-workstation-test`，供后续受控发布使用。

## 当前禁止

在人工验收完成前：

- 不开始新的 Prod 业务修改。
- 不执行 Test → Prod 功能发布。
- 不合并 `test/main`。
- 不新增 `env.js`。
- 不继续拆分 `app.js`。

## 人工验收重点

请直接使用当前 Prod `main` 验证：

1. 页面可正常加载，样式正常。
2. 主要 Tab / 页面切换正常。
3. 刷新后正式登录提示 / 默认登录行为与拆分前一致。
4. 原有正式数据可正常读取。
5. localStorage 仍使用正式版键，不出现 `wbtest_` 前缀。
6. 导入 / 导出入口正常。
7. Gist 登录 / 同步入口和行为正常。
8. 页面无明显新增报错或资源加载失败。

## 验收通过后

由 ChatGPT 进入阶段 C：固化 Test → Prod 发布流程，并更新 Test / Prod 两边发布文档。

Codex 读取本文件后，如果没有新的 ChatGPT 指令：

- 不创建新分支
- 不修改代码
- 保持 `main` 稳定
