---
title: macOS `launchd` 与计划任务
navTitle: macOS launchd 与计划任务
description: 区分 LaunchAgent、LaunchDaemon、定时触发、休眠补跑与 pmset 计划唤醒。
kind: reference
audience: 需要在 macOS 上可靠运行后台服务或定时脚本的开发者
lastVerified: "2026-09-06"
order: 3
---

`launchd` 不只是类似 `cron` 的定时器，而是 macOS 管理系统级 daemon、用户级 agent 和 XPC 服务的统一进程管理器。先区分任务属于用户登录会话还是整台机器，再选择配置位置和触发机制。

## LaunchAgent 与 LaunchDaemon

- 普通用户自动化通常使用 `~/Library/LaunchAgents/<label>.plist`：用户登录时加载，并以该用户身份执行。
- 需要系统级、跨用户后台服务时才考虑由管理员安装到 `/Library/LaunchDaemons/`。
- `launchd` 不会替程序绕过钥匙串、Git 认证、macOS 隐私权限或应用沙箱。

## 常用触发键

| 配置键 | 作用 | 关键边界 |
| --- | --- | --- |
| `StartCalendarInterval` | 按时、日、星期或月份运行 | 不负责唤醒 Mac；休眠期间错过会在下次唤醒后补跑一次，多次错过会合并为一次 |
| `StartInterval` | 每隔 N 秒尝试运行 | 休眠期间或上一次仍在运行时错过的触发不会补跑 |
| `RunAtLoad` | job 被加载时运行一次 | 避免不必要的登录或开机抢跑 |
| `KeepAlive` | 持续运行，或按退出状态、路径等条件重启 | 快速反复退出会被节流，不适合普通每日脚本 |
| `WatchPaths` | 路径发生修改时启动 | 可能漏事件，触发时文件也未必稳定 |
| `QueueDirectories` | 目录非空期间保持任务运行 | 适合待处理队列，不等于可靠的文件变更订阅 |
| `StartOnMount` | 挂载文件系统时启动 | 适合外置磁盘或卷相关任务 |

plist 还可以声明 `WorkingDirectory`、`EnvironmentVariables`、`StandardOutPath`、`StandardErrorPath` 和资源限制。

## `ProgramArguments` 不经过 shell

`ProgramArguments` 直接形成进程参数，因此管道、重定向、通配符和 shell 变量不会自然生效。复杂逻辑放进一个有明确解释器和绝对路径的脚本，再让 `launchd` 调用该脚本。

LaunchAgent 也不会自动继承交互式终端的完整 `PATH`、shell 初始化和临时环境变量。执行 Git、Node.js 等工具时应设置必要环境、使用稳定绝对路径，并把 stdout/stderr 写入日志。

## 常用管理和诊断命令

```bash
# 加载当前用户的 agent
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.example.task.plist

# 立即运行一次，并查看状态与最近退出码
launchctl kickstart -k gui/$(id -u)/com.example.task
launchctl print gui/$(id -u)/com.example.task

# 卸载
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.example.task.plist
```

配置文件能加载不代表任务完成。至少检查 label、当前 state、最近退出码，以及标准输出和错误日志。

## 屏幕关闭、休眠与关机

- 只有显示器休眠而系统仍醒着时，任务可以准时执行。
- 整机休眠时，`StartCalendarInterval` 不会主动唤醒 Mac，而是在用户操作、网络维护或其他电源事件让系统醒来后补跑。
- 多次错过的 calendar 触发会合并，不会逐次重放。
- 机器关机期间错过的时间不能假设一定补跑。

需要登录后也检查一次的任务，应在脚本中实现幂等和“当前周期是否已完成”的判断，而不是完全依赖调度器补偿。

## 需要准时唤醒时使用 `pmset`

电源唤醒计划属于 `pmset`，与 `launchd` 的任务计划相互独立。先检查现有计划，再按需设置：

```bash
# 每天 23:25 唤醒；让 launchd 在几分钟后执行实际任务
sudo pmset repeat wake MTWRFSU 23:25:00

# 查看与取消重复电源计划
pmset -g sched
sudo pmset repeat cancel
```

`pmset` 只允许一对重复的开机/唤醒与关机/睡眠事件，不能在不了解现有计划时直接覆盖。唤醒也只保证系统恢复运行，不保证网络、外置磁盘或第三方服务已经就绪；实际任务仍需处理依赖暂时不可用和重复执行。

关机后通过计划开机时，如果启用了 FileVault，仍需要用户登录，不能把它当作无人登录的 LaunchAgent 执行环境。

## 解读 `pmset -g sched`

每行的 `[n]` 是列表序号，`wake` 是电源事件类型，日期时间采用当前系统本地时间，`by '…'` 是登记事件的 owner 标识。

`com.apple.alarm.user-invisible-…` 表示 Apple 后台组件登记、不会作为普通用户闹钟展示的系统事件，不等于未知第三方程序。macOS 内部 owner 名称不都是公开 API，需要区分本机可验证映射和推测：

- `com.apple.calaccessd.travelEngine.periodicRefreshTimer` 来自 CalendarDaemon 中的 `calaccessd`，用于日历行程时间引擎周期刷新。
- 在 macOS 15.6.1 中，`com.apple.acmd.alarm` 字符串来自 `AppleCredentialManagerDaemon`；本机 LaunchDaemon 定义包含 `ACMTRMEvent_ScheduleWakeup`，程序还引用 `allowUSBRestrictedMode`。可以确认它属于 Apple 凭据与有线附件 Restricted Mode 的安全维护，但 Apple 没有公开每次唤醒更细的内部步骤。

这类一次性系统唤醒事件会由 macOS 按需新增、改期或消费，通常不需要手动删除，也不等于用户通过 `pmset repeat` 配置的重复电源计划。

## 可靠性清单

- 任务脚本可重复执行，不因补跑产生重复副作用。
- 使用绝对路径或明确环境，不依赖交互式 shell 初始化。
- 标准输出和错误输出落到可检查的位置。
- 对网络、磁盘和认证暂时不可用设置清晰失败状态或重试策略。
- 用 `launchctl print` 和任务结果验证实际状态，不把“已加载”当作“已完成”。

## 来源

- [Apple：Scheduling Timed Jobs](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/ScheduledJobs.html)
- [Apple：Creating Launch Daemons and Agents](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/CreatingLaunchdJobs.html)
- [Apple：Schedule your Mac to turn on or off in Terminal](https://support.apple.com/guide/mac-help/schedule-your-mac-to-turn-on-or-off-mchl40376151/mac)
- [Apple：Manage accessory access](https://support.apple.com/guide/deployment/manage-accessory-access-depf8a4cb051/web)

配置键、`launchctl bootstrap`、`bootout`、`kickstart`、`print` 与 `pmset` 的重复计划限制，也由 macOS 15.6.1 自带的 `launchd.plist(5)`、`launchd(8)`、`launchctl(1)` 和 `pmset(1)` 手册复核；`calaccessd` 与 `acmd` 的映射来自同一台机器上的 LaunchAgent/LaunchDaemon 定义和系统二进制标识。
