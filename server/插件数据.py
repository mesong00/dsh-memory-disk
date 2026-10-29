# -*- coding: utf-8 -*-
"""Web UI 数据接口：给 dsh-memory-disk 插件提供 JSON。

用法：
    python 插件数据.py status
    python 插件数据.py search "增程器" --limit 8 [--role user] [--project QGC]
    python 插件数据.py sync
    python 插件数据.py memories
    python 插件数据.py importance "02_长期记忆/项目/QGC增程器状态显示.md" 5
    python 插件数据.py delete "02_长期记忆/知识/某条.md"
    python 插件数据.py reindex

只输出 JSON 到 stdout；错误写 stderr 并返回非 0。
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import 记忆库 as 库
import 检索记忆 as 检索

记忆根 = 库.根目录 / '02_长期记忆'

MAX_MEMORY_FILES = 500
MAX_MEMORY_CHARS = 200_000
MAX_MEMORY_FILE_BYTES = 2 * 1024 * 1024
MAX_DISK_MB = 500
MIN_FREE_MB = 200


def 压缩(text, 上限=320):
    s = re.sub(r'\s+', ' ', str(text or '')).strip()
    return s[:上限] + ('…' if len(s) > 上限 else '')


def 解析记忆(md: Path) -> dict:
    text = md.read_text(encoding='utf-8')
    元 = {}
    body = text.lstrip('\ufeff')
    if body.startswith('---'):
        段 = body.split('---', 2)
        if len(段) >= 3:
            for line in 段[1].splitlines():
                m = re.match(r'^([^:：]+)[:：]\s*(.*)$', line.strip())
                if m:
                    元[m.group(1).strip()] = m.group(2).strip()
            body = 段[2].lstrip('\n')

    标题 = ''
    for line in body.splitlines():
        if line.startswith('#'):
            标题 = line.lstrip('# ').strip()
            break

    正文行 = []
    for line in body.splitlines():
        line = line.strip()
        if not line or line.startswith(('#', '```', '|', '---')):
            continue
        line = re.sub(r'!\[[^\]]*\]\([^)]*\)', '', line)
        line = re.sub(r'\[([^\]]+)\]\([^)]*\)', r'\1', line)
        line = re.sub(r'^[-*>]\s*', '', line)
        line = re.sub(r'[*_`]', '', line)
        正文行.append(line.strip())
    摘要 = next((x for x in 正文行 if len(x) >= 8 and re.search(r'[\u4e00-\u9fff]', x)
                 and not re.match(r'^[A-Za-z]:[\\/]', x) and '://' not in x), '')
    if not 摘要:
        摘要 = next((x for x in 正文行 if len(x) >= 8), '')

    更新 = 元.get('更新') or datetime.fromtimestamp(md.stat().st_mtime).strftime('%Y-%m-%d')

    类型 = 元.get('类型') or md.parent.name
    默认 = 3
    if any(k in 标题 for k in ('用户画像', '偏好与约定')):
        默认 = 5
    elif 类型 in ('项目', '经验'):
        默认 = 4
    elif 类型 == '事件':
        默认 = 2
    原始 = 元.get('重要度') or 元.get('重要性')
    try:
        重要度 = int(原始) if 原始 else 默认
    except ValueError:
        重要度 = 默认
    重要度 = max(1, min(5, 重要度))

    return {
        'path': md.relative_to(库.根目录).as_posix(),
        'title': 标题 or md.stem,
        'type': 类型,
        'importance': 重要度,
        'updated': 更新,
        'chars': len(body),
        'gist': 压缩(摘要, 90),
    }


def 全部记忆() -> list[dict]:
    if not 记忆根.exists():
        return []
    行 = []
    for md in sorted(记忆根.rglob('*.md')):
        try:
            相对 = md.relative_to(记忆根)
        except ValueError:
            continue
        if any(part.startswith(('_', '.')) for part in 相对.parts):
            continue
        try:
            if md.stat().st_size > MAX_MEMORY_FILE_BYTES:
                continue
        except OSError:
            continue
        try:
            行.append(解析记忆(md))
        except Exception:
            continue
    行.sort(key=lambda x: (-x['importance'], x['title']))
    return 行


def 安全路径(相对: str) -> Path:
    p = (库.根目录 / 相对).resolve()
    根 = 记忆根.resolve()
    if p != 根 and not str(p).lower().startswith(str(根).lower() + os.sep):
        raise ValueError('路径不在 02_长期记忆 内')
    if p.suffix.lower() != '.md':
        raise ValueError('只能操作 .md 记忆文件')
    try:
        相对部分 = p.relative_to(根)
    except ValueError:
        raise ValueError('路径不在 02_长期记忆 内')
    if any(part.startswith(('_', '.')) for part in 相对部分.parts):
        raise ValueError('不能操作 _回收站 或隐藏目录中的文件')
    if not p.exists():
        raise ValueError(f'记忆不存在：{相对}')
    return p


def 写重要度(text: str, 值: int) -> str:
    if text.startswith('\ufeff'):
        text = text[1:]
    if text.startswith('---'):
        段 = text.split('---', 2)
        if len(段) >= 3:
            行 = 段[1].splitlines()
            已改 = False
            for i, line in enumerate(行):
                if re.match(r'^(重要度|重要性)\s*[:：]', line.strip()):
                    行[i] = f'重要度: {值}'
                    已改 = True
            if not 已改:
                行.append(f'重要度: {值}')
            return '---\n' + '\n'.join(行).strip('\n') + '\n---\n\n' + 段[2].lstrip('\n')
    return f'---\n重要度: {值}\n---\n\n{text.lstrip()}'


def 设置重要度(相对: str, 值: int) -> dict:
    p = 安全路径(相对)
    值 = max(1, min(5, int(值)))
    text = p.read_text(encoding='utf-8')
    p.write_text(写重要度(text, 值), encoding='utf-8')
    return 解析记忆(p)


def 删除记忆(相对: str) -> dict:
    p = 安全路径(相对)
    rel = p.relative_to(记忆根)
    目标根 = 记忆根 / '_回收站' / datetime.now().strftime('%Y%m%d-%H%M%S')
    目标 = 目标根 / rel
    序号 = 1
    while 目标.exists():
        目标 = 目标根 / f'{rel.stem}-{序号}{rel.suffix}'
        序号 += 1
    目标.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(p), str(目标))
    return {
        'deleted': p.relative_to(库.根目录).as_posix(),
        'moved_to': 目标.relative_to(库.根目录).as_posix(),
    }


def 重建索引() -> int:
    db = 库.连接数据库()
    数量 = 库.重建记忆索引(db)
    db.commit()
    return 数量


def 状态() -> dict:
    db = 库.连接数据库()
    会话数 = db.execute('SELECT COUNT(*) FROM sessions').fetchone()[0]
    消息数 = db.execute('SELECT COUNT(*) FROM messages').fetchone()[0]
    记忆数 = db.execute('SELECT COUNT(*) FROM memories').fetchone()[0]
    起止 = db.execute('SELECT MIN(started_ms), MAX(ended_ms) FROM sessions').fetchone()
    大小 = sum(p.stat().st_size for p in 库.根目录.rglob('*') if p.is_file())

    全部 = 全部记忆()
    最近会话 = [
        {
            'title': r[0] or '未命名',
            'project': r[1] or '未分类',
            'started': 库.本地时间(r[2]),
            'user_count': r[3] or 0,
            'archive_rel': r[4] or '',
        }
        for r in db.execute(
            'SELECT title, project, started_ms, user_count, archive_rel FROM sessions '
            'ORDER BY started_ms DESC LIMIT 6')
    ]
    最近记忆 = [
        {'title': r[0] or '未命名', 'path': r[1] or '', 'updated_at': r[2] or ''}
        for r in db.execute('SELECT title, path, updated_at FROM memories ORDER BY updated_at DESC LIMIT 6')
    ]
    项目 = [
        {'name': r[0] or '未分类', 'count': r[1]}
        for r in db.execute(
            'SELECT project, COUNT(*) FROM sessions GROUP BY project ORDER BY COUNT(*) DESC LIMIT 8')
    ]

    同步时间 = ''
    try:
        同步时间 = datetime.fromtimestamp(库.同步日志路径.stat().st_mtime).strftime('%Y-%m-%d %H:%M:%S')
    except OSError:
        pass

    记忆字数 = sum(x['chars'] for x in 全部)
    警告 = []
    过大 = 0
    try:
        for p in 记忆根.rglob('*.md'):
            try:
                rel = p.relative_to(记忆根)
                if any(part.startswith(('_', '.')) for part in rel.parts):
                    continue
                if p.is_file() and p.stat().st_size > MAX_MEMORY_FILE_BYTES:
                    过大 += 1
            except OSError:
                pass
    except OSError:
        pass
    if 过大:
        警告.append(f'有 {过大} 个记忆文件超过 2 MB，已被摘要和管理列表跳过；请拆分。')
    if 大小 > MAX_DISK_MB * 1024 * 1024:
        警告.append(f'记忆盘占用 {大小 / 1048576:.0f} MB，超过 {MAX_DISK_MB} MB；建议清理较早的原始事件或归档。')
    if len(全部) > MAX_MEMORY_FILES:
        警告.append(f'长期记忆已有 {len(全部)} 篇，超过 {MAX_MEMORY_FILES} 篇；建议合并或删除低价值记忆。')
    if 记忆字数 > MAX_MEMORY_CHARS:
        警告.append(f'长期记忆全文 {记忆字数:,} 字，超过 {MAX_MEMORY_CHARS:,} 字；摘要仍只注入前 8 条。')
    if not 记忆根.exists():
        警告.append(f'找不到长期记忆目录：{记忆根}')

    剩余空间 = None
    try:
        剩余空间 = shutil.disk_usage(库.根目录).free
        if 剩余空间 < MIN_FREE_MB * 1024 * 1024:
            警告.append(f'记忆盘所在磁盘仅剩 {剩余空间 / 1048576:.0f} MB，请尽快清理。')
    except OSError:
        pass

    return {
        'sessions': 会话数,
        'messages': 消息数,
        'memories': 记忆数,
        'memory_files': len(全部),
        'memories_chars': 记忆字数,
        'size_mb': round(大小 / 1048576, 2),
        'disk_free_mb': round(剩余空间 / 1048576, 1) if 剩余空间 is not None else None,
        'warnings': 警告,
        'last_sync': 同步时间,
        'span_from': 库.本地时间(起止[0]) if 起止 and 起止[0] else '',
        'span_to': 库.本地时间(起止[1]) if 起止 and 起止[1] else '',
        'projects': 项目,
        'recent_sessions': 最近会话,
        'recent_memories': 最近记忆,
        'root': str(库.根目录),
    }


def 搜索(query: str, limit: int, role: str | None, project: str | None) -> dict:
    db = 库.连接数据库()
    q = query.strip()

    class 参数:
        pass

    参数.limit = limit
    参数.role = role
    参数.项目 = project
    参数.since = None

    消息 = 检索.搜索消息(db, q, 参数)
    记忆 = 检索.搜索记忆(db, q, max(3, limit // 2))
    for m in 消息:
        m['text'] = 压缩(m.get('text'))
    for m in 记忆:
        m['body'] = 压缩(m.get('body'), 400)
    return {'query': q, 'messages': 消息, 'memories': 记忆}


def 初始化() -> dict:
    库.根目录.mkdir(parents=True, exist_ok=True)
    库.确保目录()
    return {'root': str(库.根目录), 'initialized': True}


def 同步() -> dict:
    import 同步对话
    统计 = 同步对话.同步(force=False, quiet=True, 刷新目录树=True)
    return {'sync': 统计, 'status': 状态()}


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    parser = argparse.ArgumentParser(description='dsh-memory-disk Web UI 数据接口')
    sub = parser.add_subparsers(dest='command', required=True)

    sub.add_parser('status')
    sub.add_parser('sync')
    sub.add_parser('memories')
    sub.add_parser('reindex')
    sub.add_parser('init')

    p_search = sub.add_parser('search')
    p_search.add_argument('query')
    p_search.add_argument('--limit', type=int, default=8)
    p_search.add_argument('--role', choices=['user', 'assistant'])
    p_search.add_argument('--project', dest='project')

    p_imp = sub.add_parser('importance')
    p_imp.add_argument('path')
    p_imp.add_argument('value', type=int)

    p_del = sub.add_parser('delete')
    p_del.add_argument('path')

    args = parser.parse_args()
    try:
        if args.command == 'status':
            结果 = 状态()
        elif args.command == 'sync':
            结果 = 同步()
        elif args.command == 'memories':
            结果 = 全部记忆()
        elif args.command == 'importance':
            结果 = 设置重要度(args.path, args.value)
        elif args.command == 'delete':
            结果 = 删除记忆(args.path)
        elif args.command == 'reindex':
            结果 = {'indexed': 重建索引()}
        elif args.command == 'init':
            结果 = 初始化()
        else:
            结果 = 搜索(args.query, max(1, min(30, args.limit)), args.role, args.project)
        print(json.dumps(结果, ensure_ascii=False))
        return 0
    except Exception as exc:
        print(f'插件数据接口失败：{type(exc).__name__}: {exc}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
