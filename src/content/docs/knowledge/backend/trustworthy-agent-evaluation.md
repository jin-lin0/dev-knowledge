---
title: 让 Agent 评测结果值得相信
description: 从执行状态、评分证据、多次 Trial、实验指纹和持久化边界检查 Agent 评测框架。
kind: explanation
audience: 设计或评审 LLM Agent 离线评测框架的开发者
lastVerified: "2026-08-31"
order: 4
---

Agent 评测框架最危险的失败不是“跑不起来”，而是顺利产出一个看似精确、实际不可比较的分数。可信框架至少要把以下对象分开：

```text
冻结 Dataset / Fixture
→ 被测 Agent 与隔离 Environment
→ Trial 的 Outcome + Trajectory
→ 确定性 / 模型 / 人工 Grader
→ Experiment 聚合与比较
```

Anthropic 将 task、trial、grader、transcript、outcome 和 harness 分开定义，并强调 Agent 声称完成不等于环境中的目标状态真的成立。[Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)

## 执行状态和质量结论必须正交

一次 Trial 至少要区分：

| 执行状态 | 含义 | 是否进入质量统计 |
| --- | --- | --- |
| `completed` | 被测流程完整结束 | 是 |
| `model_error` | 模型输出或协议不成立 | 通常作为质量失败 |
| `infra_error` | 网络、依赖、环境或能力装配失败 | 否 |
| `grader_error` | 阅卷流程失败 | 否 |
| `timeout` | Trial 超过截止时间 | 单独统计，不能冒充取消 |
| `cancelled` | 用户或上层任务主动中止 | 否 |

超时和取消不能共用“signal 已 aborted”这一条判断。应分别保留 timeout controller 与 outer cancellation，并用硬截止包装 Trial；`AbortSignal` 只提供协作式取消，被调代码忽略 signal 时不会自动停止 Promise。超过截止时间的迟到成功也不能继续评分。

聚合结果同时报告 attempted、valid、timeout、infra error 和 cancelled。否则一个全部超时、但 infra error 计数为零的实验可能被错误标记为“有效”。

## 先验证 Outcome，再限制路径

工具 Agent 可能通过不同合法路径完成同一目标。优先检查最终业务状态，只把权限、安全和不可绕过的流程约束写成 trajectory/tool policy。τ-bench 也通过对话结束后的数据库状态与目标状态比较来判断成功。[τ-bench](https://arxiv.org/abs/2406.12045)

评测保真问题应优先在 Target、Environment 或评测专用 adapter 中解决，不能为了让测试通过而直接改变生产行为。若评测与生产确实需要共享 parser 或执行语义，应把它抽成双方复用、可独立测试的纯契约层，并把生产迁移作为单独评审，而不是隐藏在评测改造中。

Fixture 使用 YAML 还是 JSON 与环境保真是两个问题。人工拼出的“看起来像生产 Schema”的最小对象适合协议单测，但不能代表真实页面分布；生产回归 Fixture 应来自真实对象导出，经过脱敏、人工审核和版本冻结，并记录来源 Schema 与组件目录版本。深层机器快照通常更适合 JSON，Case/Suite 等人工规则则可以继续使用 YAML。Target 回写给生产 Graph 的 diff、resume state 等中间协议也必须做 conformance test；最终页面相似并不能证明中间协议兼容。

工具策略还要区分“尝试调用”和“成功完成”：

- 禁止工具：开始调用就应记录违规。
- 必需工具：只有匹配名称、参数要求且成功结束才算满足。
- 最终结果依赖工具返回值时，Grader 必须看到经过裁剪和脱敏的输出证据，不能只看到工具名。

能由代码确定的事实优先使用确定性 Grader。开放式质量再交给 LLM Judge，并为 Judge 提供 reference facts、Outcome、必要的工具结果和“不足以判断”出口。模型评分具有非确定性，需要定期与领域专家标注校准；Anthropic 同样建议组合代码、模型和人工评分，并校准 LLM-as-judge。

分层权重必须保持语义稳定。若 Criterion 权重为 `w`，多个 Dimension 的权重应先在 Criterion 内归一化；不能简单为每个 Dimension 都乘 `w`，否则增加维度数量会悄悄放大整个 Criterion 的总权重。

平均分也必须写清聚合层级。单次 Trial 常用 `Σ(value × weight) / Σ(weight)`；跨 Trial、跨 Case 时要明确是“每个 Trial 等权”“每个 Case 等权”还是使用业务 Case 权重。Case 的 repetitions 不一致时，直接平均所有 Trial 会让 Trial 更多的 Case 获得更大隐含权重。required 维度失败通常还应独立触发 Trial fail，不能被其他高分抵消；质量门禁也不应只看一个平均分。

## 多次 Trial 的默认值属于评测标准

LLM 和 Agent 输出具有随机性。LangSmith 的 repetition 文档也明确把多次运行用于降低高变异系统的噪声，并展示均值和标准差。[Evaluate with repetitions](https://docs.langchain.com/langsmith/repetition)

常见指标回答不同问题：

- `pass@1`：第一次尝试的默认体验。
- `pass@k`：k 次中至少一次成功，表示“是否有能力做到”。
- `pass^k`：k 次全部成功，表示“是否稳定可靠”。
- per-case success rate：该任务的经验成功率。

Suite 声明的 repetitions 是考试标准的一部分。CLI 或 UI 若无意中固定发送 `1`，会把 reliability 回归静默降成 one-shot 测试。界面应继承 Suite 默认值，只在用户明确修改后发送覆盖值，并展示预计 Trial 数、模型调用量和成本。

第一次验证 Harness 时可以维护一个独立的 minimal/sanity Suite：1 个无副作用 Case、1 个 Trial、只使用确定性 Outcome 或 Tool Policy，不调用 Judge。它仍应运行真实 Target，但能用最低成本区分“生产 Graph/模型链路不通”和“Rubric/Judge 配置有问题”。通过后再运行含 Judge 的 smoke 与多 Trial regression。

## YAML 和 JSON 是编写体验选择，不是可信边界

人工维护的 Case 常包含长 Prompt、多行 reference facts 和嵌套评分条件。YAML 标点少、支持多行块和注释，代码评审时通常更容易阅读；JSON 语法更严格、生态统一，更适合程序生成、CI 交换和最终报告。

两者不应形成两套领域协议。合理实现是：加载层同时接受需要的文本格式，解析后立即进入同一套 runtime schema 和语义校验；hash 也基于规范化后的领域对象生成。评测可信度来自严格 Schema、引用检查和可复现指纹，而不是文件扩展名。

YAML 作为输入时仍要注意缩进和隐式标量解析，避免依赖容易歧义的裸值。尤其是 plain scalar 中空格后的 `#` 会开始注释：`input: 改成 #FFF` 的值可能只剩“改成”。Prompt、颜色值和 reference fact 包含 `#` 时应加引号或使用 `|` block；加载器可以拒绝带行内注释的 plain scalar，防止内容被静默截断。JSON 作为人工输入时则要接受更多引号、逗号和多行字符串转义。机器生成的 Experiment 报告通常优先 JSON，减少下游工具的解析差异。

本地离线评测资产通常也不应进入生产部署包。生产构建 smoke 可以验证被测 Graph 的编译产物能加载，但 Dataset、Case 和 Fixture 仍由本地 CLI 从源码资产目录读取；把它们复制进 dist 只会增加包体、扩大信息暴露面，并制造线上运行依赖的错觉。

未发布且可以直接删除的本地调试报告不需要历史兼容层。字段、渲染方式或本地目录仍在快速迭代时，优先清理旧产物并保持单一路径；只有协议已经发布、持久化数据无法迁移，或存在明确外部消费者时，才为旧版本增加解析、推断或动态转换。否则“临时兼容”会持续增加分支、测试面和认知成本。

## 本地报告要区分机器身份和人类入口

随机 UUID 适合作为 Experiment 的稳定机器标识，却不适合作为唯一目录展示名。输出目录可以使用 `时间_场景_Suite_模型_短ID` 这类可排序且可检索的名称，同时在 Manifest 内保留完整 ID；不要强迫目录名同时承担所有身份语义。

报告文件也要按读者分层：Manifest 回答“测了什么”，Summary 回答“结果怎样”，逐 Trial 文件保存重证据。若再提供包含全部对象的单文件快照，应明确它服务于传输、compare/export 或归档，并接受与拆分文件的有意冗余。面向人阅读时，可以额外生成 `report.md`/HTML，避免让使用者从多个 JSON 中自行拼装结论。

静态 HTML 会展示模型输出和工具证据，因此必须把所有动态值当作不可信文本做 HTML 转义，最好配合拒绝脚本和网络资源的 CSP，不直接把原始输出拼成可执行标签。CLI 可以在本地交互式终端自动打开报告，但 CI/非交互环境应只生成文件，并允许显式关闭；浏览器打开失败也不应把已经成功的评测改判为失败。

## 比较门槛要覆盖所有会改变结果的条件

可比较性检查至少包含：

- Dataset、Case 选择和 Fixture 的内容 hash。
- Grader 实现/版本、Judge 模型、参数和 prompt hash。
- Target adapter、Graph contract、工具/能力快照和隔离环境版本。
- timeout、resume/step 上限、Trial 数及影响结果的并发策略。
- 可恢复的代码或构建产物标识；仅记录 `gitDirty: true` 不能重建未提交代码。

版本化资产的 Schema 也属于可信边界：顶层和嵌套对象应拒绝未知字段，避免拼错字段后被静默删除并回退默认值；同时在运行前校验 ID 唯一性、长度、引用完整性和持久化约束。Grader 输出同样要做 runtime validation，required score 必须显式给出通过结论，数值与权重必须为有限合法值。

Suite 可以用 Glob 降低持续添加 Case 的维护成本，但 Glob 会让成员集合随目录内容自动变化。可靠实现应限定搜索根目录和扩展名、拒绝路径逃逸、稳定排序、拒绝空匹配与重复命中，并把展开后的相对路径和内容写入 Dataset Hash。小型 smoke/sanity 集合适合显式文件列表；不断增长的 regression 集合更适合显式 Glob，并用 exclude 排除草稿或其他分组。

被测模型或被测实现可以不同，因为这正是比较对象；其余考试条件应固定或显式声明实验目的。只给 adapter 写一个手工版本号、只 hash `{id, contract}`，都依赖维护者永不忘记 bump，不能称为自动可复现。

比较少量随机 Trial 时，不要把任意非零 delta 直接宣称为稳定回归。至少展示样本数和逐 Trial 结果；更成熟的系统再加入配对设计、置信区间或 bootstrap。

## 先证明评测内核，再决定是否平台化

评测的最小闭环是 Dataset → Target → Trial → Grader → 本地不可变报告。它本身不要求 Web 页面、HTTP API、数据库、队列或事务。早期先用 CLI 和本地产物验证 Case 是否有效、评分是否可信、真实 Graph 是否能运行，可以显著缩小问题空间，也不会向共享存储写入试验数据。

只有出现多人共享历史、集中调度、超长任务恢复、权限审计或统一配额等明确需求时，才需要增加平台层。平台层应作为 Runner 外部适配器，消费和产出同一份 Experiment 协议，不能把队列与数据库字段反向塞进评测领域模型。

## 选择长任务平台后才需要数据库级正确性

工作台把评测变成长任务后，还要补齐普通 Runner 不负责的边界：

- 幂等重放返回同一个 canonical experiment/job ID；随机 ID 不能进入幂等 request hash。
- 进度包含 attempt + 单调 sequence，并用 CAS/条件写避免并发完成导致百分比倒退。
- cancellation 后停止领取新 work item，而不是把剩余队列逐个变成 cancelled Trial。
- Trial 完成后分批、幂等持久化；不要等整个实验结束才一次保存所有结果。
- checkpoint、trajectory 和完整页面/工具证据设置大小上限、脱敏与生命周期。
- 详情列表只返回轻量摘要，单个 Trial 的重证据按需加载。

应用运行账号即使名称包含 `rw`，也可能只允许对既有表执行 DML，而没有 `CREATE/ALTER` 权限。部署前应先用只读方式确认目标 schema、目标表是否存在和 `SHOW GRANTS`，再由独立迁移身份或数据库变更平台执行 DDL。不要打开 ORM `synchronize` 来绕过权限；MySQL DDL 通常会隐式提交，分多条建表时还要在失败后检查是否留下部分状态。

共享 Job 表中的 tenant/job type 只能提供逻辑隔离，不能提供物理零污染。复用前必须确认完成记录的 retention/cleanup；如果框架只清理锁、不删除终态 Job，评测记录会永久积累。对短期开发可优先使用 CLI + 本地产物；必须有工作台时，再在“共享表 + 明确保留策略”和“专用 Job 表/Schema”之间做显式架构决定。

## 最小验收清单

发布前至少验证：

1. 从生产构建产物启动并真正解析/加载被测 Target，不能只在 ts-node/Jest alias 环境测试。
2. 超时、用户取消、基础设施错误和 Grader 错误分别落入正确状态。
3. 必需工具调用失败时不会被判为满足。
4. 更换 timeout、resume 上限或 Judge 后，比较会被拒绝。
5. Suite 默认 repetitions 能从资产贯穿 CLI 和 Runner。
6. 本地报告使用不可覆盖的实验目录，并能直接用于 compare/export。
7. 定期抽样阅读失败 trajectory，确认失败来自 Agent 而不是任务、环境或 Grader 缺陷。

如果已经选择平台化，再额外验证幂等键、进度单调性、旧 attempt fencing、增量持久化、证据分页和 retention；这些不是 CLI-only 第一版的发布前提。

LangSmith 将 Dataset、Experiment、Trace 和 Evaluator 分层，并把生产问题回流为离线 Dataset，适合作为持续维护的心智模型参考。[Evaluation concepts](https://docs.langchain.com/langsmith/evaluation-concepts)
