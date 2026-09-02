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
- **记忆点**：`--show-origin` 显示 Git 配置层最终读取到的值及其配置文件来源；仓库本地配置通常会覆盖全局配置。它不会显示 `GIT_AUTHOR_*`、`GIT_COMMITTER_*` 等环境变量造成的提交身份覆盖。
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

## GitHub 仓库改名后，旧 remote 为什么还能使用

GitHub 会把指向仓库旧位置的 `git clone`、`git fetch` 和 `git push` 请求重定向到新位置；本地仓库的 `.git/config` 不会因此自动改写，所以 `git remote -v` 仍可能显示旧 URL。

- **排查**：用 `git remote -v` 查看当前保存的 fetch/push URL，用 `git config --show-origin --get remote.origin.url` 确认配置来源。
- **更新**：确认新地址后运行 `git remote set-url origin https://github.com/OWNER/NEW_REPOSITORY.git`，再用 `git remote -v` 验证。
- **记忆点**：旧地址能工作只是托管平台提供的兼容重定向，不等于本地配置已更新。GitHub 建议仍然改成新地址；若旧仓库名以后被重新使用，重定向会失效，而且作为 GitHub Action 使用的已改名仓库不会被重定向。
- **来源**：[GitHub：Renaming a repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/renaming-a-repository)。
