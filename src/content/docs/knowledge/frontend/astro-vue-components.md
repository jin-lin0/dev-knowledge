---
title: Astro 渲染模型与 Vue 交互岛
description: 理解 Astro 如何生成 HTML，以及 Vue 组件何时成为浏览器中的交互岛。
kind: explanation
audience: 熟悉 HTML 和 Vue、正在学习 Astro 的前端开发者
lastVerified: "2026-08-31"
order: 1
---

在 Astro 项目中，`.astro` 和 `.vue` 都能描述组件，但文件后缀并不是最重要的区别。真正决定页面成本和交互方式的是：组件在哪个阶段执行，以及浏览器是否需要继续运行它的 JavaScript。

## 先建立渲染模型

Astro 默认把尽可能多的工作放在构建阶段或服务端，只把最终 HTML 发给浏览器。需要持续响应用户操作的区域，再作为独立的客户端交互岛加载 JavaScript。

```text
构建或页面请求
      ↓
Astro 执行 .astro 组件和框架组件
      ↓
生成 HTML ─────────────────────→ 浏览器直接显示内容
      │
      └─ 组件带 client:* 指令 → 下载组件与框架代码 → 水合为交互岛
```

“水合”指浏览器在服务端生成的 HTML 上连接事件处理和响应式状态，使静态标记变成可以持续更新的组件。

## `.astro` 组件负责什么

`.astro` 是 Astro 的模板组件。`---` 之间的组件脚本用于导入模块、读取属性、获取数据和准备模板变量；它在构建时或按需渲染时执行，不会作为组件运行时代码发送到浏览器。Astro 官方文档因此把 `.astro` 描述为没有客户端运行时的 HTML 模板组件：[Astro components](https://docs.astro.build/en/basics/astro-components/)。

```astro
---
const { title } = Astro.props;
const publishedAt = new Date('2026-08-31');
---

<article>
  <h1>{title}</h1>
  <time datetime={publishedAt.toISOString()}>
    {publishedAt.toLocaleDateString('zh-CN')}
  </time>
</article>
```

模板中的值可以动态生成，但它们只参与这一次渲染。页面到达浏览器后，修改一个同名 JavaScript 变量不会让这段 HTML 自动更新。若 `.astro` 组件确实需要少量浏览器行为，可以添加普通 `<script>`；它仍不会因此获得 Vue 的组件生命周期和响应式系统。

## `.vue` 组件在 Astro 中经历什么

Vue 单文件组件把模板、逻辑和样式组合在一个文件中，由 Vue 编译工具处理。它具备响应式状态、组件生命周期和事件系统，但是否在浏览器运行仍由宿主环境决定，而不是由 `.vue` 后缀单独决定。[Vue SFC 文档](https://vuejs.org/guide/scaling-up/sfc)说明了单文件组件的编译模型。

Astro 安装 Vue 集成后，可以在 `.astro` 文件中直接导入 Vue 组件：

```astro
---
import Counter from '../components/Counter.vue';
---

<Counter />
<Counter client:load />
```

两次使用的行为不同：

- `<Counter />` 在构建阶段或服务端渲染成 HTML，但不向浏览器发送 Vue 组件代码，因此按钮等交互不会工作。
- `<Counter client:load />` 先生成 HTML，再在页面加载时下载 Vue 运行时和组件代码并完成水合。

Astro 的框架组件文档明确说明：不带 `client:*` 指令时，框架组件默认只生成静态 HTML；添加指令才会把组件 JavaScript 发送到浏览器：[Front-end frameworks](https://docs.astro.build/en/guides/framework-components/)。

常用指令表达的是“何时值得支付客户端成本”：

| 指令 | 启用交互的时机 | 适合场景 |
| --- | --- | --- |
| `client:load` | 页面加载时立即水合 | 首屏就必须可用的按钮、菜单 |
| `client:idle` | 浏览器空闲时水合 | 优先级较低的交互区域 |
| `client:visible` | 组件进入视口时水合 | 页面下方的图表、评论或工具 |
| `client:media` | 指定媒体查询匹配时水合 | 只在特定屏幕条件下使用的交互 |

完整语义和限制应查阅 [Astro 模板指令参考](https://docs.astro.build/en/reference/directives-reference/)，而不是把这张选择表当成 API 参考。

## 为什么这通常有利于内容站性能

文档、博客和营销页面的大部分内容只需要被阅读，不需要一个框架在浏览器中持续管理。如果这些区域由 `.astro` 输出为 HTML，浏览器就不必为它们下载、解析和执行组件运行时，也不需要执行水合。

这是一种默认策略优势，而不是性能保证。以下内容仍然可能让 Astro 页面变慢：

- 体积过大的图片、字体和 CSS。
- 数量过多或加载过早的客户端交互岛。
- 分析、广告和其他第三方脚本。
- 低效的数据请求、服务端渲染或缓存策略。

Vue 也可以通过服务端渲染或静态生成得到高性能页面；Astro 的区别是它默认不把整个页面变成客户端应用，让“哪些区域需要 JavaScript”成为显式选择。

## 如何选择组件类型

| 需求 | 优先选择 | 原因 |
| --- | --- | --- |
| 页面布局、文章正文、SEO 元信息 | `.astro` | 渲染后不需要持续状态 |
| 构建时读取内容或服务端获取数据 | `.astro` | 逻辑不必进入浏览器 |
| 表单联动、复杂筛选、弹窗状态 | `.vue` + 合适的 `client:*` | 需要响应式状态和事件生命周期 |
| 只需一次点击或 DOM 切换 | `.astro` + 小型 `<script>` 也可考虑 | 不一定值得引入完整框架运行时 |
| 已有成熟 Vue 组件 | `.vue` | 可以复用组件，并由 Astro 控制水合时机 |

判断标准不是“静态页面全部用 Astro，动态页面全部用 Vue”，而是把页面切成区域，逐个判断浏览器是否必须持续运行组件逻辑。

## 容易混淆的边界

### `.astro` 不等于页面完全没有 JavaScript

Astro 组件默认不带客户端运行时，但页面仍可以包含普通脚本、Web Components 或带 `client:*` 的框架组件。

### `.vue` 不等于一定发送 Vue 到浏览器

在 Astro 中，不带客户端指令的 Vue 组件只参与服务端或构建时渲染。在 Vue SPA、Nuxt 或其他宿主环境中，同一个 `.vue` 文件可能有不同的执行方式。

### Astro 不是 Vue 的同类替代品

Astro 主要决定页面如何组合和交付；Vue 提供客户端组件模型。内容型项目经常让 Astro 负责页面骨架，让 Vue 只负责真正需要交互的区域。

## 如何验证项目中的实际行为

不要只根据文件后缀推断最终产物。可以用一个纯 Astro 组件、一个无指令 Vue 组件和一个带 `client:load` 的 Vue 组件做对照：

1. 运行生产构建并打开生成页面。
2. 在浏览器网络面板中筛选 JavaScript，比较三个区域引入的资源。
3. 禁用 JavaScript 后刷新：静态内容应保留，依赖水合的交互应停止工作。
4. 将 `client:load` 改为 `client:visible`，确认组件进入视口前不会开始水合。

这个实验验证的是当前项目、集成版本和构建配置的真实结果，也能暴露第三方脚本或其他组件带来的额外成本。
