---
title: 用户自带 API Key 的模型接入边界
description: 区分额度归属、模型协议、密钥托管、SSRF 和运行时隔离，设计可控的用户自配模型接入。
kind: explanation
audience: 为多人平台接入用户自有模型 API 的开发者
lastVerified: "2026-09-09"
order: 6
---

这里的 BYOK 指用户提供自己的模型 API Key，不是密钥管理系统中“自带加密主密钥”的另一种 BYOK。它改变模型调用所用的凭据与额度归属；平台仍负责安全地接收凭据、选择请求目的地、执行任务和保存结果。

## 把模型配置和凭据分开

建议把一个模型连接拆成非秘密的配置和单独的凭据引用：

| 配置 | 解决的问题 |
| --- | --- |
| Provider / 协议类型 | 使用哪种请求、工具调用和流式响应协议 |
| Base URL + Model ID | 访问哪个服务、请求哪个模型 |
| Credential reference + Owner | 本次任务可以使用谁的凭据 |
| 能力与参数 | 是否支持工具、图片、结构化输出及所需参数 |
| 配置版本 | 报告记录的是哪次连接配置 |

运行任务只保存配置快照和凭据引用。密钥按需要由有权执行该任务的组件取得，不进入提示词、普通日志、实验报告或共享前端配置。不同用户的请求不要通过修改全局客户端或全局凭据来切换模型。

这是依据最小权限原则作出的设计建议。OWASP 要求限制秘密的读取范围、支持撤销和轮换、避免明文日志，并指出静态加密不消除使用时解密的事实；因此“数据库已加密”不能替代运行时访问控制。[OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)

## 自定义 URL 会扩大服务端网络权限

后端按照用户输入发起请求，意味着用户间接使用服务器的网络位置。未受限制的目标可能指向本机管理端口、未授权内网服务或云元数据接口，这属于服务端请求伪造（SSRF）的风险面。

优先采用管理员登记的 Provider 和端点，用户只选择模型并绑定自己的 Key。必须支持自定义端点时，应共同约束协议、端口、精确主机和实际连接地址，处理 IPv4/IPv6、DNS 变化和重定向，并通过网络出口限制兜底；连接测试接口也需要相同防护。业务确实需要内网端点时，显式登记允许的目标，不能允许任意内网地址。

上述防护依据 OWASP 的应用层与网络层建议；单独检查字符串是否以 `https://` 开头不能建立可信边界。[OWASP SSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)

密钥只能注入与其绑定的端点。更换 URL 应重新确认凭据绑定，避免把原服务的 Authorization 自动发给另一目的地。

## 请求成功不代表模型能力兼容

“兼容同一 SDK”只说明部分接口可以调用，不保证所有参数和 Agent 能力一致。例如 Claude 的 OpenAI SDK 兼容层明确列出 `response_format`、`seed`、`reasoning_effort` 和工具 `strict` 等被忽略；需要严格结构化输出时应使用对应原生能力。[Claude SDK compatibility](https://platform.claude.com/docs/en/cli-sdks-libraries/libraries/openai-sdk)

因此连接验证应按任务能力检查：简单文本返回、工具调用及结果回传、流式结束、图片输入、所需 JSON Schema 行为、用量统计、超时与取消。仅发送一句问候不足以证明这个连接能运行 Agent。不能把未支持参数被忽略后的结果当作同一实验条件。

被测 Agent、评分 Judge、检索或其他工具可以使用不同的服务和凭据。替换 Judge 连接只改变评分侧；用户 Key 必须实际覆盖相应服务，才能改变该部分的额度归属。

## 数据权限与额度仍由平台控制

有权使用某个 Key，只证明持有该服务的调用凭据，不证明有权把平台上的任意数据交给该端点。共享数据集、检索结果和附件进入模型前，还需要遵守数据访问范围和允许的目的地。

按凭据限制并发、请求速率、任务步数和调用量；平台的重试、子 Agent 循环与批量任务仍可能大量消耗用户额度。平台还承担 CPU、存储和其他工具调用的成本。OWASP 将数据外传和无界循环造成的费用消耗列为 Agent 风险，并建议限制工具权限和执行范围。[OWASP AI Agent Security](https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html)

API Key 失效、限流和 Judge 解析失败应分别报告，不能静默切换到另一个模型后沿用原模型名。评测的评分证据、实验条件和平台化边界见[让 Agent 评测结果值得相信](/knowledge/backend/trustworthy-agent-evaluation/)。
