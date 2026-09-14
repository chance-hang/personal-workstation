# 本地隔离验收

待验收分支统一使用本地 Mock 云同步，禁止使用唯一 Prod 账号直接验收。

## 启动

在仓库根目录执行：

```powershell
node tools/mock-sync-server.mjs
```

打开：

```text
http://127.0.0.1:4173/?mockSync=1
```

第二个独立端使用：

```text
http://localhost:4173/?mockSync=1
```

两个地址属于不同浏览器存储源，但共享同一个本地 Mock Gist。使用任意测试 Passcode 登录即可，不会访问正式 Gist。普通不带 `mockSync=1` 的地址仍保持正式同步行为。

Mock 模式会强制显示「本地 Mock 验收库」、使用本地假账户，并忽略浏览器中原有的正式账户配置；登录框会明确提示「仅本地，不连接正式 Gist」。
