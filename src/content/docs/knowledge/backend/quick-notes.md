---
title: 本地服务与网络速记
description: 本地服务监听地址、端口和浏览器 Origin 的常见区别与易错边界。
kind: note
audience: 开发或调试本地 HTTP、TCP 服务的开发者
lastVerified: "2026-09-01"
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
