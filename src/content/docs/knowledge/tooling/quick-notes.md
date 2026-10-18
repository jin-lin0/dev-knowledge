---
title: 本地开发、进程与构建速记
navTitle: 本地开发与构建速记
description: 按网络、workspace、进程环境与退出状态整理本地工程的常见易错点。
kind: note
audience: 开发或调试本地服务、Node.js 进程和构建脚本的开发者
lastVerified: "2026-09-09"
order: 2
---

## 网络与本地服务

### `localhost`、`127.0.0.1` 与 `::1`

三者都用于访问本机，但不代表完全相同的监听和浏览器安全边界。

| 写法 | 类型 | 关键区别 |
| --- | --- | --- |
| `localhost` | 特殊用途主机名 | 需要由应用或系统解析到回环地址，可能涉及 IPv4 和 IPv6 |
| `127.0.0.1` | IPv4 地址字面量 | 明确绑定 IPv4 回环接口，不经过主机名解析 |
| `::1` | IPv6 地址字面量 | 明确绑定 IPv6 回环接口 |

- **适合场景**：希望本地服务监听行为不受主机名解析顺序影响时，明确选择 `127.0.0.1` 或 `::1`；希望 URL 易读且工具链已正确处理 IPv4/IPv6 时，可以使用 `localhost`。
- **记忆点**：服务绑定到 `127.0.0.1` 后，如果客户端把 `localhost` 解析为 `::1`，客户端和服务端选择的地址族不同就可能连接失败。反过来也一样。
- **浏览器边界**：`http://localhost:3000` 与 `http://127.0.0.1:3000` 的 host 不同，所以是不同 Origin；CORS、Web Storage 等按 Origin 隔离的行为不能因为它们都指向本机就混用。
- **来源**：[RFC 6761 对 `localhost` 的特殊用途规定](https://www.rfc-editor.org/rfc/rfc6761.html#section-6.3)、[IANA IPv4 特殊地址注册表中的 `127.0.0.0/8`](https://www.iana.org/assignments/iana-ipv4-special-registry/iana-ipv4-special-registry.xhtml)、[WHATWG HTML Origin 定义](https://html.spec.whatwg.org/multipage/browsers.html#concept-origin)。

### 固定端口与端口 `0`

Node.js 服务监听端口 `0` 时，由操作系统分配当前未使用的端口；指定正整数端口则使用固定端口。

- **适合场景**：测试、并行任务和一次性本地工具适合端口 `0`，可以减少冲突；书签、回调地址或固定代理配置需要稳定 URL 时应指定固定端口。
- **记忆点**：固定端口被其他进程占用时，服务通常以 `EADDRINUSE` 启动失败；端口 `0` 只保证本次绑定时由系统选择可用端口，不保证下次仍相同。
- **来源**：[Node.js `server.listen()` 文档](https://nodejs.org/api/net.html#serverlistenport-host-backlog-callback)。

## 命令行参数

### 参数名合法不等于参数值被 CLI 支持

允许传入 `--type` 或 `--format`，只说明参数名称合法；具体取值仍可能受当前 CLI 的枚举约束。界面选项、默认值、兜底值和命令示例都要与实际执行版本的允许值一致，不能根据显示名称猜测参数值。

- **测试边界**：只记录调用参数的 mock、或只验证参数名的白名单，不能证明 CLI 会接受该值。接口测试应保留映射检查，再补充实际命令契约核验；CLI 升级后也需要重新核对。
- **本地核验**：支持枚举诊断的 CLI 可以用无效枚举值触发参数校验，读取允许值列表；需先确认该校验在网络或业务执行之前发生。成功数据请求的实际运行结果可以进一步验证正确值，但不应把这类联网验证混入离线单测。
- **验证**：2026-10-11 对当前本地 CLI 实测，一个界面默认值被参数解析器拒绝，使用允许的默认值后成功返回结构化结果；新增本地契约测试直接核对实际 CLI 的枚举列表，避免测试桩重复接受错误默认值。

## Workspace 与构建

### Vite `server.open`：服务启动成功与浏览器打开成功是两件事

`server.open: true` 会在开发服务器完成首次监听后触发浏览器打开动作；Vite 7.0.6 的配置重启分支会跳过这一步。因此配置已被读取、服务已显示 ready，都不能单独证明浏览器已经打开。

- **排查顺序**：核对最终解析的 `server.open`，检查实际监听地址和 HTTP 响应，再查看浏览器打开子进程是否结束及目标标签页是否出现。
- **macOS 边界**：Vite 7.0.6 检测到已运行的 Chromium 系浏览器时，会先通过 AppleScript 尝试复用标签页；该调用没有由 Vite 设置超时，错误被捕获后才回退到系统打开方式。自动化调用挂起时，服务可以正常响应而浏览器迟迟不打开。
- **默认浏览器与标签页复用**：`open: true` 只启用打开动作，不保证 macOS 始终选择系统默认浏览器。Vite 维护者说明，优先操作已运行的 Chromium 浏览器是为了复用已有标签页；这是启动工具的选择策略，与应用使用 Vue、React 或其他框架无关。[维护者解释](https://github.com/vitejs/vite/discussions/19277)。
- **已有环境控制**：Vite 支持 `BROWSER`；未配置时走默认选择流程，`none` 会禁用自动打开，macOS 的 `open` 值会跳过上述 Chromium AppleScript 分支并使用系统浏览器。这是 Vite 支持的配置能力，不代表当前终端已设置；排查时不要擅自写入用户的环境配置。
- **验证**：2026-10-18 在 macOS、Vite 7.0.6 上核对最终配置为 true，开发服务返回 HTTP 200；同时观察到浏览器打开脚本持续运行至少 112 秒，脚本结束后目标页面才出现在 Chrome。该观察确认打开调用发生延迟，未据此断言具体权限或浏览器实例冲突是根因。
- **单次复测**：同日以进程作用域设置 `BROWSER=open`，目标页面正常出现为新的 Chrome 标签页，未再观察到挂起的 Chrome 打开脚本；该设置只属于这次进程启动，不代表项目或全局环境已被修改。
- **项目级本机设置**：在 macOS 上可将 `BROWSER=open` 放入 `.env.development.local`，供默认开发模式读取；`.env.local` 则适用于各模式。保持 `server.open: true` 并重启开发进程。`BROWSER` 是 Vite 特殊读取的 Node 侧控制变量，不需要 `VITE_` 前缀；已有进程环境中的值优先。是否被 Git 忽略须以项目规则为准。2026-10-19 已对照 Vite 7.0.6 的环境文件加载及浏览器打开实现核验。
- **跨平台边界**：`BROWSER=open` 是 Vite 的 macOS 专用处理分支，不能把它当作所有系统通用的浏览器名。团队配置若采用它，应限定 macOS；Windows/Linux 继续使用默认打开流程。2026-10-19 对照 [官方实现](https://github.com/vitejs/vite/blob/main/packages/vite/src/node/server/openBrowser.ts) 核验，主分支改用 JXA 后仍保留 Chromium 标签页复用策略。
- **来源**：[Vite server.open](https://vite.dev/config/server-options.html#server-open)，并对照已安装 Vite 7.0.6 的启动与浏览器打开实现核验。

### Node.js 直接执行 TypeScript 要核对最低运行版本

脚本能在当前 Node 中直接导入 `.ts`，不代表项目声明支持的全部 Node 版本都能执行；类型检查成功也不能补上运行时加载能力。

- **版本边界**：原生类型擦除从 Node 22.6.0 开始提供，Node 22.18.0 和 23.6.0 起默认开启；Node 20 不提供这项能力，22.12.0 默认也未开启。
- **适合场景**：把读取 TypeScript 模块的生成器或校验器接入 `check`、CI 等入口时，同时核对项目的最低 Node 版本、执行参数和加载器。
- **处理方法**：保留旧版 Node 支持时，使用兼容的转译或加载方案；确实提高运行版本要求时，同步更新版本声明与执行环境。原生类型擦除不读取 `tsconfig.json`，不能据此假设路径别名或需要生成代码的 TypeScript 语法也可用。
- **来源与验证**：[Node.js TypeScript 支持与版本历史](https://nodejs.org/api/typescript.html)；2026-10-15 在 Node 24.19.0 上关闭类型擦除后，确认 ESM 导入 `.ts` 会以未知扩展名错误失败。

### 构建产物的特征字符串检查必须做反例验证

“没有搜到某段报错文案”不能单独证明对应依赖没有进入产物：生产分支裁剪和 tree shaking 可能删掉文案，同时保留实际功能。

- **验证方法**：用真实生产配置构造一个明确包含目标功能的最小产物，确认检查脚本会拒绝它；再用明确不包含目标的产物确认能通过。只在当前干净产物上运行一次检查，无法验证漏报率。
- **Vue 示例**：2026-10-15 使用 Vue 3.5.42 与 Vite 7.0.6，将完整 ESM 构建的 `compile` 暴露到全局；产物仍能把模板编译成渲染函数，但不含几条开发期编译错误文案，依赖这些文案的扫描器仍返回成功。
- **改进方向**：优先检查打包器实际纳入的模块图；使用产物特征时，明确适用构建形式，并保留上述应当被拒绝的回归样本。

### ESM 依赖需要分别检查 Node、TypeScript 和 Jest

Node 能加载一个 ESM 包，不代表 TypeScript 类型检查和 Jest 测试运行器也已支持同样的加载方式。

- **运行时**：现代 Node 可以从 CommonJS 使用 `require()` 加载同步 ESM 模块，但模块及依赖链不能包含顶层 `await`。
- **编译器**：TypeScript 5.8 才在 `module: nodenext` 下支持这项互操作；旧版即使配合新 Node，仍可能对编译为 `require()` 的静态导入报告 `TS1479`。`esModuleInterop` 不能代替这项版本支持。
- **测试器**：Jest 默认跳过依赖目录的转译。CommonJS 测试导入 `lodash-es` 等 ESM 包时，可为该包开放 `transformIgnorePatterns` 并配置 JavaScript 转译；pnpm 的实际路径还经过 `.pnpm`，只匹配包名所在的一层可能仍被忽略。使用 ts-jest 转译依赖中的 JavaScript 时，需要对这项转译开启 `allowJs`。
- **验证**：2026-10-12 在 Node 24、TypeScript 5.6、Jest 30 环境中分别复现运行时加载成功、静态导入 `TS1479`、Jest 拒绝 `export`，并验证定向转译能消除测试加载错误。
- **来源**：[TypeScript 5.8 的 require(ESM) 支持](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-8.html#support-for-require-of-ecmascript-modules-in---module-nodenext)、[Jest 转译忽略规则及 pnpm 示例](https://jestjs.io/docs/configuration#transformignorepatterns-arraystring)。

### Monorepo 中同名 `pnpm run` 脚本取决于当前 package

`pnpm run <script>` 执行当前 package manifest 中定义的脚本。Workspace 根目录和子包可以存在同名脚本；如果在不同目录执行相同命令，实际启动的程序和端口可能完全不同。

```bash
# 执行前先确认当前目录、package 名称和脚本内容
pwd
node -p "require('./package.json').name"
node -p "require('./package.json').scripts['dev:server']"

# 需要避免目录歧义时，从 workspace 中显式选择 package
pnpm --filter <package-name> run dev:server
```

- **诊断线索**：启动日志显示“成功”，但目标端口没有监听时，先确认日志对应的是哪个框架、进程工作目录和 package，而不是继续等待输出。
- **记忆点**：长驻的 dev/watch 服务启动成功后没有新日志通常只是进入等待状态；应使用 `lsof -nP -iTCP:<port> -sTCP:LISTEN` 或 HTTP 探针验证目标端口，不能把“终端仍被占用”当作目标服务已经启动。
- **来源**：[pnpm run](https://pnpm.io/cli/run) 说明它执行 package manifest 中的脚本；[pnpm filtering](https://pnpm.io/filtering) 说明 `--filter` 可以把命令限定到明确的 workspace package。结论也通过同一 workspace 中两个同名脚本的实际进程工作目录和监听端口复核。

### Vue 的 CommonJS 依赖可能引入运行时模板编译器

应用自己的 `import 'vue'` 使用纯运行时构建，不代表第三方依赖的 `require('vue')` 也解析到同一个入口。条件导出可能让两条路径选择不同产物。

- **判断方法**：检查依赖发布入口、框架的 `exports.import` / `exports.require`，再查看生产构建实际保留的模块。不要仅凭依赖名字判断它是否需要替换。
- **可选处理**：若所有模板都在构建期编译，可在 Vite 用精确匹配 `^vue$` 的别名指向 `vue/dist/vue.runtime.esm-bundler.js`。精确匹配避免误改 `vue/server-renderer` 等子路径；依赖运行时字符串模板的应用不能直接套用。
- **权衡**：直接操作 DOM 的排序库仍需要与框架数据更新、元素复用和卸载生命周期协调。移除 Vue 包装组件能减少部分体积，也会把这部分维护职责交给项目；应先排除错误入口造成的额外体积，再决定是否重写。
- **验证**：2026-10-19 核对 Vue 3.5.42 的条件导出与 vuedraggable 4.1.0 的 UMD 入口；采用上述别名后的 Vite 7 生产构建通过模块图检查，浏览器中鼠标拖拽与键盘重排都正常。

### 限制导入语句优先使用语法规则

按行扫描导入关键字的正则不理解代码上下文，注释或字符串中的示例也可能被当成真实依赖。项目已有语法检查器时，应优先用相应规则表达导入限制。

- **ESLint 示例**：`no-restricted-imports` 检查实际导入和相关导出节点，适合限制明确的模块入口；动态加载等额外语法需要另行核对规则覆盖范围。
- **验证**：2026-10-18 用同一段仅包含注释示例的代码复现了文本扫描误报；本地 ESLint 规则对注释返回零诊断，对真实的受限静态导入返回错误，并核对了已安装规则的语法节点访问逻辑。

### 批量构建必须传播失败退出码

批量构建多个子项目时，可以继续处理后续目标以收集完整结果，但最终命令必须在任一子构建失败时返回非零退出码。

- **适合场景**：一个脚本循环执行多个应用、包或平台构建，并被 `check`、CI 或发布流程当作质量门禁。
- **记忆点**：在循环内部 `catch` 后只打印错误，会让脚本最终以 `0` 退出，形成“日志里失败、门禁却通过”的假成功。应收集失败项，并在循环结束后设置 `process.exitCode = 1` 或抛出汇总错误。
- **验证方法**：故意让其中一个最小测试目标失败，确认后续目标仍按策略执行，同时父命令退出码非零且不会打印“全部成功”。
- **来源**：通过 Node.js 脚本控制流与子进程退出行为检查验证。

### 精简注释时保留工具指令

普通说明与工具指令都可能写在注释里，不能用“删除全部注释”替代整理。`@vitest-environment` 会选择测试环境，`eslint-disable` 会影响规则诊断。

- **保留内容**：简明解释设计原因、输入边界、兼容约束和数据格式；类型文档中的有效 `@param` / `@returns` 也应保留。
- **可精简内容**：重复描述代码动作、已由测试名表达的行为、旧实现片段、一次性的排查过程与性能数字。修改说明时需对照当前实现，避免把过时叙述缩短后继续保留。
- **验证方法**：对比移除普通注释后的脚本语法结构、模板编译结果和 CSS 规则，同时单独核对工具指令，再运行相应检查。仅比较去注释后的文本不足以覆盖工具读取注释的行为。
- **验证**：2026-10-19 结合本地 Vitest 3.2.7、ESLint 9.32 的指令解析逻辑和注释整理回归验证；未把临时核验工具加入项目命令。

### 在脏工作区运行 `lint` 前先检查脚本

`pnpm lint`、`npm run lint` 只是脚本名，不保证是只读检查；项目可能把它定义成 `eslint ... --fix`，一执行就会改写整个匹配范围。

- **安全检查**：先读取 `package.json` 中对应脚本；需要只读验证时，直接运行不带 `--fix` 的底层命令，并把路径收窄到本次改动。
- **变更确认**：运行前后比较 `git status --short` 与 `git diff --name-only`，可以及时发现格式化器越界修改。
- **恢复边界**：如果工作区原本已有用户改动，不要直接用覆盖式 Git 命令回退；先精确区分本次工具产生的差异，再取得用户授权或逐项恢复。
- **验证依据**：npm/pnpm 脚本会原样执行 `package.json` 中配置的命令；`eslint --fix` 的语义就是把可自动修复的问题写回文件。实际运行也应以脚本内容和前后 Git 差异为准。

## 自动化测试

### Vitest：不要无意中从 `beforeEach` 返回 mock 函数

Vitest 会把 `beforeEach` 返回的函数当作测试结束后的清理回调。`mockReset()` 返回 mock 本身，因此 `beforeEach(() => mock.mockReset())` 会让框架在测试结束后再次调用这个 mock。

- **症状**：测试正文已经用 `rejects` 正确断言了失败，但整条测试仍因同一个错误失败；也可能出现意外的额外调用。
- **正确写法**：`beforeEach(() => { mock.mockReset(); });`，没有清理需求时让钩子返回 `undefined`。
- **边界**：返回一个专门的清理函数是有意支持的用法，不应一概禁止钩子返回函数。
- **验证依据**：2026-10-15 对照本地 Vitest 3.0.5 runner 的 `callSuiteHook` / `callCleanupHooks` 实现，并通过失败断言测试复现；改为块体且不返回 mock 后通过。不假定其他测试框架具有相同约定。

### Jest 全部 PASS，但进程不退出

测试断言通过与测试进程正常结束是两件事；未关闭的服务器、子进程或定时器都可能继续占用事件循环。

- **诊断命令**：`pnpm exec jest --detectOpenHandles`，它会尝试给出残留句柄的创建堆栈，并隐含串行运行。
- **导入也可能有副作用**：测试为使用校验器或注册表而导入模块时，其运行时依赖仍可能在顶层启动日志上报、服务发现或定时任务；应在测试边界替换依赖，或由创建者在 teardown 关闭资源。纯 `import type` 不属于这种运行时导入。
- **记忆点**：`--forceExit` 只能强制结束进程，不证明资源已经正确释放；`--detectOpenHandles` 有性能开销，适合排障使用。
- **来源**：[Jest CLI 的 detectOpenHandles](https://jestjs.io/docs/cli#--detectopenhandles)；2026-10-09 本地执行验证了“全部断言通过、导入依赖的定时器仍阻止退出”的情况，未保留业务日志或标识。

### Jest 的测试入口由发现规则决定

测试目录可以同时放测试入口、共享测试数据构造器和辅助脚本；文件是否作为独立测试套件运行，要看 Jest 的发现配置。

- **默认约定**：Jest 的默认匹配包含 `__tests__` 目录中的测试源文件，以及其他位置的 `.test` / `.spec` 文件，不能单凭“没有 spec 后缀”断言不会被收集。
- **显式规则**：配置 `testRegex: '.*\\.spec\\.ts$'` 后，测试入口限定为 `.spec.ts` 结尾；普通 `fixtures.ts` 或 `helpers.ts` 可以被测试导入，但不会因此成为独立测试套件。`testMatch` 与 `testRegex` 不能同时配置。
- **辅助脚本**：子进程测试还可能需要独立运行的 `.cjs` 文件，它模拟进程行为，由测试启动，不需要包含 `describe` 或 `it`。
- **验证**：用 `jest --listTests --runInBand` 查看实际收集结果，区分“没有被当成测试入口”与“被其他测试调用时会执行”。
- **来源**：[Jest 测试发现配置](https://jestjs.io/docs/30.0/configuration#testmatch-arraystring)、[testRegex](https://jestjs.io/docs/30.0/configuration#testregex-string--arraystring)；2026-09-10 通过本地测试发现命令验证显式后缀规则与辅助文件未被单独收集。

### Playwright：DOM 存在不等于元素可见

`locator.waitFor()` 默认等待 `visible`，要求元素具有非空边界框且不是 `visibility: hidden`。元素即使已经存在、也已经加上“收起”类，只要尺寸变成零，等待可见仍会超时。

- **只确认节点和状态类存在**：使用 `state: 'attached'`；例如等待折叠后的面板。
- **确认用户看得到内容**：使用 `visible`；确认移除节点则使用 `detached`。
- **注意 `hidden`**：它同时接受节点不存在和节点不可见，不能单独证明某个业务操作已经完成。
- **诊断方法**：区分“找不到元素”与“找到了但不可见”；检查 class/属性、边界框及明确的业务完成状态，不要仅增加超时或重复执行已经完成的操作。

```js
await page.locator('#settings-panel.is-collapsed').waitFor({ state: 'attached' });
```

来源：[Playwright Locator.waitFor](https://playwright.dev/docs/api/class-locator#locator-wait-for) 定义四种等待状态；本地浏览器验证也确认零高度折叠容器会被默认可见性等待判为未就绪。核验日期：2026-09-07。

### Playwright：全局 Cookie 请求头不会按登录域隔离

BrowserContext 的 `extraHTTPHeaders` 作用于该上下文页面发起的每个请求。把整串 Cookie 放进去，跨主机的脚本等资源请求也可能携带它。

- **适合场景**：给自动化浏览器注入登录态前，区分“浏览器 Cookie 存储”与“人为追加全局请求头”。
- **正确边界**：需要登录 Cookie 时，用 `addCookies` 明确配置 `url`，或同时指定 `domain` 与 `path`；访问公共资源不应额外携带凭据。不需要登录态的执行链不要注入 Cookie。
- **风险判断**：收到请求的其他服务能看到人为追加的 Cookie，凭据还可能进入其日志或监控。如果其中是有效、可重用的会话凭据，获得者可能冒用会话；是否可用仍取决于过期、撤销、设备绑定等服务端校验。HTTPS 保护传输过程，不能阻止目标服务读取自己收到的头。合成 Cookie 实验只能证明发送范围，不能据此声称真实账号已泄露。[OWASP 会话管理](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- **验证方法**：两个本地 HTTP 服务分别使用 `127.0.0.1` 和 `localhost`，页面从另一主机加载脚本；只使用虚构 Cookie，检查脚本服务收到的请求头。
- **来源**：[Playwright 全局请求头](https://playwright.dev/docs/api/class-browsercontext#browser-context-set-extra-http-headers)、[addCookies 的作用域参数](https://playwright.dev/docs/api/class-browsercontext#browser-context-add-cookies)；2026-10-09 用本地无头 Chrome 与合成凭据验证跨主机请求确实收到全局 Cookie 头。

## 进程与环境

### Node.js `child.kill()` 不等于子进程已经退出

在 POSIX 系统上，`child.kill()` 默认发送 SIGTERM；子进程可以处理该信号并继续运行。`child.killed` 为 true 只说明信号已成功发送。

- **超时与取消**：父进程的 Promise 拒绝、AbortSignal 触发或超时计时结束，都不能单独证明子进程停止执行。
- **清理策略**：向仍属于本任务的子进程请求退出，等待有限宽限期；仍未退出时按平台使用强制终止，再确认 `exit`/`close`。不要在 PID 已回收后延迟向旧号码发信号，避免命中复用的 PID。
- **有界退出等待（bounded wait）**：为退出等待设置明确时限。比如发送 SIGTERM 后最多等 2 秒，提前退出就立即继续；超时仍存活则发送 SIGKILL，再用另一段有限等待确认退出。数字只是策略示例，不是 Node.js 默认值；最终仍未确认退出时应记录清理失败，不能无限挂住，也不能报告已清理。
- **进程树边界**：终止直接子进程也不自动等于终止所有后代，需按任务拥有的进程树或进程组设计清理。
- **来源**：[Node.js subprocess.kill](https://nodejs.org/api/child_process.html#subprocesskillsignal)、[subprocess.killed](https://nodejs.org/api/child_process.html#subprocesskilled)；2026-10-09 在 macOS 使用捕获 SIGTERM 的本地 Node.js 替身，分别验证了超时与 AbortSignal 返回后子进程仍存活，并在测试结束时显式清理。

### Node.js `os.userInfo().username`：当前进程的系统用户名

`os` 是 Node.js 内置的操作系统模块。`os.userInfo()` 同步返回当前有效操作系统用户的信息对象，`.username` 是读取该对象的用户名属性，默认得到字符串。

```js
import os from 'node:os';

const username = os.userInfo().username;
```

- **返回内容**：对象还包含 `uid`、`gid`、`homedir` 和 `shell`；Windows 下 `uid`、`gid` 为 `-1`，`shell` 为 `null`。
- **身份边界**：结果对应运行进程的系统账号。以服务账号或容器内账号运行时，得到的是该运行账号，不能据此确定网页操作者或已登录的业务用户。
- **调用边界**：不需要 `await`；默认编码为 UTF-8。操作系统缺少用户名或主目录信息时可能抛出 `SystemError`，调用方应按需要处理。
- **来源与验证**：[Node.js `os.userInfo()`](https://nodejs.org/api/os.html#osuserinfooptions)；2026-09-10 在 Node.js v24.19.0 上核验返回值非 Promise、用户名为字符串、`uid` 与 `process.geteuid()` 一致，未记录真实用户名或用户目录。

### IPC：进程间通信

IPC 是 Inter-Process Communication 的缩写，表示进程之间交换消息和数据。Node.js 的 `child_process.fork()` 内置父子进程消息通道：父进程用 `child.send(message)`，子进程用 `process.send(message)`，双方通过 `message` 事件接收。

- **记忆点**：IPC 负责通信，不负责创建线程或保证任务并发。普通对象消息经过序列化和解析，接收方不会直接拿到发送方原来的对象引用。
- **用途**：主进程发送开始、取消等命令，子进程回报进度、结果或错误。
- **来源**：[Node.js subprocess.send](https://nodejs.org/api/child_process.html#subprocesssendmessage-sendhandle-options-callback)。

### `fork()`、`worker_threads` 与异步并发池

任务被命名为 worker，不代表它创建了线程或进程；应查看真正的启动 API。

- **`child_process.fork()`**：启动新的 Node.js 子进程，各自拥有 V8 实例与内存，并内置 IPC 消息通道。模块单例与普通 JS 对象不会直接与父进程共用；文件、数据库等外部资源仍可能共享。
- **`worker_threads.Worker`**：在同一进程中并行执行 JavaScript 的线程，适合 CPU 密集计算；可通过 `SharedArrayBuffer` 显式共享内存。
- **`async` 循环和 `Promise.all()`**：不创建新的 JS 线程或进程；完整机制见[单线程异步并发](/knowledge/frontend/async-concurrency/)，独立任务状态仍需程序显式管理。
- **来源**：[Node.js 子进程与 fork](https://nodejs.org/api/child_process.html#child_processforkmodulepath-args-options)、[Worker threads](https://nodejs.org/api/worker_threads.html)；2026-09-09 对照调用入口、异步循环和共享对象生命周期核验。

### macOS 应用打不开：`-600` / `procNotFound`

macOS 的 `OSStatus -600` 对应 `procNotFound`，SDK 定义为“没有符合指定描述符的可用进程”。它描述一次进程定位或通信失败，不能仅凭错误码认定应用文件损坏、内存不足或硬件故障。

- **先确认对象**：保留完整错误域、错误码和 `AppPath`。桌面弹窗中的应用名称可能不够明确，系统日志中的路径有助于确认实际启动失败的应用。
- **关联日志**：应用启动失败可查 `CoreServicesUIAgent`、`launchservicesd`；打开或保存对话框异常可查 `com.apple.appkit.xpc.openAndSavePanelService`，对照同一时间段的退出、故障和连接错误。
- **判断边界**：多个应用同时异常、重启后恢复，是检查共享系统服务的线索，不足以证明它们有同一个根因；服务退出日志证明退出事实，也未必给出最初触发原因。
- **证据来源**：Apple macOS SDK 的 `CarbonCore.framework/Headers/MacErrors.h` 明确声明 `procNotFound = -600`；[Apple 的 `procNotFound` 条目](https://developer.apple.com/documentation/coreservices/procnotfound)提供符号入口。系统统一日志也可直接出现 `NSOSStatusErrorDomain Code=-600` 与该描述。核验日期：2026-09-08。

### Node.js `spawn()` 子进程只能看到传入的环境

`child_process.spawn()` 的 `options.env` 默认是父进程当前的 `process.env`。一旦显式传入 `env`，子进程看到的就是该对象中的键值；需要在保留原环境的基础上新增变量时，应明确展开 `process.env`。

```js
const env = { ...process.env, SERVICE_MODE: 'local' };
spawn(process.execPath, ['worker.js'], { env });
```

- **诊断线索**：子程序提示缺少环境变量时，先在实际启动它的父进程中检查 `Boolean(process.env.REQUIRED_VAR)`，并保留子进程的 `stderr`。不要为了排查而打印令牌、会话 ID 或其他秘密值。
- **记忆点**：环境属于具体进程。长驻服务不会因为稍后在另一个终端 `export` 变量，或另一个应用向自身进程注入变量，就自动获得更新；应从具备正确环境的入口重启父进程，或由父进程在 `spawn()` 时显式传入所需变量。
- **边界**：写成 `{ env: { REQUIRED_VAR: value } }` 会让子进程只收到这个精简环境，`PATH` 等原有变量也可能丢失；通常使用 `{ ...process.env, REQUIRED_VAR: value }`，除非确实需要隔离环境。
- **来源**：[Node.js `child_process.spawn()`](https://nodejs.org/api/child_process.html#child_processspawncommand-args-options) 说明 `env` 的默认值是 `process.env`，并由传入的 `env` 决定子进程可见变量；[Node.js 环境变量](https://nodejs.org/api/environment_variables.html#processenv) 说明 `process.env` 是当前 Node.js 进程的用户环境对象。
