---
title: JSON Schema、Function Calling 与工具选择
description: 区分回答格式、工具参数和工具选择策略，理解结构化输出的兼容性与校验边界。
kind: explanation
audience: 接入模型 API 并希望理解结构化输出和工具调用差异的开发者
lastVerified: "2026-10-14"
order: 7
---

JSON Schema 是描述数据结构的规范。模型接口可以用它描述回答正文，也可以用它描述工具参数。SDK 中的 `jsonSchema` 与 `functionCalling` 通常代表两种输出策略，不能理解成“前者有 Schema，后者没有”。

本文使用 Chat Completions 风格字段；不同 Provider、接口和 SDK 的命名及默认值可能不同。LangChain 的接口将原生 Schema 输出、Function Calling 和 JSON Mode 分为不同方法。[LangChain withStructuredOutput](https://reference.langchain.com/javascript/langchain-openai/ChatOpenAI/withStructuredOutput)

## 分清三个控制点

| 字段 | 控制什么 |
| --- | --- |
| `tools` | 有哪些工具、每个工具做什么、接受什么参数 |
| `tool_choice` | 是否允许、要求或指定模型选择工具 |
| `response_format` | 最终回答采用什么数据格式 |

工具定义包括名称、描述及参数 Schema。模型根据用户问题和这些定义生成调用意图；应用收到调用后，才查找对应函数并执行。模型收到的是工具说明，不是自动获得本地函数的执行能力。[工具参数与选择策略](https://help.aliyun.com/zh/model-studio/qwen-api-via-openai-chat-completions/)

## jsonSchema 约束回答正文

以输出一个评价结果为例，下面定义字段结构：

```js
const resultSchema = {
  type: 'object',
  properties: {
    score: { type: 'number' },
    reason: { type: 'string' },
  },
  required: ['score', 'reason'],
  additionalProperties: false,
};
```

原生 Schema 输出把它放在回答格式中。下面是参数片段，省略模型、消息和客户端初始化；`strict` 的可用性须按服务端文档确认：

```js
response_format: {
  type: 'json_schema',
  json_schema: {
    name: 'result',
    schema: resultSchema,
    strict: true,
  },
}
```

结果通常位于回答正文 `message.content`，正文是一段 JSON 文本，例如 `{"score":0.8,"reason":"基本满足要求"}`。SDK 可以进一步解析成对象。此流程不需要虚构一个工具来承载结果。

`json_object`（JSON Mode）与 `json_schema` 也不同：前者要求合法 JSON，但不等于约束到指定字段结构；后者提交了具体 Schema，严格遵守程度还与服务端支持及严格模式有关。[结构化输出模式对比](https://help.aliyun.com/zh/model-studio/qwen-structured-output)

## functionCalling 约束工具参数

同一个 Schema 可以用于定义工具：

```js
tools: [{
  type: 'function',
  function: {
    name: 'submit_result',
    description: '提交评价结果',
    parameters: resultSchema,
  },
}],
tool_choice: {
  type: 'function',
  function: { name: 'submit_result' },
}
```

支持该选择方式的服务会要求模型输出指定工具调用。数据位于 `tool_calls[].function.arguments`，原始协议通常将 arguments 编码成 JSON 字符串。这里同样有 Schema，只是 Schema 作用于工具入参。

Function Calling 有两种常见用途：

- **实际工具执行**：模型请求 `get_weather({city: '上海'})`，应用执行查询，再将结果作为工具消息交回模型，模型继续回答。
- **结构化结果提取**：把最终数据定义成 `submit_result` 的参数，程序直接解析参数作为结果，不必真的执行一个提交函数，也不必多请求一次模型。

后一种用途解释了为什么某些结构化输出 SDK 会自动绑定一个工具并设置强制工具选择。工具结果回传是实际执行工具时的流程，不是所有结构化结果提取都必须进行的额外回合。[Function Calling 执行流程](https://help.aliyun.com/zh/model-studio/qwen-function-calling)

## 没有 tool_choice，为什么仍能选择工具

前提是请求已经提供 `tools`，并且该接口默认采用自动选择。省略可选字段时使用服务端默认策略，不等于禁用工具。

| 策略 | 含义（具体支持范围按接口确认） |
| --- | --- |
| 省略或 `auto` | 在默认值为 auto 的接口中，由模型决定直接回答或发出工具调用 |
| `none` | 不选择工具 |
| `required` | 要求至少调用一个工具，不指定具体工具 |
| 指定工具对象 | 要求使用给定工具 |

例如提供天气查询工具后，“上海现在下雨吗”可能产生天气查询调用；“你好”可能直接得到文字回复。判断依据来自工具描述、参数定义、用户输入和对话上下文，`tool_choice` 只改变选择规则。自动选择不保证选对工具，也不保证一定调用。

例如千问兼容接口明确以 `auto` 为默认；其部分 thinking 模式限制强制选择。因此，自主调用成功不能证明 `required` 或指定工具也可用。[默认值与模式限制](https://help.aliyun.com/zh/model-studio/qwen-api-via-openai-chat-completions/)

## 为什么不能未经验证就统一使用 jsonSchema

对于只需要最终数据对象的任务，若所有目标推理点都支持原生 Schema，统一这一路径可以简化实现。但“支持文本对话”“支持工具调用”“支持原生 Schema”“支持严格工具参数”是不同能力。

还要检查实际 Schema 是否落在服务端支持的子集内：对象根类型、必填字段、额外字段、联合类型、引用和数值限制等都可能影响兼容性。服务商的模型名单和 Schema 限制应分别确认；同名模型通过不同网关访问，也不能直接推断能力一致。[支持范围与关键字限制](https://help.aliyun.com/zh/model-studio/qwen-structured-output)

原生回答格式也不会代替真实外部查询或操作。Agent 需要工具时，仍需工具定义、调用分发和结果回传；如果接口支持，两种能力可以组合为“先使用工具，再生成结构化最终答案”。

适配表记录现有策略，不是模型能力的完整证明。验证一个模型后可以收敛其策略，但不应因一个推理点报错而把所有模型改成提示词 JSON。协议兼容的更大边界见[模型接入边界](/knowledge/backend/byok-model-integration/)。

## 原生约束与本地校验负责不同问题

服务端严格模式在其支持范围内约束输出结构；本地解析器检查最终收到的数据，两者可以同时存在。只看 `method: 'jsonSchema'`，不能推断 SDK 已显式发送 `strict: true`；须核对实际请求和服务端默认值。

Zod 的 `.strict()` 用于本地对象未知字段校验，与请求中的 `json_schema.strict` 不是同一个开关。SDK 可以从 Zod 生成 Schema，但本地声明不能代替确认服务端的严格模式配置。

结构符合 Schema 也不等于内容正确：合法的数字可以是错误评分，合法字符串可以包含错误事实。字段结构由解析和 Schema 校验负责，事实准确性、标识是否与本次输入对应、跨字段关系等仍需应用检查。处理响应时也要区分正常完成与截断、拒绝或请求失败。

本文示例用于说明协议形状，不宣称已对所有模型或网关执行验证。
