# -*- coding: utf-8 -*-
"""记忆移植：导出/导入记忆包（zip）。

用法：
    python 迁移记忆.py export [--to D:\\path\\记忆包.zip]
    python 迁移记忆.py import --from D:\\path\\记忆包.zip [--mode merge]

只输出 JSON；错误写 stderr 并返回非 0。
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import 记忆库 as 库

允许顶层 = ('00_说明', '01_对话归档', '02_长期记忆', '03_索引')
排除目录 = {'_回收站', '__pycache__', '.tmp', '.git'}
最大解压字节 = 2 * 1024 * 1024 * 1024
最大条目数 = 100_000


def 导出(目标: str | None = None) -> dict:
    根 = 库.根目录
    目标路径 = Path(目标) if 目标 else 根 / '04_整理记录' / '迁移' / f'记忆包_{datetime.now():%Y%m%d_%H%M%S}.zip'
    目标路径.parent.mkdir(parents=True, exist_ok=True)

    文件数 = 0
    原始字节 = 0
    with zipfile.ZipFile(目标路径, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        for 顶层 in 允许顶层:
            基 = 根 / 顶层
            if not 基.exists():
                continue
            for p in 基.rglob('*'):
                if not p.is_file():
                    continue
                相对 = p.relative_to(根)
                if any(part in 排除目录 or part.startswith('.') for part in 相对.parts):
                    continue
                if 顶层 == '03_索引' and p.suffix.lower() != '.db':
                    continue
                try:
                    z.write(p, 相对.as_posix())
                    文件数 += 1
                    原始字节 += p.stat().st_size
                except OSError:
                    continue

        清单 = {
            '格式': 'dsh-memory-disk',
            '版本': 1,
            '导出时间': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            '源记忆盘': str(根),
            '文件数': 文件数,
            '原始字节': 原始字节,
        }
        z.writestr('manifest.json', json.dumps(清单, ensure_ascii=False, indent=2))

    return {
        'zip': str(目标路径),
        'files': 文件数,
        'bytes': 原始字节,
        'size_mb': round(目标路径.stat().st_size / 1048576, 2),
        'manifest': 清单,
    }


def 校验条目(信息: zipfile.ZipInfo) -> None:
    名称 = 信息.filename
    if 名称.startswith(('/', '\\')):
        raise ValueError(f'非法绝对路径：{名称}')
    部分 = Path(名称).parts
    if '..' in 部分:
        raise ValueError(f'非法路径穿越：{名称}')
    if any(part in 排除目录 for part in 部分):
        raise ValueError(f'包含排除目录：{名称}')
    if (信息.external_attr >> 16) & 0o170000 == 0o120000:
        raise ValueError(f'不支持符号链接：{名称}')


def 导入(包路径: str, 模式: str = 'merge') -> dict:
    根 = 库.根目录
    包 = Path(包路径)
    if not 包.exists():
        raise ValueError(f'迁移包不存在：{包}')
    if 模式 != 'merge':
        raise ValueError('当前只支持 --mode merge')

    with zipfile.ZipFile(包) as z:
        信息列表 = z.infolist()
        if len(信息列表) > 最大条目数:
            raise ValueError('迁移包条目过多')
        总解压 = sum(i.file_size for i in 信息列表)
        if 总解压 > 最大解压字节:
            raise ValueError('迁移包解压后超过 2 GB')
        for 信息 in 信息列表:
            校验条目(信息)

        临时 = Path(tempfile.mkdtemp(prefix='dsh-memory-import-'))
        try:
            z.extractall(临时)
            清单 = {}
            try:
                清单 = json.loads((临时 / 'manifest.json').read_text(encoding='utf-8'))
            except Exception:
                pass

            统计 = {'复制': 0, '跳过': 0, '冲突备份': 0}
            冲突根 = 根 / '02_长期记忆' / '_回收站' / f'导入冲突_{datetime.now():%Y%m%d_%H%M%S}'
            for 顶层 in ('00_说明', '01_对话归档', '02_长期记忆'):
                源 = 临时 / 顶层
                if not 源.exists():
                    continue
                for p in 源.rglob('*'):
                    if not p.is_file():
                        continue
                    相对 = p.relative_to(临时)
                    目标 = 根 / 相对
                    if 目标.exists():
                        if 顶层 == '02_长期记忆' and 目标.read_bytes() != p.read_bytes():
                            备份 = 冲突根 / 相对.relative_to('02_长期记忆')
                            备份.parent.mkdir(parents=True, exist_ok=True)
                            shutil.move(str(目标), str(备份))
                            统计['冲突备份'] += 1
                        else:
                            统计['跳过'] += 1
                            continue
                    目标.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(p, 目标)
                    统计['复制'] += 1

            库.确保目录()
            db = 库.连接数据库()
            索引数 = 库.重建记忆索引(db)
            db.commit()
            try:
                import 同步对话
                同步对话.同步(force=False, quiet=True, 刷新目录树=True)
            except Exception:
                pass

            return {
                '包': str(包),
                'manifest': 清单,
                '结果': 统计,
                '长期记忆索引': 索引数,
                '目标记忆盘': str(根),
            }
        finally:
            shutil.rmtree(临时, ignore_errors=True)


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    parser = argparse.ArgumentParser(description='DSH 记忆盘迁移')
    sub = parser.add_subparsers(dest='command', required=True)
    p_export = sub.add_parser('export')
    p_export.add_argument('--to')
    p_import = sub.add_parser('import')
    p_import.add_argument('--from', dest='source', required=True)
    p_import.add_argument('--mode', default='merge', choices=['merge'])

    args = parser.parse_args()
    try:
        if args.command == 'export':
            结果 = 导出(args.to)
        else:
            结果 = 导入(args.source, args.mode)
        print(json.dumps(结果, ensure_ascii=False))
        return 0
    except Exception as exc:
        print(f'迁移失败：{type(exc).__name__}: {exc}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
