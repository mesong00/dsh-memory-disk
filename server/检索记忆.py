# -*- coding: utf-8 -*-
"""DSH 记忆盘 —— 全文检索

在全部历史对话与长期记忆文件中检索关键词。

用法：
    python 检索记忆.py 增程器
    python 检索记忆.py 增程器 --role user --limit 5
    python 检索记忆.py --项目 QGC地面站二次开发 --since 2026-10
    python 检索记忆.py --统计
    python 检索记忆.py --会话 session-d60f7c65
    python 检索记忆.py --待整理
    python 检索记忆.py 打包 --json
"""

from __future__ import annotations

import argparse
import json
import re
import sqlite3
import sys
import time
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
import 记忆库 as 库

分隔线 = '─' * 60


def 片段(文本: str, 关键词: str, 半径: int = 60) -> str:
    文本 = re.sub(r'\s+', ' ', 文本 or '').strip()
    if not 关键词:
        return 文本[:半径 * 2] + ('…' if len(文本) > 半径 * 2 else '')
    位置 = 文本.lower().find(关键词.lower())
    if 位置 < 0:
        return 文本[:半径 * 2] + ('…' if len(文本) > 半径 * 2 else '')
    起 = max(0, 位置 - 半径)
    止 = min(len(文本), 位置 + len(关键词) + 半径)
    前缀 = '…' if 起 > 0 else ''
    后缀 = '…' if 止 < len(文本) else ''
    return 前缀 + 文本[起:止] + 后缀


def 构造消息查询(q: str, 参数) -> tuple[str, list]:
    条件 = []
    值: list = []
    if q:
        terms = [t for t in q.split() if t]
        长词 = [t for t in terms if len(t) >= 3]
        if 长词:
            匹配 = ' AND '.join('"' + t.replace('"', '""') + '"' for t in 长词)
            条件.append('messages_fts MATCH ?')
            值.append(匹配)
            基础 = ('SELECT m.id, m.session_id, m.role, m.ts_ms, m.text, s.title, s.project, s.archive_rel '
                    'FROM messages_fts f JOIN messages m ON m.id = f.rowid '
                    'JOIN sessions s ON s.session_id = m.session_id')
            排序 = 'ORDER BY rank'
        else:
            条件.append('m.text LIKE ?')
            值.append(f'%{q}%')
            基础 = ('SELECT m.id, m.session_id, m.role, m.ts_ms, m.text, s.title, s.project, s.archive_rel '
                    'FROM messages m JOIN sessions s ON s.session_id = m.session_id')
            排序 = 'ORDER BY m.ts_ms DESC'
    else:
        基础 = ('SELECT m.id, m.session_id, m.role, m.ts_ms, m.text, s.title, s.project, s.archive_rel '
                'FROM messages m JOIN sessions s ON s.session_id = m.session_id')
        排序 = 'ORDER BY m.ts_ms DESC'

    if 参数.role:
        条件.append('m.role = ?')
        值.append(参数.role)
    if 参数.项目:
        条件.append('s.project LIKE ?')
        值.append(f'%{参数.项目}%')
    if 参数.since:
        条件.append('s.started_ms >= ?')
        值.append(时间下限(参数.since))
    where = (' WHERE ' + ' AND '.join(条件)) if 条件 else ''
    return f'{基础}{where} {排序} LIMIT ?', 值 + [参数.limit]


def 时间下限(文本: str) -> int:
    for 格式 in ('%Y-%m', '%Y-%m-%d', '%Y'):
        try:
            t = time.strptime(文本, 格式)
            return int(time.mktime(t) * 1000)
        except ValueError:
            continue
    return 0


def 搜索消息(db: sqlite3.Connection, q: str, 参数) -> list[dict]:
    sql, 值 = 构造消息查询(q, 参数)
    try:
        rows = db.execute(sql, 值).fetchall()
    except sqlite3.OperationalError as exc:
        print(f'[警告] 查询失败：{exc}', file=sys.stderr)
        return []
    return [{'session_id': r[1], 'role': r[2], 'ts_ms': r[3], 'text': r[4],
             'title': r[5], 'project': r[6], 'archive_rel': r[7]} for r in rows]


def 搜索记忆(db: sqlite3.Connection, q: str, limit: int) -> list[dict]:
    if not q:
        return []
    try:
        if len(q.strip()) >= 3:
            匹配 = '"' + q.replace('"', '""') + '"'
            rows = db.execute(
                'SELECT m.path, m.title, m.body FROM memories_fts f JOIN memories m ON m.id = f.rowid '
                'WHERE memories_fts MATCH ? ORDER BY rank LIMIT ?', (匹配, limit)).fetchall()
        else:
            rows = db.execute(
                'SELECT path, title, body FROM memories WHERE body LIKE ? LIMIT ?',
                (f'%{q}%', limit)).fetchall()
    except sqlite3.OperationalError:
        return []
    return [{'path': r[0], 'title': r[1], 'body': r[2]} for r in rows]


def 输出消息结果(结果: list[dict], q: str) -> None:
    print(f'🔍 对话命中 {len(结果)} 条（关键词：{q or "（无）"}）')
    print(分隔线)
    for i, r in enumerate(结果, 1):
        角色 = '👤 用户' if r['role'] == 'user' else '🤖 助手'
        print(f"{i}. {库.本地时间(r['ts_ms'])} · {角色} · {r['project']} · {r['title']}")
        print(f"   {片段(r['text'], q)}")
        print(f"   📄 {r['archive_rel']}")
        print()


def 输出记忆结果(结果: list[dict], q: str) -> None:
    if not 结果:
        return
    print(f'🧠 长期记忆命中 {len(结果)} 条')
    print(分隔线)
    for r in 结果:
        print(f"- {r['title']}（{r['path']}）")
        print(f"  {片段(r['body'], q)}")
    print()


def 打印统计(db: sqlite3.Connection) -> None:
    会话数 = db.execute('SELECT COUNT(*) FROM sessions').fetchone()[0]
    消息数 = db.execute('SELECT COUNT(*) FROM messages').fetchone()[0]
    记忆数 = db.execute('SELECT COUNT(*) FROM memories').fetchone()[0]
    起止 = db.execute('SELECT MIN(started_ms), MAX(ended_ms) FROM sessions').fetchone()
    总字节 = sum(p.stat().st_size for p in 库.根目录.rglob('*') if p.is_file())

    print('📊 DSH 记忆盘统计')
    print(分隔线)
    print(f'  记忆盘根目录：{库.根目录}')
    print(f'  已归档会话：{会话数} 个')
    print(f'  已索引消息：{消息数} 条')
    print(f'  长期记忆：{记忆数} 篇')
    print(f"  时间跨度：{库.本地时间(起止[0])} → {库.本地时间(起止[1])}")
    print(f'  记忆盘占用：{库.人性大小(总字节)}')
    print()
    print('  按项目：')
    for row in db.execute(
            'SELECT project, COUNT(*), SUM(user_count) FROM sessions GROUP BY project ORDER BY COUNT(*) DESC'):
        print(f'    - {row[0]}：{row[1]} 个会话 / {row[2] or 0} 条用户消息')
    print()
    print('  最近 5 个会话：')
    for row in db.execute('SELECT started_ms, title, project, archive_rel FROM sessions ORDER BY started_ms DESC LIMIT 5'):
        print(f"    - {库.本地时间(row[0])} · {row[2]} · {row[1]}")
        print(f"      {row[3]}")


def 打印会话(db: sqlite3.Connection, 编号: str, 原对话: bool) -> None:
    row = db.execute(
        'SELECT session_id, title, project, cwd, started_ms, ended_ms, status, model, provider, turns, '
        'user_count, assistant_count, tool_count, archive_rel FROM sessions '
        'WHERE session_id LIKE ? ORDER BY started_ms DESC LIMIT 1', (f'%{编号}%',)).fetchone()
    if not row:
        print(f'未找到会话：{编号}')
        return
    摘要 = 库.根目录 / row[13] / '会话摘要.md'
    对话 = 库.根目录 / row[13] / '对话.md'
    print(f'📌 {row[1]}')
    print(分隔线)
    print(f'  项目：{row[2]}    工作区：{row[3]}')
    print(f'  时间：{库.本地时间(row[4])} → {库.本地时间(row[5])}（{row[6]}）')
    print(f'  模型：{row[8] or "—"} / {row[7]}')
    print(f'  规模：{row[9]} 轮 · 用户 {row[10]} 条 · 助手 {row[11]} 条 · 工具 {row[12]} 次')
    print(f'  摘要：{摘要}')
    print(f'  原文：{对话}')
    print()
    if not 原对话 and 摘要.exists():
        内容 = 摘要.read_text(encoding='utf-8').splitlines()
        print('\n'.join(内容[:50]))
        if len(内容) > 50:
            print(f'…（共 {len(内容)} 行，完整内容见上方摘要文件）')


def 打印待整理(db: sqlite3.Connection) -> None:
    行 = []
    for row in db.execute(
            'SELECT session_id, title, project, started_ms, archive_rel FROM sessions '
            'WHERE user_count > 0 ORDER BY started_ms DESC'):
        if (库.根目录 / row[4] / '.已整理').exists():
            continue
        行.append(row)
    print(f'📝 待整理会话 {len(行)} 个（未生成长期记忆卡片）')
    print(分隔线)
    for row in 行:
        print(f"- {库.本地时间(row[3])} · {row[2]} · {row[1]}")
        print(f"  {row[4]}  （id: {row[0]}）")
    print()
    print('整理完成后在归档目录放一个空的 `.已整理` 文件即可标记。')


def 标记已整理(db: sqlite3.Connection, 编号: str) -> None:
    row = db.execute('SELECT session_id, archive_rel FROM sessions WHERE session_id LIKE ? LIMIT 1',
                     (f'%{编号}%',)).fetchone()
    if not row:
        print(f'未找到会话：{编号}')
        return
    目录 = 库.根目录 / row[1]
    (目录 / '.已整理').write_text('', encoding='utf-8')
    db.execute('UPDATE sessions SET digested=1 WHERE session_id=?', (row[0],))
    db.commit()
    print(f'已标记为已整理：{row[1]}')


def main() -> None:
    parser = argparse.ArgumentParser(description='检索 DSH 记忆盘中的历史对话与长期记忆')
    parser.add_argument('关键词', nargs='*', help='要搜索的关键词（可多个）')
    parser.add_argument('--limit', type=int, default=10, help='最多返回条数（默认 10）')
    parser.add_argument('--role', choices=['user', 'assistant'], help='只看用户或助手消息')
    parser.add_argument('--项目', dest='项目', help='按项目名过滤')
    parser.add_argument('--since', help='起始时间，如 2026-10 或 2026-10-01')
    parser.add_argument('--json', action='store_true', help='输出 JSON')
    parser.add_argument('--统计', action='store_true', help='显示记忆盘统计')
    parser.add_argument('--会话', help='按会话 ID 前缀查看会话摘要')
    parser.add_argument('--原对话', action='store_true', help='配合 --会话：不打印摘要正文')
    parser.add_argument('--待整理', action='store_true', help='列出尚未整理成长期记忆的会话')
    parser.add_argument('--标记已整理', dest='标记', help='把某个会话标记为已整理')
    parser.add_argument('--无记忆', action='store_true', help='只搜对话，不搜长期记忆文件')
    args = parser.parse_args()

    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    db = 库.连接数据库()
    q = ' '.join(args.关键词).strip()

    if args.统计:
        打印统计(db)
        return
    if args.会话:
        打印会话(db, args.会话, args.原对话)
        return
    if args.待整理:
        打印待整理(db)
        return
    if args.标记:
        标记已整理(db, args.标记)
        return
    if not q:
        parser.print_help()
        return

    消息 = 搜索消息(db, q, args)
    记忆 = [] if args.无记忆 else 搜索记忆(db, q, max(3, args.limit // 2))

    if args.json:
        print(json.dumps({'关键词': q, '对话': 消息, '长期记忆': 记忆}, ensure_ascii=False, indent=2))
        return
    if not 消息 and not 记忆:
        print(f'没有找到与「{q}」相关的记忆。')
        print('提示：可换更短的关键词，或先运行 同步对话.py 把最新对话收进来。')
        return
    输出消息结果(消息, q)
    输出记忆结果(记忆, q)


if __name__ == '__main__':
    main()
