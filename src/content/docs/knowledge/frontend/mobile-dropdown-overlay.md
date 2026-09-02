---
title: 移动端下拉浮层的视口适配
description: 让 Portal、Teleport 一类下拉浮层在窄屏、滚动容器和软键盘场景中保持可读且不越界。
kind: how-to
audience: 正在实现跨容器下拉菜单或选择器的前端开发者
lastVerified: "2026-08-31"
order: 2
---

下拉菜单通过 Portal 或 Teleport 挂到 `body`，可以避免被祖先元素的 `overflow` 裁切，但浮层也因此失去了原布局上下文。移动端工具栏中的触发器很容易被 Flex 或 Grid 压窄；如果浮层直接复制触发器宽度，选项会只剩几个字符，甚至看起来像“没有内容”。

## 核心约束

先统一坐标系。下面的 `triggerLeft`、`viewportLeft` 和最终应用到浮层的 `left` 必须处于同一坐标系；触发器位置通常来自 `getBoundingClientRect()`。若浮层使用文档坐标的 `position: absolute`，还要把视口坐标统一换算为文档坐标，不能直接混用滚动偏移与视口偏移。

横向尺寸应同时满足三条约束：

1. 不小于触发器宽度。
2. 不小于一个可读的菜单宽度，例如 `200px`。
3. 不超过视口宽度减去两侧安全距离。

```ts
const visualViewport = window.visualViewport
const viewportLeft = visualViewport?.offsetLeft ?? 0
const viewportWidth = visualViewport?.width ?? window.innerWidth
const safeLeft = viewportLeft + padding
const safeRight = viewportLeft + viewportWidth - padding
const availableWidth = Math.max(0, safeRight - safeLeft)
const width = Math.min(Math.max(triggerWidth, minReadableWidth), availableWidth)
const left = Math.min(
  Math.max(safeLeft, triggerLeft),
  Math.max(safeLeft, safeRight - width),
)
```

这比单纯设置 `min-width` 更可靠，因为右侧触发器还需要同步调整 `left`，极窄视口也必须让视口上限覆盖最小宽度。把 `offsetLeft` 纳入计算后，页面缩放或视觉视口横向偏移时也不会错误地假设可视区域总从 `0` 开始。

可读宽度不应写死成所有场景都相同的值。通用组件可以提供一个保守默认值，同时允许调用方为模型名、时区等长选项传入更大的最小宽度；最终仍由视口可用宽度兜底。移动端也不应只依赖单行省略号，因为触屏没有稳定的悬停提示。长选项可以允许换行，而触发器继续保持单行省略：

```css
.option-label {
  white-space: normal;
  overflow-wrap: anywhere;
}

.trigger-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

垂直方向则应分别计算触发器上下两侧的可用空间：优先放在能容纳菜单的一侧；两侧都放不下时选择空间更大的一侧，并给浮层设置 `max-height`，让选项列表内部滚动。不要只在“上方能完整容纳”时才翻转，否则上下都不足时菜单仍会被屏幕底部截断。

## 为什么要考虑 Visual Viewport

移动端软键盘、页面缩放和浏览器工具栏会改变用户当前真正能看到的区域。仅使用 `window.innerHeight` 往往不能完整描述这个区域。浏览器支持时，可优先读取 `window.visualViewport` 的 `width`、`height`、`offsetLeft` 与 `offsetTop`，并在浮层打开期间监听它的 `resize` 和 `scroll` 事件；同时保留 `window` 的滚动与尺寸变化监听作为常规场景和兼容性兜底。[CSSOM View](https://drafts.csswg.org/cssom-view/#visual-viewport) 定义了这些尺寸、偏移和事件的坐标语义。

监听器只应在浮层打开期间存在，并在关闭或组件卸载时成对移除。

## 容器结构

浮层限高后，搜索区需要固定，选项区负责滚动。一个稳定的结构是：

```css
.dropdown {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.dropdown-search {
  flex-shrink: 0;
}

.dropdown-options {
  flex: 0 1 auto;
  min-height: 0;
  overflow-y: auto;
}
```

`min-height: 0` 很关键：Flex 子项默认的最小内容尺寸可能阻止它收缩，导致外层虽然设置了 `max-height`，列表仍然溢出或被硬裁切。

## 验证清单

- 320px、375px 和断点边界宽度下，长选项仍有可读空间。
- 靠近左右边缘的触发器打开后，浮层保留安全距离。
- 靠近屏幕底部时能向上翻转；上下都不足时列表内部可滚动。
- 页面、弹窗或抽屉滚动时，浮层持续跟随触发器。
- 可搜索下拉框唤起软键盘后仍处于可视区域。
- 浮层挂到 `body` 后，主题变量、层级和点击外部关闭逻辑仍然有效。

这些结论可通过纯函数布局测试覆盖边界输入，再用真实手机视口检查浮层的几何尺寸和选项可见性。
