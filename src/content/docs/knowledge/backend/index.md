---
title: 后端与数据采集
description: API 集成、批处理、数据采集可靠性与可恢复任务设计。
order: 5
---

这里记录外部 API 集成、批量数据管道和长时间任务中可复用的可靠性设计。

## 数据采集与覆盖范围

- [批量采集器要区分空数据与真正失败](/knowledge/backend/no-data-vs-failure/)

## 本地数据产品

- [用 SQLite 构建本地分析型 Web 应用](/knowledge/backend/local-sqlite-analytics/)

## 长任务与质量验证

- [长时间 CLI 任务要报告真实阶段进度](/knowledge/backend/long-running-cli-progress/)
- [让 Agent 评测结果值得相信](/knowledge/backend/trustworthy-agent-evaluation/)

本地端口、pnpm、Node.js 子进程和 macOS 后台任务已经归入 [工程工具与系统](/knowledge/tooling/)。
