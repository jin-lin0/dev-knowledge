---
title: 用临时索引创建不改变工作区的 Git 快照
navTitle: 临时索引与底层快照
description: 从工作区、索引、对象库和引用理解 GIT_INDEX_FILE、read-tree、write-tree、commit-tree 与 push refspec。
kind: explanation
audience: 想备份未提交修改，同时保持当前 HEAD、暂存区和工作区不变的开发者
lastVerified: "2026-09-03"
order: 5
---

通常用 `git add` 和 `git commit` 创建提交，但它们会更新真实索引和当前分支。少数自动化或备份场景要求“远端拥有一个可恢复的 commit，同时本地所有状态原封不动”，这时可以使用临时索引和 Git plumbing 命令构造快照。

这不是日常提交的首选流程。它适合明确需要隔离真实索引的工具或脚本；普通开发仍优先使用容易理解、会运行项目 hooks 的 `git add`、`git commit` 和独立 WIP 分支。

## 先理解 Git 的五层状态

| 层次 | 保存什么 | 常见位置或名称 |
| --- | --- | --- |
| 工作区 | 当前磁盘上实际看到和编辑的文件 | working tree |
| 索引 | 下一次 commit 准备记录的文件快照 | `.git/index`，也叫 staging area |
| 对象库 | 不可变的 blob、tree、commit 对象 | `.git/objects/` |
| 引用 | 指向某个对象的可移动名字 | `refs/heads/main`、分支、标签 |
| HEAD | 当前检出的分支，或直接指向某个 commit | `.git/HEAD` |

对象库中的主要对象：

- blob 保存单个文件的字节内容；
- tree 保存目录结构、文件名、模式，以及对应 blob 或子 tree 的哈希；
- commit 指向一个根 tree、零个或多个父 commit，并记录作者、时间和提交说明；
- branch 本身不是文件快照，只是一个通常指向最新 commit 的 ref。

因此，“创建 commit 对象”和“让当前分支指向这个 commit”是两件不同的事。普通 `git commit` 一次完成这两件事；`git commit-tree` 只做前者。

## 普通提交为什么会改变本地状态

常规流程是：

```text
工作区 ──git add──> 真实索引 ──git commit──> tree + commit
                                              │
                                              └─ 当前分支与 HEAD 前进
```

如果之后运行 `git reset --mixed HEAD~1`，当前分支会退回父 commit，真实索引重置为父 commit，文件内容则留在工作区。最终可以重新看到未暂存 Changes，但过程中真实索引和当前分支确实发生过变化，提交 hooks 也可能运行。

## 临时索引方案的结构

临时索引方案在真实索引旁边创建另一份 index：

```text
                   ┌──────────────────────────────┐
真实索引 ──────────┤ 全程不变                     │
当前 HEAD/分支 ────┤ 全程不变                     │
工作区 ────────────┤ 全程不变                     │
                   └──────────────────────────────┘

HEAD tree ──read-tree──> 临时索引
工作区 ─────git add────> 临时索引
临时索引 ──write-tree─> 新 tree
新 tree ──commit-tree─> 新 commit 对象
新 commit ─────push───> 远端备份分支
```

核心是给单条 Git 命令设置 `GIT_INDEX_FILE`。这个环境变量告诉 Git：本次命令不要使用仓库真实的 `.git/index`，改用指定文件。

## 第一步：把基准版本装入临时索引

```bash
GIT_INDEX_FILE=/tmp/example-wip-index \
  git read-tree <base-commit>
```

`git read-tree` 把指定 tree-ish 的目录状态读入索引。传入 commit 时，Git 会解析出该 commit 的根 tree。

这里使用当前 HEAD 作为基准，含义是：“先假设临时索引与当前正式版本完全一样”。因为没有传 `-u`，命令不会把任何内容检出到工作区。

`GIT_INDEX_FILE=...` 只影响紧随其后的这一条命令，不会永久修改 Git 配置。

## 第二步：将当前文件状态写入临时索引

```bash
GIT_INDEX_FILE=/tmp/example-wip-index \
  git add -A -- .
```

各部分含义：

- `git add` 将工作区状态更新到索引；
- `-A` 同时记录新增、修改和删除；
- `--` 表示后面的内容都按路径解析，不再当成命令选项；
- `.` 表示从当前仓库目录开始处理；
- `GIT_INDEX_FILE` 让所有更新只进入临时索引。

该命令不会修改真实 staging area，但会把需要的新 blob 写入共享对象库。被 `.gitignore` 忽略的文件仍不会加入；子模块内部尚未提交的内容也不会自动变成父仓库的普通文件快照。

如果同一个文件同时有 staged 和 unstaged 修改，临时快照保存的是工作区最终文件内容，不会在远端 commit 中保留“两层修改”的区别。本地真实索引仍然原样保留。

## 第三步：从临时索引创建 tree

```bash
GIT_INDEX_FILE=/tmp/example-wip-index git write-tree
```

`git write-tree` 将当前索引表示的完整目录状态写成 tree 对象，并在标准输出打印 tree 哈希。它不会创建 commit，也不会移动任何分支。

Git 对象使用内容寻址：相同内容会得到相同对象 ID，已有对象可以直接复用；对象创建后不会原地修改。

## 第四步：创建一个未绑定分支的 commit 对象

```bash
git commit-tree <snapshot-tree> \
  -p <base-commit> \
  -m "wip: backup unreviewed changes"
```

参数含义：

- `<snapshot-tree>`：这个 commit 要保存的完整目录快照；
- `-p <base-commit>`：父提交，表示快照基于哪个历史版本；
- `-m`：提交说明。

命令返回新 commit 的哈希。与普通 `git commit` 不同，它不会更新当前 branch、HEAD 或 index，也不会自动运行常规 commit hooks。它只是把 commit 对象写入对象库。

此时如果没有任何 ref 指向新 commit，它在本地属于不可达对象，将来可能被垃圾回收；因此接下来要创建一个远端 ref 保存它。

## 第五步：用 refspec 创建远端备份分支

```bash
git push origin \
  <snapshot-commit>:refs/heads/chore/wip-backup-YYYYMMDD
```

push refspec 的基本格式是：

```text
<src>:<dst>
```

- `<src>` 是本地源对象，可以是分支名、HEAD，也可以是任意可解析的 commit 哈希；
- `<dst>` 是要更新的远端 ref；
- `refs/heads/...` 表示远端普通分支；
- `origin` 是远端仓库的本地别名。

Git 会发送该 commit 所需且远端尚未拥有的对象，然后让远端备份分支指向它。因为没有创建或更新本地分支，也没有使用 `-u`，本地不会增加 tracking branch 关系。

## 第六步：验证而不是凭感觉判断

```bash
git ls-remote --heads origin refs/heads/chore/wip-backup-YYYYMMDD
git branch --show-current
git rev-parse HEAD
git diff --cached --quiet
git status --short --branch
```

- `git ls-remote` 读取远端分支和它指向的 commit；
- `git branch --show-current` 确认当前分支名；
- `git rev-parse HEAD` 确认 HEAD 哈希；
- `git diff --cached --quiet` 用退出码判断真实索引是否存在改动，不打印 diff；
- `git status` 确认工作区和 staging area 的最终状态。

临时索引使用完后可以删除。它只是一次性 staging area，不是远端快照本身；远端恢复依赖的是已推送的 commit 和分支。

## 如何恢复远端快照

建议在干净工作区或新 clone 中操作：

```bash
git fetch origin chore/wip-backup-YYYYMMDD
git switch -c recover-wip origin/chore/wip-backup-YYYYMMDD
```

只恢复某个文件时，可以在确认目标路径后使用：

```bash
git restore \
  --source=origin/chore/wip-backup-YYYYMMDD \
  -- path/to/file
```

## 适用边界

临时索引方案适合：

- 自动化工具需要创建快照，但不能改变用户真实 index；
- staged/unstaged 状态必须完整保留；
- 当前分支不能临时移动；
- 只想创建备份 ref，不准备直接合并这个 WIP commit。

不适合把它当成常规团队提交方式，因为：

- 命令底层且不直观，手工输入更容易出错；
- 不运行日常 commit hooks；
- 新 commit 默认没有本地分支名；
- ignored 文件、仓库外文件和子模块内部未提交内容仍需单独处理；
- 远端分支对有权限的协作者可见，推送前仍应检查凭据和敏感数据。

## 来源

- [gitglossary：working tree、index、object、tree 与 ref](https://git-scm.com/docs/gitglossary)
- [git-read-tree](https://git-scm.com/docs/git-read-tree)
- [git-write-tree](https://git-scm.com/docs/git-write-tree)
- [git-commit-tree](https://git-scm.com/docs/git-commit-tree)
- [git-push：refspec](https://git-scm.com/docs/git-push#Documentation/git-push.txt-refspec)

上述行为也使用本机 Git 2.39 系列手册和一次远端备份操作结果复核。
