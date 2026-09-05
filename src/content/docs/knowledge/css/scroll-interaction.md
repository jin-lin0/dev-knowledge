---
title: CSS 滚动、命中与原生交互
navTitle: 滚动、命中与原生交互
description: 区分裁切、滚动容器、定位补偿、滚动链、触摸手势、命中测试和文本选择。
kind: reference
audience: 正在实现弹层、锚点导航、触摸交互或自定义控件的前端开发者
lastVerified: "2026-09-06"
order: 4
---

滚动类问题常同时涉及四个对象：谁裁切内容、谁是真正的滚动容器、滚动到哪里算“可见”、输入事件由浏览器还是应用处理。先找对对象，再设置属性。

## `overflow: hidden` 与 `overflow: clip` 不等价

| 值 | 裁切 | 是滚动容器 | 可通过脚本滚动 |
| --- | --- | --- | --- |
| `hidden` | 是 | 是 | 是 |
| `clip` | 是 | 否 | 否 |

`hidden` 隐藏滚动 UI，但 `scrollTop`、`scrollTo()`、焦点滚入等机制仍能改变它的滚动位置。`clip` 禁止所有滚动机制，也不会单独建立新的格式化上下文；需要格式化上下文时可组合 `display: flow-root`。

```css
.pure-clip {
  overflow: clip;
  overflow-clip-margin: 0.5rem;
}
```

`overflow-clip-margin` 可以把裁切边界向外扩一小段，适合保留阴影或发光效果，但它不会把元素变成滚动容器。

来源：[CSS Overflow Level 3 的 `overflow`](https://www.w3.org/TR/css-overflow-3/#overflow-properties)与 [`overflow-clip-margin`](https://www.w3.org/TR/css-overflow-3/#overflow-clip-margin)。

## `scroll-padding` 设在容器，`scroll-margin` 设在目标

固定头部遮住锚点时不要给每次滚动写 JS 偏移：

```css
html {
  scroll-padding-block-start: 4rem;
}

.section-heading {
  scroll-margin-block-start: 1rem;
}
```

- `scroll-padding` 缩小滚动容器的最佳可视区域，表达“这个容器边缘需要保留多少空间”。
- `scroll-margin` 扩大目标元素用于滚入视图和 Scroll Snap 的区域，表达“这个目标希望离边缘多远”。

它们影响滚动定位，不会像普通 `padding`、`margin` 那样改变正常布局尺寸。

来源：[CSS Scroll Snap Level 1 的 scroll snap area、snapport、`scroll-margin` 与 `scroll-padding`](https://www.w3.org/TR/css-scroll-snap-1/#scroll-padding)。

## `scrollbar-gutter: stable` 减少滚动条出现时的横向跳动

```css
.panel {
  overflow: auto;
  scrollbar-gutter: stable;
}
```

在使用经典滚动条的平台上，`stable` 会在需要出现滚动条前预留沟槽，从而避免内容宽度突然变化。`both-edges` 可以在行内轴两侧保留对称沟槽。覆盖式滚动条是否占据沟槽由规范规则和平台行为决定，因此不要把它当作固定宽度的 padding。

来源：[CSS Overflow Level 3 的 `scrollbar-gutter`](https://www.w3.org/TR/css-overflow-3/#scrollbar-gutter-property)。

## `overscroll-behavior` 控制滚动链和边界反馈

内层弹窗滚到底后继续滑动，默认可能带动外层页面。把属性设置在真正滚动的容器上：

```css
.dialog__body {
  overflow: auto;
  overscroll-behavior: contain;
}
```

- `auto`：允许默认滚动链和越界反馈。
- `contain`：阻止滚动链传给祖先，但保留当前容器自己的越界反馈。
- `none`：同时抑制滚动链和越界反馈。

非滚动容器会接受但忽略这个属性。它处理的是滚动边界默认行为，不等于背景内容不可聚焦；模态框仍需要正确的语义、焦点管理和关闭机制。

来源：[CSS Overscroll Behavior Level 1](https://www.w3.org/TR/css-overscroll-1/#overscroll-behavior-properties)。

## `scroll-behavior: smooth` 不控制手指和滚轮本身

这个属性影响锚点导航、滚动 API 和非用户直接发起的滚动定位。用户手指拖动或滚轮产生的滚动不由它强制变平滑，浏览器也可以根据平台约定忽略平滑滚动。

```css
@media (prefers-reduced-motion: no-preference) {
  html {
    scroll-behavior: smooth;
  }
}
```

把动效放在 `prefers-reduced-motion` 条件内，可以尊重希望减少动画的用户。来源：[CSS Overflow Level 3 的 `scroll-behavior`](https://www.w3.org/TR/css-overflow-3/#smooth-scrolling)、[Media Queries Level 5 的 `prefers-reduced-motion`](https://www.w3.org/TR/mediaqueries-5/#prefers-reduced-motion)。

## `touch-action` 要在手势开始前声明浏览器能做什么

Pointer Events 中，浏览器会在手势开始时根据命中元素及其祖先的 `touch-action` 决定哪些平移和缩放行为可以接管：

```css
.horizontal-slider {
  touch-action: pan-y;
}
```

这表示浏览器仍可处理纵向页面滚动，而组件自己处理横向拖动。常见值还有 `auto`、`none`、`pan-x`、`pan-y`、`pinch-zoom` 和 `manipulation`。

不要为了方便手势代码就给整个页面设置 `touch-action: none`；它会禁止相应区域由浏览器执行平移和缩放，可能严重影响可访问性。事件监听器调用 `preventDefault()` 也不能替代手势开始前的声明。

来源：[Pointer Events Level 3 的 `touch-action`](https://www.w3.org/TR/pointerevents3/#the-touch-action-css-property)。

## `pointer-events: none` 只退出命中测试

```css
.decorative-overlay {
  pointer-events: none;
}
```

它让该元素自身不成为指针命中目标，适合纯装饰覆盖层。需要记住：

- 后代可以重新设置 `pointer-events` 成为命中目标，事件传播路径仍可能经过父元素。
- 它不等于 `disabled`，不会自动改变表单语义、焦点顺序、键盘激活或可访问性状态。
- 真正不可交互的控件应优先使用原生 `disabled`、`inert` 或符合组件语义的状态管理。

来源：[CSS Basic User Interface Level 4 的 `pointer-events`](https://www.w3.org/TR/css-ui-4/#pointer-events-control)。

## `user-select` 是交互便利，不是复制保护

```css
.drag-handle {
  user-select: none;
}

.copy-token {
  user-select: all;
}
```

- `none` 适合拖拽手柄、按钮装饰等容易误选文字的局部区域。
- `all` 让选择动作以整个元素为单位，适合短 token 或命令，但仍应验证移动端体验。
- 不要在页面根节点大范围禁止选择；用户可能需要复制、查词、翻译或搜索错误信息。

浏览器和用户工具仍可以提供其他选择方式，所以 `user-select: none` 从来不是内容保护机制。来源：[CSS Basic User Interface Level 4 的 `user-select`](https://www.w3.org/TR/css-ui-4/#content-selection)。

## `accent-color` 保留原生控件能力，只改变强调色

```css
:root {
  accent-color: #6d5dfc;
}
```

它为 checkbox、radio、range、progress 等由浏览器绘制的控件提供强调色，同时保留原生交互、状态和平台适配。它不是完整主题系统；具体哪些部位使用该颜色由用户代理决定，用户的对比度偏好也可以覆盖作者选择。

来源：[CSS Basic User Interface Level 4 的 `accent-color`](https://www.w3.org/TR/css-ui-4/#widget-accent)。
