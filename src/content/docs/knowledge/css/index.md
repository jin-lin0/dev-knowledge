---
title: CSS
description: 按文本、布局、滚动和交互问题组织 CSS 的实用属性与容易遗忘的边界。
order: 3
---

这里不按属性字母表堆知识，而是按“正在解决什么问题”组织。先进入对应主题建立心智模型，再把页面中的属性表当作速查手册。

## 按问题查找

- **空白、换行和省略**：[文本空白、断行与省略](/knowledge/css/text-wrapping/)——`white-space`、`break-spaces`、`overflow-wrap`、`word-break`、`hyphens`、`line-clamp`。
- **元素为什么不肯缩、尺寸为什么溢出**：[布局、尺寸与渲染边界](/knowledge/css/layout-sizing/)——自动最小尺寸、`min-inline-size: 0`、`minmax(0, 1fr)`、固有尺寸、图片裁切、定位和包含。
- **滚动错位、滚动穿透和触摸手势**：[滚动、命中与原生交互](/knowledge/css/scroll-interaction/)——`overflow: clip`、`scroll-padding`、`scroll-margin`、`overscroll-behavior`、`touch-action`、`pointer-events`。

## 阅读顺序

1. 先看每篇开头的“先判断什么”，确定问题属于内容、容器还是交互边界。
2. 再使用属性对照表选择机制，不用多个看似有效的属性叠加碰运气。
3. 最后检查兼容性、可访问性和极端内容：长 URL、CJK 文本、缩放字体、键盘操作、触摸滚动与窄容器。

## 收录边界

这里优先保存容易忘但能直接解决真实问题的属性，以及它们与相邻属性的区别。仍在演进的 CSS 草案能力会明确标为渐进增强；浏览器支持范围应根据项目目标单独检查，不能只根据规范中出现了某个值就默认可用。
