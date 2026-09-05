---
title: 前端运行时与框架速记
navTitle: 前端快速复习
description: 按组件状态、构建加载、网络与实时性能整理前端运行时的易混边界。
kind: note
audience: 希望快速复习前端工程行为与诊断方法的开发者
lastVerified: "2026-09-06"
order: 4
---

这里仅记录框架、浏览器运行时和工程加载边界。纯 CSS 属性已经归入独立的 [CSS 主题](/knowledge/css/)，本地命令、进程和构建脚本归入 [工程工具与系统](/knowledge/tooling/)。

## 组件状态与数据边界

### 条件 class 的判断数据不必来自当前元素

动态 class 加在哪个元素上，与它应由哪个数据决定，是两个不同问题。样式可能施加在说明文字上，但触发原因来自相邻标题、父组件状态或整体布局模式。

- **记忆点**：先说明 class 的视觉意图，再选择判断条件；不要仅因为 class 加在某个节点上，就机械地改为读取该节点展示的数据。若代码容易误读，应把 predicate 或 class 命名成原因，例如 `should-align-with-heading`，而不是只描述目标元素。
- **来源**：[Vue Class 与 Style 绑定：对象值的真假决定 class 是否存在](https://vuejs.org/guide/essentials/class-and-style#binding-html-classes)。

### HTML 字符引用不在 `<style>` 中展开

`&#x20;` 在普通 HTML 文本或属性中解码为 U+0020 空格；`<style>` 是 raw text 元素，其中不能用 HTML 字符引用代替 CSS 语法空格。源码字符经过 HTML 解析、JSON 解析或框架模板转换后，CSS 只能处理最终进入 DOM 的真实字符。

- **来源**：[HTML Standard：数字字符引用](https://html.spec.whatwg.org/multipage/syntax.html#syntax-charref)与 [raw text 解析状态](https://html.spec.whatwg.org/multipage/parsing.html#parsing-main-inrawtext)。

## 构建与加载

### `astro dev` 与 `astro preview` 的内容来源不同

`astro dev` 运行开发服务器，监听 `src/` 并通过 HMR 更新页面；`astro preview` 只提供最近一次 `astro build` 生成的静态目录（默认 `dist/`），修改 Markdown 或源码后不会自动重新构建。

- **排查旧页面**：用 `lsof -nP -iTCP:<port> -sTCP:LISTEN` 找 PID，再用 `ps -p <pid> -o pid=,ppid=,lstart=,etime=,command=` 和 `lsof -a -p <pid> -d cwd` 确认命令、启动时间和工作目录；同时比较 `dist/` 与源文件时间，并直接请求新增路由验证。
- **记忆点**：本地 URL 能访问只证明端口仍有进程监听，不证明它读取的是最新源码。需要边编辑边看时运行 `astro dev`；需要验证生产构建时先 `astro build`，再运行 `astro preview`。
- **后台进程**：Astro 7 的 background 模式会把 PID、端口和日志写入 `.astro/dev.json` 或 `.astro/preview.json`；检测到 AI 编码代理时可能自动启用。原终端关闭后进程仍可存活，父 PID 可能变为 1，应结合监听端口和 JSON 中的 PID 判断，不能只看是否还有终端窗口。
- **来源**：[Astro CLI：dev、build、preview 与 background](https://docs.astro.build/en/reference/cli-reference/)；结论也由本地 Astro 7.2.9 进程命令、锁文件、构建时间和 HTTP 404 响应复核。

### `defineAsyncComponent` 与路由体积预算

异步组件被拆成独立 chunk，不等于它不属于页面首次进入成本；如果异步组件在父页面首帧就被渲染，Vue 会立即调用 loader 并下载该 chunk。

- **适合场景**：根据 Vite `manifest.json` 编写首屏或路由体积预算。
- **记忆点**：Vite manifest 分别记录静态 `imports` 和 `dynamicImports`。只遍历 `imports` 会漏掉首帧立即渲染的 `defineAsyncComponent`；递归计入所有 `dynamicImports` 又会把真正由点击等操作延迟的功能算进去。
- **验证方法**：预算配置显式标记“首帧必触发”的动态入口并纳入依赖闭包，再用冷缓存浏览器网络记录核对实际请求。是否属于首次成本取决于组件何时渲染，而不是只看它是否使用 `import()`。
- **来源**：[Vue 异步组件](https://vuejs.org/guide/components/async)、[Vite manifest 结构](https://vite.dev/guide/backend-integration.html)。

## 网络与实时性能

### 请求超时应按工作流设置

只有某个关键阶段需要避免无限等待时，应让请求层提供可选超时能力，并由该阶段显式传入；不要因此给所有请求增加同一个全局时限。

- **适合场景**：启动鉴权、健康检查等必须在有限时间内结束的流程，同时系统还包含同步、保存或其他可能合理耗时较长的请求。
- **记忆点**：超时时间属于工作流策略。全局默认值会扩大行为变化范围，让无关请求在慢网络下被提前取消；请求封装只负责组合调用方取消信号、可选计时器和稳定错误码。
- **验证方法**：分别覆盖显式超时会中止、调用方主动取消保持原语义、未传超时时不创建计时器三个测试。
- **来源**：通过 `AbortController`、假定时器和挂起请求的聚焦测试验证。

### 实时循环中的 AI rollout 必须有独立预算

在动画帧回调中同步执行前向推演、MCTS 或其他候选搜索时，最危险的不是平均 CPU 占用，而是某个决策帧一次性超过帧预算并阻塞主线程。

- **适合场景**：实时游戏、可视化模拟或交互式工具需要用多个候选动作 × 多个未来步长做决策。
- **记忆点**：计算量通常近似 `候选数 × 推演步数 × 单步状态成本`；难度若同时增加候选数和推演深度，会形成乘法增长。Web Worker 可以移走主线程卡顿，但不会减少总计算量；仍应使用简化预测模型、固定候选预算、缓存/复用缓冲区或跨帧分片。
- **验证方法**：用固定场景分别测量单步模拟、状态克隆和完整决策的耗时，并与目标刷新率的单帧预算比较；60 FPS 的理论预算约为 16.7 ms。一次聚焦微基准中，完整状态 rollout 随候选数和深度增长到数百至数千毫秒，证实渲染优化无法消除这种决策帧停顿。
- **来源**：通过固定输入的 TypeScript 聚焦微基准和实时循环源码路径验证。
