---
title: 前端
description: 浏览器端组件、框架、网络与运行时性能。
order: 4
---

这里记录框架组件模型、浏览器运行时、资源加载、网络错误和实时性能。纯样式机制归入独立的 [CSS 主题](/knowledge/css/)，本地命令和构建脚本归入 [工程工具与系统](/knowledge/tooling/)。

## 建立框架与渲染模型

- [Astro 渲染模型与 Vue 交互岛](/knowledge/frontend/astro-vue-components/)

## 完成交互与网络任务

- [单线程 JavaScript 如何实现异步并发](/knowledge/frontend/async-concurrency/)
- [移动端下拉浮层的视口适配](/knowledge/frontend/mobile-dropdown-overlay/)
- [流式请求的错误提示与安全降级](/knowledge/frontend/streaming-error-fallback/)

## 优化加载与运行时

- [预计算查表：把固定范围的复杂计算移出运行时](/knowledge/frontend/precomputed-lookup-tables/)：用紧凑结构和累计偏移重建结果，并通过差分测试验证有限范围的行为。

## 快速复习

- [前端运行时与框架速记](/knowledge/frontend/quick-notes/)
- [计算属性缓存与时间依赖](/knowledge/frontend/quick-notes/#vue-computed-不会因时间经过自动重算)
- [自定义 Error 类与错误语义](/knowledge/frontend/quick-notes/#自定义-error-类负责携带错误语义)
