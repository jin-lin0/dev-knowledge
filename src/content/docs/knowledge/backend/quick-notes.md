---
title: 本地服务与系统任务速记
description: 本地服务监听、网络边界与 macOS 后台任务的常见区别和易错点。
kind: note
audience: 开发或调试本地服务、网络与后台任务的开发者
lastVerified: "2026-09-03"
order: 5
---

## `localhost`、`127.0.0.1` 与 `::1`

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

## 固定端口与端口 `0`

Node.js 服务监听端口 `0` 时，由操作系统分配当前未使用的端口；指定正整数端口则使用固定端口。

- **适合场景**：测试、并行任务和一次性本地工具适合端口 `0`，可以减少冲突；书签、回调地址或固定代理配置需要稳定 URL 时应指定固定端口。
- **记忆点**：固定端口被其他进程占用时，服务通常以 `EADDRINUSE` 启动失败；端口 `0` 只保证本次绑定时由系统选择可用端口，不保证下次仍相同。
- **来源**：[Node.js `server.listen()` 文档](https://nodejs.org/api/net.html#serverlistenport-host-backlog-callback)。

## Monorepo 中同名 `pnpm run` 脚本取决于当前 package

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

## `launchd`：macOS 的后台服务与定时任务管理器

`launchd` 不只是类似 `cron` 的定时器，而是 macOS 管理系统级 daemon、用户级 agent 和 XPC 服务的统一进程管理器。普通用户的自动化通常使用 `~/Library/LaunchAgents/<label>.plist`：用户登录时加载，并以该用户身份执行；需要系统级、跨用户后台服务时才考虑由管理员安装到 `/Library/LaunchDaemons/`。

| 配置键 | 作用 | 关键边界 |
| --- | --- | --- |
| `StartCalendarInterval` | 按时、日、星期或月份运行 | 它本身不负责唤醒 Mac；休眠期间错过会在下次唤醒后补跑一次，多次错过会合并为一次 |
| `StartInterval` | 每隔 N 秒尝试运行 | 休眠期间或上一次仍在运行时错过的触发不会补跑 |
| `RunAtLoad` | job 被加载时运行一次 | 当前手册建议避免不必要的登录或开机抢跑 |
| `KeepAlive` | 持续运行，或按退出状态、路径等条件重启 | 快速反复退出会被节流，不适合普通每日脚本 |
| `WatchPaths` | 路径发生修改时启动 | 当前手册明确警告它可能漏事件且触发时文件未必稳定 |
| `QueueDirectories` | 目录非空期间保持任务运行 | 适合待处理队列，不等于可靠的文件变更订阅 |
| `StartOnMount` | 挂载文件系统时启动 | 适合外置磁盘或卷相关任务 |

plist 还可以声明 `WorkingDirectory`、`EnvironmentVariables`、`StandardOutPath`、`StandardErrorPath` 和资源限制。`ProgramArguments` 直接形成进程参数，不会自动经过 shell，因此管道、重定向、通配符和 shell 变量不会自然生效；复杂逻辑通常放进一个有明确解释器和绝对路径的脚本，再让 `launchd` 调用该脚本。

常用管理与诊断命令：

```bash
# 加载当前用户的 agent
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.example.task.plist

# 立即运行一次，并查看状态与最近退出码
launchctl kickstart -k gui/$(id -u)/com.example.task
launchctl print gui/$(id -u)/com.example.task

# 卸载
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.example.task.plist
```

- **屏幕关闭、休眠与关机**：只有显示器休眠而系统仍醒着时，任务可以准时执行。整机休眠时，`StartCalendarInterval` 不会主动唤醒 Mac，而是在用户操作、网络维护或其他电源事件让系统醒来后补跑；机器关机期间错过的时间不会补跑。需要登录后也检查一次的任务，应在脚本中实现幂等和“今天是否已完成”的判断，而不是假设所有错过事件都会恢复。
- **需要准时唤醒时**：电源唤醒计划属于 `pmset`，与 `launchd` 的任务计划相互独立。先用 `pmset -g sched` 检查现有计划，再按需设置唤醒时间；`pmset` 只允许一对重复的开机/唤醒与关机/睡眠事件，不能在不了解现有计划时直接覆盖。

  ```bash
  # 每天 23:25 唤醒；让 launchd 在几分钟后执行实际任务
  sudo pmset repeat wake MTWRFSU 23:25:00

  # 查看与取消重复电源计划
  pmset -g sched
  sudo pmset repeat cancel
  ```

  `pmset` 的唤醒只负责让系统恢复运行，不保证网络、外置磁盘或第三方服务已经立即可用；实际任务仍应处理依赖暂时不可用和重复执行。关机后通过计划开机时，如果启用了 FileVault，仍需要用户登录，不能把它当作无人登录的 LaunchAgent 执行环境。
- **解读 `pmset -g sched`**：每行的 `[n]` 只是列表序号，`wake` 是电源事件类型，日期时间采用当前系统的本地时间，`by '…'` 是登记该事件的 owner 标识。`com.apple.alarm.user-invisible-…` 表示 Apple 后台组件登记、不会作为普通用户闹钟展示的系统事件，不代表未知第三方程序。

  macOS 内部 owner 名称不都是公开 API，但可以用本机服务定义区分已验证事实与推断。例如：

  - `com.apple.calaccessd.travelEngine.periodicRefreshTimer` 来自 CalendarDaemon 中的 `calaccessd`，用于日历行程时间引擎的周期刷新。
  - 在 macOS 15.6.1 中，`com.apple.acmd.alarm` 字符串来自 `AppleCredentialManagerDaemon`；它的本机 LaunchDaemon 定义包含 `ACMTRMEvent_ScheduleWakeup`，程序还引用 `allowUSBRestrictedMode`。因此可以确认它属于 Apple 凭据与有线附件 Restricted Mode 的安全维护，而不是“时钟”App 闹钟；Apple 没有公开该内部 alarm 每次唤醒的更细业务步骤。

  这类一次性系统唤醒事件会由 macOS 按需新增、改期或消费，通常不需要手动删除。它们也不等于用户通过 `pmset repeat` 配置的那一对重复电源计划。
- **环境边界**：LaunchAgent 不会自动继承交互式终端里的完整 `PATH`、shell 初始化和临时环境变量。执行 Git、Node.js 等工具时应设置必要环境、使用稳定的绝对路径，并把 stdout/stderr 写入日志。
- **权限边界**：用户级 agent 通常不需要 root，只拥有该用户本身的文件、钥匙串和网络权限；`launchd` 不会替脚本绕过 Git 认证、macOS 隐私权限或应用沙箱。
- **来源**：[Apple：Scheduling Timed Jobs](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/ScheduledJobs.html)、[Apple：Creating Launch Daemons and Agents](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/CreatingLaunchdJobs.html)、[Apple：Schedule your Mac to turn on or off in Terminal](https://support.apple.com/guide/mac-help/schedule-your-mac-to-turn-on-or-off-mchl40376151/mac)、[Apple：Manage accessory access](https://support.apple.com/guide/deployment/manage-accessory-access-depf8a4cb051/web)。配置键、`launchctl bootstrap`、`bootout`、`kickstart` 与 `print`，以及 `pmset` 的重复计划限制，也由 macOS 15.6.1 自带的 `launchd.plist(5)`、`launchd(8)`、`launchctl(1)` 和 `pmset(1)` 手册复核；`calaccessd` 与 `acmd` 的映射来自同一台机器上的 LaunchAgent/LaunchDaemon 定义和系统二进制标识。
