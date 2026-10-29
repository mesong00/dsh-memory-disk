# 发行版评估与发布清单（2026-10-30，0.5.0）

仓库：<https://github.com/mesong00/dsh-memory-disk>

## 当前发布状态

- 本地 git 已初始化并提交：`17a98fa feat: dsh-memory-disk 0.5.0`；
- 远程已配置为 `https://github.com/mesong00/dsh-memory-disk.git`；
- **push 尚未成功**：当前 git 凭据身份是 `songzdon`，GitHub 返回 `Permission to mesong00/dsh-memory-disk.git denied to songzdon`；
- 需要：把 `songzdon` 加为该仓库 collaborator，或改用 `mesong00` 的凭据/PAT 后执行 `git push -u origin main`。

## 结论

**已经接近“装完就能用”：记忆引擎已内置，首次运行有目录向导，迁移包可导出/导入。**
剩下的主要是 Windows 平台声明、仓库元数据和一次干净环境实测。

已具备：

- `package.json`：`main`、`exports["./client"]`、`dsh.bundle.patch`、`dsh.client.platform = web`；
- Host 半（提示注入、`memory_search`、HTTP 路由、首次运行配置、迁移路由）与浏览器半（手写 lazy-CJS，`settings.section` / `conversation.view` / `sidebar.panellist` + `main`）均在本机 DSH 0.2.1-rc.3 实测通过；
- 引擎已打进 `server/`：`记忆库.py`、`同步对话.py`、`检索记忆.py`、`插件数据.py`、`迁移记忆.py`、`生成目录树.py`、`记忆配置.json`；
- 首次运行：无配置时 UI 显示“选择记忆盘目录”，写入 `%USERPROFILE%\.dsh\memory-disk-plugin.json`，自动 init + sync；
- 迁移：`迁移记忆.py export` / `import --mode merge`，UI 已实测导出和上传导入；
- `npm pack` 包含 `server/`、`docs/`、`LICENSE`、`RELEASE.md`；npm 名称 `dsh-memory-disk` 当前未被占用。

## 仍需处理

1. **平台声明**
   - 目录选择用 PowerShell + WinForms，`open` 用 `explorer.exe`，路径按 Windows 写；
   - 要么 README 明确 “Windows only”，要么为 macOS/Linux 分支 `open`/目录选择器。

2. **Python 依赖**
   - 需要 Python 3.10+ 和 `zstandard`；首次运行向导会检查并提示 `python -m pip install zstandard`；
   - 不内置 Python 运行时（内置会让包增大很多）。

3. **仓库元数据**
   - 发布前填 `repository` / `homepage` / `bugs`（当前只有 author/license）；
   - 建议加 `dsh.compatibility.dshReleases`。

4. **干净环境实测**
   - 在一个没有 F 盘、没有旧配置的 desktop profile 上：安装 → 重启 → 首次选目录 → 三入口 → 搜索/重要度/删除 → 导出 → 新目录导入；
   - 这一步完成后再发布。

## 已实测

- 首次运行：无配置时显示向导，创建 00/01/02/03/04 + DB，随后进入面板；
- 迁移：从 F 盘导出约 10 MB zip（65 文件），导入空目录得到 12 会话/8 记忆；冲突时旧文件备份到 `_回收站/导入冲突_*`；
- **tarball 安装实测**：`npm pack` 后 `dsh plugin --profile web add <tgz>`，`/api/dsh-memory/status` 返回 200，证明包内 `server/` 引擎可用；
- 3 个并发同步 exit 0；路径穿越/绝对路径/`_回收站` 操作被拒绝；
- 6 MB 超大记忆被摘要跳过并告警；
- 前端重置滚动、KPI 3+2、图标的布局已用无头 Edge 截图确认。

## 发布命令

```powershell
cd dsh-memory-plugin
git init
git add .
git commit -m "feat: dsh-memory-disk 0.5.0"
gh repo create dsh-memory-disk --public --source=. --push

npm pack --dry-run
npm publish
```

GitHub Release 附 `dsh-memory-disk-0.5.0.tgz`，写明 Python 版本、Windows 限制和首次运行步骤。
