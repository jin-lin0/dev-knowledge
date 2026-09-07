---
title: Codex 模式与易混概念
navTitle: Codex 快速复习
description: 快速区分 Codex 的执行模式、模型推理强度和其他容易混淆的概念。
kind: note
audience: 希望快速选择 Codex 工作方式与模型设置的开发者
lastVerified: "2026-09-06"
order: 3
---

这是一份持续增长的 Codex 速记页。每个条目只保留选择设置和排查概念混淆时需要的信息。

## ChatGPT 网页与 Codex 的模型可用性

同一个 ChatGPT 账号在网页端看到某个模型，不代表该模型会同时出现在 Codex 桌面应用、CLI、IDE 扩展或 Codex Cloud 中。各产品界面分别依据推出阶段、客户端支持、登录方式、账号权益和工作区策略计算可用模型。

- **排查顺序**：先确认网页端与 Codex 登录的是同一账号和工作区，再更新并重启客户端、重新打开模型选择器；团队账号还应检查管理员是否为 Codex 单独启用了该模型。
- **记忆点**：模型选择器没有列出时，通常不能靠手写 `config.toml` 的模型 ID 绕过权限；配置只能选择当前产品和身份已经获准使用的模型。
- **特别情况**：Codex Cloud 当前不能修改云端聊天的默认模型。使用 API Key 登录时，模型权限取决于该 Key 所属的 API 组织和项目，不继承 ChatGPT 网页端权限。
- **来源**：[OpenAI Codex 模型](https://learn.chatgpt.com/zh-Hans/docs/models)、[OpenAI 工作区模型可用性](https://learn.chatgpt.com/zh-Hans/docs/enterprise/workspace-model-availability)。

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
