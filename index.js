/**
 * dsh-memory-disk — DeepSeek Harness host plugin.
 *
 * Three jobs:
 *  1. Inject a compact long-term-memory policy into every session's system prompt.
 *  2. Register `memory_search`, which shells out to the local memory disk's
 *     Python search CLI (F:\DSH记忆盘\05_工具\检索记忆.py).
 *  3. Serve the settings-page JSON routes used by ./lib/client.js.
 *
 * No runtime dependencies: the tool definition is a plain object accepted by
 * ctx.tools.register, so the plugin needs no import from @deepseek-ai/*.
 */

import { execFile, spawn } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { basename, dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const 插件目录 = dirname(fileURLToPath(import.meta.url))
const 旧默认根 = 'F:\\DSH记忆盘'
const DSH主目录 = process.env.DSH_HOME || join(homedir(), '.dsh')
const 插件配置路径 = join(DSH主目录, 'memory-disk-plugin.json')
const 默认Python = 'D:\\Python311\\python.exe'

let 宿主上下文 = null
let 自动同步计时器 = null

function 读取插件配置() {
  try {
    const 配置 = JSON.parse(readFileSync(插件配置路径, 'utf8'))
    return 配置 && typeof 配置 === 'object' ? 配置 : {}
  } catch {
    return {}
  }
}

function 保存插件配置(补丁) {
  const 配置 = { ...读取插件配置(), ...补丁 }
  mkdirSync(dirname(插件配置路径), { recursive: true })
  writeFileSync(插件配置路径, `${JSON.stringify(配置, null, 2)}\n`, 'utf8')
  return 配置
}

function 默认记忆根目录() {
  return join(homedir(), '.dsh', 'memory-disk')
}

function 已配置() {
  if (process.env.DSH_MEMORY_FORCE_SETUP === '1') return false
  if (process.env.DSH_MEMORY_ROOT) return true
  const 配置根 = 读取插件配置().root
  if (配置根) return existsSync(配置根)
  return existsSync(旧默认根)
}

function 记忆根目录() {
  if (process.env.DSH_MEMORY_ROOT) return process.env.DSH_MEMORY_ROOT
  const 配置根 = 读取插件配置().root
  if (配置根) return 配置根
  if (existsSync(旧默认根)) return 旧默认根
  return 默认记忆根目录()
}

function 引擎目录() {
  if (process.env.DSH_MEMORY_ENGINE) return process.env.DSH_MEMORY_ENGINE
  const 内置 = join(插件目录, 'server')
  if (existsSync(join(内置, '插件数据.py'))) return 内置
  return join(记忆根目录(), '05_工具')
}

function Python路径() {
  const 配置 = 读取插件配置()
  const 候选 = [process.env.DSH_MEMORY_PYTHON, 配置.python, 默认Python, 'python']
  for (const 项 of 候选) {
    if (!项) continue
    if (项 === 'python' || existsSync(项)) return 项
  }
  return 'python'
}

function 压缩空白(text) {
  return String(text ?? '').replace(/\s+/g, ' ').trim()
}

function 片段(text, 上限 = 320) {
  const 文本 = 压缩空白(text)
  return 文本.length > 上限 ? `${文本.slice(0, 上限)}…` : 文本
}

function 本地时间(ms) {
  const 数字 = Number(ms)
  if (!Number.isFinite(数字) || 数字 <= 0) return '时间未知'
  return new Date(数字 + 8 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' ')
}

function 钳制条数(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 8
  return Math.min(20, Math.max(1, Math.trunc(n)))
}

// ------------------------------------------------------- prompt memory brief

const 摘要缓存 = { 签名: '', 文本: '', 条数: 0, 字数: 0, 总字数: 0, 警告: [] }
const 摘要限制 = { 最大文件数: 500, 最大单文件字节: 2 * 1024 * 1024, 最大总读取字节: 20 * 1024 * 1024 }

function 遍历记忆(目录) {
  const 结果 = []
  let 项 = []
  try {
    项 = readdirSync(目录, { withFileTypes: true })
  } catch {
    return 结果
  }
  for (const 个 of 项) {
    if (个.name.startsWith('_') || 个.name.startsWith('.')) continue
    const 路径 = join(目录, 个.name)
    if (个.isDirectory()) {
      结果.push(...遍历记忆(路径))
    } else if (个.isFile() && 个.name.toLowerCase().endsWith('.md')) {
      结果.push(路径)
    }
  }
  return 结果
}

function 清理正文行(line) {
  return line
    .trim()
    .replace(/^[-*>#\s]+/, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]/g, '')
    .trim()
}

function 解析记忆文件(路径) {
  const text = readFileSync(路径, 'utf8').replace(/^\uFEFF/, '')
  const 元 = {}
  let 正文 = text
  if (正文.startsWith('---')) {
    const 结束 = 正文.indexOf('---', 3)
    if (结束 !== -1) {
      const 头 = 正文.slice(3, 结束)
      正文 = 正文.slice(结束 + 3).replace(/^\r?\n/, '')
      for (const line of 头.split(/\r?\n/)) {
        const m = line.match(/^([^:：]+)[:：]\s*(.*)$/)
        if (m) 元[m[1].trim()] = m[2].trim()
      }
    }
  }

  const 标题 = (正文.match(/^#\s+(.+)$/m) || [])[1]?.trim() || basename(路径, '.md')
  const 行 = []
  for (const raw of 正文.split(/\r?\n/)) {
    const 原 = raw.trim()
    if (!原 || 原.startsWith('#') || 原.startsWith('```') || 原.startsWith('|') || 原.startsWith('---')) continue
    const 清理 = 清理正文行(raw)
    if (清理) 行.push(清理)
  }
  let 摘要 = 行.find((x) => x.length >= 8 && /[\u4e00-\u9fff]/.test(x) && !/^[A-Za-z]:[\\/]/.test(x) && !x.includes('://'))
    || 行.find((x) => x.length >= 8) || ''
  if (摘要.length > 70) 摘要 = `${摘要.slice(0, 70)}…`

  const 类型 = 元['类型'] || basename(dirname(路径))
  let 默认 = 3
  if (标题.includes('用户画像') || 标题.includes('偏好与约定')) 默认 = 5
  else if (类型 === '项目' || 类型 === '经验') 默认 = 4
  else if (类型 === '事件') 默认 = 2

  let 重要度 = Number.parseInt(元['重要度'] || 元['重要性'] || String(默认), 10)
  if (!Number.isFinite(重要度)) 重要度 = 默认
  重要度 = Math.min(5, Math.max(1, 重要度))

  return {
    路径,
    标题,
    类型,
    重要度,
    摘要,
    字数: 正文.length,
  }
}

function 构建记忆摘要() {
  const 目录 = join(记忆根目录(), '02_长期记忆')
  const 全部文件 = 遍历记忆(目录)

  let 签名 = ''
  for (const p of 全部文件) {
    try {
      const s = statSync(p)
      签名 += `${p}:${s.mtimeMs}:${s.size}|`
    } catch {
      // A vanished file just drops out of this generation.
    }
  }
  if (签名 === 摘要缓存.签名) return 摘要缓存

  const 警告 = []
  let 文件 = 全部文件
  if (文件.length > 摘要限制.最大文件数) {
    警告.push(`长期记忆有 ${文件.length} 篇，超过 ${摘要限制.最大文件数} 篇；只读取前 ${摘要限制.最大文件数} 篇生成摘要。`)
    文件 = 文件.slice(0, 摘要限制.最大文件数)
  }

  const 条目 = []
  let 已读 = 0
  for (const p of 文件) {
    try {
      const s = statSync(p)
      if (s.size > 摘要限制.最大单文件字节) {
        警告.push(`跳过过大的记忆文件（${(s.size / 1024 / 1024).toFixed(1)} MB）：${p}`)
        continue
      }
      if (已读 + s.size > 摘要限制.最大总读取字节) {
        警告.push(`长期记忆总读取量超过 ${摘要限制.最大总读取字节 / 1024 / 1024} MB，摘要只读了一部分。`)
        break
      }
      已读 += s.size
      条目.push(解析记忆文件(p))
    } catch {
      // Skip an unreadable memory rather than failing prompt assembly.
    }
  }
  条目.sort((a, b) => b.重要度 - a.重要度 || (a.标题 < b.标题 ? -1 : 1))
  const 取 = 条目.slice(0, 8)
  const 总字数 = 条目.reduce((sum, x) => sum + x.字数, 0)
  const 列表 = 取.map((x) => `- [${x.重要度}] ${x.标题}：${x.摘要}`).join('\n')

  const 文本 = `## 长期记忆盘（${记忆根目录()}）

记忆盘保存全部历史对话与长期记忆。下面是按重要度挑选的稳定摘要，用于减少 token 并复用前缀缓存；完整内容按需检索。

规则：
- 用户提到“以前 / 上次 / 之前说过 / 我们做过的 / 那个项目 / 历史记录 / 以前怎么解决”时，先调用 \`memory_search\` 检索，再回答；没有检索过，不要声称“没有相关记忆”。
- 检索结果只是片段；引用具体参数、路径或结论前，用 \`read\` 打开归档路径核对原文。
- 产生稳定的偏好、项目约束、结论或踩坑经验时，写进 \`02_长期记忆\` 对应分类（先看 \`00_说明\\目录规范.md\`）；重要度 1-5（5 最高）可在 DSH 侧边栏/设置页调整。
- 摘要只覆盖重要度最高的记忆；需要未列出的内容时用 \`memory_search\`。

当前自动加载（按重要度排序，最多 8 条）：
${列表 || '- （暂无长期记忆）'}`

  摘要缓存.签名 = 签名
  摘要缓存.文本 = 文本
  摘要缓存.条数 = 取.length
  摘要缓存.字数 = 文本.length
  摘要缓存.总字数 = 总字数
  摘要缓存.警告 = 警告
  return 摘要缓存
}

// ---------------------------------------------------------------- UI routes

async function 运行数据接口(参数) {
  const 根 = 记忆根目录()
  const 脚本 = join(引擎目录(), '插件数据.py')
  if (!existsSync(脚本)) {
    throw new Error(`找不到记忆引擎：${脚本}。请确认插件包含 server/，或设置 DSH_MEMORY_ENGINE。`)
  }
  let stdout
  let stderr
  try {
    ;({ stdout, stderr } = await execFileAsync(Python路径(), [脚本, ...参数], {
      cwd: 根,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 60000,
      maxBuffer: 20 * 1024 * 1024,
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        PYTHONUTF8: '1',
        DSH_MEMORY_ROOT: 根,
        DSH_HOME: process.env.DSH_HOME || join(homedir(), '.dsh'),
      },
    }))
  } catch (error) {
    throw new Error(`记忆盘数据接口失败：${压缩空白(error?.stderr || error?.message || String(error))}`)
  }
  try {
    return JSON.parse(stdout)
  } catch {
    throw new Error(`记忆盘数据接口返回了非 JSON 内容：${片段(stdout, 400)}${stderr ? ` ${片段(stderr, 200)}` : ''}`)
  }
}

function 应答(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

async function 打开路径(请求体) {
  const 根 = resolve(记忆根目录())
  const 相对 = typeof 请求体?.path === 'string' ? 请求体.path.trim() : ''
  const 目标 = 相对 ? resolve(根, 相对) : 根
  if (目标 !== 根 && !目标.startsWith(根 + sep)) throw new Error('路径不在记忆盘内')
  if (!existsSync(目标)) throw new Error(`路径不存在：${目标}`)
  const 是目录 = statSync(目标).isDirectory()
  const 子进程 = spawn('explorer.exe', [是目录 ? 目标 : `/select,${目标}`], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  })
  子进程.unref()
  return { opened: 目标 }
}

function 配置信息() {
  return {
    configured: 已配置(),
    root: 记忆根目录(),
    default_root: 默认记忆根目录(),
    python: Python路径(),
    engine: 引擎目录(),
    config_file: 插件配置路径,
    legacy: existsSync(旧默认根),
  }
}

async function 检查Python() {
  try {
    const { stdout } = await execFileAsync(Python路径(), ['-c', 'import sys, zstandard; print(sys.version.split()[0])'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 30000,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
    })
    return { ok: true, version: 压缩空白(stdout) }
  } catch (error) {
    return { ok: false, error: 压缩空白(error?.stderr || error?.message || String(error)) }
  }
}

async function 设置根目录(根) {
  const 目标 = resolve(String(根 || '').trim())
  if (!目标) throw new Error('缺少记忆盘目录')
  if (目标.length < 3) throw new Error('目录路径太短')
  const python = await 检查Python()
  if (!python.ok) throw new Error(`Python 环境不可用：${python.error}`)
  mkdirSync(目标, { recursive: true })
  const 探针 = join(目标, `.dsh-write-test-${Date.now()}.tmp`)
  writeFileSync(探针, 'ok', 'utf8')
  rmSync(探针, { force: true })
  保存插件配置({ root: 目标 })
  const 初始化 = await 运行数据接口(['init'])
  const 同步 = await 运行数据接口(['sync'])
  摘要缓存.签名 = ''
  if (宿主上下文) 启动自动同步(宿主上下文)
  return { config: 配置信息(), init: 初始化, sync: 同步 }
}

async function 选择文件夹() {
  if (process.platform !== 'win32') throw new Error('当前平台不支持原生目录选择，请手动输入路径')
  const 脚本 = [
    'Add-Type -AssemblyName System.Windows.Forms',
    "$d = New-Object System.Windows.Forms.FolderBrowserDialog",
    "$d.Description = '选择 DSH 记忆盘目录'",
    "$d.SelectedPath = [Environment]::GetFolderPath('UserProfile')",
    "if ($d.ShowDialog() -eq 'OK') { [Console]::OutputEncoding = [Text.Encoding]::UTF8; Write-Output $d.SelectedPath }",
  ].join('; ')
  const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-STA', '-Command', 脚本], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
  })
  return { path: 压缩空白(stdout) || null }
}

async function 运行迁移接口(参数) {
  const 根 = 记忆根目录()
  const 脚本 = join(引擎目录(), '迁移记忆.py')
  if (!existsSync(脚本)) throw new Error(`找不到迁移脚本：${脚本}`)
  const { stdout, stderr } = await execFileAsync(Python路径(), [脚本, ...参数], {
    cwd: 根,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 600000,
    maxBuffer: 20 * 1024 * 1024,
    env: {
      ...process.env,
      PYTHONIOENCODING: 'utf-8',
      PYTHONUTF8: '1',
      DSH_MEMORY_ROOT: 根,
      DSH_HOME: process.env.DSH_HOME || join(homedir(), '.dsh'),
    },
  })
  try {
    return JSON.parse(stdout)
  } catch {
    throw new Error(`迁移脚本返回了非 JSON：${片段(stdout, 400)}${stderr ? ` ${片段(stderr, 200)}` : ''}`)
  }
}

async function 接收迁移包(request) {
  const 表单 = await request.formData()
  const 文件 = 表单.get('file')
  if (!文件 || typeof 文件.arrayBuffer !== 'function') throw new Error('缺少迁移包文件')
  const 数据 = Buffer.from(await 文件.arrayBuffer())
  if (数据.length > 200 * 1024 * 1024) throw new Error('迁移包超过 200 MB，请使用命令行导入')
  const 临时 = join(tmpdir(), `dsh-memory-import-${Date.now()}-${Math.random().toString(16).slice(2)}.zip`)
  writeFileSync(临时, 数据)
  try {
    const 结果 = await 运行迁移接口(['import', '--from', 临时, '--mode', 'merge'])
    摘要缓存.签名 = ''
    return 结果
  } finally {
    rmSync(临时, { force: true })
  }
}

function 启动自动同步(ctx) {
  const 配置 = 读取插件配置()
  if (!配置.root) return
  if (自动同步计时器) {
    clearInterval(自动同步计时器)
    自动同步计时器 = null
  }
  const 分钟 = Math.max(1, Number(配置.auto_sync_minutes) || 10)
  const 计时器 = setInterval(() => {
    运行数据接口(['sync']).catch(() => {
      // A failed background sync must not break the host; the UI shows the error on demand.
    })
  }, 分钟 * 60 * 1000)
  自动同步计时器 = 计时器
  ctx.effect(() => {
    return () => {
      clearInterval(计时器)
      if (自动同步计时器 === 计时器) 自动同步计时器 = null
    }
  }, 'dsh-memory-disk: background sync')
}

function 注册界面路由(ctx) {  ctx.inject(['connection'], (c) => {
    const 服务 = c.connection
    const 注册 = 服务?.fetch?.register
    if (typeof 注册 !== 'function') return

    const 列表 = [
      {
        path: '/api/dsh-memory/status',
        处理: async () => {
          const 状态 = await 运行数据接口(['status'])
          const 摘要 = 构建记忆摘要()
          return {
            ...状态,
            brief_memories: 摘要.条数,
            brief_chars: 摘要.字数,
            warnings: [...(状态.warnings || []), ...摘要.警告],
          }
        },
      },
      {
        path: '/api/dsh-memory/search',
        处理: async (请求体) => {
          const query = 压缩空白(请求体?.query)
          if (!query) throw new Error('缺少 query')
          const 参数 = ['search', query, '--limit', String(Math.min(30, Math.max(1, Number(请求体?.limit) || 8)))]
          if (请求体?.role === 'user' || 请求体?.role === 'assistant') 参数.push('--role', 请求体.role)
          if (typeof 请求体?.project === 'string' && 请求体.project.trim()) {
            参数.push('--project', 请求体.project.trim())
          }
          return 运行数据接口(参数)
        },
      },
      {
        path: '/api/dsh-memory/sync',
        处理: async () => {
          const 结果 = await 运行数据接口(['sync'])
          const 摘要 = 构建记忆摘要()
          return {
            ...结果,
            status: {
              ...结果.status,
              brief_memories: 摘要.条数,
              brief_chars: 摘要.字数,
              warnings: [...((结果.status && 结果.status.warnings) || []), ...摘要.警告],
            },
          }
        },
      },
      {
        path: '/api/dsh-memory/open',
        处理: async (请求体) => 打开路径(请求体),
      },
      {
        path: '/api/dsh-memory/memories',
        处理: async () => 运行数据接口(['memories']),
      },
      {
        path: '/api/dsh-memory/importance',
        处理: async (请求体) => {
          const 路径 = 压缩空白(请求体?.path)
          const 值 = Number(请求体?.importance)
          if (!路径) throw new Error('缺少 path')
          if (!Number.isInteger(值) || 值 < 1 || 值 > 5) throw new Error('importance 必须是 1-5')
          const 结果 = await 运行数据接口(['importance', 路径, String(值)])
          摘要缓存.签名 = ''
          return 结果
        },
      },
      {
        path: '/api/dsh-memory/delete',
        处理: async (请求体) => {
          const 路径 = 压缩空白(请求体?.path)
          if (!路径) throw new Error('缺少 path')
          const 结果 = await 运行数据接口(['delete', 路径])
          const 索引 = await 运行数据接口(['reindex'])
          摘要缓存.签名 = ''
          return { ...结果, indexed: 索引.indexed }
        },
      },
      {
        path: '/api/dsh-memory/brief',
        处理: async () => {
          const 摘要 = 构建记忆摘要()
          return {
            memories: 摘要.条数,
            chars: 摘要.字数,
            total_chars: 摘要.总字数,
            text: 摘要.文本,
          }
        },
      },
      {
        path: '/api/dsh-memory/config',
        处理: async () => ({ ...配置信息(), python_check: await 检查Python() }),
      },
      {
        path: '/api/dsh-memory/config/set',
        处理: async (请求体) => 设置根目录(请求体?.root),
      },
      {
        path: '/api/dsh-memory/pick-folder',
        处理: async () => 选择文件夹(),
      },
      {
        path: '/api/dsh-memory/export',
        处理: async () => 运行迁移接口(['export']),
      },
      {
        path: '/api/dsh-memory/import',
        原始请求: true,
        处理: async (_请求体, request) => 接收迁移包(request),
      },
    ]

    for (const 路由 of 列表) {
      const 处理函数 = async (request) => {
        try {
          let 请求体 = {}
          if (!路由.原始请求) {
            try {
              请求体 = await request.json()
            } catch {
              // Status/sync/open tolerate an empty body.
            }
          }
          return 应答({ ok: true, value: await 路由.处理(请求体, request) })
        } catch (error) {
          return 应答({ ok: false, error: 压缩空白(error?.message || String(error)) }, 500)
        }
      }
      try {
        c.effect(
          () => 注册.call(服务.fetch, {
            path: 路由.path,
            methods: ['POST'],
            requestBody: 'buffered',
            fetch: 处理函数,
          }),
          `dsh-memory-disk: ${路由.path}`,
        )
      } catch {
        // A host without the fetch face keeps the prompt/tool half only.
      }
    }
  })
}

export const name = 'dsh-memory-disk'
export const inject = ['systemPrompt', 'tools']

export function apply(ctx) {
  try {
    const logger = typeof ctx.logger === 'function' ? ctx.logger('dsh-memory-disk') : ctx.logger
    logger?.info?.(`[dsh-memory-disk] loaded; memory root = ${记忆根目录()}`)
  } catch {
    // logging is best-effort only
  }

  // ---------------------------------------------------------------- prompt
  let 锚点 = -1000
  try {
    const 值 = ctx.systemPrompt.getSectionOrder('HARNESS_IDENTITY')
    if (Number.isFinite(值)) 锚点 = 值
  } catch {
    // keep the fallback order
  }

  ctx.systemPrompt.section({
    name: 'dsh-memory-disk:entry',
    order: 锚点 + 1100,
    interpolate: false,
    text: () => 构建记忆摘要().文本,
  })

  // ------------------------------------------------------------------ tool
  ctx.tools.register({
    name: 'memory_search',
    description:
      `检索本机 DSH 长期记忆盘（${记忆根目录()}）中的历史对话与长期记忆卡片。` +
      '当用户提到“以前 / 上次 / 之前说过 / 我们做过的 / 那个项目 / 历史记录 / 以前怎么解决”时，必须先调用本工具再回答；' +
      '需要引用历史决策、参数、路径或踩坑经验时也调用。返回命中片段、时间和归档路径。',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '检索关键词，中文优先；多个关键词用空格分隔。2-3 个字通常比长句更稳。',
        },
        limit: {
          type: 'number',
          description: '最多返回多少条对话命中，默认 8，范围 1-20。',
        },
        role: {
          type: 'string',
          enum: ['user', 'assistant'],
          description: '只检索用户消息或只检索助手回复；省略则两者都检索。',
        },
        project: {
          type: 'string',
          description: '按项目名过滤，例如 QGC地面站二次开发；省略则检索全部项目。',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: String(value) }],
    },
    timeoutMs: 30000,
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const query = 压缩空白(args?.query)
      if (!query) throw new Error('memory_search 需要非空的 query')

      const limit = 钳制条数(args?.limit)
      const 根 = 记忆根目录()
      const 脚本 = join(引擎目录(), '检索记忆.py')
      if (!existsSync(脚本)) {
        throw new Error(`找不到记忆检索引擎：${脚本}。请确认插件包含 server/，或设置 DSH_MEMORY_ENGINE。`)
      }

      const argv = [脚本, query, '--limit', String(limit), '--json']
      if (args?.role === 'user' || args?.role === 'assistant') argv.push('--role', args.role)
      if (typeof args?.project === 'string' && args.project.trim()) {
        argv.push('--项目', args.project.trim())
      }

      const 选项 = {
        cwd: 根,
        encoding: 'utf8',
        windowsHide: true,
        timeout: 30000,
        maxBuffer: 10 * 1024 * 1024,
        env: {
          ...process.env,
          PYTHONIOENCODING: 'utf-8',
          PYTHONUTF8: '1',
          DSH_MEMORY_ROOT: 根,
          DSH_HOME: process.env.DSH_HOME || join(homedir(), '.dsh'),
        },
      }
      if (exec?.signal) 选项.signal = exec.signal

      let stdout
      try {
        ;({ stdout } = await execFileAsync(Python路径(), argv, 选项))
      } catch (error) {
        const 原因 = 压缩空白(error?.stderr || error?.message || String(error))
        throw new Error(`记忆检索失败：${原因}`)
      }

      let 数据
      try {
        数据 = JSON.parse(stdout)
      } catch {
        throw new Error(`记忆检索返回了非 JSON 内容：${片段(stdout, 400)}`)
      }

      const 对话 = Array.isArray(数据?.对话) ? 数据.对话 : []
      const 记忆 = Array.isArray(数据?.长期记忆) ? 数据.长期记忆 : []

      if (!对话.length && !记忆.length) {
        return [
          `没有检索到与「${query}」相关的记忆。`,
          '',
          '- 可以换更短的关键词再试（中文 2-3 个字通常更稳）；',
          `- 确认记忆盘已同步：\`python ${join(根, '05_工具', '同步对话.py')}\`；`,
          '- 如果确实没有历史记录，再如实告诉用户。',
        ].join('\n')
      }

      const 行 = [
        `记忆检索「${query}」：对话 ${对话.length} 条 / 长期记忆 ${记忆.length} 条`,
        '（以下是片段，不是完整原文；引用具体结论前请用 read 打开归档路径核对。）',
      ]

      if (对话.length) {
        行.push('', '【对话】')
        对话.forEach((r, i) => {
          const 角色 = r.role === 'user' ? '👤 用户' : '🤖 助手'
          行.push(
            `${i + 1}. ${本地时间(r.ts_ms)} · ${角色} · ${压缩空白(r.project) || '未分类'} · ${压缩空白(r.title) || '未命名'}`,
            `   ${片段(r.text)}`,
            `   归档：${压缩空白(r.archive_rel)}`,
          )
        })
      }

      if (记忆.length) {
        行.push('', '【长期记忆】')
        记忆.forEach((r) => {
          行.push(
            `- ${压缩空白(r.title) || '未命名'}（${压缩空白(r.path)}）`,
            `  ${片段(r.body, 400)}`,
          )
        })
      }

      return 行.join('\n')
    },
  })

  if (typeof ctx.inject === 'function') {
    宿主上下文 = ctx
    注册界面路由(ctx)
    启动自动同步(ctx)
  }
}
