---
title: 后端与数据库易忘知识点
description: HTTP 路由异常、数据库字段、数据生命周期与服务端存储的常见区别。
kind: note
audience: 希望快速复习数据库与后端机制的开发者
lastVerified: "2026-09-10"
order: 5
---

## HTTP 路由与异常

### 服务级 context 与请求级 context

`context` 通常只是程序给普通上下文对象起的名字，没有自动创建状态或管理生命周期的语言机制；要看对象在哪里创建、传给了谁。

- **服务级上下文**：在服务启动时组装依赖、配置与进程内状态，由该实例的多个路由共享。它便于复用连接和服务，也方便测试注入替身。
- **请求级上下文**：每次请求单独创建，保存该次请求、响应、解析后的 URL 等信息。不能仅因两者都叫 context，就认为生命周期相同。
- **状态边界**：进程内 Map、取消控制器与进行中的 Promise 不等于持久化数据；重启后能否恢复任务，需要额外的存储与恢复机制。
- **类型边界**：TypeScript 的 interface 只约束对象形状。仅包含接口、类型别名及 type imports 的文件，不会因为被导入就生成对应的运行时对象。
- **来源**：2026-09-10 对照服务启动、路由参数传递和关闭流程核验；本地 TypeScript 转译验证只含上述类型声明的模块仅保留模块标记，没有业务对象初始化。

### NestJS `Cannot GET /path`：路由兜底 404

当堆栈指向 NestJS `routes-resolver` 的 `registerNotFoundHandler` 回调，且错误为 `NotFoundException: Cannot GET /path`，表示该请求落入路由未匹配的兜底处理。它与已命中业务接口后抛出的“资源不存在”404，需要结合堆栈与路由上下文区分。

- 这条堆栈可以定位异常产生的位置，不能识别发起请求的人或服务，也不能单独证明服务崩溃、受到攻击或某次业务执行失败。
- 全局异常过滤器可以捕获这种异常；是否写日志、是否发送群通知，取决于应用策略，不能仅根据 `WARN` 推断不会通知。
- 核对服务地址、请求方法、全局前缀与实际注册路由；需要定位来源时查看访问日志中的连接来源、请求 ID、User-Agent 和代理链。代理后的连接地址可能只是网关；不能把未经可信代理校验的 `X-Forwarded-For` 直接当真实来源。
- **来源**：[NestJS v11.1.12 路由兜底源码](https://github.com/nestjs/nest/blob/v11.1.12/packages/core/router/routes-resolver.ts#L136-L150)、[NestJS 异常过滤器](https://docs.nestjs.com/exception-filters)、[Express 代理信任配置](https://expressjs.com/en/guide/behind-proxies/)。本条验证日期：2026-09-08。

## 数据生命周期

### 普通 SELECT 后再写入，不自动构成原子判断

两个实例都可能先查到“没有运行任务”或“任务仍待执行”，随后各自启动。因此，数据库可共享状态，但独立的查询与写入并不能自动保证只有一个执行者。

- **领取同一任务**：可用针对已有任务行的条件更新，只有状态转换成功的一方执行；或者在短事务内锁定候选任务并提交领取状态。
- **限制同一资源上的多个任务**：需要对相同调度范围或资源位进行互斥、容量控制；分别锁住不同任务行，不会自动形成全局并发上限。
- **事务边界**：锁只覆盖领取与状态变更，不应持有数据库事务等待远端长任务完成。
- **来源**：[MySQL InnoDB Locking Reads](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html) 明确说明普通 SELECT 后再插入或更新不足以防止其他事务修改数据；结合任务领取与执行分离的源码路径核验于 2026-09-10。

### `deleted_at`：软删除、回收站与文件删除

软删除（逻辑删除）保留数据库记录，只改变它是否出现在正常查询中；物理删除才移除记录。`deleted_at` 是常见约定，不是数据库自动赋予功能的特殊字段。

- 正常列表筛选 `deleted_at IS NULL`；移入回收站时写入删除时间。
- 回收站筛选 `deleted_at IS NOT NULL`；恢复时把该字段设回 `NULL`。
- 列表和详情接口都需要遵守删除状态及访问权限；仅增加一列不会自动生成回收站页面或恢复接口。
- Sequelize v6 可以通过 `paranoid: true` 实现这类行为，需要启用 timestamps；原始 SQL 不会自动补充软删除过滤。详见 [Sequelize Paranoid 文档](https://sequelize.org/docs/v6/core-concepts/paranoid/)。

如果记录只是引用外部文件的 URL，更新删除标记本身不会删除文件，也不会撤销该 URL 的访问。文件清理与 CDN 缓存失效需要另外处理，不能把“从列表隐藏”描述成“文件已经彻底删除”。例如 CloudFront 的缓存失效会让后续请求重新访问源站，不等于删除源站对象；客户端已有缓存也不一定同时失效。详见 [CloudFront 缓存失效说明](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Invalidation.html)。
