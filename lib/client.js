// dsh-memory-disk browser half.
// Hand-written lazy-CJS factory: the client module loader expects this exact
// wrapper shape (see dsh-context's built lib/client.js). No build step, no
// imports beyond the platform-seeded `react`.
window.__ModuleLoader__.load({
  id: 'dsh-memory-disk',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    var React = require('react')
    var h = React.createElement

    var CSS = `
.mem-page{box-sizing:border-box;height:100%;min-height:0;overflow:auto;padding:22px clamp(14px,3cqi,36px) 56px;color:var(--dsw-alias-label-primary);font-size:13px;container-type:inline-size}
.mem-head{display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:18px}
.mem-head-main{min-width:0;flex:1}
.mem-title{margin:0;font-size:18px;font-weight:600;line-height:1.3}
.mem-sub{color:var(--dsw-alias-label-secondary);font-size:12px;margin-top:4px;overflow-wrap:anywhere}
.mem-actions{display:flex;gap:8px;flex-wrap:wrap;margin-left:auto}
.mem-btn{font:inherit;cursor:pointer;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-radius:8px;padding:6px 12px;font-size:12px;line-height:1.4;transition:border-color .2s,background-color .2s,color .2s}
.mem-btn:hover:enabled{border-color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-interactive-bg-hover)}
.mem-btn:disabled{opacity:.5;cursor:default}
.mem-btn-primary{background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary));border-color:transparent;color:var(--dsw-alias-label-primary-foreground,#fff)}
.mem-btn-primary:hover:enabled{background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary));border-color:transparent;opacity:.9}
.mem-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:16px}
.mem-kpi{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:12px 14px;min-width:0}
.mem-kpi-label{color:var(--dsw-alias-label-secondary);font-size:11px;white-space:nowrap}
.mem-kpi-value{font-size:22px;font-weight:600;font-variant-numeric:tabular-nums;margin-top:2px;overflow-wrap:anywhere}
.mem-kpi-hint{color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));font-size:10px;margin-top:2px}
.mem-card{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;padding:14px 16px;margin-bottom:14px;min-width:0}
.mem-card-title{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;margin-bottom:10px}
.mem-search{display:flex;gap:8px}
.mem-input{flex:1;min-width:0;font:inherit;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:7px 10px;color:var(--dsw-alias-label-primary);font-size:12px;outline:none}
.mem-input:focus{border-color:var(--dsw-alias-brand-primary)}
.mem-input::placeholder{color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary))}
.mem-list{display:flex;flex-direction:column;gap:6px}
.mem-results{margin-top:12px}
.mem-subhead{color:var(--dsw-alias-label-secondary);font-size:11px;font-weight:600;margin:6px 0 2px}
.mem-row{display:flex;align-items:flex-start;gap:10px;padding:8px 10px;border-radius:8px;border:1px solid transparent;min-width:0}
.mem-row:hover{background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-border-l2)}
.mem-row-main{flex:1;min-width:0}
.mem-row-title{font-size:12.5px;font-weight:600;overflow-wrap:anywhere}
.mem-row-meta{color:var(--dsw-alias-label-secondary);font-size:11px;margin-top:2px;overflow-wrap:anywhere}
.mem-row-snippet{color:var(--dsw-alias-label-secondary);font-size:11.5px;line-height:1.5;margin-top:4px;overflow-wrap:anywhere}
.mem-row-actions{flex:none;display:flex;gap:6px}
.mem-mini{font:inherit;cursor:pointer;border:0;background:transparent;color:var(--dsw-alias-brand-primary);font-size:11px;padding:2px 4px}
.mem-mini:hover{text-decoration:underline}
.mem-select{font:inherit;font-size:11px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:6px;padding:2px 4px;cursor:pointer}
.mem-select:focus{outline:1px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.mem-danger{color:var(--dsw-alias-state-error-primary,var(--color-red-500))}
.mem-manage-actions{align-items:center;flex-wrap:wrap;justify-content:flex-end}
.mem-hint{color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));font-size:11px;margin:-4px 0 8px;line-height:1.5}
.mem-brief{color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1.5;margin-top:6px}
.mem-projects{display:flex;flex-direction:column;gap:8px}
.mem-proj{display:grid;grid-template-columns:minmax(90px,150px) minmax(0,1fr) 38px;gap:8px;align-items:center;font-size:11.5px}
.mem-proj-name{white-space:nowrap;text-overflow:ellipsis;overflow:hidden;color:var(--dsw-alias-label-primary)}
.mem-proj-n{text-align:right;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}
.mem-bar{height:6px;border-radius:4px;background:color-mix(in srgb,var(--dsw-alias-label-secondary) 18%,transparent);overflow:hidden;display:block}
.mem-bar i{display:block;height:100%;border-radius:4px;background:var(--dsw-alias-brand-primary)}
.mem-columns{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px}
.mem-columns>.mem-card{margin-bottom:14px}
.mem-empty{color:var(--dsw-alias-label-secondary);font-size:12px;padding:8px 0}
.mem-error{color:var(--dsw-alias-state-error-primary,var(--color-red-500));background:color-mix(in srgb,var(--dsw-alias-state-error-primary,var(--color-red-500)) 9%,transparent);border:1px solid color-mix(in srgb,var(--dsw-alias-state-error-primary,var(--color-red-500)) 35%,transparent);border-radius:8px;padding:8px 10px;margin-bottom:12px;font-size:12px;overflow-wrap:anywhere}
.mem-note{color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));font-size:11px;margin-top:4px;overflow-wrap:anywhere}
.mem-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);box-shadow:var(--dsw-shadow-lv2,0 6px 24px #0004);color:var(--dsw-alias-label-primary);border-radius:999px;padding:7px 16px;font-size:12px;z-index:400}
@container (max-width:760px){.mem-columns{grid-template-columns:minmax(0,1fr)}.mem-head{flex-direction:column}.mem-actions{margin-left:0}}
`

    var CSS_EXTRA = `
.mem-page{--mem-accent:#5b8cff;--mem-card:var(--dsw-alias-bg-layer-1);--mem-line:var(--dsw-alias-border-l2);--mem-muted:var(--dsw-alias-label-secondary);padding:26px clamp(16px,3.2cqi,40px) 64px;background:radial-gradient(900px 280px at 8% -10%,color-mix(in srgb,var(--mem-accent) 9%,transparent),transparent 65%)}
.mem-head{display:flex;flex-direction:row;align-items:center;gap:14px;flex-wrap:nowrap;margin-bottom:22px}
.mem-brand{width:44px;height:44px;flex:none;border-radius:14px;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,#5b8cff,#8b5cf6);box-shadow:0 6px 18px color-mix(in srgb,#5b8cff 35%,transparent)}
.mem-head-main{flex:1;min-width:0}
.mem-title{margin:0;font-size:22px;font-weight:700;letter-spacing:-.02em;line-height:1.25}
.mem-sub{display:flex;align-items:center;gap:8px;flex-wrap:wrap;color:var(--mem-muted);font-size:11.5px;margin-top:6px}
.mem-pill{display:inline-flex;align-items:center;gap:6px;border:1px solid color-mix(in srgb,var(--mem-accent) 26%,var(--mem-line));background:color-mix(in srgb,var(--mem-accent) 9%,transparent);color:var(--mem-accent);border-radius:999px;padding:2px 9px;font-size:10.5px;font-weight:600;white-space:nowrap}
.mem-pill-soft{color:var(--mem-muted);border-color:var(--mem-line);background:var(--dsw-alias-bg-layer-2)}
.mem-dot{width:6px;height:6px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 3px color-mix(in srgb,#22c55e 18%,transparent)}
.mem-actions{display:flex;gap:8px;flex-wrap:wrap;margin-left:auto;flex:none}
.mem-btn{height:32px;display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid var(--mem-line);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-radius:9px;padding:0 12px;font-size:12px;font-weight:500;line-height:1;cursor:pointer;transition:transform .15s,border-color .2s,background-color .2s,box-shadow .2s,opacity .2s}
.mem-btn:hover:enabled{border-color:color-mix(in srgb,var(--mem-accent) 45%,var(--mem-line));background:color-mix(in srgb,var(--mem-accent) 7%,var(--dsw-alias-bg-layer-2));transform:translateY(-1px)}
.mem-btn:active:enabled{transform:translateY(0)}
.mem-btn:disabled{opacity:.55;cursor:default;transform:none}
.mem-btn-primary{border-color:transparent;background:linear-gradient(135deg,#5b8cff,#7c5cff);color:#fff;box-shadow:0 5px 14px color-mix(in srgb,#5b8cff 30%,transparent)}
.mem-btn-primary:hover:enabled{border-color:transparent;background:linear-gradient(135deg,#4f7ff5,#6f4ff0);box-shadow:0 7px 18px color-mix(in srgb,#5b8cff 38%,transparent)}
.mem-btn-ghost{background:transparent}
.mem-btn-sm{height:30px;padding:0 10px;font-size:11.5px}
.mem-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin-bottom:16px}
.mem-kpi{position:relative;overflow:hidden;border-radius:15px;padding:14px 16px;background:var(--mem-card);border:1px solid var(--mem-line);box-shadow:0 1px 2px #0000000a,0 8px 24px -18px #00000055}
.mem-kpi::before{content:"";position:absolute;width:110px;height:110px;right:-38px;top:-46px;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--tone) 22%,transparent),transparent 68%);pointer-events:none}
.mem-kpi-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
.mem-kpi-label{color:var(--mem-muted);font-size:11px;font-weight:600;letter-spacing:.02em;white-space:nowrap}
.mem-kpi-icon{width:28px;height:28px;border-radius:9px;display:grid;place-items:center;color:var(--tone);background:color-mix(in srgb,var(--tone) 13%,transparent);border:1px solid color-mix(in srgb,var(--tone) 20%,transparent);flex:none}
.mem-kpi-value{font-size:24px;font-weight:750;letter-spacing:-.025em;font-variant-numeric:tabular-nums;margin-top:7px;line-height:1.15;overflow-wrap:anywhere}
.mem-kpi-hint{color:var(--mem-muted);font-size:10.5px;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mem-tone-blue{--tone:#5b8cff}
.mem-tone-green{--tone:#22c55e}
.mem-tone-violet{--tone:#a855f7}
.mem-tone-amber{--tone:#f59e0b}
.mem-tone-slate{--tone:#64748b}
.mem-card{border-radius:15px;padding:16px 18px;background:var(--mem-card);border:1px solid var(--mem-line);box-shadow:0 1px 2px #00000008,0 10px 30px -26px #00000066}
.mem-card-head{display:flex;align-items:center;gap:8px;margin-bottom:12px;min-width:0}
.mem-card-icon{color:var(--mem-accent);width:18px;height:18px;display:grid;place-items:center;flex:none}
.mem-card-title{font-size:13px;font-weight:700;letter-spacing:.01em;margin:0}
.mem-card-count{margin-left:auto;color:var(--mem-muted);font-size:10.5px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--mem-line);border-radius:999px;padding:1px 8px;white-space:nowrap}
.mem-searchbox{display:flex;align-items:center;gap:8px;border:1px solid var(--mem-line);background:var(--dsw-alias-bg-layer-2);border-radius:11px;padding:4px 4px 4px 12px;transition:border-color .2s,box-shadow .2s}
.mem-searchbox:focus-within{border-color:color-mix(in srgb,var(--mem-accent) 55%,var(--mem-line));box-shadow:0 0 0 3px color-mix(in srgb,var(--mem-accent) 13%,transparent)}
.mem-searchbox>.mem-icon{color:var(--mem-muted);flex:none}
.mem-searchbox .mem-input{background:transparent;border:0;box-shadow:none;padding:7px 0;font-size:12.5px}
.mem-searchbox .mem-input:focus{outline:none}
.mem-searchbox .mem-btn{flex:none}
.mem-brief-card{background:linear-gradient(135deg,color-mix(in srgb,var(--mem-accent) 8%,var(--mem-card)),var(--mem-card) 62%);border-color:color-mix(in srgb,var(--mem-accent) 22%,var(--mem-line))}
.mem-brief-stats{display:flex;gap:clamp(18px,4cqi,40px);flex-wrap:wrap;margin-top:2px}
.mem-brief-stat b{display:block;font-size:22px;font-weight:750;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.mem-brief-stat span{display:block;color:var(--mem-muted);font-size:10.5px;margin-top:2px}
.mem-progress{height:8px;border-radius:999px;background:color-mix(in srgb,var(--mem-muted) 16%,transparent);overflow:hidden;margin:13px 0 8px}
.mem-progress i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#5b8cff,#a855f7);box-shadow:0 0 10px color-mix(in srgb,#5b8cff 45%,transparent)}
.mem-muted{color:var(--mem-muted);font-size:10.8px;line-height:1.55;overflow-wrap:anywhere}
.mem-warn{display:flex;align-items:flex-start;gap:10px;border:1px solid color-mix(in srgb,#f59e0b 40%,var(--mem-line));background:color-mix(in srgb,#f59e0b 9%,transparent);color:var(--dsw-alias-label-primary);border-radius:12px;padding:10px 12px;margin-bottom:14px;font-size:11.5px;line-height:1.55}
.mem-warn .mem-icon{color:#f59e0b;flex:none;margin-top:1px}
.mem-warn-list{display:flex;flex-direction:column;gap:3px;min-width:0}
.mem-warn-list span{overflow-wrap:anywhere}
.mem-setup{max-width:760px}
.mem-setup-path{margin:10px 0 12px;max-width:680px}
.mem-setup-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.mem-file-input{display:none}
.mem-dist{display:flex;flex-direction:column;gap:8px}
.mem-dist-row{display:grid;grid-template-columns:46px minmax(0,1fr) 24px;gap:8px;align-items:center;font-size:11px}
.mem-dist-label{color:var(--mem-muted);white-space:nowrap;font-variant-numeric:tabular-nums}
.mem-dist-bar{height:7px;border-radius:999px;background:color-mix(in srgb,var(--mem-muted) 14%,transparent);overflow:hidden}
.mem-dist-bar i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#f59e0b,#f97316)}
.mem-dist-n{text-align:right;color:var(--mem-muted);font-variant-numeric:tabular-nums}
.mem-types{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}
.mem-chip{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--mem-line);background:var(--dsw-alias-bg-layer-2);color:var(--mem-muted);border-radius:999px;padding:2px 8px;font-size:10.5px}
.mem-chip b{color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums}
.mem-manage-row{display:flex;align-items:center;gap:12px;border:1px solid var(--mem-line);border-radius:12px;padding:10px 12px;margin-bottom:8px;background:var(--dsw-alias-bg-layer-1);transition:border-color .2s,background-color .2s}
.mem-manage-row:hover{border-color:color-mix(in srgb,var(--mem-accent) 32%,var(--mem-line));background:color-mix(in srgb,var(--mem-accent) 4%,var(--mem-card))}
.mem-manage-main{flex:1;min-width:0}
.mem-manage-title{display:flex;align-items:center;gap:7px;flex-wrap:wrap;font-size:12.5px;font-weight:650;line-height:1.35}
.mem-badge{display:inline-flex;align-items:center;border-radius:6px;padding:1px 6px;font-size:10px;font-weight:600;color:var(--mem-accent);background:color-mix(in srgb,var(--mem-accent) 11%,transparent);border:1px solid color-mix(in srgb,var(--mem-accent) 20%,transparent)}
.mem-path{color:var(--mem-muted);font-family:var(--ds-font-family-code,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:10.3px;margin-top:3px;overflow-wrap:anywhere;opacity:.85}
.mem-stars{display:inline-flex;align-items:center;gap:1px;flex:none}
.mem-star{border:0;background:transparent;padding:0 1px;line-height:1;cursor:pointer;color:color-mix(in srgb,var(--mem-muted) 32%,transparent);font-size:15px;transition:transform .12s,color .15s}
.mem-star.on{color:#f59e0b;text-shadow:0 0 8px color-mix(in srgb,#f59e0b 35%,transparent)}
.mem-star:hover{transform:scale(1.18);color:#f59e0b}
.mem-icon-btn{width:28px;height:28px;flex:none;display:grid;place-items:center;border:1px solid var(--mem-line);background:transparent;border-radius:8px;color:var(--mem-muted);cursor:pointer;transition:color .15s,background-color .15s,border-color .15s}
.mem-icon-btn:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover);border-color:color-mix(in srgb,var(--mem-accent) 35%,var(--mem-line))}
.mem-icon-btn.danger:hover{color:var(--dsw-alias-state-error-primary,var(--color-red-500));background:color-mix(in srgb,var(--dsw-alias-state-error-primary,var(--color-red-500)) 10%,transparent);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary,var(--color-red-500)) 30%,transparent)}
.mem-link{border:0;background:transparent;color:var(--mem-accent);font:inherit;font-size:11px;cursor:pointer;padding:3px 5px;border-radius:6px;white-space:nowrap}
.mem-link:hover{background:color-mix(in srgb,var(--mem-accent) 10%,transparent)}
.mem-proj{grid-template-columns:minmax(90px,150px) minmax(0,1fr) 38px;gap:10px}
.mem-bar{height:7px;background:color-mix(in srgb,var(--mem-muted) 14%,transparent)}
.mem-bar i{background:linear-gradient(90deg,#5b8cff,#8b5cf6)}
.mem-empty{border:1px dashed var(--mem-line);border-radius:11px;padding:16px;text-align:center;color:var(--mem-muted);font-size:11.5px;background:color-mix(in srgb,var(--mem-muted) 3%,transparent)}
.mem-note{margin-top:6px}
.mem-toast{backdrop-filter:blur(10px);background:color-mix(in srgb,var(--dsw-alias-bg-layer-2) 88%,transparent);border-color:var(--mem-line);box-shadow:0 10px 30px -8px #00000066;padding:8px 18px;font-weight:500}
.mem-columns{gap:14px}
@container (max-width:760px){.mem-head{flex-wrap:wrap}.mem-actions{margin-left:0;width:100%}.mem-actions .mem-btn{flex:1}.mem-columns{grid-template-columns:minmax(0,1fr)}}
@container (max-width:360px){.mem-kpis{grid-template-columns:minmax(0,1fr)}.mem-brief-stats{gap:18px}.mem-brand{width:38px;height:38px;border-radius:12px}.mem-title{font-size:19px}}
`

    function ensureStyle() {
      if (typeof document === 'undefined') return
      if (document.getElementById('dsh-memory-disk-style')) return
      var el = document.createElement('style')
      el.id = 'dsh-memory-disk-style'
      el.textContent = CSS + '\n' + CSS_EXTRA
      document.head.appendChild(el)
    }

    function api(path, body) {
      return fetch('/api/dsh-memory/' + path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      }).then(function (res) {
        return res.json().catch(function () { return null }).then(function (data) {
          if (!res.ok || !data || data.ok !== true) {
            throw new Error((data && data.error) || ('HTTP ' + res.status))
          }
          return data.value
        })
      })
    }

    function apiForm(path, formData) {
      return fetch('/api/dsh-memory/' + path, { method: 'POST', body: formData }).then(function (res) {
        return res.json().catch(function () { return null }).then(function (data) {
          if (!res.ok || !data || data.ok !== true) {
            throw new Error((data && data.error) || ('HTTP ' + res.status))
          }
          return data.value
        })
      })
    }

    function num(n) {
      return typeof n === 'number' ? n.toLocaleString('zh-CN') : String(n || 0)
    }

    function fmtTime(ms) {
      var n = Number(ms)
      if (!isFinite(n) || n <= 0) return '时间未知'
      return new Date(n + 8 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' ')
    }

    var ICON_PATHS = {
      search: ['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z', 'm20 20-4-4'],
      database: [
        'M12 3C7.6 3 4 4.3 4 6s3.6 3 8 3 8-1.3 8-3-3.6-3-8-3Z',
        'M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6',
        'M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6',
      ],
      chat: ['M21 11.5a8.4 8.4 0 0 1-8.5 8.3 9.6 9.6 0 0 1-3.9-.8L4 20l1-4.2a8 8 0 0 1-1-3.8A8.4 8.4 0 0 1 12.5 3 8.4 8.4 0 0 1 21 11.5Z'],
      sync: ['M20 11a8 8 0 0 0-13.7-5.6L4 8', 'M4 4v4h4', 'M4 13a8 8 0 0 0 13.7 5.6L20 16', 'M20 20v-4h-4'],
      folder: ['M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z'],
      refresh: ['M20 12a8 8 0 1 1-2.34-5.66', 'M20 4v4h-4'],
      trash: ['M4 7h16', 'M9 7V5h6v2', 'M6 7l1 13h10l1-13', 'M10 11v6', 'M14 11v6'],
      chart: ['M4 20V10', 'M10 20V4', 'M16 20v-7', 'M22 20H2'],
      brief: ['M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6Z', 'm9 12 2 2 4-4'],
      alert: ['M12 3 2 21h20L12 3Z', 'M12 9v5', 'M12 17h.01'],
    }

    function Icon(props) {
      var size = typeof props.size === 'number' ? props.size : 16
      var paths = ICON_PATHS[props.name] || []
      return h('svg', {
        className: 'mem-icon',
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.8,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': 'true',
      }, paths.map(function (d, i) { return h('path', { d: d, key: i }) }))
    }

    function Kpi(props) {
      return h('div', { className: 'mem-kpi mem-tone-' + (props.tone || 'blue') },
        h('div', { className: 'mem-kpi-top' },
          h('span', { className: 'mem-kpi-label' }, props.label),
          h('span', { className: 'mem-kpi-icon' }, Icon({ name: props.icon || 'chart', size: 15 }))),
        h('div', { className: 'mem-kpi-value' }, props.value),
        props.hint ? h('div', { className: 'mem-kpi-hint' }, props.hint) : null)
    }

    function CardHead(props) {
      return h('div', { className: 'mem-card-head' },
        h('span', { className: 'mem-card-icon' }, Icon({ name: props.icon || 'chart', size: 16 })),
        h('h2', { className: 'mem-card-title' }, props.title),
        props.count !== undefined ? h('span', { className: 'mem-card-count' }, props.count) : null)
    }

    function Row(props) {
      return h('div', { className: 'mem-row' },
        h('div', { className: 'mem-row-main' },
          h('div', { className: 'mem-row-title' }, props.title),
          props.meta ? h('div', { className: 'mem-row-meta' }, props.meta) : null,
          props.snippet ? h('div', { className: 'mem-row-snippet' }, props.snippet) : null),
        props.onOpen ? h('div', { className: 'mem-row-actions' },
          h('button', { className: 'mem-link', type: 'button', onClick: props.onOpen }, '打开')) : null)
    }

    function MemoryIcon(props) {
      return Icon({ name: 'database', size: props.size })
    }

    function SearchResults(props) {
      var msgs = props.result.messages || []
      var mems = props.result.memories || []
      if (!msgs.length && !mems.length) {
        return h('div', { className: 'mem-empty' }, '没有检索到「' + props.result.query + '」相关的记忆。')
      }
      var children = []
      if (msgs.length) {
        children.push(h('div', { className: 'mem-subhead', key: 'mh' }, '对话命中 ' + msgs.length + ' 条'))
        msgs.forEach(function (m, i) {
          children.push(h(Row, {
            key: 'sr' + i,
            title: (m.role === 'user' ? '👤 ' : '🤖 ') + (m.title || '未命名'),
            meta: (m.project || '未分类') + ' · ' + fmtTime(m.ts_ms),
            snippet: m.text,
            onOpen: function () { props.onOpen(m.archive_rel) },
          }))
        })
      }
      if (mems.length) {
        children.push(h('div', { className: 'mem-subhead', key: 'mh2' }, '长期记忆 ' + mems.length + ' 条'))
        mems.forEach(function (m, i) {
          children.push(h(Row, {
            key: 'sm' + i,
            title: m.title,
            meta: m.path,
            snippet: m.body,
            onOpen: function () { props.onOpen(m.path) },
          }))
        })
      }
      return h('div', { className: 'mem-list mem-results' }, children)
    }

    function MemorySection() {
      var state = React.useState(null)
      var snap = state[0]
      var setSnap = state[1]
      var allState = React.useState([])
      var allMemories = allState[0]
      var setAllMemories = allState[1]
      var errState = React.useState('')
      var error = errState[0]
      var setError = errState[1]
      var busyState = React.useState(false)
      var busy = busyState[0]
      var setBusy = busyState[1]
      var qState = React.useState('')
      var query = qState[0]
      var setQuery = qState[1]
      var resState = React.useState(null)
      var result = resState[0]
      var setResult = resState[1]
      var searchingState = React.useState(false)
      var searching = searchingState[0]
      var setSearching = searchingState[1]
      var toastState = React.useState('')
      var toast = toastState[0]
      var setToast = toastState[1]
      var configState = React.useState(null)
      var config = configState[0]
      var setConfig = configState[1]
      var setupModeState = React.useState(false)
      var setupMode = setupModeState[0]
      var setSetupMode = setupModeState[1]
      var setupPathState = React.useState('')
      var setupPath = setupPathState[0]
      var setSetupPath = setupPathState[1]
      var setupBusyState = React.useState(false)
      var setupBusy = setupBusyState[0]
      var setupBusySet = setupBusyState[1]
      var setupErrorState = React.useState('')
      var setupError = setupErrorState[0]
      var setupErrorSet = setupErrorState[1]
      var pickingState = React.useState(false)
      var picking = pickingState[0]
      var setPicking = pickingState[1]
      var exportingState = React.useState(false)
      var exporting = exportingState[0]
      var setExporting = exportingState[1]
      var importingState = React.useState(false)
      var importing = importingState[0]
      var setImporting = importingState[1]
      var migrationState = React.useState(null)
      var migration = migrationState[0]
      var setMigration = migrationState[1]
      var importRef = React.useRef(null)
      var timer = React.useRef(null)
      var rootRef = React.useRef(null)

      React.useEffect(function () {
        var el = rootRef.current
        if (!el) return
        var reset = function () {
          var p = el.parentElement
          while (p) {
            var style = window.getComputedStyle(p)
            if (/(auto|scroll)/.test(style.overflowY) && p.scrollHeight > p.clientHeight) {
              p.scrollTop = 0
              break
            }
            p = p.parentElement
          }
        }
        reset()
        var observer = null
        if (typeof IntersectionObserver !== 'undefined') {
          observer = new IntersectionObserver(function (entries) {
            if (entries.some(function (entry) { return entry.isIntersecting })) reset()
          }, { threshold: 0.01 })
          observer.observe(el)
        }
        return function () { if (observer) observer.disconnect() }
      }, [])

      var load = React.useCallback(function () {
        setError('')
        return Promise.all([api('status'), api('memories')]).then(function (values) {
          setSnap(values[0])
          setAllMemories(values[1] || [])
        }).catch(function (e) {
          setError(e.message)
        })
      }, [])

      var boot = React.useCallback(function () {
        setError('')
        return api('config').then(function (value) {
          setConfig(value)
          if (value.configured) return load()
          setSetupPath(value.default_root || '')
          return null
        }).catch(function (e) {
          setError(e.message)
        })
      }, [load])

      React.useEffect(function () {
        boot()
        return function () { if (timer.current) clearTimeout(timer.current) }
      }, [boot])

      function flash(text) {
        setToast(text)
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(function () { setToast('') }, 3200)
      }

      function sync() {
        setBusy(true)
        setError('')
        api('sync').then(function (value) {
          setSnap(value.status)
          var s = value.sync || {}
          flash('同步完成：新增 ' + (s['新增'] || 0) + '，更新 ' + (s['更新'] || 0) + '，失败 ' + (s['失败'] || 0))
        }).catch(function (e) {
          setError(e.message)
        }).finally(function () {
          setBusy(false)
        })
      }

      function open(path) {
        api('open', { path: path || '' }).then(function () {
          flash('已在资源管理器中打开')
        }).catch(function (e) {
          setError(e.message)
        })
      }

      function search() {
        var q = query.trim()
        if (!q) return
        setSearching(true)
        setError('')
        api('search', { query: q, limit: 8 }).then(function (value) {
          setResult(value)
        }).catch(function (e) {
          setError(e.message)
        }).finally(function () {
          setSearching(false)
        })
      }

      function setImportance(memory, value) {
        var 值 = Number(value)
        if (!值 || 值 < 1 || 值 > 5) return
        api('importance', { path: memory.path, importance: 值 }).then(function () {
          flash('已把「' + memory.title + '」重要度设为 ' + 值)
          load()
        }).catch(function (e) {
          setError(e.message)
        })
      }

      function removeMemory(memory) {
        if (!window.confirm('删除记忆「' + memory.title + '」？\n会移到 02_长期记忆/_回收站，可从那里手动恢复。')) return
        api('delete', { path: memory.path }).then(function () {
          flash('已移到回收站：' + memory.title)
          load()
        }).catch(function (e) {
          setError(e.message)
        })
      }

      function pickFolder() {
        setPicking(true)
        setupErrorSet('')
        api('pick-folder').then(function (value) {
          if (value && value.path) setSetupPath(value.path)
        }).catch(function (e) {
          setupErrorSet(e.message)
        }).finally(function () {
          setPicking(false)
        })
      }

      function createRoot() {
        var path = setupPath.trim()
        if (!path) {
          setupErrorSet('请先填写或选择记忆盘目录')
          return
        }
        setupBusySet(true)
        setupErrorSet('')
        api('config/set', { root: path }).then(function (value) {
          setConfig(value.config)
          setSetupMode(false)
          flash('记忆盘已创建：' + value.config.root)
          return load()
        }).catch(function (e) {
          setupErrorSet(e.message)
        }).finally(function () {
          setupBusySet(false)
        })
      }

      function exportMemory() {
        setExporting(true)
        setError('')
        api('export').then(function (value) {
          setMigration(value)
          flash('已导出记忆包：' + value.zip)
          open(value.zip)
        }).catch(function (e) {
          setError(e.message)
        }).finally(function () {
          setExporting(false)
        })
      }

      function importFile(event) {
        var file = event.target.files && event.target.files[0]
        if (!file) return
        if (file.size > 200 * 1024 * 1024) {
          setError('迁移包超过 200 MB，请用命令行导入')
          return
        }
        setImporting(true)
        setError('')
        var form = new FormData()
        form.append('file', file)
        apiForm('import', form).then(function (value) {
          setMigration(value)
          flash('导入完成：复制 ' + value['结果']['复制'] + ' 个文件，冲突备份 ' + value['结果']['冲突备份'] + ' 个')
          load()
        }).catch(function (e) {
          setError(e.message)
        }).finally(function () {
          setImporting(false)
          if (event.target) event.target.value = ''
        })
      }

      var 全文 = Number(snap && snap.memories_chars) || 0
      var 摘要字数 = Number(snap && snap.brief_chars) || 0
      var 节省 = 全文 > 0 && 摘要字数 > 0 ? Math.max(0, Math.round((1 - 摘要字数 / 全文) * 100)) : 0
      var 注入占比 = 全文 > 0 ? Math.max(2, Math.min(100, Math.round(摘要字数 / 全文 * 100))) : 0

      var counts = [0, 0, 0, 0, 0, 0]
      allMemories.forEach(function (m) {
        var level = Math.min(5, Math.max(1, Number(m.importance) || 3))
        counts[level] += 1
      })
      var maxCount = 1
      counts.forEach(function (n) { if (n > maxCount) maxCount = n })
      var typeMap = {}
      allMemories.forEach(function (m) {
        var type = m.type || '其他'
        typeMap[type] = (typeMap[type] || 0) + 1
      })
      var typeRows = Object.keys(typeMap).map(function (type) {
        return { type: type, count: typeMap[type] }
      }).sort(function (a, b) { return b.count - a.count })

      var header = h('div', { className: 'mem-head' },
        h('div', { className: 'mem-brand' }, Icon({ name: 'database', size: 22 })),
        h('div', { className: 'mem-head-main' },
          h('h1', { className: 'mem-title' }, '长期记忆'),
          h('div', { className: 'mem-sub' },
            snap
              ? h('span', { className: 'mem-pill' }, h('i', { className: 'mem-dot' }), '已同步 ' + (snap.last_sync || '未知'))
              : h('span', null, '加载中…'),
            snap ? h('span', null, snap.root) : null)),
        h('div', { className: 'mem-actions' },
          h('button', { className: 'mem-btn mem-btn-primary', type: 'button', onClick: sync, disabled: busy },
            Icon({ name: 'sync', size: 14 }), h('span', null, busy ? '同步中…' : '立即同步')),
          h('button', { className: 'mem-btn', type: 'button', onClick: function () { open('') } },
            Icon({ name: 'folder', size: 14 }), h('span', null, '打开记忆盘')),
          h('button', { className: 'mem-btn mem-btn-ghost', type: 'button', onClick: load },
            Icon({ name: 'refresh', size: 14 }), h('span', null, '刷新'))))

      var setupHeader = h('div', { className: 'mem-head' },
        h('div', { className: 'mem-brand' }, Icon({ name: 'database', size: 22 })),
        h('div', { className: 'mem-head-main' },
          h('h1', { className: 'mem-title' }, '长期记忆'),
          h('div', { className: 'mem-sub' }, h('span', { className: 'mem-pill' }, '首次使用'), h('span', null, '选择记忆盘目录'))))

      if (config && (!config.configured || setupMode)) {
        var setupCard = h('div', { className: 'mem-card mem-setup' },
          h('div', { className: 'mem-card-head' },
            h('span', { className: 'mem-card-icon' }, Icon({ name: 'folder', size: 16 })),
            h('h2', { className: 'mem-card-title' }, setupMode ? '更改记忆盘目录' : '选择记忆盘目录')),
          h('p', { className: 'mem-muted' }, setupMode
            ? '更换目录不会自动搬移旧数据；请先用「记忆移植」导出，再在新目录导入。'
            : '第一次使用需要指定一个目录；插件会创建 00_说明 / 01_对话归档 / 02_长期记忆 / 03_索引 / 04_整理记录。'),
          h('div', { className: 'mem-searchbox mem-setup-path' },
            Icon({ name: 'folder', size: 16 }),
            h('input', {
              className: 'mem-input',
              value: setupPath,
              placeholder: '例如：C:\\Users\\你\\.dsh\\memory-disk',
              onChange: function (e) { setSetupPath(e.target.value) },
              onKeyDown: function (e) { if (e.key === 'Enter') createRoot() },
            }),
            h('button', { className: 'mem-btn mem-btn-sm', type: 'button', onClick: pickFolder, disabled: picking }, picking ? '选择中…' : '选择文件夹')),
          config.python_check && !config.python_check.ok
            ? h('div', { className: 'mem-warn' },
              Icon({ name: 'alert', size: 16 }),
              h('div', { className: 'mem-warn-list' },
                h('span', null, 'Python 3.10+ 或 zstandard 不可用：' + config.python_check.error),
                h('span', null, '请先安装 Python，并运行：python -m pip install zstandard')))
            : null,
          setupError ? h('div', { className: 'mem-error' }, setupError) : null,
          h('div', { className: 'mem-setup-actions' },
            h('button', { className: 'mem-btn mem-btn-primary', type: 'button', onClick: createRoot, disabled: setupBusy || !setupPath.trim() },
              setupBusy ? '创建中…' : '创建并使用'),
            setupMode ? h('button', { className: 'mem-btn', type: 'button', onClick: function () { setSetupMode(false) } }, '取消') : null))
        return h('div', { className: 'mem-page', ref: rootRef }, setupHeader, setupCard)
      }

      if (!snap) {
        return h('div', { className: 'mem-page', ref: rootRef }, header,
          error ? h('div', { className: 'mem-error' }, error) : h('div', { className: 'mem-empty' }, '正在读取记忆盘…'))
      }

      var kpis = h('div', { className: 'mem-kpis' },
        h(Kpi, { label: '已归档会话', value: num(snap.sessions), tone: 'blue', icon: 'chat' }),
        h(Kpi, { label: '已索引消息', value: num(snap.messages), tone: 'violet', icon: 'chart' }),
        h(Kpi, { label: '长期记忆', value: num(snap.memories), tone: 'green', icon: 'database' }),
        h(Kpi, { label: '注入摘要', value: num(摘要字数) + ' 字', tone: 'amber', icon: 'brief', hint: num(snap.brief_memories || 0) + ' 条 / 全文 ' + num(全文) + ' 字' }),
        h(Kpi, { label: '占用', value: snap.size_mb + ' MB', tone: 'slate', icon: 'folder' }))

      var briefCard = h('div', { className: 'mem-card mem-brief-card' },
        h('div', { className: 'mem-card-head' },
          h('span', { className: 'mem-card-icon' }, Icon({ name: 'brief', size: 16 })),
          h('h2', { className: 'mem-card-title' }, '缓存友好摘要'),
          h('span', { className: 'mem-pill mem-pill-soft' }, '稳定前缀')),
        h('div', { className: 'mem-brief-stats' },
          h('div', { className: 'mem-brief-stat' }, h('b', null, num(snap.brief_memories || 0)), h('span', null, '条高重要度记忆')),
          h('div', { className: 'mem-brief-stat' }, h('b', null, num(摘要字数)), h('span', null, '注入字符')),
          h('div', { className: 'mem-brief-stat' }, h('b', null, 节省 + '%'), h('span', null, '相比全文少注入'))),
        h('div', { className: 'mem-progress' }, h('i', { style: { width: 注入占比 + '%' } })),
        h('div', { className: 'mem-muted' },
          '全文 ' + num(全文) + ' 字 → 系统提示只注入 ' + num(摘要字数) + ' 字；摘要不含时间戳，跨会话稳定，细节由 memory_search 按需检索。'))

      var searchCard = h('div', { className: 'mem-card' },
        CardHead({ icon: 'search', title: '检索记忆' }),
        h('div', { className: 'mem-searchbox' },
          Icon({ name: 'search', size: 16 }),
          h('input', {
            className: 'mem-input',
            value: query,
            placeholder: '输入关键词，例如：增程器、打包、参数',
            onChange: function (e) { setQuery(e.target.value) },
            onKeyDown: function (e) { if (e.key === 'Enter') search() },
          }),
          h('button', { className: 'mem-btn mem-btn-primary mem-btn-sm', type: 'button', onClick: search, disabled: searching },
            searching ? '检索中…' : '搜索')),
        result ? h(SearchResults, { result: result, onOpen: open }) : null)

      var distCard = h('div', { className: 'mem-card' },
        CardHead({ icon: 'chart', title: '记忆构成', count: allMemories.length ? allMemories.length + ' 条' : undefined }),
        allMemories.length
          ? h('div', { className: 'mem-dist' }, [5, 4, 3, 2, 1].map(function (level) {
            return h('div', { className: 'mem-dist-row', key: level },
              h('span', { className: 'mem-dist-label' }, '★ ' + level),
              h('span', { className: 'mem-dist-bar' }, h('i', { style: { width: Math.max(3, Math.round(counts[level] / maxCount * 100)) + '%' } })),
              h('span', { className: 'mem-dist-n' }, num(counts[level])))
          }))
          : h('div', { className: 'mem-empty' }, '暂无长期记忆'),
        typeRows.length
          ? h('div', { className: 'mem-types' }, typeRows.map(function (row) {
            return h('span', { className: 'mem-chip', key: row.type }, row.type, h('b', null, num(row.count)))
          }))
          : null)

      var sessions = h('div', { className: 'mem-card' },
        CardHead({ icon: 'chat', title: '最近会话', count: snap.recent_sessions.length + ' 个' }),
        h('div', { className: 'mem-list' }, snap.recent_sessions.map(function (s, i) {
          return h(Row, {
            key: 's' + i,
            title: s.title,
            meta: s.project + ' · ' + s.started + ' · 用户 ' + num(s.user_count) + ' 条',
            onOpen: function () { open(s.archive_rel) },
          })
        })))

      var memories = h('div', { className: 'mem-card' },
        CardHead({ icon: 'database', title: '最近长期记忆', count: snap.recent_memories.length + ' 条' }),
        h('div', { className: 'mem-list' }, snap.recent_memories.map(function (m, i) {
          return h(Row, { key: 'm' + i, title: m.title, meta: m.updated_at + ' · ' + m.path, onOpen: function () { open(m.path) } })
        })))

      var visibleMemories = allMemories.slice(0, 200)
      var manage = h('div', { className: 'mem-card' },
        CardHead({ icon: 'database', title: '记忆管理', count: allMemories.length + ' 条' }),
        h('div', { className: 'mem-hint' }, '点击 ★ 设置重要度（5 最高），越高越优先进入系统提示摘要；删除会移到 _回收站，可手动恢复。'),
        allMemories.length
          ? h('div', null, visibleMemories.map(function (m, i) {
            return h('div', { className: 'mem-manage-row', key: 'a' + i },
              h('div', { className: 'mem-manage-main' },
                h('div', { className: 'mem-manage-title' },
                  h('span', null, m.title),
                  m.type && m.type !== m.title ? h('span', { className: 'mem-badge' }, m.type) : null),
                h('div', { className: 'mem-path' }, m.path),
                h('div', { className: 'mem-row-snippet' }, m.gist)),
              h('div', { className: 'mem-stars', role: 'group', 'aria-label': '重要度' }, [1, 2, 3, 4, 5].map(function (level) {
                return h('button', {
                  className: 'mem-star' + (level <= m.importance ? ' on' : ''),
                  type: 'button',
                  key: level,
                  title: '重要度 ' + level,
                  onClick: function () { setImportance(m, level) },
                }, '★')
              })),
              h('button', {
                className: 'mem-icon-btn danger',
                type: 'button',
                title: '删除记忆',
                onClick: function () { removeMemory(m) },
              }, Icon({ name: 'trash', size: 14 })))
          }).concat(allMemories.length > 200
            ? [h('div', { className: 'mem-muted', key: 'more' }, '仅显示前 200 条，共 ' + allMemories.length + ' 条；建议合并或删除低价值记忆。')]
            : []))
          : h('div', { className: 'mem-empty' }, '暂无长期记忆。'))

      var migrationCard = h('div', { className: 'mem-card' },
        CardHead({ icon: 'folder', title: '记忆移植' }),
        h('div', { className: 'mem-hint' },
          '导出包含 00_说明 / 01_对话归档 / 02_长期记忆 / 03_索引 的 zip；换电脑后安装插件、导入即可合并，冲突的旧文件备份到 _回收站。'),
        h('div', { className: 'mem-muted' }, '当前目录：' + (config ? config.root : '')),
        h('div', { className: 'mem-setup-actions' },
          h('button', { className: 'mem-btn mem-btn-primary', type: 'button', onClick: exportMemory, disabled: exporting },
            Icon({ name: 'folder', size: 14 }), h('span', null, exporting ? '导出中…' : '导出记忆包')),
          h('button', { className: 'mem-btn', type: 'button', onClick: function () { if (importRef.current) importRef.current.click() }, disabled: importing },
            Icon({ name: 'refresh', size: 14 }), h('span', null, importing ? '导入中…' : '导入记忆包')),
          h('input', { className: 'mem-file-input', type: 'file', accept: '.zip', ref: importRef, onChange: importFile }),
          h('button', { className: 'mem-btn mem-btn-ghost', type: 'button', onClick: function () { setSetupMode(true); setSetupPath(config ? config.root : ''); setupErrorSet('') } }, '更改目录')),
        migration
          ? h('div', { className: 'mem-muted' }, migration.zip
            ? '已导出：' + migration.zip + '（' + num(migration.files) + ' 个文件，' + num(migration.size_mb) + ' MB）'
            : '导入：复制 ' + num(migration['结果']['复制']) + '，跳过 ' + num(migration['结果']['跳过']) + '，冲突备份 ' + num(migration['结果']['冲突备份']))
          : null)

      var maxProject = 1
      snap.projects.forEach(function (p) { if (p.count > maxProject) maxProject = p.count })
      var projects = h('div', { className: 'mem-card' },
        CardHead({ icon: 'chart', title: '项目分布' }),
        h('div', { className: 'mem-projects' }, snap.projects.map(function (p, i) {
          return h('div', { className: 'mem-proj', key: 'p' + i },
            h('span', { className: 'mem-proj-name', title: p.name }, p.name),
            h('span', { className: 'mem-bar' }, h('i', { style: { width: Math.max(4, Math.round(p.count / maxProject * 100)) + '%' } })),
            h('span', { className: 'mem-proj-n' }, num(p.count)))
        })))

      return h('div', { className: 'mem-page', ref: rootRef },
        header,
        error ? h('div', { className: 'mem-error' }, error) : null,
        (snap.warnings || []).length
          ? h('div', { className: 'mem-warn' },
            Icon({ name: 'alert', size: 16 }),
            h('div', { className: 'mem-warn-list' }, snap.warnings.map(function (text, i) {
              return h('span', { key: i }, text)
            })))
          : null,
        kpis,
        briefCard,
        h('div', { className: 'mem-columns' }, searchCard, distCard),
        h('div', { className: 'mem-columns' }, sessions, memories),
        manage,
        migrationCard,
        projects,
        h('div', { className: 'mem-note' },
          '数据来源：' + snap.root + '；自动同步每 10 分钟一次。',
          ' 摘要注入 ' + num(摘要字数) + ' 字 / 全文 ' + num(全文) + ' 字' + (节省 > 0 ? '（少注入约 ' + 节省 + '%）' : '') + '。'),
        toast ? h('div', { className: 'mem-toast' }, toast) : null)
    }

    var NS = 'dsh-memory-disk'

    exports.name = NS
    exports.inject = ['slots']
    exports.apply = function (ctx) {
      ensureStyle()

      // Conversation tab: appears beside 对话 / 轨迹 / 上下文 / 编队.
      ctx.slots.inject('conversation.view', function () {
        return ctx.slots.register({
          name: 'conversation.view',
          id: NS,
          order: 40,
          locale: NS,
          label: function () { return '记忆' },
        }, MemorySection)
      })

      // Left sidebar row + its full page (the same pairing dsh-context uses).
      ctx.slots.inject('main', function () {
        return ctx.slots.register({ name: 'main', key: NS, locale: NS }, MemorySection)
      })
      ctx.slots.inject('sidebar.panellist', function () {
        return ctx.slots.register({
          name: 'sidebar.panellist',
          id: NS,
          order: 25,
          locale: NS,
          label: function () { return '长期记忆' },
        }, function (props) {
          return h(MemoryIcon, { size: typeof props.size === 'number' ? props.size : undefined })
        })
      })

      // Settings page remains as a secondary entry.
      ctx.slots.inject('settings.section', function () {
        return ctx.slots.register({
          name: 'settings.section',
          id: NS,
          order: 40,
          locale: NS,
          label: function () { return '长期记忆' },
        }, MemorySection)
      })
    }
    return module.exports
  },
})
