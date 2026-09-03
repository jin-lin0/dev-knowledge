---
title: Git 命令与易忘知识点
navTitle: Git 快速复习
description: 按使用场景整理 Git 命令、参数和容易混淆的边界。
kind: note
audience: 希望快速复习 Git 行为和命令的开发者
lastVerified: "2026-09-03"
order: 3
---

这是一份持续增长的 Git 速记页。每个条目只保留能够帮助回忆、排查和正确使用命令的信息；需要完整机制时，再进入对应专题文章。

## 撤销尚未推送的最新 commit，并保留文件修改

`git reset` 的模式决定撤销 commit 后，修改留在索引还是工作区：

```bash
# 只移动 HEAD：修改仍在 Staged Changes
git reset --soft HEAD~1

# 移动 HEAD 并重置索引：修改回到未暂存的 Changes
git reset --mixed HEAD~1
# --mixed 是默认值，也可简写为：git reset HEAD~1
```

- **适合场景**：最新 commit 尚未推送，希望重新整理或修改后再提交。
- **记忆点**：`--soft` 只重置 HEAD；`--mixed` 重置 HEAD 和 index，但保留 working tree；想回到 GUI 的未暂存 `Changes` 应使用 `--mixed`。操作后用 `git status` 核对。
- **边界**：不要为了保留修改使用 `--hard`，它会同时重置 HEAD、索引和工作区。已经推送到共享分支的提交通常不应直接 reset 改写历史，应根据协作情况考虑 `git revert`。
- **来源**：[git-reset](https://git-scm.com/docs/git-reset)；结论也由本机 `git reset -h` 的模式说明复核。

## 将未评审 Changes 备份到远端，同时保持本地未暂存

远端 Git 只能保存 commit；可以创建一次 WIP commit，将它通过显式 refspec 推到独立备份分支，再把本地 HEAD mixed reset 回去：

```bash
git status --short
git add -A
git commit -m "wip: backup unreviewed changes"
git push origin HEAD:refs/heads/chore/wip-backup-YYYYMMDD
git reset --mixed HEAD~1
git status
```

- **结果**：远端 `chore/wip-backup-YYYYMMDD` 保留 WIP commit；当前本地分支回到原 HEAD，文件内容仍在 working tree，并统一显示为未暂存 Changes。
- **边界**：`git add -A` 不包含 ignored 文件，也不会保留原有 staged/unstaged 分组；提交钩子若会自动修改文件，也可能改变最终快照。推送前至少检查文件列表和敏感信息，备份分支不要直接作为正式合并分支。
- **不要混淆**：普通 `git stash` 默认只保存在本地仓库，电脑和本地仓库一起丢失时不能充当远端备份。
- **恢复**：可从任意新 clone 中查看备份分支，或基于该分支恢复文件；不需要改写正式远端分支历史。
- **保持本地状态完全不变**：自动化场景可以改用 `GIT_INDEX_FILE`、`read-tree`、`write-tree` 和 `commit-tree` 构造快照，详见[用临时索引创建不改变工作区的 Git 快照](/knowledge/git/temporary-index-snapshot/)。
- **来源**：[git-push 的 refspec](https://git-scm.com/docs/git-push#Documentation/git-push.txt-refspec)、[git-reset](https://git-scm.com/docs/git-reset)。命令模式也由本机 Git 帮助复核。

## `.gitignore` 不会自动取消已经跟踪的文件

`.gitignore` 只决定未跟踪文件是否应被 Git 忽略。一个文件只要已经进入索引，即使后来匹配 ignore 规则，修改后仍会出现在 `git status` 中。

```bash
# 确认文件是否已被跟踪
git ls-files --stage path/to/generated-file

# 即使文件已跟踪，也检查它本应匹配哪条 ignore 规则
git check-ignore -v --no-index path/to/generated-file

# 确认团队确实不再提交该文件后，只从索引移除并保留本地文件
git rm --cached -- path/to/generated-file
```

- **记忆点**：添加 ignore 规则和取消跟踪是两个独立动作。`git rm --cached` 会把“从仓库删除该路径”加入下一次提交，但不会删除工作区文件；之后匹配的 ignore 规则才会阻止它再次被普通 `git add` 加入。
- **边界**：有些仓库会默认忽略整个生成目录，但用 `git add -f` 按需跟踪少数生成物。看到“tracked + ignored”不能仅凭目录名判断是错误，应同时检查项目文档、生成/构建流程和同目录历史文件。
- **来源**：[gitignore](https://git-scm.com/docs/gitignore) 明确说明已跟踪文件不受影响；[git-rm](https://git-scm.com/docs/git-rm) 说明 `--cached` 只从索引移除路径。

## 删除冲突标记不等于 Git 已标记冲突解决

手工编辑冲突文件只会改变工作区；只要索引中仍保留冲突的 stage 1/2/3 条目，`git status --short` 就仍会显示 `UU` 等未合并状态。

```bash
# 检查索引中仍未解决的路径和各阶段条目
git status --short
git ls-files -u

# 审核最终文件后，把当前内容写入索引并标记该路径已解决
git add -- path/to/file
```

- **适合场景**：文件内已经看不到 `<<<<<<<`、`=======`、`>>>>>>>`，但 Git 仍报告 `unmerged paths`。
- **记忆点**：冲突标记属于工作区文本，`unmerged` 属于索引状态；删除标记不会自动更新索引。`git add` 不只是“消除提示”，还会把当前文件内容写入索引，因此应先审查合并结果。
- **辅助检查**：`git diff --check` 可以发现常见空白错误和残留冲突标记；`git ls-files -u` 能直接确认索引是否仍有未合并条目。
- **来源**：[Git User Manual：Resolving a merge](https://git-scm.com/docs/user-manual#resolving-a-merge)、[git-status 的 unmerged entries](https://git-scm.com/docs/git-status#_porcelain_format_version_2)、[git-ls-files](https://git-scm.com/docs/git-ls-files)。结论也在 Git 2.39.5 的实际合并状态中复核。

## `pre-commit` 中 ESLint 因 Node 堆内存不足退出

提交输出包含 `Reached heap limit`、`JavaScript heap out of memory` 和 `SIGABRT` 时，直接失败原因是 Node/V8 堆上限，而不是 ESLint 已经报告了某条代码规则错误。大量 staged 文件被 `lint-staged` 一次性交给 ESLint 时尤其容易触发。

```bash
# 先确认本次提交和 Node 默认堆规模
git diff --cached --name-only | wc -l
node -e "const v8=require('v8'); console.log(v8.getHeapStatistics().heap_size_limit / 1024 / 1024)"

# 机器内存充足时，只为这一次终端提交提高堆上限
NODE_OPTIONS=--max-old-space-size=8192 git commit
```

- **记忆点**：`--max-old-space-size` 调整 V8 old space 上限；通过 `NODE_OPTIONS` 设置后会传给提交钩子启动的 Node 子进程。GUI 提交是否继承该变量取决于 GUI 进程的启动环境，因此一次性重试优先从设置变量的同一终端执行。
- **不要混淆**：提高堆上限只是资源层缓解。若钩子经常处理数百文件，应继续评估按 workspace 或文件批次运行 ESLint；不要默认用 `--no-verify` 绕过质量门禁。
- **失败恢复**：`lint-staged` 默认会备份原状态，并在任务失败时回滚任务产生的修改；仍应复查 `git status`、staged/unstaged diff 和 stash，不能只根据日志假设恢复完整。
- **清理提示**：`Cleaning up temporary files...` 表示在任务完成或原状态恢复后，删除隐藏的 unstaged patch 并丢弃本轮自动备份 stash。它作用于当前 working tree/index 的临时恢复材料，不会切换、重置或改写其他分支引用；stash 虽然在仓库内跨分支可见，但只有显式 apply/pop 才会作用到工作区。
- **来源**：[Node.js CLI：`--max-old-space-size` 与 `NODE_OPTIONS`](https://nodejs.org/api/cli.html#--max-old-space-sizesize-in-mib)、[lint-staged：任务参数与失败回滚](https://github.com/lint-staged/lint-staged#readme)。结论也通过 Node 24 的默认堆统计和一次大规模 staged ESLint OOM 日志复核。

## Merge commit 打开提交信息编辑器不代表已经提交

解决冲突后运行 `git commit`，Git 通常会打开预填的 merge commit message。第一行是待提交信息，`# Conflicts:`、状态摘要和所有以 `#` 开头的行都是编辑提示，会被忽略。

- **完成提交**：保留或修改非注释提交信息，保存并正常关闭编辑器；Git 返回终端并输出新 commit 后才算成功。
- **不要重复提交**：编辑器仍打开时，原来的 `git commit` 进程仍在等待，不应另开终端再次运行 `git commit`。
- **验证结果**：运行 `git status`，成功后不再显示 `All conflicts fixed but you are still merging`；也可用 `git log -1 --oneline` 查看最新 commit。
- **记忆点**：`It looks like you may be committing a merge` 是根据 `MERGE_HEAD` 给出的说明，不是错误。确认本来就在合并时，不要删除 `MERGE_HEAD`。
- **来源**：[git-commit](https://git-scm.com/docs/git-commit)、[githooks](https://git-scm.com/docs/githooks)。

## Merge commit 之后执行 `git pull` 突然出现大量文件

先检查 `git status` 和 `git config --show-origin --get pull.rebase`。当 `pull.rebase=true` 时，`git pull` 会先 fetch，再把本地提交重新播放到最新 upstream；普通 rebase 默认不会保留本地 merge commit 的拓扑，可能把合并进来的整组提交重新应用一次。

```bash
git status
git config --show-origin --get pull.rebase
git diff --name-only --diff-filter=U
```

- **不要被数量误导**：rebase 状态里的大量 `A/M` 通常是当前正在重放的提交内容，真正需要人工处理的是 `git status` 的 `Unmerged paths` 或 `git diff --diff-filter=U`。
- **继续或退出**：确认要改写本地提交时，解决冲突、`git add` 后运行 `git rebase --continue`；不希望改写历史或需要保留既有 merge commit 时，使用 `git rebase --abort` 回到 rebase 前的分支状态，再明确选择 merge 工作流。
- **共享分支边界**：已经发布或需要保留合并关系的集成分支，不应无意中使用普通 rebase。一次性拉取可显式选择 `git pull --no-rebase`；长期配置是否修改应按团队工作流决定。
- **完整流程**：[远程分支领先导致 push 被拒时如何处理](/knowledge/git/remote-divergence-workflow/)。
- **来源**：[git-pull](https://git-scm.com/docs/git-pull) 说明 `--rebase` 与 `--no-rebase` 的集成方式；[git-rebase](https://git-scm.com/docs/git-rebase) 说明 detached replay、冲突继续和 `--abort` 恢复原分支。

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
