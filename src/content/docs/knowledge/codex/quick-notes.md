---
title: Codex 模式与易混概念
navTitle: Codex 快速复习
description: 快速区分 Codex 的执行模式、模型推理强度和其他容易混淆的概念。
kind: note
audience: 希望快速选择 Codex 工作方式与模型设置的开发者
lastVerified: "2026-09-01"
order: 3
---

这是一份持续增长的 Codex 速记页。每个条目只保留选择设置和排查概念混淆时需要的信息。

## `xhigh（极高）`、`Max（最高）` 与 `Ultra`

这三个档位不只是同一条“思考更久”刻度。`xhigh` 和 `Max` 调整所选模型处理单个任务时的推理投入；`Ultra` 还会改变任务编排方式，自动把适合拆分的工作委派给子代理。

| 设置 | 执行方式 | 更适合 |
| --- | --- | --- |
| `xhigh（极高）` | 单个代理投入极高推理深度 | 多步骤、多来源或有复杂权衡的困难任务 |
| `Max（最高）` | 单个代理获得最大推理深度和更多推理时间 | `xhigh` 仍不够可靠、需要充分探索和核验的最难问题 |
| `Ultra` | 最大推理，并自动委派和汇总多个子任务 | 能清晰拆成检索、实现、测试、审查等独立工作流的大型任务 |

- **选择顺序**：先使用能满足要求的最低档位；困难任务可试 `xhigh`，质量比速度和用量更重要时再比较 `Max`，能够有效并行拆分时才考虑 `Ultra`。
- **成本边界**：提高推理强度通常会增加延迟和 token 用量，但官方没有给出 `Max` 相对 `xhigh` 的固定倍数，也不保证每个任务都更正确。`Ultra` 中的子代理还会各自执行模型与工具工作，并产生额外协调成本。
- **可用性**：`Max` 和 `Ultra` 只会出现在支持并启用它们的产品配置中。官方说明多数任务并不需要这两个档位。
- **来源**：[OpenAI Codex models](https://learn.chatgpt.com/docs/models)、[OpenAI Codex subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents)。
