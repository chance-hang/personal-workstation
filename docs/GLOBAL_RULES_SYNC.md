# 跨项目规则同步

更新：2026-09-16。以 `chance-hang/AI-Coding-Control-Center/GLOBAL_RULES.md` 为跨项目来源，本文件只记录本项目适用补充，不覆盖 `AGENTS.md` 的项目特有规则。

- PAT/Token/密码/正式 Passcode 等秘密不得硬编码、提交 Git、进入 URL/二维码；运行时输入并采用最小权限。
- Prod 不得自动生成演示/测试数据；本地 Mock、seed、fixture、验收数据不得回流正式 Gist/数据。个人工作台 2026-09-15 的 Prod 污染防护是本规则的已验证实现。
- 外部 API 并发/条件请求等假设必须按真实当前 API 行为验证；失败必须显式暴露并保全数据/回滚能力。
- Executor/终端初始化失败时不修改仓库、ACL 或 Git 历史来修环境；保持原状，换已验证执行通道并从 GitHub 当前状态重新接管。
- ChatGPT 可 Review/建议，但不是发布门禁；用户授权 + 必要自动验证/备份/回滚/线上检查构成发布约束。
