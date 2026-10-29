# -*- coding: utf-8 -*-
"""DSH 记忆盘 —— 对话同步

把 DSH（DeepSeek Harness）本地会话日志同步进记忆盘：

    原始 zstd 日志  ->  01_对话归档/<年-月>/<年-月-日>/<时间>_<项目>_<标题>/
                          ├── 对话.md            人可读的完整对话
                          ├── 会话摘要.md        结构化速览
                          ├── 会话信息.json      元数据（供程序用）
                          └── 原始事件.jsonl.zst 原始日志副本

同时更新 03_索引/记忆索引.db（SQLite FTS5 全文索引）与 00_说明/目录树.md。

用法：
    python 同步对话.py              # 增量同步
    python 同步对话.py --force      # 强制重建全部归档
    python 同步对话.py --quiet      # 静默（计划任务用）
    python 同步对话.py --no-tree    # 不刷新目录树
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
import time
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
import 记忆库 as 库


def 选择归档目录(db, s: dict, mtime: int, size: int) -> Path:
    """沿用已有归档目录（标题变化时不搬家），否则按日期/项目/标题新建。"""
    row = db.execute('SELECT archive_rel, archive_rel FROM sessions WHERE session_id=?',
                     (s['session_id'],)).fetchone()
    if row and row[0]:
        旧 = 库.根目录 / row[0]
        if 旧.is_dir():
            return 旧

    日期 = 库.本地时间(s['started_ms'])[:10] or time.strftime('%Y-%m-%d')
    年, 月, 日 = 日期.split('-')
    时间 = 库.本地时间(s['started_ms'])[11:16].replace(':', '') or time.strftime('%H%M')
    基础 = f"{时间}_{库.清理名称(s['project'], 20)}_{库.清理名称(s['title'], 34)}"
    候选 = 库.归档目录 / f'{年}-{月}' / 日期 / 基础
    if 候选.exists():
        信息 = 候选 / '会话信息.json'
        同会话 = False
        if 信息.exists():
            try:
                同会话 = json.loads(信息.read_text(encoding='utf-8')).get('session_id') == s['session_id']
            except Exception:
                同会话 = False
        if not 同会话:
            候选 = 候选.with_name(f"{基础}_{s['session_id'][-6:]}")
    return 候选


def 写入归档(s: dict, 目录: Path, 来源: Path) -> None:
    目录.mkdir(parents=True, exist_ok=True)
    相对 = 目录.relative_to(库.根目录).as_posix()
    库.写文本(目录 / '对话.md', 库.渲染对话(s))
    库.写文本(目录 / '会话摘要.md', 库.渲染摘要(s, 相对))

    工具计数: dict[str, int] = {}
    for b in s['blocks']:
        if b['kind'] == 'tool':
            工具计数[b.get('name') or '工具'] = 工具计数.get(b.get('name') or '工具', 0) + 1
    信息 = {
        'session_id': s['session_id'],
        'title': s['title'],
        'project': s['project'],
        'cwd': s['cwd'],
        'started_at': 库.本地时间(s['started_ms']),
        'ended_at': 库.本地时间(s['ended_ms']),
        'status': s['status'],
        'provider': s['provider'],
        'model': s['model'],
        'turns': s['turns'],
        'user_count': s['user_count'],
        'assistant_count': s['assistant_count'],
        'tool_count': s['tool_count'],
        'tool_usage': 工具计数,
        'files': s['files'],
        'source_log': s['source'],
        'archive_dir': 相对,
        'generated_at': time.strftime('%Y-%m-%d %H:%M:%S'),
    }
    库.写文本(目录 / '会话信息.json', json.dumps(信息, ensure_ascii=False, indent=2) + '\n')

    try:
        shutil.copy2(来源, 目录 / '原始事件.jsonl.zst')
    except Exception as exc:
        print(f'[警告] 复制原始日志失败：{exc}', file=sys.stderr)


def 同步(force: bool = False, quiet: bool = False, 刷新目录树: bool = True) -> dict:
    库.确保目录()
    db = 库.连接数据库()
    文件们 = 库.会话文件列表()
    统计 = {'扫描': len(文件们), '新增': 0, '更新': 0, '跳过': 0, '失败': 0}
    错误: list[str] = []
    开始 = time.time()

    for f in 文件们:
        try:
            mtime = f.stat().st_mtime_ns
            size = f.stat().st_size
            父名 = f.parent.name
            row = db.execute('SELECT archive_rel, source_mtime, source_size FROM sessions WHERE session_id=?',
                             (父名,)).fetchone()
            if not force and row and row[1] == mtime and row[2] == size and row[0] \
                    and (库.根目录 / row[0]).is_dir():
                统计['跳过'] += 1
                continue

            events = 库.读取事件(f)
            if not events:
                统计['失败'] += 1
                错误.append(f'{f}：无法解析出任何事件')
                continue

            s = 库.解析会话(events, f)
            s['source_mtime'] = mtime
            s['source_size'] = size
            目录 = 选择归档目录(db, s, mtime, size)
            写入归档(s, 目录, f)
            库.写入会话索引(db, s, 目录.relative_to(库.根目录).as_posix())
            db.commit()
            if row and row[0]:
                统计['更新'] += 1
            else:
                统计['新增'] += 1
        except Exception as exc:
            统计['失败'] += 1
            错误.append(f'{f}：{exc}')
            db.rollback()

    记忆数 = 库.重建记忆索引(db)
    db.commit()

    if 刷新目录树:
        库.生成目录树(写入文件=True)

    耗时 = round(time.time() - 开始, 1)
    统计['长期记忆文件'] = 记忆数
    统计['耗时秒'] = 耗时
    统计['完成时间'] = time.strftime('%Y-%m-%d %H:%M:%S')

    写同步日志(统计, 错误)
    if not quiet:
        print(f"同步完成：扫描 {统计['扫描']} 个会话，新增 {统计['新增']}，更新 {统计['更新']}，"
              f"跳过 {统计['跳过']}，失败 {统计['失败']}，长期记忆 {记忆数} 篇，耗时 {耗时}s")
        for e in 错误:
            print(f'  ! {e}')
    return 统计


def 写同步日志(统计: dict, 错误: list[str]) -> None:
    库.记录目录.mkdir(parents=True, exist_ok=True)
    if not 库.同步日志路径.exists():
        库.写文本(库.同步日志路径,
                '# 同步日志\n\n> 每次自动/手动同步追加一条记录；只保留最近 300 条。\n\n')
    行 = [
        f"{统计['完成时间']} 同步",
        '',
        f"- 扫描会话：{统计['扫描']}  新增：{统计['新增']}  更新：{统计['更新']}  "
        f"跳过：{统计['跳过']}  失败：{统计['失败']}",
        f"- 长期记忆文件：{统计['长期记忆文件']}  耗时：{统计['耗时秒']}s",
    ]
    for e in 错误[:10]:
        行.append(f'- ❌ {e}')

    旧 = 库.同步日志路径.read_text(encoding='utf-8')
    头 = 旧.split('\n## ')[0]
    条目 = [x.strip() for x in 旧.split('\n## ')[1:] if x.strip()]
    条目.append('\n'.join(行))
    新 = 头.rstrip() + '\n\n## ' + '\n\n## '.join(条目[-300:]) + '\n'
    库.写文本(库.同步日志路径, 新)


def main() -> None:
    parser = argparse.ArgumentParser(description='把 DSH 会话日志同步到本地记忆盘')
    parser.add_argument('--force', action='store_true', help='忽略增量判断，重建全部会话归档')
    parser.add_argument('--quiet', action='store_true', help='静默模式（计划任务用）')
    parser.add_argument('--no-tree', action='store_true', help='不刷新目录树')
    args = parser.parse_args()
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    同步(force=args.force, quiet=args.quiet, 刷新目录树=not args.no_tree)


if __name__ == '__main__':
    main()
