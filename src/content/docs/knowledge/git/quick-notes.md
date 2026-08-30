---
title: Git 命令与易忘知识点
navTitle: Git 快速复习
description: 按使用场景整理 Git 命令、参数和容易混淆的边界。
kind: note
audience: 希望快速复习 Git 行为和命令的开发者
lastVerified: "2026-08-31"
order: 3
---

这是一份持续增长的 Git 速记页。每个条目只保留能够帮助回忆、排查和正确使用命令的信息；需要完整机制时，再进入对应专题文章。

## 查看某项配置的实际来源

```bash
git config --show-origin --get user.email
```

- **适合场景**：全局和仓库配置同时存在，不确定当前值为什么与预期不同。
- **记忆点**：`--show-origin` 同时显示最终读取到的值及其配置文件来源；仓库本地配置通常会覆盖全局配置。
- **延伸阅读**：[Git 提交身份、远端认证与仓库权限](/knowledge/git/commit-identity/)。
- **来源**：[git-config](https://git-scm.com/docs/git-config)。

## 同时查看 author 与 committer

```bash
git log -1 --format=fuller
```

- **适合场景**：确认最近一次提交真正记录的作者、提交者以及两组时间。
- **记忆点**：`fuller` 格式会分别显示 `Author`、`AuthorDate`、`Commit` 和 `CommitDate`，适合排查代提交、变基或身份配置问题。
- **来源**：[git-log 的 pretty formats](https://git-scm.com/docs/git-log#_pretty_formats)。

## 确认 GitHub SSH 密钥对应哪个账号

```bash
ssh -T git@github.com
```

- **适合场景**：一台电脑配置了多个 GitHub 账号或多把 SSH Key，需要确认当前连接被识别成谁。
- **记忆点**：认证成功的消息会包含用户名，但 GitHub 不提供 shell，因此该命令成功认证后仍会以状态码 `1` 退出；应判断消息内容，不能只判断退出码。
- **来源**：[GitHub：Testing your SSH connection](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/testing-your-ssh-connection)。
