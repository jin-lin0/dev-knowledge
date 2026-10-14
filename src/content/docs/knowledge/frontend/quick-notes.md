---
title: 前端运行时与框架速记
navTitle: 前端快速复习
description: 按组件状态、构建加载、网络与实时性能整理前端运行时的易混边界。
kind: note
audience: 希望快速复习前端工程行为与诊断方法的开发者
lastVerified: "2026-09-09"
order: 4
---

这里仅记录框架、浏览器运行时和工程加载边界。纯 CSS 属性已经归入独立的 [CSS 主题](/knowledge/css/)，本地命令、进程和构建脚本归入 [工程工具与系统](/knowledge/tooling/)。

## 组件状态与数据边界

### 分页列表不能代表跨页选择的有效范围

当前页没有某个已选 ID，不能说明对应记录已经失效。刷新跨页多选表格时，应单独按已选 ID 查询仍然符合条件的记录，再清理失效选择；不能直接拿选择集合与当前页 ID 求交集。

- **例子**：已选 `a、b、c`，当前页只显示 `a`，而 `b` 在另一页、`c` 已被删除。独立查询应保留 `a、b`；按当前页清理会误删 `b`。
- **失败边界**：查询失败不能当作“全部失效”。依赖查询结果清理选择时，应等待查询成功再更新；提交前后的数据还可能变化，服务端执行校验仍需保留。
- **页码边界**：数据减少后还要检查 `offset >= total`。越界时回退并重查最后一页，零基偏移为 `max(0, ceil(total / limit) - 1) * limit`；否则可能出现空列表，而总数不足一页又让翻页按钮消失。补查响应也要核对当前筛选和请求序号，不能覆盖较新的查询。
- **来源**：2026-09-09 通过本地 Vue 状态测试验证跨页选择保留、失效记录移除、查询拒绝时保留原选择，并对照批量查询与提交校验源码核验。
- **浏览器复核**：2026-09-09 在本地 Chrome 验证 60 条数据减少到 45 条后，位于第二页的列表正确返回有效页；另用 Vue 状态测试延迟页码补查响应，验证它不会覆盖新的筛选结果。

### 编辑器的 dirty 状态应与保存基线比较

关闭保护要判断当前缓冲区是否仍与最近保存的内容不同，而不是在第一次输入后永久标记为已修改。

- **用法**：文本编辑器可保存 `savedText`，用 `computed(() => text.value !== savedText.value)` 派生 `dirty`；保存或重新加载成功后更新基线。
- **边界**：撤销或重新输入原文后应回到未修改；如果产品忽略格式、空白或字段顺序，需要另外定义语义比较规则。文本相等只适用于以原文为保存单位的编辑器。
- **导入边界**：导入文件只是替换编辑缓冲区，没有完成持久化，不能同时更新保存基线；否则 `dirty` 会变成 false，关闭时可能丢弃尚未保存的导入内容。只有成功保存或明确重新加载持久化内容时才移动基线。
- **来源**：2026-09-09 本地 Vue 3.5.8 响应式实验验证原文、修改、恢复原文三个阶段分别为 `false → true → false`；浏览器同时检查关闭确认的取消操作保留编辑缓冲区。
- **追加验证**：2026-10-13 用本地浏览器验证导入后更新基线会绕过未保存关闭保护，并以独立 Node.js 示例确认导入内容应继续与原保存内容比较。

### 对象展开不能隔离表单的嵌套草稿

`{ ...template }` 只复制第一层属性，嵌套对象和数组仍与模板共享引用。在表单中修改数组成员，即使最后选择放弃，也可能已经改动默认模板，影响下一次新建。

```js
const template = { rules: [{ required: true }] };
const draft = { ...template };
draft.rules[0].required = false;
console.log(template.rules[0].required); // false
```

- **用法**：对于普通、可结构化克隆的数据，打开编辑器时用 `structuredClone(template)` 建立独立草稿；只有保存成功才把结果交回持久化层或父状态。不要把函数、DOM 或 Vue Proxy 直接当成可克隆的数据，应先明确普通数据边界。
- **验证**：2026-10-13 独立 Node.js 断言确认展开对象共享嵌套引用，而对同一普通数据使用 `structuredClone` 后，修改草稿不会改变模板；另用本地浏览器复核“修改、放弃、再次新建”的完整交互。

### Vue computed 不会因时间经过自动重算

计算属性缓存依赖响应式数据；读取 `Date.now()` 或 `new Date()`，不会把系统时间变成响应式依赖。对已经缓存的结果，单纯推进时钟不会保证它重新计算。

```ts
const now = ref(Date.now());
const deadline = ref(Date.now() + 60_000);
const expired = computed(() => now.value >= deadline.value);

// 由现有调度器或明确的刷新事件更新真正的响应式依赖。
now.value = Date.now();
```

- **适合场景**：倒计时、过期提示、按当前时间筛选记录，以及依赖时间边界的展示状态。
- **边界**：改成普通函数也不会让界面随时间自动刷新，仍需要触发调用或渲染。时间变化只说明判断边界变化，不代表缓存中的外部数据已经更新；数据也有时效要求时，应同时明确重取与失效规则。
- **来源**：[Vue 计算属性缓存与方法](https://vuejs.org/guide/essentials/computed#computed-caching-vs-methods)。2026-10-11 用假时钟核验：依赖数组不变时，跨过截止时间后计算属性仍返回缓存筛选结果。

### 上下文菜单的目标应绑定触发行

上下文菜单目标与当前选中项可以不同：正在阅读 A 时，在 B 上右键，查看区可以继续显示 A，而菜单动作必须作用于 B。

- 使用触发记录的稳定 ID 或对应行的事件参数执行操作；可见的省略号与右键入口复用同一套命令，避免各自维护一份逻辑。
- 每次打开先关闭旧菜单，滚动时收起菜单；键盘打开后将焦点移到菜单项，不能只显示菜单却把焦点留在列表中。
- 来源：2026-09-09 本地 Vue 界面验证：在未选中行上右键，当前查看对象保持不变，确认弹窗使用右键行的名称；滚轮滚动关闭菜单，列表记录未被修改。

### 条件 class 的判断数据不必来自当前元素

动态 class 加在哪个元素上，与它应由哪个数据决定，是两个不同问题。样式可能施加在说明文字上，但触发原因来自相邻标题、父组件状态或整体布局模式。

- **记忆点**：先说明 class 的视觉意图，再选择判断条件；不要仅因为 class 加在某个节点上，就机械地改为读取该节点展示的数据。若代码容易误读，应把 predicate 或 class 命名成原因，例如 `should-align-with-heading`，而不是只描述目标元素。
- **来源**：[Vue Class 与 Style 绑定：对象值的真假决定 class 是否存在](https://vuejs.org/guide/essentials/class-and-style#binding-html-classes)。

### HTML 字符引用不在 `<style>` 中展开

`&#x20;` 在普通 HTML 文本或属性中解码为 U+0020 空格；`<style>` 是 raw text 元素，其中不能用 HTML 字符引用代替 CSS 语法空格。源码字符经过 HTML 解析、JSON 解析或框架模板转换后，CSS 只能处理最终进入 DOM 的真实字符。

- **来源**：[HTML Standard：数字字符引用](https://html.spec.whatwg.org/multipage/syntax.html#syntax-charref)与 [raw text 解析状态](https://html.spec.whatwg.org/multipage/parsing.html#parsing-main-inrawtext)。

## 组件语义与可访问性

### Vue 的属性透传不保证标注到内部交互控件

单根组件会把未声明的属性自动加到根元素。如果根元素只是布局容器，实际的 `input`、`button` 或 `role="combobox"` 在内部，把 `aria-label` 写在组件调用处可能只给外层容器命名，内部控件仍然没有正确的可访问名称。

- **实现选择**：用明确的 `ariaLabel` / `ariaLabelledby` prop 绑定到实际控件；或关闭自动继承后，有选择地把 `$attrs` 转发到控件。布局用的 `class`、`style` 与控件属性要分别确定目标，避免整包移动后改变布局。
- **标签与值**：选择器名称应表达“选择什么”，例如“周期”；当前值是“周线”。有可见标签时可使用 `aria-labelledby` 建立关联；`aria-label` 也应与可见标签保持一致。
- **验证**：检查浏览器可访问性树中控件的名称，用角色和名称定位控件，并验证方向键选择、Enter 确认、Escape 关闭和焦点恢复；只看到外层 DOM 上有属性不足以证明控件已标注。
- **来源**：[Vue 属性透传](https://vuejs.org/guide/components/attrs.html)、[WAI-ARIA Combobox 模式](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/)。2026-10-11 通过组件测试与 Chrome 的 DOM / 可访问性观察核验内部控件命名和键盘交互。

## 构建与加载

### Vue SFC 的编译与类型检查是两条链路

Vite 转换 TypeScript 和 Vue 单文件组件，并不等于执行类型检查；SFC 的脚本、模板、props 和事件类型应通过 `vue-tsc` 校验，并明确接入开发或 CI 流程。

- **关键命令**：已有正确配置时运行 `pnpm exec vue-tsc --noEmit`。能手工运行，不等于项目构建或 CI 已经自动调用。
- **通配声明边界**：`declare module '*.vue'` 中的宽泛 `DefineComponent` 声明，不能单独证明 `vue-tsc` 会丢失 SFC 的 props/emits 类型；它能够从实际 SFC 生成类型信息。应以具体调用的诊断结果确认边界，不机械地为每个组件手写另一份声明。
- **验证**：2026-10-13 用两个通用 Vue 组件及同样的通配声明核验：子组件声明数字 prop 和数字事件参数，父组件传字符串 prop、使用接收字符串的事件处理器，`vue-tsc` 分别报告两处 TS2322。
- **来源**：[Vue 官方 TypeScript 概览](https://vuejs.org/guide/typescript/overview.html)说明 Vite 转换与类型检查的职责，以及 `vue-tsc` 对 SFC 的支持。

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

## TypeScript 类型与运行时校验

### `as unknown as T` 是双重类型断言，不是数据转换

`value as unknown as T` 先把表达式视为 `unknown`，再要求编译器把它视为 `T`。当原类型与目标类型缺少足够的兼容关系、直接断言被拒绝时，这种写法可以绕过检查，但不会验证字段、补齐属性或转换实际值。

```ts
const value = '42' as unknown as number;
console.log(typeof value); // 运行时仍然是 string
```

- **删除边界**：只删中间的 `as unknown`，可能重新触发类型不兼容错误；全部删除，则恢复原表达式的静态类型。应先确认声明与真实数据为什么不同。
- **替代方式**：对于 IPC、接口或测试替身的独立数据协议，可以用运行时 Schema 校验并推导类型。测试如果需要核对请求是否原样传递，应保留原始字段做完整比较，避免通过补默认值或转换掩盖传输问题。
- **来源**：[TypeScript 官方类型断言说明](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#type-assertions)，2026-10-13 核验；类型断言在编译时移除，不包含运行时检查。

## JavaScript 表达式

### 比较运算符先于相等运算符分组

`<`、`>`、`<=`、`>=` 的优先级高于 `===`、`!==`。例如 `flag !== count > 0` 解析为 `flag !== (count > 0)`，先比较数值，再比较两个布尔值；不是 `(flag !== count) > 0`。

- **可读性**：显式写成 `flag !== (count > 0)` 能表达分组意图，但在这个表达式中加括号不改变行为。优先级决定语法分组，不等于所有操作数都按优先级顺序求值。
- **验证**：2026-10-14 用 TypeScript 解析器确认外层节点为 `!==`、右侧节点为 `>`；在 Node.js v26.0.0 中遍历布尔 flag 与 count 为 0、1、2 的六种组合，确认原式与显式括号形式结果一致。

## JavaScript 数据与序列化

### 序列化时的条件判断：空数组也是真值

序列化是把数据转换成适合保存或传输的表示，JavaScript 中常见的是用 `JSON.stringify` 生成 JSON 文本。应用也可能先把运行时模型转换成普通对象，再生成 JSON；在构造对象时写的条件决定哪些字段会被输出，并不等于执行数据校验。

```js
const items = [];
const output = {
  ...(items ? { items } : {}),
};
JSON.stringify(output); // '{"items":[]}'
```

- **条件展开**：三元表达式选择一个对象，`...` 再把该对象的字段加入结果；选中 `{}` 就不添加字段。
- **空不等于假**：`Boolean([])` 为 `true`，空数组会进入真分支；`undefined` 为 `false`，上述条件在字段未定义时选择空对象。
- **判断意图**：`if (items)` 检查真值，不检查数组是否有成员。若协议只输出非空数组，需要明确判断数组类型和 `length > 0`；若空数组本身表示有意义的空结果，就应保留。
- **验证**：2026-10-09 用独立 Node.js 示例检查 `undefined`、空数组、非空数组三种输入，条件展开后分别得到字段省略、字段值为 `[]`、字段值为非空数组。

## JavaScript 调用与作用域

### 把函数作为参数：回调的实参由接收方提供

`run(callback)` 传入的是函数本身；`run` 的实现决定何时调用它、传入哪些实参，以及是否返回它的结果。函数有两个形参，不代表外层 `run` 也接收两个参数。

```js
async function withResource(execute) {
    const resource = { value: 'ready' };
    const readState = () => resource.value;
    return execute(resource, readState);
}

const suffix = '!';
const result = await withResource((resource, readState) => {
    return Promise.resolve(readState() + suffix);
});
// result === 'ready!'
```

- **参数来源**：`resource` 和 `readState` 由 `withResource` 调用回调时提供；`suffix` 来自回调定义处的外层作用域，这就是闭包。
- **返回链**：回调返回 Promise，外层 async 函数返回它，调用方 `await` 得到最终值。箭头函数的表达式体会隐式返回表达式；改成花括号函数体时，需要明确写 `return` 才会传出该结果。
- **执行时机**：定义或传递函数不等于执行函数体；这里真正触发执行的是 `execute(resource, readState)`。回调也不天然意味着异步或另开线程。
- **验证**：2026-10-13 独立 Node.js 断言确认定义回调时无执行记录，包装器调用后按准备、回调顺序执行，最终 `await` 收到 `ready!`。

### 对象方法与外层函数同名，不代表裸调用就是递归

对象方法简写中的方法名是属性名；方法体里的裸标识符按词法作用域查找，不会因为属性同名就自动指向该方法。

```js
function load(value) {
    return `outer:${value}`;
}

const worker = {
    load(value) {
        return load(value);
    },
};

worker.load('demo'); // 'outer:demo'
```

这里调用的是外层函数。`this.load(value)` 则通过接收者读取方法；同名复用容易让读者误判，包装方法可以保留公开名称，并给内部函数使用更明确的名字。上述方法简写与外层函数的解析关系已通过本地 Node.js 聚焦运行验证。

## 异步任务与错误处理

单线程、事件循环、`await` 与并发上限的完整机制见[单线程 JavaScript 如何实现异步并发](/knowledge/frontend/async-concurrency/)。下列速记聚焦返回值和错误传播。

### 自定义 Error 类负责携带错误语义

自定义错误类可以很简单：它统一构造稳定的 `code`、错误名称和必要的上下文字段，让捕获方判断发生了什么。重试、终止或界面提示等处理策略由调用方决定，不需要都写进错误类。

```js
class LookupError extends Error {
  code = 'LOOKUP_MISSING';

  constructor(key) {
    super(`Missing key: ${key}`);
    this.name = 'LookupError';
    this.key = key;
  }
}
```

- **识别依据**：`code` 是应用自行约定的字段，普通 `new Error()` 不会自动带业务错误码。使用稳定的 code 和上下文字段比解析可能改写的 message 更可靠；同一种“对象不存在”还可能需要结合已有记录才能判断原因。
- **继承的价值**：仍可正常 `throw/catch`，使用 Error 的 message、运行时提供的 stack，以及同一 JavaScript realm 内的 `instanceof` 判断。类主要保证构造方式和字段约定，普通 Error 加字段或工厂函数也能实现同类协议。
- **封装边界**：错误定义可以是内部实现，独立文件只是组织选择。其他内部文件要导入定义时需要模块导出，但不代表必须额外公开 `package.json` 的包子路径；是否提供公开入口应由包外调用需求决定。调用方只消费 code 与普通字段时，无需依赖具体错误类。
- **传输边界**：显式发送 `{ code, message, key }` 等普通数据；JSON 序列化不会保留自定义类原型，接收方不能假设对象仍能通过 `instanceof LookupError`。
- **来源**：2026-10-09 在 Node.js `v24.19.0` 独立验证继承、错误码/元数据、stack，以及 JSON 往返后原型身份丢失而 code 保留；另以临时 ESM 包验证内部模块导出可供包主入口使用，未列入 exports 的子路径则报 `ERR_PACKAGE_PATH_NOT_EXPORTED`。

### 加载状态与加载提示的显示时机应分开

短暂的异步切换不一定需要立即显示加载文字；提示每次出现再消失，反而会产生闪烁。可以只在等待明显变长时展示反馈，并在完成、切换目标或组件卸载时清理提示计时器。

- **静默读取**：不显示提示，不等于删除请求状态。仍需阻止未就绪的提交、处理并发与失败；用 `hasLoaded` 区分首次读取与真正空结果，刷新期间保留已有内容，成功后再替换。
- **布局边界**：提示若插入正常文档流，会改变正文位置。预留空间或使用不挤压正文的浮层；可变长度标题也需要稳定占位，否则去掉加载行后仍可能上下跳动。
- **组件边界**：同一容器切换资源时，避免仅因资源 URL 改变就强制重建整个容器；真正需要重置状态的主动重试可单独处理。
- **来源**：2026-09-09 在本地 Vue 界面连续切换三个长短标题的异步内容，DOM 观测确认没有即时加载文字，内容区域的顶部坐标与高度三次一致。等待阈值属于具体产品策略，不是通用固定值。


### 轮询与取消请求应保护任务身份和终态

异步请求的完成顺序不等于状态的新旧顺序。取消和轮询并行时，迟到的“运行中”或“取消中”响应可能覆盖已经完成的任务。

- **提交边界**：发送前复制本次选择和参数，之后的进度占位读取提交快照，不能重新读取仍可编辑的表单。
- **回写边界**：发请求时记录任务 ID；响应回来后核对当前任务仍是同一个，再拒绝把终态回退为进行中。取消按钮还需有请求中的标记，防止连续点击发起重复取消。
- **资源详情边界**：选中资源与它的标题、正文和加载状态需要保持同一身份。切换资源后，旧请求的成功、错误和 `finally` 都不能改写新资源；新资源失败时显示它的失败状态，不能把旧正文挂在新 ID 下。取消传输与回写时校验请求版本可以同时使用，即使传输忽略取消，版本检查仍能阻止旧数据覆盖。
- **补充验证**：2026-10-10 用可手动完成的 Promise 验证先选 A、后选 B 而 A 后完成，旧请求完成时 B 仍在加载，以及 B 失败时清除旧详情三个场景；这些测试控制完成顺序，不依赖真实网络延迟。
- **验证方法**：用可手动完成的 Promise 控制响应顺序，覆盖“轮询先确认完成、取消响应后到”“取消先完成、旧轮询后到”，以及提交等待期间修改表单。2026-09-09 的本地状态测试验证了这些顺序。

### `async function*` 返回迭代器，消费时才执行函数体

调用异步生成器函数只得到异步迭代器；函数体从第一次 `.next()` 开始执行。`for await...of` 会不断请求下一项，因此通常也是事件流开始实际工作的地方。

```js
async function* produce(input) {
    console.log('started', input);
    yield 'first';
    yield 'last';
}

const events = produce('demo'); // 此时还没有打印 started
for await (const event of events) {
    console.log(event);
}
```

- **边界**：这条惰性执行规则针对 `async function*`，不能推广到所有叫 `stream` 的函数，也不能套用于普通 async 函数；普通 async 函数调用后会立即执行到第一个等待点。
- **验证**：2026-10-13 独立 Node.js 断言确认创建迭代器后函数体执行记录仍为空，消费后才出现 started，按序收到 first 和 last。

### `await` 只能等待函数实际返回的任务

函数内部启动了请求，不代表调用方 `await fn()` 就会等待该请求。必须返回请求 Promise，或在 `async` 函数内 `await` 它；只添加 `async`、内部仍然不返回也不等待请求，同样会提前完成。

```ts
// 调用方能等待请求完成，并捕获失败。
function loadData() {
  return fetch('/api/example');
}

try {
  const response = await loadData();
  // 继续处理响应。
} catch (error) {
  console.error('请求失败', error);
}
```

- **记忆点**：普通函数未写 `return` 时返回 `undefined`；`await undefined` 只经过一次异步续接，不会自动关联函数内部启动的请求。
- **来源**：2026-09-08 在 Node.js `v24.19.0` 用手动 resolve 的挂起 Promise 验证：函数不返回该 Promise 时，调用方 `await` 后任务尚未完成。

### 固定大小分批请求与循环内 `await`

接口限制每次提交的条目数时，可以用 `slice(offset, offset + batchSize)` 分块，再合并各批返回的数组。`slice` 不包含结束位置，也不修改原数组；在普通 `for` 循环体内等待本批请求完成后，才会发起下一批请求。

```ts
const items: Item[] = [];
const batchSize = 2; // 示例值；实际应遵循接口限制。
for (let offset = 0; offset < ids.length; offset += batchSize) {
  const batchResult = await loadBatch(ids.slice(offset, offset + batchSize));
  items.push(...batchResult);
}
```

- **记忆点**：5 个条目按每批 2 个拆成 `2 + 2 + 1`，批次串行执行。`push(...batchResult)` 把本批数组中的元素逐个追加，得到一个合并数组；`push(batchResult)` 则会追加数组本身。
- **边界**：空输入不会发起请求；若某批 Promise 拒绝且没有捕获，函数会停止后续批次并以拒绝结束，不会成功返回已经累积的部分结果。
- **来源**：2026-09-09 在 Node.js `v26.0.0` 用异步模拟请求验证：批次大小为 `[2, 2, 1]`、最多同时执行 1 批、结果合并且原输入不变；空输入调用次数为 0，第二批拒绝后未发起第三批。

### 共享在途 Promise 需要失败后释放

请求去重可以按资源身份保存正在执行的 Promise，让重叠调用复用同一个任务；成功和失败都必须释放在途记录，否则一次失败可能让后续重试一直复用已经拒绝的 Promise。

- **边界**：在途去重与结果缓存是两件事。前者只覆盖任务未完成的时间，后者需要另行定义有效期和失效规则；共享任务的一个消费者离开时，也不能直接取消其他消费者仍在等待的传输。
- **验证**：2026-10-11 在 Node.js 24.19.0 用同键并发调用验证两次调用得到同一个 Promise；第一轮拒绝并清理后，下一轮可以重新执行并成功。

### `Promise.allSettled` 允许明确处理部分成功

`Promise.all` 遇到任意拒绝就以拒绝结束，调用方不会得到一个完整的成功结果数组；`Promise.allSettled` 等待全部任务结束，逐项保留 `fulfilled` 或 `rejected`，便于按产品约定保留有效结果并标记失败项。

- **边界**：两个组合器都不自动取消已经开始的任务；`allSettled` 也不会自动重试或把失败变成空数据。全部失败、部分失败和成功但为空，应由调用方明确区分。
- **分批查询**：每批自行捕获错误后继续调度，汇总已成功的批次；否则循环内一次未捕获的拒绝会提前停止后续批次。
- **共享资源收尾**：`Promise.all` 提前拒绝可以触发外层 `finally`，但其他任务仍可能使用共享资源。若首次异常应停止整批，需要分别停止领取新任务、等待已启动任务结束，再释放资源并抛出原始错误；仅换成 `allSettled` 不会阻止 worker 继续领取队列。
- **收尾顺序验证**：2026-10-14 用可手动完成的 Promise 验证，一个任务拒绝后，`Promise.all(...).finally(cleanup)` 的清理早于另一个任务完成。
- **验证**：2026-10-11 用独立 Node.js 实验验证一个拒绝任务和一个成功任务的结果均被保留；聚焦测试另验证一个批次失败时，后续成功批次仍能返回有效记录。

### 外层 `try/catch` 不会捕获未等待 Promise 的异步拒绝

`try { startTask(); } catch { ... }` 只能捕获调用时的同步抛错，不能捕获返回 Promise 后发生的拒绝。需要写 `await startTask()`，或显式接上 `.catch(...)`。即使函数标记为 `async`，函数体里的抛错也会表现为返回 Promise 的拒绝。

- **错误传播**：内部 `.catch()` 如果只记录日志而不重新 `throw`，产生的新 Promise 会转为成功状态，外层即使 `await` 也不会进入失败分支。
- **来源**：2026-09-08 在 Node.js `v24.19.0` 隔离验证：未等待的拒绝不进入外层 catch；等待的拒绝进入 catch；只记录、不重新抛错的 catch 使返回 Promise 成功解析为 `undefined`。

## 网络与实时性能

### HTTP 响应头与 meta 的 CSP 会同时生效

多条执行型 Content Security Policy（CSP）需要同时满足；HTML 的 `<meta http-equiv="Content-Security-Policy">` 不能放宽服务器响应头已经施加的限制。

- **典型现象**：HTTP 响应头是 `style-src 'self'`，页面 meta 写了 `style-src 'unsafe-inline'`，内嵌 `<style>` 仍会被拦截。`'self'` 允许同源样式资源，不等于允许内联 CSS；正文可以正常显示，但配色、卡片和间距退回默认样式。
- **排查方法**：同时检查 Network 中实际文档响应头、HTML 中的 meta 和 Console 的 CSP 报错。同一份 HTML 直接打开正常，通过本地服务打开却没有样式时，尤其要检查服务统一添加的响应头。
- **来源**：[CSP 规范：多条策略的效果](https://www.w3.org/TR/CSP3/#multiple-policies)；2026-09-09 本地 Chrome 验证，相同 HTML 在上述响应头下没有生效样式表，移除该响应头后恢复内嵌样式。

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
