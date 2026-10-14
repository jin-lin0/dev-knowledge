---
title: Playwright 的浏览器对象与执行环境
description: 区分 Browser、BrowserContext、Page，以及 page.evaluate 两侧的变量、参数和资源生命周期。
kind: explanation
audience: 阅读或编写 Playwright 浏览器自动化程序的开发者
lastVerified: "2026-10-10"
order: 4
---

Playwright 程序通常同时涉及控制程序和浏览器页面两个 JavaScript 环境。先确定代码在哪边执行，再判断变量属于谁、对象由谁创建和释放，会比只看函数名称更容易理解自动化代码。

## Browser Context 和 Page

| 对象 | 负责什么 | 关系 |
| --- | --- | --- |
| Browser | 控制已启动或连接的浏览器实例 | 一个实例可以创建多个 Context |
| BrowserContext | 隔离的浏览器会话容器 | 各 Context 隔离 Cookie 等浏览器存储，近似独立无痕会话 |
| Page | 控制具体标签页 | 属于某个 Context，同一 Context 可以包含多个 Page |

Page 中的应用还可以创建自己的业务会话对象。重建业务对象不等于刷新 Page，更不等于新建 Context。关闭一个 Context 会关闭它包含的 Page；清理单个任务时，应先判断任务是否独占整个 Browser，再决定关闭范围。[Playwright Browser](https://playwright.dev/docs/api/class-browser)、[隔离模型](https://playwright.dev/docs/browser-contexts)、[BrowserContext.close](https://playwright.dev/docs/api/class-browsercontext#browser-context-close)

Playwright Test 的默认隔离安排和直接调用 Playwright Library 不同。直接使用 Library 时，Context 的创建、复用和关闭由程序负责，不能假定每次函数调用都会自动得到干净的浏览器环境。[Playwright 隔离模型](https://playwright.dev/docs/browser-contexts)

## page.evaluate 两边不共享闭包

evaluate 的回调在浏览器页面里执行，外层控制代码在另一个 JavaScript 环境里执行。回调可以读取 window/document，却不能直接读取外层 Node 变量，需要通过参数显式传值；结果再传回控制程序。[Playwright Evaluating JavaScript](https://playwright.dev/docs/evaluating)

下面假设 page 已建立，用可序列化的数组演示参数传递：

```js
const numbers = [2, 4, 6];
const count = await page.evaluate(values => values.length, numbers);
```

numbers 属于控制程序，values 是页内回调接收的值；不要把回调改成直接读取外层 numbers。需要多个参数时通常组合成一个对象。若回调返回 Promise，evaluate 会等待它完成，因此外层 await 可以接收异步页面操作的结果。[Playwright Evaluating JavaScript](https://playwright.dev/docs/evaluating)

TypeScript 的类型断言只影响编译器，不会把 Node 对象搬进浏览器，也不会在运行时创建页面全局对象。自定义全局 API 必须由页面脚本实际安装，再由自动化代码检查它是否存在。

## 导航完成与业务就绪是不同条件

等待 DOMContentLoaded 不代表页面里的异步业务数据已经加载。若程序需要调用自定义页面 API，可以先用 waitForFunction 等它出现，再等待该 API 的准备方法完成；入口存在与业务准备完成应分别定义。[Page.goto](https://playwright.dev/docs/api/class-page#page-goto)、[Page.waitForFunction](https://playwright.dev/docs/api/class-page#page-wait-for-function)

等待具体 DOM 元素时，还要区分存在与可见，见[DOM 存在不等于元素可见](/knowledge/tooling/quick-notes/#playwrightdom-存在不等于元素可见)。给 Context 注入登录态则另看[全局 Cookie 请求头的作用域](/knowledge/tooling/quick-notes/#playwright全局-cookie-请求头不会按登录域隔离)。
