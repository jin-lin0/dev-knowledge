---
title: 后端与数据库易忘知识点
description: 数据库字段、数据生命周期与服务端存储的常见区别。
kind: note
audience: 希望快速复习数据库与后端机制的开发者
lastVerified: "2026-09-07"
order: 5
---

## 数据生命周期

### `deleted_at`：软删除、回收站与文件删除

软删除（逻辑删除）保留数据库记录，只改变它是否出现在正常查询中；物理删除才移除记录。`deleted_at` 是常见约定，不是数据库自动赋予功能的特殊字段。

- 正常列表筛选 `deleted_at IS NULL`；移入回收站时写入删除时间。
- 回收站筛选 `deleted_at IS NOT NULL`；恢复时把该字段设回 `NULL`。
- 列表和详情接口都需要遵守删除状态及访问权限；仅增加一列不会自动生成回收站页面或恢复接口。
- Sequelize v6 可以通过 `paranoid: true` 实现这类行为，需要启用 timestamps；原始 SQL 不会自动补充软删除过滤。详见 [Sequelize Paranoid 文档](https://sequelize.org/docs/v6/core-concepts/paranoid/)。

如果记录只是引用外部文件的 URL，更新删除标记本身不会删除文件，也不会撤销该 URL 的访问。文件清理与 CDN 缓存失效需要另外处理，不能把“从列表隐藏”描述成“文件已经彻底删除”。例如 CloudFront 的缓存失效会让后续请求重新访问源站，不等于删除源站对象；客户端已有缓存也不一定同时失效。详见 [CloudFront 缓存失效说明](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Invalidation.html)。
