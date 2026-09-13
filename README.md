# 答主考官 Demo

一个按 `docs/答主考官-Demo设计方案.md` 实现的离线 MVP。核心闭环是：选题 → 先讲述 → 知乎观点比对 → 补讲复测 → 掌握度报告与知识卡片。

## 运行

无需安装第三方依赖。接入知乎 skill 后请使用 Node 后端启动：

```bash
npm run dev
```

然后打开 `http://localhost:4173`。后端会继承当前进程的知乎凭证环境变量，浏览器不会接触 Access Secret。若知乎 CLI 不在默认路径，可设置 `ZHIHU_CLI_PATH`。

搜索接口为 `POST /api/search`，请求体：`{"query":"你的问题"}`。知乎服务异常时会返回 `fallback: true`，前端继续使用离线演示资料。

## 测试

```bash
npm test
```

测试覆盖离线 fixture 的来源字段、四类状态统计、评分和补讲提分逻辑。Demo 不依赖实时知乎接口，页面明确标注“回答摘要（演示资料）”；后续接入接口时只需替换 `src/core.js` 的 fixture / adapter。
