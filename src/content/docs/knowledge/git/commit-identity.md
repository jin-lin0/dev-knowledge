---
title: Git 提交身份、远端认证与仓库权限
navTitle: Git 身份与远端权限
description: 区分提交记录中的作者、连接代码托管平台的账号，以及决定能否推送的仓库权限。
kind: explanation
audience: 在一台电脑上使用一个或多个 Git 托管账号的开发者
lastVerified: "2026-08-31"
order: 2
---

“提交显示成谁”和“能否把提交推送到远端”是两套独立机制。多账号环境中的大多数困惑，都来自把提交元数据、远端认证、平台权限和提交归属当成了同一个身份。

## 四个环节分别回答什么

```text
git config user.name / user.email
              ↓
写入 commit 的 author 和 committer 元数据
              ↓
SSH Key 或 HTTPS Token 认证远端平台账号
              ↓
平台检查该账号是否拥有目标仓库和分支的写入权限
              ↓
平台再根据提交邮箱等规则显示提交归属
```

| 环节 | 回答的问题 | 常见控制项 |
| --- | --- | --- |
| 提交身份 | 这个 commit 记录的作者和提交者是谁 | `user.name`、`user.email` |
| 远端认证 | 当前连接向平台证明了哪个账号 | SSH Key、凭据管理器、Access Token |
| 仓库授权 | 已认证账号是否允许推送 | 仓库角色、团队权限、分支规则 |
| 平台归属 | 平台把 commit 展示到哪个个人资料 | 提交邮箱、已验证邮箱、平台规则 |

Git 官方的 `git-config` 文档说明，`user.name` 和 `user.email` 决定 commit 对象中的 author 与 committer 字段；它们不是远端登录凭据：[git-config](https://git-scm.com/docs/git-config)。因此，把 `user.email` 改成某个平台账号的邮箱，不会让当前 SSH 连接自动切换到那个账号。

## 提交身份是 commit 的一部分

创建提交时，Git 会把作者和提交者的姓名、邮箱与时间写进 commit。全局配置提供默认值，仓库本地配置可以覆盖它：

```bash
# 查看当前仓库最终生效的值及其来源
git config --show-origin --get user.name
git config --show-origin --get user.email

# 只为当前仓库设置身份
git config user.name "Example Developer"
git config user.email "developer@example.com"
```

不带 `--global` 时，写入的是当前仓库的 `.git/config`；本地值会覆盖全局值。Git 的配置作用域和优先级见 [First-Time Git Setup](https://git-scm.com/book/en/v2/Getting-Started-First-Time-Git-Setup)。

修改配置只影响之后创建的 commit，不会自动重写已有历史。查看最近一次提交实际记录的元数据：

```bash
git log -1 --format=fuller
```

## 远端认证决定平台看到哪个账号

推送时，托管平台需要验证连接方身份：

- SSH 远端通常通过私钥签名，平台根据已登记的公钥识别账号。
- HTTPS 远端通常通过凭据管理器保存的 Token 或其他凭据识别账号。

先确认仓库使用哪种远端地址：

```bash
git remote -v
```

对于 GitHub SSH，可以测试当前密钥被识别成哪个账号：

```bash
ssh -T git@github.com
```

成功消息会包含用户名，并提示平台不提供 shell。GitHub 特别说明这个测试命令即使认证成功也会以状态码 `1` 退出，因此应判断消息内容，不能只判断退出码：[Testing your SSH connection](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/testing-your-ssh-connection)。

## 认证成功不代表具有推送权限

认证只证明“你是谁”，授权才决定“你能做什么”。一个 SSH Key 可以成功识别为某个账号，但该账号如果没有仓库写权限，推送仍会失败。组织仓库中，GitHub 的 `Write`、`Maintain` 和 `Admin` 角色通常允许推送，但分支保护或 ruleset 仍可能限制目标分支：[Repository roles](https://docs.github.com/en/organizations/managing-user-access-to-your-organizations-repositories/managing-repository-roles/repository-roles-for-an-organization)。

因此，排查推送失败时应按顺序确认：

1. `git remote -v` 是否指向预期仓库和协议。
2. SSH 或 HTTPS 凭据是否认证成预期账号。
3. 该账号是否拥有仓库写权限。
4. 目标分支是否受到分支保护、ruleset 或只允许 Pull Request 的流程限制。

## 推送成功不代表提交会归属到当前账号

平台展示提交作者时，通常根据 commit 中的邮箱匹配账号，而不是根据谁执行了 `git push`。因此，账号 A 可以推送一个 author 邮箱属于账号 B 的 commit。

GitHub 使用本地 Git 配置中的提交邮箱关联账号；要让提交显示在个人资料中，应使用已添加并验证的邮箱，或平台提供的 `noreply` 地址：[Setting your commit email address](https://docs.github.com/en/account-and-profile/how-tos/email-preferences/setting-your-commit-email-address)。

这也解释了两个常见现象：

- **能推送，但提交头像或贡献记录不对**：优先检查 commit 邮箱与平台账号的邮箱关联。
- **提交作者显示正确，但无法推送**：优先检查远端认证账号和仓库权限，而不是修改 `user.name`。

## 多账号环境的稳定配置思路

每个仓库需要同时解决两个映射：

```text
仓库路径 → 正确的提交姓名与邮箱
远端主机别名 → 正确的 SSH Key 或 HTTPS 凭据
```

提交身份可以使用仓库本地配置，或在大量仓库中使用 Git 条件包含；SSH 多账号通常为不同密钥设置不同的 `Host` 别名，再让各仓库远端引用对应别名。无论采用哪种方案，都应分别验证提交元数据和认证账号，不要用其中一个结果推断另一个。

## 最小验证清单

```bash
# 1. 当前提交身份及其配置来源
git config --show-origin --get user.name
git config --show-origin --get user.email

# 2. 最近一次提交真正记录的作者与提交者
git log -1 --format=fuller

# 3. 当前仓库连接到哪里、使用什么协议
git remote -v

# 4. SSH 场景下，远端识别成哪个账号
ssh -T git@github.com
```

最后再到托管平台确认该账号的仓库角色与目标分支规则。只有四个环节都对应预期，提交展示和推送行为才会一致。
