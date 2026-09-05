# Dev Knowledge

一个基于 Astro 的个人开发知识库。内容使用 Markdown 编写，站点导航、目录、主题和搜索均为项目内自定义实现，输出为可直接部署到 Vercel 的纯静态网站。

## 开始使用

环境要求：Node.js 22.12 或更高版本，推荐 Node.js 24。

```bash
pnpm install
pnpm dev
```

本地开发地址默认为 `http://localhost:4321`。
全文搜索在开发模式和生产模式下都可以使用。

## 内容位置

所有文档位于：

```text
src/content/docs/
```

在 `src/content/docs/knowledge/` 下创建 Markdown 文件后，知识库侧边栏和搜索索引会自动更新。

## 构建检查

```bash
pnpm check
pnpm build
pnpm preview
```

构建产物位于 `dist/`，不需要提交到 Git。

## 部署到 Vercel

1. 检查当前改动并手动创建第一次提交。
2. 推送到你自己的 GitHub 私有仓库。
3. 在 Vercel 中导入该 GitHub 仓库。
4. Vercel 会自动识别 Astro；保持默认构建设置即可。

这是纯静态站点，不需要安装 Vercel Adapter，也不需要配置环境变量或数据库。
构建时会自动读取 Vercel 提供的 `VERCEL_PROJECT_PRODUCTION_URL`，用于生成正确的 canonical URL。

## 内容原则

- 把知识库当作个人学习记忆，不直接归档聊天答案或任务日志。
- 用户问到或任务中遇到的通用技术知识，经过验证后默认积累，包括基础概念、冷门命令、参数、比较和易错点。
- 小知识进入便于扫描的速记页面；机制、流程和成体系内容再整理成专题文章。
- 优先更新现有主题或分类速记页，避免为每个命令单独创建页面。
- 每个一级知识目录只表达一个稳定领域，分类首页负责按问题和学习路径组织内容；不要把 CSS、框架、系统命令和后端机制混入同一个“杂项”页面。
- 速记页内部按问题域分组而不是按添加时间排列；单个条目发展出完整机制或操作流程后，提升为专题并从原处链接过去。
- 优先引用官方文档、源代码和实际运行结果，让证据靠近它支持的结论。
- 上传前删除公司内部信息、凭据、客户数据与其他敏感内容。
- 不自动提交或推送；所有 Git 变更由维护者人工检查后完成。

完整收录与编辑标准见 [`src/content/docs/writing-guide.md`](src/content/docs/writing-guide.md)。
