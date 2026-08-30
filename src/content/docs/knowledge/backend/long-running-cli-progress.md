---
title: 长时间 CLI 任务要报告真实阶段进度
description: 用阶段、真实工作单元和持久化进度避免长计算看起来像卡死。
kind: how-to
audience: 正在实现批处理、采集或分析型命令行工具的开发者
order: 3
---

长时间 CLI 只打印“开始”和“完成”，用户无法区分正常计算、死循环、数据库锁和写盘停滞。进度必须来自计算引擎的真实工作单元，而不是外层定时器模拟。

## 先拆阶段

典型分析任务可以拆成：

```text
读取输入
→ 加载依赖数据
→ 计算/模拟
→ 汇总指标
→ 持久化明细
→ 保留策略与收尾
```

每个阶段报告 `current`、`total` 和人类可读信息：

```ts
type Progress = {
  stage: "load" | "compute" | "persist" | "complete";
  current: number;
  total: number;
  message: string;
};
```

## 使用真实工作单元

不同阶段应选择不同单位：

- 数据加载：实体数量。
- 模拟计算：事件或任务数量。
- 汇总：规则 × 周期 × 样本组合数量。
- 持久化：实际写入记录数。

不要只在计算阶段显示百分比。大量逐条插入数据库时，持久化可能比计算更慢；若写库没有进度，用户仍会在 90% 处误以为任务卡死。

## 控制输出频率

逐条打印会严重拖慢终端和日志系统。可以把进度映射为固定桶，例如每 5% 输出一次：

```ts
const bucket = Math.floor((current / total) * 20);
if (bucket > lastBucket || current === total) {
  report({ current, total });
  lastBucket = bucket;
}
```

对于非交互日志，优先使用普通换行而不是依赖 `\r` 覆盖同一行，确保保存后的日志仍然可读。

## 引擎与展示解耦

计算函数接收可选 `onProgress` 回调：

```ts
runTask({
  onProgress(progress) {
    console.log(`[${progress.stage}] ${progress.message}`);
  },
});
```

核心引擎不知道终端、网页或日志系统。CLI 可以打印文字，网页可以转成进度条，测试可以记录阶段序列。

## 完成信息

最终输出至少应包含：

- 处理输入数。
- 产生结果数。
- 跳过或失败数。
- 持久化记录数。
- 清理或保留结果。
- 总耗时与输出位置。

测试应验证关键阶段都出现、最后一个阶段是 `complete`，并确保零结果和大量结果都不会除零或永久停在 99%。
