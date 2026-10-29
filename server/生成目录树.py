# -*- coding: utf-8 -*-
"""DSH 记忆盘 —— 目录树生成

把记忆盘的目录结构、文件大小、最近会话与长期记忆清单写成
`00_说明/目录树.md`。同步脚本每次结束也会自动调用本逻辑。
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
import 记忆库 as 库


def main() -> None:
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    text = 库.生成目录树(写入文件=True)
    print(f"目录树已更新：{库.说明目录 / '目录树.md'}")
    print(f"（{len(text.splitlines())} 行，包含目录结构、总览、最近会话与长期记忆清单）")


if __name__ == '__main__':
    main()
