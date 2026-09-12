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

## Workspace 与构建

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

### 批量构建必须传播失败退出码

批量构建多个子项目时，可以继续处理后续目标以收集完整结果，但最终命令必须在任一子构建失败时返回非零退出码。

- **适合场景**：一个脚本循环执行多个应用、包或平台构建，并被 `check`、CI 或发布流程当作质量门禁。
- **记忆点**：在循环内部 `catch` 后只打印错误，会让脚本最终以 `0` 退出，形成“日志里失败、门禁却通过”的假成功。应收集失败项，并在循环结束后设置 `process.exitCode = 1` 或抛出汇总错误。
- **验证方法**：故意让其中一个最小测试目标失败，确认后续目标仍按策略执行，同时父命令退出码非零且不会打印“全部成功”。
- **来源**：通过 Node.js 脚本控制流与子进程退出行为检查验证。

### 在脏工作区运行 `lint` 前先检查脚本

`pnpm lint`、`npm run lint` 只是脚本名，不保证是只读检查；项目可能把它定义成 `eslint ... --fix`，一执行就会改写整个匹配范围。

- **安全检查**：先读取 `package.json` 中对应脚本；需要只读验证时，直接运行不带 `--fix` 的底层命令，并把路径收窄到本次改动。
- **变更确认**：运行前后比较 `git status --short` 与 `git diff --name-only`，可以及时发现格式化器越界修改。
- **恢复边界**：如果工作区原本已有用户改动，不要直接用覆盖式 Git 命令回退；先精确区分本次工具产生的差异，再取得用户授权或逐项恢复。
- **验证依据**：npm/pnpm 脚本会原样执行 `package.json` 中配置的命令；`eslint --fix` 的语义就是把可自动修复的问题写回文件。实际运行也应以脚本内容和前后 Git 差异为准。

## 自动化测试

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

## 进程与环境

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
