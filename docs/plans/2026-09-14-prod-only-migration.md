# Prod-only 迁移计划

## 目标

将个人工作台的日常开发、验收和发布统一到本 Prod 仓库的临时 `review/*` 分支，停止把 `personal-workstation-test` 作为长期代码来源。

## 新链路

```text
personal-workstation/main
  → review/<task-name>
  → review 模式启动与醒目标识
  → 自动测试 / 本地验收
  → 用户验收或明确直接上线
  → Prod rollback SHA / tag
  → 合并 main、部署、线上 smoke check
```

## 迁移要求

- 保留 Prod 专属行为：无前缀 localStorage、GitHub Gist 正式同步、IndexedDB、登录和导入导出流程。
- review 验收使用独立的 localStorage namespace、Gist sandbox/mock 和非正式上传/同步目标。
- 不再执行 `git fetch test`、读取 `test/main` 或从 Test 仓库复制文件。
- 当前 P0 发布任务完成前不覆盖其 ACTIVE_TASK；迁移分支只修改治理和发布入口。
- 旧 Test 发布记录只保留为历史证据，不再作为新任务来源。

## 删除门禁

只有完成一次从 Prod review 分支到 Prod main 的真实代码发布演练，并确认 review 模式不会写入正式 Gist、数据或缓存后，才允许移除 `test` remote、删除本地 Test clone，最后退役 GitHub Test 仓库。

## 回滚

迁移失败时恢复迁移前 Prod SHA、`test` remote 配置和本文件变更；不使用 Test 整库覆盖 Prod。数据同步异常时单独恢复 Gist/IndexedDB 快照或人工重配，不把 Git 回滚当作数据回滚。
