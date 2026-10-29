# -*- coding: utf-8 -*-
"""DSH 记忆盘 —— 公共库

负责：路径与配置、DSH 会话日志解析、归档 Markdown 生成、SQLite 索引读写、
      长期记忆文件索引、目录树生成。

所有脚本都从本文件导入，保证目录结构、命名规则、索引结构只有一份定义。
"""

from __future__ import annotations

import datetime as _dt
import json
import os
import re
import shutil
import sqlite3
import sys
import time
from pathlib import Path

import zstandard as zstd

# ---------------------------------------------------------------- 路径与配置

工具目录 = Path(__file__).resolve().parent
默认根目录 = Path(os.environ.get('DSH_MEMORY_ROOT') or (Path.home() / '.dsh' / 'memory-disk'))
配置路径 = 工具目录 / '记忆配置.json'

默认配置 = {
    '记忆盘根目录': '',
    'DSH主目录': str(Path.home() / '.dsh'),
    '附加会话目录': [],
    '工具结果截断字数': 400,
    '摘要内用户消息截断字数': 200,
    '会话进行中判定分钟': 5,
    '自动同步间隔分钟': 10,
}


def 载入配置() -> dict:
    conf = dict(默认配置)
    if 配置路径.exists():
        try:
            loaded = json.loads(配置路径.read_text(encoding='utf-8'))
            if isinstance(loaded, dict):
                conf.update(loaded)
        except Exception as exc:  # 配置损坏时退回默认值，不阻塞同步
            print(f'[警告] 读取配置失败，使用默认值：{exc}', file=sys.stderr)
    env_home = os.environ.get('DSH_HOME')
    if env_home:
        conf['DSH主目录'] = env_home
    return conf


配置 = 载入配置()

_env_root = os.environ.get('DSH_MEMORY_ROOT')
_配置根 = str(配置.get('记忆盘根目录') or '').strip()
根目录 = Path(_env_root) if _env_root else (Path(_配置根) if _配置根 else 默认根目录)

归档目录 = 根目录 / '01_对话归档'
记忆目录 = 根目录 / '02_长期记忆'
索引目录 = 根目录 / '03_索引'
记录目录 = 根目录 / '04_整理记录'
说明目录 = 根目录 / '00_说明'
数据库路径 = 索引目录 / '记忆索引.db'
同步日志路径 = 记录目录 / '同步日志.md'


def 确保目录() -> None:
    for d in (归档目录, 记忆目录, 索引目录, 记录目录, 说明目录,
              记忆目录 / '项目', 记忆目录 / '人物', 记忆目录 / '事件',
              记忆目录 / '知识', 记忆目录 / '经验'):
        d.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------- 小工具

非法文件名字符 = re.compile(r'[\\/:*?"<>|\x00-\x1f]')


def 清理名称(文本: str, 上限: int = 40) -> str:
    """把标题/项目名变成安全的目录名。"""
    文本 = (文本 or '').strip()
    文本 = 非法文件名字符.sub(' ', 文本)
    文本 = re.sub(r'\s+', ' ', 文本).strip(' .')
    if len(文本) > 上限:
        文本 = 文本[:上限].rstrip()
    return 文本 or '未命名'


def 本地时间(毫秒: int | None) -> str:
    if not 毫秒:
        return ''
    return _dt.datetime.fromtimestamp(毫秒 / 1000).strftime('%Y-%m-%d %H:%M:%S')


def 短时间(毫秒: int | None) -> str:
    if not 毫秒:
        return ''
    return _dt.datetime.fromtimestamp(毫秒 / 1000).strftime('%H:%M:%S')


def 人性大小(字节: int) -> str:
    if 字节 < 1024:
        return f'{字节} B'
    if 字节 < 1024 ** 2:
        return f'{字节 / 1024:.1f} KB'
    if 字节 < 1024 ** 3:
        return f'{字节 / 1024 ** 2:.1f} MB'
    return f'{字节 / 1024 ** 3:.2f} GB'


def 写文本(路径: Path, 内容: str) -> None:
    """原子写入 UTF-8 文本，避免同步中途被读到半个文件。"""
    路径.parent.mkdir(parents=True, exist_ok=True)
    临时 = 路径.with_name(路径.name + '.tmp')
    临时.write_text(内容, encoding='utf-8', newline='\n')
    os.replace(临时, 路径)


def 去空行(文本: str) -> str:
    文本 = (文本 or '').replace('\r\n', '\n').replace('\r', '\n')
    文本 = re.sub(r'\n{3,}', '\n\n', 文本)
    return 文本.strip()


# ---------------------------------------------------------------- 会话日志读取

def 读取zstd(路径: Path) -> bytes:
    """读取 DSH 的 zstd 多帧日志；尾部帧写了一半时尽量保留已解出的内容。"""
    with 路径.open('rb') as f:
        try:
            reader = zstd.ZstdDecompressor().stream_reader(f, read_across_frames=True)
            return reader.read()
        except zstd.ZstdError:
            pass
    # 退化路径：逐块解压，忽略最后一个不完整帧造成的异常
    data = 路径.read_bytes()
    输出: list[bytes] = []
    obj = zstd.ZstdDecompressor().decompressobj()
    try:
        输出.append(obj.decompress(data))
    except zstd.ZstdError:
        pass
    return b''.join(输出)


def 读取事件(路径: Path) -> list[dict]:
    raw = 读取zstd(路径)
    events: list[dict] = []
    for line in raw.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            events.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return events


def 内容文本(内容) -> str:
    """从 DSH 的 content 数组里抽纯文本。"""
    if 内容 is None:
        return ''
    if isinstance(内容, str):
        return 内容
    parts: list[str] = []
    if isinstance(内容, list):
        for item in 内容:
            if isinstance(item, dict) and item.get('type') == 'text':
                parts.append(item.get('text') or '')
            elif isinstance(item, str):
                parts.append(item)
    elif isinstance(内容, dict) and 内容.get('type') == 'text':
        parts.append(内容.get('text') or '')
    return '\n'.join(p for p in parts if p)


def 会话文件列表() -> list[Path]:
    roots = [Path(配置['DSH主目录']) / 'sessions']
    for extra in 配置.get('附加会话目录') or []:
        roots.append(Path(extra))
    files: list[Path] = []
    for root in roots:
        if not root.exists():
            continue
        files.extend(sorted(root.rglob('*.jsonl.zst')))
        files.extend(sorted(root.rglob('*.jsonl.zstd')))
    # 去重（同一文件被两个根目录覆盖时）
    seen, unique = set(), []
    for f in files:
        key = str(f.resolve()).lower()
        if key not in seen:
            seen.add(key)
            unique.append(f)
    return unique


# ---------------------------------------------------------------- 会话解析

def 项目名(cwd: str) -> str:
    if not cwd:
        return '未知工作区'
    p = Path(cwd)
    name = p.name
    if not name or len(name) == 2 and name.endswith(':'):
        return f'{p.drive or "未知"}盘根目录'.lstrip('\\')
    if name.lower() == 'default-workspace':
        return '默认工作区'
    return 清理名称(name, 20)


默认模型 = '—'


def 解析会话(events: list[dict], 来源: Path) -> dict:
    head = events[0] if events else {}
    sid = head.get('id') or 来源.parent.name
    cwd = head.get('cwd') or ''
    start = head.get('createdAt') or 0
    title = ''
    provider = model = ''
    blocks: list[dict] = []
    tools: dict[str, dict] = {}
    已登记调用: set[str] = set()
    用户数 = 助手数 = 工具数 = 0
    turns: set[int] = set()
    文件: list[str] = []
    todos = None
    goal = None
    最后时间 = start
    压缩摘要数 = 0

    for e in events:
        t = e.get('type')
        d = e.get('data') or {}
        tm = e.get('time') or 最后时间
        最后时间 = max(最后时间, tm)

        if t == 'session/title':
            title = d.get('title') or title
        elif t == 'user/message':
            src = (d.get('source') or {}).get('kind')
            if src != 'user':
                continue
            text = 内容文本(d.get('content'))
            if not text.strip():
                continue
            blocks.append({'kind': 'user', 'time': tm, 'text': text})
            用户数 += 1
        elif t == 'assistant/message':
            msg = d.get('message') or {}
            src = msg.get('source') or {}
            provider = src.get('provider') or provider
            model = src.get('model') or model
            turn = d.get('turn')
            if turn:
                turns.add(turn)
            text_parts = []
            for c in msg.get('content') or []:
                if c.get('type') == 'text' and (c.get('text') or '').strip():
                    text_parts.append(c['text'])
            if text_parts:
                blocks.append({'kind': 'assistant', 'time': tm,
                               'text': '\n\n'.join(text_parts), 'turn': turn})
                助手数 += 1
            for c in msg.get('content') or []:
                if c.get('type') == 'tool-call':
                    cid = c.get('id') or ''
                    tools[cid] = {'kind': 'tool', 'time': tm, 'turn': turn,
                                  'name': c.get('name') or '工具',
                                  'args': c.get('arguments') or '',
                                  'callId': cid, 'result': '', 'ok': None}
                    blocks.append(tools[cid])
                    已登记调用.add(cid)
                    工具数 += 1
        elif t == 'tool/call':
            cid = d.get('callId') or ''
            if cid and cid in 已登记调用:
                continue
            tools[cid] = {'kind': 'tool', 'time': tm, 'turn': d.get('turn'),
                          'name': d.get('name') or '工具',
                          'args': d.get('arguments') or '',
                          'callId': cid, 'result': '', 'ok': None}
            blocks.append(tools[cid])
            已登记调用.add(cid)
            工具数 += 1
        elif t == 'tool/result':
            cid = d.get('toolCallId') or (d.get('source') or {}).get('callId') or ''
            msg = d.get('message') or {}
            text = 内容文本(msg.get('content'))
            b = tools.get(cid)
            if b is not None:
                b['result'] = text
                b['ok'] = not msg.get('isError', False)
        elif t == 'compaction/summary':
            text = 内容文本(d.get('summary'))
            if text.strip():
                blocks.append({'kind': 'summary', 'time': tm, 'text': text})
                压缩摘要数 += 1
        elif t == 'todo/write':
            todos = d.get('todos') or todos
        elif t == 'goal/change':
            g = d.get('goal') or {}
            if g.get('objective'):
                goal = g

    # 收集改动的文件（edit / write / read）
    for b in blocks:
        if b['kind'] != 'tool':
            continue
        name = (b.get('name') or '').lower()
        if name not in ('edit', 'write', 'read'):
            continue
        try:
            args = json.loads(b.get('args') or '{}')
        except Exception:
            args = {}
        fp = args.get('file_path') or args.get('path')
        if fp and fp not in 文件:
            文件.append(fp)

    if not title:
        first_user = next((b['text'] for b in blocks if b['kind'] == 'user'), '')
        if first_user.strip():
            title = 清理名称(first_user.splitlines()[0], 30)
        else:
            title = '空会话'

    now_ms = int(time.time() * 1000)
    状态 = '进行中' if (最后时间 and now_ms - 最后时间 < 配置.get('会话进行中判定分钟', 5) * 60 * 1000) else '已结束'
    if len(events) <= 2 and not blocks:
        状态 = '空会话'

    return {
        'session_id': sid,
        'title': title,
        'cwd': cwd,
        'project': 项目名(cwd),
        'started_ms': start,
        'ended_ms': 最后时间,
        'status': 状态,
        'provider': provider,
        'model': model or 默认模型,
        'turns': len(turns),
        'user_count': 用户数,
        'assistant_count': 助手数,
        'tool_count': 工具数,
        'blocks': blocks,
        'files': 文件[:80],
        'todos': todos,
        'goal': goal,
        'source': str(来源),
        'compactions': 压缩摘要数,
    }


# ---------------------------------------------------------------- Markdown 渲染

def 工具摘要(b: dict) -> str:
    name = (b.get('name') or '工具').lower()
    try:
        args = json.loads(b.get('args') or '{}')
    except Exception:
        args = {}
    if name == 'pwsh':
        描述 = args.get('description')
        if not 描述:
            命令 = (args.get('command') or '').strip()
            描述 = 命令.splitlines()[0] if 命令 else '执行命令'
        return 清理名称(描述, 90)
    if name in ('edit', 'write', 'read'):
        return args.get('file_path') or args.get('path') or ''
    if name in ('glob', 'grep'):
        return args.get('pattern') or ''
    if name in ('web_search', 'web_fetch'):
        return args.get('query') or args.get('url') or ''
    if name == 'ask_user_question':
        qs = args.get('questions') or []
        if qs:
            return 清理名称(qs[0].get('question') or '', 90)
        return ''
    text = (b.get('args') or '').strip().replace('\n', ' ')
    if text in ('', '{}', 'null', '[]'):
        return ''
    return 清理名称(text, 90)


def 渲染对话(s: dict) -> str:
    行: list[str] = []
    行.append(f"# {s['title']}")
    行.append('')
    行.append(f"> **会话 ID**：`{s['session_id']}`  ")
    行.append(f"> **工作区**：`{s['cwd'] or '未知'}`  ")
    行.append(f"> **开始时间**：{本地时间(s['started_ms'])}  ")
    行.append(f"> **最后活动**：{本地时间(s['ended_ms'])}（{s['status']}）  ")
    行.append(f"> **模型**：{s['provider'] or '—'} / {s['model']}  ")
    行.append(f"> **统计**：{s['turns']} 轮 · 用户 {s['user_count']} 条 · 助手 {s['assistant_count']} 条 · 工具 {s['tool_count']} 次")
    行.append('')
    行.append('---')
    行.append('')

    for b in s['blocks']:
        kind = b['kind']
        if kind == 'user':
            行.append(f"### 👤 用户 · {短时间(b['time'])}")
            行.append('')
            行.append(去空行(b['text']))
            行.append('')
        elif kind == 'assistant':
            行.append(f"### 🤖 助手 · {短时间(b['time'])}")
            行.append('')
            行.append(去空行(b['text']))
            行.append('')
        elif kind == 'summary':
            行.append(f"### 📦 上下文压缩摘要 · {短时间(b['time'])}")
            行.append('')
            文本 = 去空行(b['text'])
            if len(文本) > 1500:
                文本 = 文本[:1500] + '\n\n…（摘要已截断，全文见原始事件）'
            行.append(文本)
            行.append('')
        elif kind == 'tool':
            name = b.get('name') or '工具'
            desc = 工具摘要(b)
            title = f"🔧 **{name}**" + (f"：{desc}" if desc else '')
            行.append(f"> {title}  ")
            if b.get('result'):
                结果 = 去空行(b['result']).replace('\n', ' ')
                上限 = int(配置.get('工具结果截断字数', 400))
                if len(结果) > 上限:
                    结果 = 结果[:上限] + '…'
                标记 = '✅' if b.get('ok') else ('❌' if b.get('ok') is False else '•')
                行.append(f"> {标记} 结果：{结果}  ")
            行.append('')

    if s['blocks'] and s['blocks'][-1]['kind'] == 'tool':
        行.append('')
    return '\n'.join(行).rstrip() + '\n'


def 渲染摘要(s: dict, 归档相对路径: str) -> str:
    行: list[str] = []
    行.append(f"# 会话摘要：{s['title']}")
    行.append('')
    行.append('| 项目 | 内容 |')
    行.append('|---|---|')
    行.append(f"| 工作区 | `{s['cwd'] or '未知'}` |")
    行.append(f"| 项目 | {s['project']} |")
    行.append(f"| 时间 | {本地时间(s['started_ms'])} → {本地时间(s['ended_ms'])} |")
    行.append(f"| 状态 | {s['status']} |")
    行.append(f"| 模型 | {s['provider'] or '—'} / {s['model']} |")
    行.append(f"| 规模 | {s['turns']} 轮 · 用户 {s['user_count']} 条 · 助手 {s['assistant_count']} 条 · 工具 {s['tool_count']} 次 |")
    行.append(f"| 会话 ID | `{s['session_id']}` |")
    行.append('')

    users = [b for b in s['blocks'] if b['kind'] == 'user']
    if users:
        行.append('## 用户诉求')
        行.append('')
        上限 = int(配置.get('摘要内用户消息截断字数', 200))
        for i, b in enumerate(users[:30], 1):
            文本 = 去空行(b['text']).replace('\n', ' ')
            if len(文本) > 上限:
                文本 = 文本[:上限] + '…'
            行.append(f"{i}. {文本}")
        行.append('')

    assistants = [b for b in s['blocks'] if b['kind'] == 'assistant']
    if assistants:
        行.append('## 助手收尾（每轮最后一段）')
        行.append('')
        按轮: dict = {}
        for b in assistants:
            按轮[b.get('turn')] = b
        轮次 = list(按轮.items())[-15:]
        for turn, b in 轮次:
            文本 = 去空行(b['text']).replace('\n', ' ')
            if len(文本) > 220:
                文本 = 文本[:220] + '…'
            标签 = f"第 {turn} 轮" if turn else '—'
            行.append(f"- **{标签}**：{文本}")
        行.append('')

    if s['goal']:
        行.append('## 会话目标')
        行.append('')
        行.append(f"> {s['goal'].get('objective')}")
        行.append('')

    if s['files']:
        行.append('## 涉及文件')
        行.append('')
        for fp in s['files'][:40]:
            行.append(f"- `{fp}`")
        行.append('')

    if s['todos']:
        行.append('## 最后的待办清单')
        行.append('')
        for t in s['todos'][:20]:
            图标 = {'completed': '✅', 'in_progress': '🔄', 'pending': '⬜'}.get(t.get('status'), '•')
            行.append(f"- {图标} {t.get('content')}")
        行.append('')

    if s['blocks']:
        工具计数: dict[str, int] = {}
        for b in s['blocks']:
            if b['kind'] == 'tool':
                工具计数[b.get('name') or '工具'] = 工具计数.get(b.get('name') or '工具', 0) + 1
        if 工具计数:
            行.append('## 工具使用')
            行.append('')
            行.append('、'.join(f'{k} × {v}' for k, v in sorted(工具计数.items(), key=lambda x: -x[1])))
            行.append('')

    行.append('## 原始归档')
    行.append('')
    行.append(f"- 对话原文：[对话.md](./对话.md)")
    行.append(f"- 原始事件：`原始事件.jsonl.zst`")
    行.append(f"- 归档目录：`{归档相对路径}`")
    行.append('')
    return '\n'.join(行).rstrip() + '\n'


# ---------------------------------------------------------------- SQLite 索引

def 连接数据库() -> sqlite3.Connection:
    索引目录.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(数据库路径, timeout=15)
    db.execute('PRAGMA journal_mode=WAL')
    db.executescript(
        """
        CREATE TABLE IF NOT EXISTS sessions (
            session_id TEXT PRIMARY KEY,
            title TEXT,
            project TEXT,
            cwd TEXT,
            started_ms INTEGER,
            ended_ms INTEGER,
            status TEXT,
            model TEXT,
            provider TEXT,
            turns INTEGER,
            user_count INTEGER,
            assistant_count INTEGER,
            tool_count INTEGER,
            archive_rel TEXT,
            source_path TEXT,
            source_mtime INTEGER,
            source_size INTEGER,
            generated_at TEXT,
            digested INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            role TEXT NOT NULL,
            ts_ms INTEGER,
            turn INTEGER,
            text TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
        CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(text, tokenize='trigram');
        CREATE TABLE IF NOT EXISTS memories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            path TEXT UNIQUE,
            title TEXT,
            body TEXT,
            updated_at TEXT
        );
        CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(title, body, tokenize='trigram');
        """
    )
    return db


def 重建记忆索引(db: sqlite3.Connection) -> int:
    db.execute('DELETE FROM memories')
    db.execute('DELETE FROM memories_fts')
    数量 = 0
    for md in sorted(记忆目录.rglob('*.md')):
        try:
            相对 = md.relative_to(记忆目录)
        except ValueError:
            continue
        # _回收站、.已删除 等以下划线/点开头的目录不参与索引
        if any(part.startswith(('_', '.')) for part in 相对.parts):
            continue
        try:
            text = md.read_text(encoding='utf-8')
        except Exception:
            continue
        title = ''
        for line in text.splitlines():
            if line.startswith('#'):
                title = line.lstrip('# ').strip()
                break
        # 索引正文时去掉 YAML frontmatter，检索片段更干净
        body = text
        if text.startswith('---'):
            分段 = text.split('---', 2)
            if len(分段) >= 3:
                body = 分段[2].lstrip('\n')
        rel = md.relative_to(根目录).as_posix()
        cur = db.execute(
            'INSERT INTO memories(path, title, body, updated_at) VALUES (?,?,?,?)',
            (rel, title or md.stem, body, 本地时间(int(md.stat().st_mtime * 1000))),
        )
        db.execute('INSERT INTO memories_fts(rowid, title, body) VALUES (?,?,?)',
                   (cur.lastrowid, title or md.stem, body))
        数量 += 1
    return 数量


def 删除会话索引(db: sqlite3.Connection, sid: str) -> None:
    rows = [r[0] for r in db.execute('SELECT id FROM messages WHERE session_id=?', (sid,))]
    if rows:
        占位 = ','.join('?' * len(rows))
        db.execute(f'DELETE FROM messages_fts WHERE rowid IN ({占位})', rows)
        db.execute('DELETE FROM messages WHERE session_id=?', (sid,))


def 写入会话索引(db: sqlite3.Connection, s: dict, 归档相对: str) -> None:
    删除会话索引(db, s['session_id'])
    db.execute(
        """INSERT INTO sessions(session_id,title,project,cwd,started_ms,ended_ms,status,model,provider,
               turns,user_count,assistant_count,tool_count,archive_rel,source_path,source_mtime,source_size,generated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
           ON CONFLICT(session_id) DO UPDATE SET
               title=excluded.title, project=excluded.project, cwd=excluded.cwd,
               started_ms=excluded.started_ms, ended_ms=excluded.ended_ms, status=excluded.status,
               model=excluded.model, provider=excluded.provider, turns=excluded.turns,
               user_count=excluded.user_count, assistant_count=excluded.assistant_count,
               tool_count=excluded.tool_count, archive_rel=excluded.archive_rel,
               source_path=excluded.source_path, source_mtime=excluded.source_mtime,
               source_size=excluded.source_size, generated_at=excluded.generated_at""",
        (s['session_id'], s['title'], s['project'], s['cwd'], s['started_ms'], s['ended_ms'],
         s['status'], s['model'], s['provider'], s['turns'], s['user_count'], s['assistant_count'],
         s['tool_count'], 归档相对, s['source'], s['source_mtime'], s['source_size'],
         _dt.datetime.now().strftime('%Y-%m-%d %H:%M:%S')),
    )
    for b in s['blocks']:
        if b['kind'] not in ('user', 'assistant'):
            continue
        cur = db.execute(
            'INSERT INTO messages(session_id, role, ts_ms, turn, text) VALUES (?,?,?,?,?)',
            (s['session_id'], b['kind'], b['time'], b.get('turn'), b['text']),
        )
        db.execute('INSERT INTO messages_fts(rowid, text) VALUES (?,?)', (cur.lastrowid, b['text']))


# ---------------------------------------------------------------- 目录树

def 可显示(p: Path) -> bool:
    """目录树里跳过的临时条目。"""
    name = p.name
    if name.startswith('.') or name == '__pycache__':
        return False
    if name.endswith('-wal') or name.endswith('-shm'):
        return False
    return True


def 生成目录树(写入文件: bool = True) -> str:
    """生成 00_说明/目录树.md，并返回同样的文本。"""
    db = None
    try:
        db = 连接数据库()
    except Exception:
        pass

    行: list[str] = []
    行.append('# DSH 记忆盘 · 目录树')
    行.append('')
    行.append(f'> 根目录：`{根目录}`  ')
    行.append(f'> 生成时间：{_dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S")}  ')
    行.append('> 本文件由 `05_工具/生成目录树.py` 自动生成，每次同步后刷新。')
    行.append('')

    统计: dict = {'文件数': 0, '目录数': 0, '字节': 0}

    def 汇总(目录: Path) -> tuple[int, int]:
        文件们 = [x for x in 目录.rglob('*') if x.is_file() and 可显示(x)]
        return len(文件们), sum(x.stat().st_size for x in 文件们)

    def 遍历(目录: Path, 前缀: str = '') -> None:
        条目 = [p for p in sorted(目录.iterdir(), key=lambda p: (p.is_file(), p.name)) if 可显示(p)]
        for i, p in enumerate(条目):
            最后 = i == len(条目) - 1
            枝 = '└── ' if 最后 else '├── '
            子前缀 = 前缀 + ('    ' if 最后 else '│   ')
            if p.is_dir():
                文件数, 字节 = 汇总(p)
                统计['目录数'] += 1
                备注 = f'（{文件数} 个文件，{人性大小(字节)}）' if 文件数 else '（空）'
                行.append(f'{前缀}{枝}{p.name}/ {备注}')
                遍历(p, 子前缀)
            else:
                大小 = p.stat().st_size
                统计['文件数'] += 1
                统计['字节'] += 大小
                行.append(f'{前缀}{枝}{p.name}（{人性大小(大小)}）')

    for top in sorted(根目录.iterdir(), key=lambda p: (p.is_file(), p.name)):
        if not 可显示(top):
            continue
        if top.is_dir():
            文件数, 字节 = 汇总(top)
            统计['目录数'] += 1
            行.append(f'{top.name}/ （{文件数} 个文件，{人性大小(字节)}）')
            遍历(top, '    ')
        else:
            大小 = top.stat().st_size
            统计['文件数'] += 1
            统计['字节'] += 大小
            行.append(f'{top.name}（{人性大小(大小)}）')

    行.append('')
    行.append('## 总览')
    行.append('')
    行.append(f"- 目录：{统计['目录数']} 个")
    行.append(f"- 文件：{统计['文件数']} 个")
    行.append(f"- 占用：{人性大小(统计['字节'])}")
    行.append('')

    if db is not None:
        try:
            行.append('## 最近归档的会话（最新 20 个）')
            行.append('')
            行.append('| 时间 | 项目 | 标题 | 轮数 | 归档目录 |')
            行.append('|---|---|---|---|---|')
            for row in db.execute(
                'SELECT started_ms, project, title, turns, archive_rel FROM sessions ORDER BY started_ms DESC LIMIT 20'
            ):
                行.append(f"| {本地时间(row[0])} | {row[1]} | {row[2]} | {row[3]} | `{row[4]}` |")
            行.append('')
            行.append('## 长期记忆文件')
            行.append('')
            for row in db.execute('SELECT path, title FROM memories ORDER BY path'):
                行.append(f'- `{row[0]}` —— {row[1]}')
            行.append('')
        except Exception:
            pass

    文本 = '\n'.join(行).rstrip() + '\n'
    if 写入文件:
        写文本(说明目录 / '目录树.md', 文本)
    return 文本
