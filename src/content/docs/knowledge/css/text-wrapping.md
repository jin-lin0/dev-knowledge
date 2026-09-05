---
title: CSS 文本空白、断行与省略
navTitle: 文本空白、断行与省略
description: 系统区分 white-space、break-spaces、overflow-wrap、word-break、hyphens 与文本省略。
kind: reference
audience: 经常处理用户文本、长链接、CJK 排版和文本省略的前端开发者
lastVerified: "2026-09-06"
order: 2
---

文本“为什么不换行”或“为什么空格消失”通常不是一个开关能回答的。先把问题拆成四层：

1. 源码空格、Tab 和换行是否保留。
2. 哪些位置本来就是合法的软换行点。
3. 没有合法换行点时是否允许紧急断行。
4. 超出指定行数后是否裁切或显示省略号。

## `white-space` 的六个经典值

`white-space` 同时控制空白折叠和软换行。`<br>` 以及被保留的源码换行属于强制换行，不要和容器变窄时产生的软换行混为一谈。

| 值 | 源码换行 | 连续空格、Tab | 自动折行 | 典型用途 |
| --- | --- | --- | --- | --- |
| `normal` | 折叠 | 折叠 | 允许 | 普通正文，默认值 |
| `nowrap` | 折叠 | 折叠 | 禁止 | 单行标题、按钮 |
| `pre` | 保留 | 保留 | 禁止 | 完整模拟 `<pre>` 的预格式文本 |
| `pre-wrap` | 保留 | 保留 | 允许 | 保留用户排版，又要适应容器宽度 |
| `pre-line` | 保留 | 折叠 | 允许 | 只尊重人工换行，不保留对齐用空格 |
| `break-spaces` | 保留 | 保留 | 允许 | 空格本身必须完整参与布局和逐个换行 |

来源：[CSS Text Level 3 的 `white-space` 定义与行为表](https://www.w3.org/TR/css-text-3/#white-space-property)。

## `break-spaces` 不只是另一种 `pre-wrap`

二者都保留空格、Tab 和源码换行，也都允许自动折行。真正的区别是保留的空白如何参与断行和尺寸计算：

- `pre-wrap` 在一整段连续空格或 Tab 的末尾提供软换行机会；行尾空格可以“悬挂”到行框外，不阻碍正文贴齐行尾。
- `break-spaces` 在每一个被保留的空格或 Tab 之后都提供软换行机会，连续空格因此可以分散到多行。
- `break-spaces` 的行尾空格像其他可见字符一样占宽度，不能悬挂，也不能压缩推进宽度；它们会影响固有尺寸，并可能制造看似空白的新行或溢出。
- `break-spaces` 不会拆分完全没有空白的长单词或 URL，也不把 U+00A0 不换行空格变成普通断行点。
- 容器窄到连单个空格自身都放不下时仍可能溢出；Tab 的实际推进宽度仍由 `tab-size` 控制。

```css
.verbatim-message {
  white-space: break-spaces;
  overflow-wrap: anywhere;
  tab-size: 4;
}
```

来源：[CSS Text Level 3 的 `break-spaces` 规则](https://www.w3.org/TR/css-text-3/#valdef-white-space-break-spaces)、[CSS Text Level 4 的空白处理模型](https://www.w3.org/TR/css-text-4/#white-space-processing)。

## Level 4 把 `white-space` 拆成三个方向

现代规范将 `white-space` 定义为三个长属性的简写：

| 长属性 | 负责什么 | 关键值 |
| --- | --- | --- |
| `white-space-collapse` | 空白怎样折叠或保留 | `collapse`、`preserve`、`preserve-breaks`、`preserve-spaces`、`break-spaces` |
| `text-wrap-mode` | 是否允许软换行 | `wrap`、`nowrap` |
| `white-space-trim` | 是否裁掉元素边界处空白 | `none`、`discard-before`、`discard-after`、`discard-inner` |

经典值可以理解为以下组合，`white-space-trim` 均为默认的 `none`：

| `white-space` | `white-space-collapse` | `text-wrap-mode` |
| --- | --- | --- |
| `normal` | `collapse` | `wrap` |
| `nowrap` | `collapse` | `nowrap` |
| `pre` | `preserve` | `nowrap` |
| `pre-wrap` | `preserve` | `wrap` |
| `pre-line` | `preserve-breaks` | `wrap` |
| `break-spaces` | `break-spaces` | `wrap` |

Level 4 的拆分语法仍在演进，尤其 `discard`、`preserve-spaces` 和 trim 组合不应在未验证目标浏览器时作为基础能力。来源：[CSS Text Level 4 的 `white-space` 简写](https://www.w3.org/TR/css-text-4/#white-space-property)。

## `overflow-wrap`、`word-break` 和 `line-break` 各管一层

| 属性 | 它回答的问题 | 常用选择 |
| --- | --- | --- |
| `overflow-wrap` | 单词或 URL 太长、正常换行点仍不够时怎么办 | `anywhere` 作为防溢出兜底 |
| `word-break` | 哪些字符之间可以被视为单词内部断点 | CJK 用 `keep-all`；极端窄布局才考虑 `break-all` |
| `line-break` | 东亚文字标点等排版规则使用多严格 | `auto`、`loose`、`normal`、`strict` |
| `hyphens` | 单词是否允许按语言规则加连字符断开 | 正文可用 `auto`，同时提供正确 `lang` |

### `overflow-wrap: anywhere`

它只在内容本来无法换行并将溢出时增加任意字符间的软换行机会，适合用户输入、哈希、长 URL。与旧值 `break-word` 的重要尺寸差异是：`anywhere` 引入的换行机会会参与 `min-content` 尺寸计算，而 `break-word` 不参与。

```css
.untrusted-text {
  overflow-wrap: anywhere;
}
```

### `word-break: keep-all`

`keep-all` 抑制中日韩文字字符之间通常存在的断行机会，非 CJK 文本基本按 `normal` 处理。它不会取消空白、标点、`<wbr>` 或强制换行产生的断点，因此不等于 `nowrap`。

`break-all` 则更激进，允许在单词内部断开。它可能明显损害可读性，不应该只因为某个 URL 溢出就全局使用；长字符串兜底优先考虑 `overflow-wrap: anywhere`。

### `hyphens: auto` 依赖语言

浏览器需要知道文本语言才能选择正确断词词典和连字符规则：

```html
<article lang="en" class="prose">...</article>
```

```css
.prose {
  hyphens: auto;
}
```

来源：[CSS Text Level 3 的 `overflow-wrap`](https://www.w3.org/TR/css-text-3/#overflow-wrap-property)、[`word-break`](https://www.w3.org/TR/css-text-3/#word-break-property)、[`line-break`](https://www.w3.org/TR/css-text-3/#line-break-property) 与 [`hyphens`](https://www.w3.org/TR/css-text-3/#hyphenation)。

## 标题与正文的换行质量

`text-wrap` 不负责创造新的断行点，而是在已有断行点中选择更好的组合：

```css
h1,
.caption {
  text-wrap: balance;
}

.article-body {
  text-wrap: pretty;
}
```

- `balance` 倾向让标题、图注的各行长度更均衡。
- `pretty` 允许浏览器为正文花更多代价寻找更好的换行结果。
- `stable` 面向正在编辑或可能编辑的内容，尽量避免前面各行因追加文字而重新排版。

这些值属于 Level 4 能力，应作为渐进增强，并在目标浏览器验证。来源：[CSS Text Level 4 的 `text-wrap-style`](https://www.w3.org/TR/css-text-4/#text-wrap-style)。

## 单行与多行省略不是同一件事

单行省略需要三个条件共同成立：禁止换行、产生溢出、对溢出显示省略号。

```css
.one-line {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
```

多行裁切使用 `line-clamp`；需要兼容旧 WebView 时，通常保留历史的 WebKit 组合：

```css
.two-lines {
  display: -webkit-box;
  overflow: hidden;
  white-space: normal;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
```

只删除 `white-space: nowrap` 会恢复不限行换行，并不会自动变成“两行省略”。如果标题同时是 Flex/Grid 子项，还要检查自动最小尺寸是否阻止它收缩。来源：[CSS Overflow Level 4 的 `line-clamp` 和兼容语法](https://www.w3.org/TR/css-overflow-4/#propdef-line-clamp)。

## 几个很实用但容易漏掉的文字属性

### `hanging-punctuation: first`

允许开头引号、括号等标点悬挂到行框外，使正文笔画更容易与下方文本的左边缘对齐。它调整的是标点排版，不应该通过给所有后续兄弟元素增加左边距来模拟。

这是适合渐进增强的排版能力，使用前需要验证目标浏览器；不支持时应退化为标点不悬挂，而不是依赖会破坏多行对齐的整体位移。

### `text-underline-offset` 与 `text-decoration-thickness`

链接下划线离字形太近或粗细不协调时，可以分别控制偏移和厚度：

```css
a {
  text-decoration-thickness: 0.08em;
  text-underline-offset: 0.18em;
  text-decoration-skip-ink: auto;
}
```

`text-decoration-skip-ink` 决定下划线穿过字形笔画时是否避开字形；CJK 文本是否适合避让需要结合字体和实际效果判断。

来源：[CSS Text Level 3 的 `hanging-punctuation`](https://www.w3.org/TR/css-text-3/#hanging-punctuation-property)、[CSS Text Decoration Level 4](https://www.w3.org/TR/css-text-decor-4/)。

## 数据边界：CSS 只能处理真实字符

- JSON 字符串中的 `\n` 经解析后成为真实换行字符，配合 `pre-line`、`pre-wrap` 或 `break-spaces` 才能产生换行。
- 如果接口实际返回两个可见字符 `\\` 和 `n`，CSS 无法把它们识别成换行；应优先修正协议，兼容旧数据时在数据归一化层集中转换。
- HTML 字符引用和 `<style>` raw text 的解析边界见[前端运行时与框架速记](/knowledge/frontend/quick-notes/)，不要把 HTML 解析规则误当成 CSS 空白处理。
- 展示普通用户文本继续使用框架的文本插值；不要为了支持换行改用不安全的 HTML 注入。

来源：[HTML Standard 的数字字符引用](https://html.spec.whatwg.org/multipage/syntax.html#syntax-charref)、[HTML raw text 元素解析规则](https://html.spec.whatwg.org/multipage/parsing.html#parsing-main-inrawtext)、[Vue 安全指南](https://vuejs.org/guide/best-practices/security)。

## 快速选择

- 普通正文：`white-space: normal`。
- 单行不折行：`nowrap`。
- 完整预格式文本：`pre`。
- 保留用户排版且适应宽度：`pre-wrap`。
- 只保留人工换行：`pre-line`。
- 连行尾空格都必须精确参与布局：`break-spaces`。
- 长 URL 或不可控字符串兜底：额外加 `overflow-wrap: anywhere`。
- CJK 词组不希望任意拆开：按语言场景评估 `word-break: keep-all`。
