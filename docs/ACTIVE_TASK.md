# ACTIVE TASK

## 当前状态

Completed

## 当前目标

个人工作台 Prod 三文件结构迁移已经完成、合并并通过人工验收。

当前没有待执行的 Prod Codex 任务。

## 当前结构

正式库当前采用：

- `index.html`
- `styles.css`
- `app.js`

## 长期角色

本仓库是正式发布区，不是日常开发入口。

常规流程：

Test 开发 → ChatGPT Review → 人工验收 → Test 标记 Release Ready → Prod 通过 `test` remote 获取指定 Test commit → 按 `docs/RELEASE.md` 执行受控发布 → ChatGPT Review → 人工验收。

## 当前要求

Codex 读取本文件后，如果没有新的 ChatGPT 指令或新的发布任务：

- 不创建新分支
- 不修改业务代码
- 不主动同步 Test
- 不合并 `test/main`
- 不执行历史任务
- 保持 `main` 为当前稳定正式基线

下一次正式发布开始时，由 ChatGPT 更新本文件并明确：

- Source Test commit
- 发布范围
- 必须保留的 Prod 差异
- 目标分支
- 验证要求
