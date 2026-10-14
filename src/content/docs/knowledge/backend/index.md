---
title: 后端与数据采集
description: API 集成、批处理、数据采集可靠性与可恢复任务设计。
order: 5
---

这里记录外部 API 集成、批量数据管道和长时间任务中可复用的可靠性设计。

## HTTP 接口与故障定位

- [HTTP 路由与异常速记](/knowledge/backend/quick-notes/#http-路由与异常)：NestJS 路由兜底 404、异常通知与请求来源的判断边界。
- [草稿与提交、执行校验](/knowledge/backend/quick-notes/#接口输入校验)：区分合法保存与业务完整，复用字段定义并避免把 `.partial()` 当作放宽已填写内容的校验。
- [接口数据归一化与资源身份](/knowledge/backend/quick-notes/#接口数据归一化)：区分缺失数值与真实零值，保留来源限定 ID 的命名空间。

## 模型 API 与凭据接入

- [用户自带 API Key 的模型接入边界](/knowledge/backend/byok-model-integration/)：额度归属、协议兼容、密钥托管与自定义 URL 的 SSRF 风险。
- [JSON Schema、Function Calling 与工具选择](/knowledge/backend/structured-output-and-tool-calling/)：回答正文与工具参数的区别、默认 auto 策略，以及原生约束和本地校验的边界。

## 数据库与数据生命周期

- [后端与数据库易忘知识点](/knowledge/backend/quick-notes/)：软删除、回收站、外部文件与 CDN 清理的边界。

## 数据采集与覆盖范围

- [批量采集器要区分空数据与真正失败](/knowledge/backend/no-data-vs-failure/)
- [RSS 与上游访问条件](/knowledge/backend/quick-notes/#rss-转换器开源不代表上游数据免费可用)：区分开源转换工具、上游授权和整条通知流程的成本。

## 本地数据产品

- [用 SQLite 构建本地分析型 Web 应用](/knowledge/backend/local-sqlite-analytics/)

## 长任务与质量验证

- [长时间 CLI 任务要报告真实阶段进度](/knowledge/backend/long-running-cli-progress/)
- [让 Agent 评测结果值得相信](/knowledge/backend/trustworthy-agent-evaluation/)：单测/E2E 与评测的关系、执行证据、评分口径及平台复用边界。

本地端口、pnpm、Node.js 子进程和 macOS 后台任务已经归入 [工程工具与系统](/knowledge/tooling/)。
