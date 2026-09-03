---
title: 远程分支领先导致 push 被拒时如何处理
navTitle: 处理本地与远程分叉
description: 用 fetch 判断 ahead/behind，并根据共享分支或个人分支选择 merge、rebase 或 fast-forward。
kind: how-to
audience: 遇到 non-fast-forward、pull 冲突或本地与远程同时有新提交的开发者
lastVerified: "2026-09-02"
order: 4
---

当别人先向同一个远程分支推送后，本地再 push 通常会被拒绝。这不是 Git 要求“远程覆盖本地”，而是远程和本地已经形成两条提交线；必须先把两边历史整合成一条可推送的历史。

## 先区分两种“冲突”

- **push 被拒绝**：常见提示是 `non-fast-forward` 或 `fetch first`。此时通常还没有文件冲突，只是远程存在本地没有的新提交。
- **merge/rebase 文件冲突**：执行历史整合后，双方修改了相同区域，Git 才会停下来要求人工决定最终内容。

不要因为 push 被拒绝就直接反复 `git pull`。先检查状态和配置，避免无意中启动 rebase。

## 第一步：确认工作区和 pull 策略

```bash
git status
git branch -vv
git config --show-origin --get pull.rebase
git config --show-origin --get pull.ff
```

工作区有未提交修改时，先明确它们是否属于当前任务，并完成提交或使用可恢复方式保存。不要在不清楚 staged/unstaged 边界时直接 pull、reset 或覆盖文件。

`pull.rebase=true` 会让普通 `git pull` 在 fetch 后执行 rebase；`false` 才执行 merge。一次性命令中的显式参数比隐含配置更容易审查。

## 第二步：只 fetch，不立即改变工作区

```bash
git fetch origin

# 左边是仅远程存在的提交数，右边是仅本地存在的提交数
git rev-list --left-right --count '@{upstream}...HEAD'

# 查看两边分别有哪些提交
git log --graph --decorate --oneline --left-right '@{upstream}...HEAD'
```

根据计数判断：

| 结果 | 状态 | 处理方式 |
| --- | --- | --- |
| `0 0` | 本地与远程一致 | 无需整合 |
| `N 0` | 仅远程领先 | fast-forward |
| `0 N` | 仅本地领先 | 验证后直接 push |
| `N M` | 两边都有新提交 | 选择 merge 或 rebase |

## 第三步：选择 merge 还是 rebase

| 场景 | 推荐方式 | 原因 |
| --- | --- | --- |
| 共享主干、staging、release 或集成分支 | merge | 保留已发布历史和合并关系，不重写其他人可能依赖的提交 |
| 本地已有重要 merge commit | merge | 普通 rebase 默认会拆开并重新播放 merge 引入的提交 |
| 尚未发布的个人 feature 分支 | rebase | 可以得到线性历史，冲突通常按本地提交逐个解决 |
| 不确定团队策略 | 先停止并确认 | 历史策略错误比多一个 merge commit 更难恢复 |

### 共享分支：使用 merge

```bash
git fetch origin
git merge --no-commit '@{upstream}'
```

如果发生冲突：

```bash
git diff --name-only --diff-filter=U

# 编辑并验证每个冲突文件后
git add -- path/to/resolved-file

# 确认没有未合并路径
git diff --name-only --diff-filter=U

# 运行项目需要的格式、类型和测试检查
git commit
git push
```

`--no-commit` 让 Git 在创建 merge commit 前停下，便于检查自动合并结果。若不想继续，可在尚未提交时使用 `git merge --abort` 返回 merge 前状态。

### 私有分支：使用 rebase

```bash
git fetch origin
git rebase '@{upstream}'
```

遇到冲突时：

```bash
git diff --name-only --diff-filter=U
# 编辑最终内容
git add -- path/to/resolved-file
git rebase --continue
```

每解决一批冲突就继续，直到全部本地提交重放完成；不想继续时使用 `git rebase --abort` 返回 rebase 前的分支状态。

rebase 会创建新的 commit ID。若这些本地提交从未推送，完成后通常可以普通 push；若旧版本已经发布，更新远程可能需要 `--force-with-lease`，但只应在明确允许改写的个人分支上使用。共享分支不要使用普通 `--force`，也不要默认使用 `--force-with-lease`。

## 解决文件冲突时的检查顺序

1. 用 `git status` 确认当前是 merge 还是 rebase。
2. 分别理解 base、当前版本和待整合版本的意图，不要只删除冲突标记。
3. 保留双方仍有效的功能，消除重复、旧接口和失效测试。
4. 检查冲突标记与空白错误：`git diff --check`。
5. 运行受影响模块的类型检查和测试。
6. `git add` 只用于已经审查完成的路径。

`ours` / `theirs` 在 rebase 中容易误解：merge 时 `ours` 通常是当前分支、`theirs` 是正在合入的提交；rebase 时 Git 正在把本地提交重放到 upstream 上，含义会反转到“新基底”和“正在重放的提交”。因此不要在未查看内容时批量选择一侧。

## push 时远程又被别人更新

如果冲突处理期间远程再次前进，push 仍可能被拒绝。这不表示上一轮处理无效，只需要重复：

```text
fetch → 查看新分叉 → 按原策略 merge/rebase → 验证 → push
```

不要为了抢先推送而 force 覆盖共享分支。远程每前进一步，本地都需要重新证明最终提交包含两边的新历史。

## `git pull` 应该怎么用

`git pull` 等于 fetch 加一种历史整合方式。熟悉当前状态后可以使用显式模式：

```bash
# 只允许快进；出现分叉就停下来
git pull --ff-only

# 明确使用 merge
git pull --no-rebase

# 明确使用 rebase
git pull --rebase
```

多人共享分支上，`--ff-only` 是很安全的默认探测：没有本地分叉时直接更新，有分叉时停止并让开发者显式决定 merge 或 rebase。

### 推荐的仓库本地安全配置

如果一个仓库主要操作共享集成分支，并且不希望普通 `git pull` 自动改写或合并历史，可以只在该仓库设置：

```bash
git config --local pull.rebase false
git config --local pull.ff only
```

这组配置允许无分叉时 fast-forward；一旦本地和远程都有新提交，pull 会停止，让开发者先 fetch、检查分叉，再显式选择 merge 或 rebase。`--local` 只修改当前仓库的 `.git/config`，不会改变其他仓库。

如果仓库中只有某个共享分支不应 rebase，而其他个人分支仍希望默认 rebase，可以使用更窄的 branch 配置：

```bash
git config --local branch.<shared-branch>.rebase false
```

无论默认配置是什么，关键操作仍建议在命令行显式写出 `--ff-only`、`--no-rebase` 或 `--rebase`，让本次历史策略可见。

## 完成验证

```bash
git status --short --branch
git rev-list --left-right --count '@{upstream}...HEAD'
git log -3 --oneline --decorate
```

push 成功后应满足：工作区符合预期、没有进行中的 merge/rebase，ahead/behind 为 `0 0`，本地 HEAD 与 upstream 指向同一提交。

## 依据

- [git-pull](https://git-scm.com/docs/git-pull)：fetch 后使用 fast-forward、merge 或 rebase 集成远程历史。
- [git-merge](https://git-scm.com/docs/git-merge)：merge 冲突、`--no-commit` 与 `--abort`。
- [git-rebase](https://git-scm.com/docs/git-rebase)：提交重放、`--continue` 与 `--abort`。
- [git-push](https://git-scm.com/docs/git-push)：fast-forward 限制与 `--force-with-lease` 边界。
