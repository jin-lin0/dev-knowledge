---
title: 用 SQLite 构建本地分析型 Web 应用
description: 让服务端按需查询本地 SQLite，以分页、聚合和读模型安全展示大体量数据。
kind: explanation
audience: 正在设计单机数据采集与分析工具的全栈开发者
lastVerified: "2026-08-31"
order: 2
---

个人分析工具不一定需要远程数据库。数据采集、计算和使用都发生在同一台电脑时，可以把 SQLite 作为唯一数据源，由本地 Web server 查询，再把小型读模型返回浏览器。

本文讨论的是这种应用从数据访问、查询准备、时间口径到数据生命周期的整体设计边界，不是 SQLite 语法或通用数据库入门教程。

## 推荐边界

```text
浏览器
  → 本地 Web server
  → server-only repository
  → SQLite
```

浏览器不应直接读取数据库文件，也不应接收全表 JSON。页面或 API 只返回当前视图需要的数据，例如：

- 指定实体的最近一段时间序列。
- 指定规则和周期的聚合指标。
- 带 `LIMIT/OFFSET` 的明细页。
- 数据覆盖、失败任务和日期范围摘要。

## 为页面建立读模型

数据库写入模型通常围绕采集和幂等设计，页面查询方向可能完全不同。例如写入主键按“数据类型、日期、实体”排序，而详情页需要“实体、数据类型、日期倒序”。应根据真实页面查询增加辅助索引：

```sql
CREATE INDEX idx_factor_entity
ON factor_snapshots(entity_id, factor_type, observed_at DESC);

CREATE INDEX idx_trades_rule
ON trades(run_id, rule_id, horizon, sample, event_date DESC);
```

索引服务于访问模式，不应机械地为每个字段建索引。大型现有数据库首次创建索引可能持有写锁，应在采集停止后升级并启动新版本。

## 不要在页面请求中同步创建大索引

`CREATE INDEX IF NOT EXISTS` 虽然幂等，但“索引不存在”时仍会扫描整张表。若把它放在每次连接都会执行的通用 schema 初始化中，第一次页面请求可能同步构建数百万行索引；使用同步 SQLite API 时还会阻塞整个 Web server 事件循环，表现为所有页面卡死。

大索引应改为显式准备步骤：

```text
停止采集写入
  → 运行 prepare 命令
  → 逐个创建索引并显示耗时
  → 执行 ANALYZE
  → 写入索引版本标记
  → 启动 Web server
```

页面启动时只读取轻量版本标记。未准备时展示明确命令或返回 `503`，不能回退到无索引全表扫描。索引已经存在时，prepare 命令可以安全重复执行。

## 分页和上限必须在服务端

明细查询应限制页大小，图表接口也要限制最大点数：

```ts
function clampInt(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
) {
  if (
    (typeof value !== 'number' && typeof value !== 'string') ||
    (typeof value === 'string' && value.trim() === '')
  ) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

const pageSize = clampInt(requestedPageSize, 10, 100, 25);
const pointLimit = clampInt(requestedPointLimit, 30, 1000, 300);
```

不能只做 `Math.min`/`Math.max`：查询参数缺失、为空、是非数字字符串或 `NaN` 时，都应使用明确的默认值。应先解析并验证有限整数，再执行上下限裁剪。收益分布、净值曲线等视图可以只查询需要的数值列，而不是加载包含大 JSON 的完整记录。数据量继续增长后，可进一步在服务端按时间桶聚合。

## 跨来源按日统计必须统一日界线

两个数据源都返回 `yyyy-MM-dd`，不代表它们覆盖同一个 24 小时区间。服务端日桶可能按 UTC 切分，本地日志却常按系统时区切分；在 UTC+8 地区，本地某日 `00:00–07:59` 实际属于前一个 UTC 日。直接按日期字符串并排后，单机值甚至可能看起来大于“全部设备”值。

对比前应先明确每条序列的日界线：

- 服务端日桶没有小时级明细时，不要尝试把它猜测性地拆回本地自然日。
- 将本地事件按服务端的时区重新分桶，并让查询窗口、图表日历和日期格式化使用同一时区。
- 成本明细等面向用户自然日的视图可以继续使用本地时区；比较视图应通过显式查询参数选择 UTC 或本地日界线。
- 数据库保存绝对时间戳作为事实字段，派生的 `day_key` 只用于特定读模型，不能成为唯一时间依据。

SQLite 中可直接从 Unix 时间戳生成 UTC 日桶：

```sql
SELECT strftime('%Y-%m-%d', occurred_at, 'unixepoch') AS utc_day,
       SUM(token_count)
FROM usage_events
WHERE occurred_at >= ? AND occurred_at < ?
GROUP BY utc_day;
```

回归测试应至少放入两条“本地同一天、UTC 不同天”的记录，验证 UTC 查询会拆成两个日桶，而原有本地日查询仍合并为一天。还应覆盖 UTC 年初、日末以及负时区日期格式化，防止查询正确但图表标签再次偏移。

## 先确认浏览器打开的是正确本地服务

多个开发工具可能同时占用常见端口。若应用启动时自动换到下一个端口，而用户仍访问旧地址，页面可能显示另一个服务或产生大量看似属于当前应用的 404。

本地应用应：

- 为主要服务固定一个明确端口，或在启动日志中突出实际 URL。
- 在页面标题、品牌和健康接口中提供可识别身份。
- 遇到路由 404 时先核对地址栏、页面身份和启动终端，不要立即归因于路由代码。
- 更新生产构建后重新 build/restart，不能让旧 server 继续响应新页面链接。

自动化验收也应读取页面标题或品牌文本，不能只验证 `localhost` 返回了 HTTP 200。

## 图表必须提供尺度和浏览方式

仅有折线形状但没有日期轴、数值轴、单位或零线，用户无法判断变化幅度和方向。时间序列至少应提供：

- 开始和结束日期。
- 数值刻度与单位。
- 正负数据的零线。
- 最新值的文字解释。
- 长时间序列的范围切换、拖动或缩放。

图表负责帮助比较，文字负责说明指标边界；不能让用户根据一个无坐标的形状猜含义。

## 灵活 JSON 与稳定列并存

外部 API 字段不稳定时，原始因子可以先保存在 JSON 中；用于高频过滤和排序的稳定字段应逐步提升为普通列或物化表。通用原则是：

```text
JSON 保存完整性与兼容性
普通列承担高频查询与索引
```

不要让浏览器负责解析数百万条 JSON，也不要在每次页面请求中重复计算可以离线汇总的指标。

## SQLite 运行边界

[WAL 模式](https://www.sqlite.org/wal.html) 允许读取与写入并发，但同一时刻仍只有一个写入者，因此适合“一个采集写入者 + 多个页面读取者”的单机结构。本地工具还应注意：

- 短连接应在请求结束后关闭；应用级长连接可以复用，但要及时结束语句和事务，并在服务退出时关闭。
- 长查询必须有日期范围和行数上限。
- schema 初始化使用 `CREATE ... IF NOT EXISTS` 保持幂等。
- 基础小索引可以随 schema 初始化；大索引迁移必须离开请求路径，并避开正在运行的长采集任务。
- 在线备份优先使用 SQLite Backup API 或 `VACUUM INTO`。若手动复制文件，应停止写入、关闭数据库连接并完成最终 checkpoint 后再复制主文件；WAL 中仍有未 checkpoint 的提交时，不能只复制主文件。

## 为大明细表设置保留窗口

重复分析运行通常会产生“小汇总 + 大明细”。如果每次都永久保留逐条明细，本地数据库会按运行次数线性增长。适合个人工具的策略是：

- 所有当前运行先完整写入并提交成功。
- 只保留最近 N 次完整运行。
- 用主表外键 `ON DELETE CASCADE` 删除旧运行对应的指标和明细。
- 汇总导出可以单独保留为小型 JSON/HTML。
- `0` 或显式配置可表示不自动清理，避免把策略写死。

顺序必须是“新运行成功 → 再清旧运行”，不能在计算开始前删除最后一份可用结果。

SQLite 删除记录后只会把页加入 freelist，数据库文件通常不会立即缩小；后续写入可以复用这些页。需要把空间真正归还文件系统时，应提供独立维护命令：

```text
停止写入者和 Web server
  → checkpoint/truncate WAL
  → VACUUM
  → ANALYZE
```

`VACUUM` 是写操作；存在阻止写入的连接锁或未结束事务时会失败，并且执行时最多可能需要接近数据库大小两倍的额外可用空间，因此不应在每次运行结束后自动执行。具体边界见 SQLite 的 [VACUUM](https://www.sqlite.org/lang_vacuum.html) 与 [Backup API](https://www.sqlite.org/backup.html) 文档。

## 何时不适用

以下情况应考虑远程或专用分析数据库：

- 多台设备同时写入。
- 多用户远程访问。
- 单次查询需要扫描数十亿行。
- 需要高并发、权限隔离或持续可用性。

对于单用户、单机、数百万到数千万行的个人研究工具，本地 SQLite 加服务端读模型通常更简单，也能避免部署、凭据和数据同步成本。是否继续适用仍应通过代表性查询的延迟、数据库体积、WAL 增长和备份耗时来判断，而不能只看行数。
