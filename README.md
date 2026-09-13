# 答主考官 Demo

一个按 `docs/答主考官-Demo设计方案.md` 实现的离线 MVP。核心闭环是：选题 → 先讲述 → 知乎观点比对 → 补讲复测 → 掌握度报告与知识卡片。

## 运行

无需安装第三方依赖。接入知乎 skill 后请使用 Node 后端启动：

```bash
npm run dev
```

然后打开 `http://localhost:4173`。后端会继承当前进程的知乎凭证环境变量，浏览器不会接触 Access Secret。CLI 路径按以下顺序解析：`ZHIHU_CLI_PATH`（绝对路径，最高优先级）→ 宿主注入的 `ZHIHU_CLI_HOME/current/zhihu-cli(.exe)` → PATH 中的 `zhihu-cli`。启动日志会打印实际使用的 CLI，未找到时会明确提示搜索与直答不可用。

搜索接口为 `POST /api/search`，请求体：`{"query":"你的问题"}`。评估接口为 `POST /api/evaluate`，请求体：`{"topic":"问题","answer":"用户讲述"}`；它调用知乎直答（默认 `zhida-thinking-1p5`）生成 5～8 个结构化考点，再由知乎搜索摘要绑定可追溯链接。知乎服务异常时返回 502，前端明确提示重试，不使用离线评估。

知乎直答综合说明与知乎搜索摘要会在界面中分开标注；直答没有返回可验证链接时，不会伪造“查看原文”链接。

## 测试

```bash
npm test
```

测试覆盖离线 fixture 的来源字段、四类状态统计、评分和补讲提分逻辑。Demo 不依赖实时知乎接口，页面明确标注“回答摘要（演示资料）”；后续接入接口时只需替换 `src/core.js` 的 fixture / adapter。
