import { useMemo, useState, useEffect } from 'react'
import {
  ArrowDownLeft, ArrowDownRight, ArrowLeftRight, ArrowRight, ArrowUpRight,
  BarChart3, Bell, BookOpen, BriefcaseBusiness, CalendarDays, CarFront,
  Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Download,
  Ellipsis, FileText, HeartPulse, House, LayoutDashboard, Menu, Pencil,
  Plus, Search, Settings2, ShoppingBag, SlidersHorizontal, Sparkles,
  Target, Trash2, TrendingUp, UtensilsCrossed, Wallet, X,
} from 'lucide-react'
import {
  CATEGORIES, CURRENCIES, DEFAULT_BUDGETS, DEMO_TRANSACTIONS,
  categoryOf, currentMonth, downloadCsv, money, monthKey, monthLabel,
  originalMoney, summarize, toCny, localDate, localMonth,
} from './finance'
import { api } from './api.js'
import RecoveryCodes from './RecoveryCodes.jsx'

const ICONS = {
  utensils: UtensilsCrossed, bag: ShoppingBag, car: CarFront,
  home: House, sparkles: Sparkles, book: BookOpen, heart: HeartPulse,
  more: Ellipsis, briefcase: BriefcaseBusiness,
}

const NAV = [
  { id: 'overview', label: '总览', icon: LayoutDashboard },
  { id: 'transactions', label: '交易记录', icon: ArrowLeftRight },
  { id: 'analytics', label: '收支分析', icon: BarChart3 },
  { id: 'budgets', label: '预算管理', icon: Target },
]

function readStored(key, fallback) {
  try { const value = JSON.parse(localStorage.getItem(key)); return value ?? fallback } catch { return fallback }
}

function CategoryIcon({ name, size = 18 }) {
  const category = categoryOf(name)
  const Icon = ICONS[category.icon] || Ellipsis
  return <span className="category-icon" style={{ '--category-color': category.color }}><Icon size={size} strokeWidth={1.9} /></span>
}

function Avatar({ name = '演示' }) { return <span className="avatar">{String(name || '演示').slice(0, 1).toUpperCase()}</span> }

function TransactionModal({ item, onClose, onSave, remote }) {
  const [form, setForm] = useState(item ? { ...item, manualRate: item.rateSource === 'MANUAL' ? item.fxRate : '' } : {
    type: 'expense', amount: '', currency: 'CNY', category: '餐饮美食',
    note: '', date: localDate(new Date()), manualRate: '',
  })
  const [error, setError] = useState('')
  const categories = CATEGORIES.filter((c) => c.type === form.type)
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  function submit(event) {
    event.preventDefault()
    if (!Number.isFinite(Number(form.amount)) || Number(form.amount) <= 0) return setError('请输入大于 0 的金额')
    if (!form.date) return setError('请选择日期')
    onSave({ ...form, amount: Math.round(Number(form.amount) * 100) / 100, note: form.note.trim() || form.category, id: item?.id })
  }
  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-head"><div><span className="eyebrow">TRANSACTION</span><h2 id="modal-title">{item ? '编辑交易' : '记录新交易'}</h2></div><button className="icon-button" onClick={onClose} aria-label="关闭"><X size={20} /></button></div>
      <form onSubmit={submit}>
        <div className="type-toggle"><button type="button" className={form.type === 'expense' ? 'selected' : ''} onClick={() => setForm((f) => ({ ...f, type: 'expense', category: '餐饮美食' }))}>支出</button><button type="button" className={form.type === 'income' ? 'selected income-selected' : ''} onClick={() => setForm((f) => ({ ...f, type: 'income', category: '工资收入' }))}>收入</button></div>
        <label className="field-label">金额</label><div className="amount-entry"><select aria-label="币种" value={form.currency} onChange={(e) => update('currency', e.target.value)}>{Object.entries(CURRENCIES).map(([code, c]) => <option key={code} value={code}>{c.symbol} {code}</option>)}</select><input autoFocus type="number" min="0.01" step="0.01" placeholder="0.00" value={form.amount} onChange={(e) => update('amount', e.target.value)} /></div>
        {form.currency !== 'CNY' && (remote ? <><p className="field-hint">保存时获取交易日期对应的历史汇率，并将汇率快照保存在这笔记录中。</p><label className="field-label" htmlFor="manual-rate">手动汇率（选填）</label><input id="manual-rate" className="form-control" type="number" min="0.0000000001" step="any" placeholder="汇率服务不可用时填写：1 原币 = ? 人民币" value={form.manualRate} onChange={(e) => update('manualRate', e.target.value)} />{item?.rateDate && <p className="field-hint">原记录汇率：{item.fxRate} · {item.rateDate} · {item.rateSource}</p>}</> : <p className="field-hint">约合 {money(Number(form.amount || 0) * CURRENCIES[form.currency].rate)} · 使用演示汇率</p>)}
        <div className="form-grid"><div><label className="field-label" htmlFor="category">分类</label><select id="category" className="form-control" value={form.category} onChange={(e) => update('category', e.target.value)}>{categories.map((c) => <option key={c.name}>{c.name}</option>)}</select></div><div><label className="field-label" htmlFor="date">日期</label><input id="date" className="form-control" type="date" max={localDate(new Date())} value={form.date} onChange={(e) => update('date', e.target.value)} /></div></div>
        <label className="field-label" htmlFor="note">备注</label><input id="note" className="form-control" maxLength="80" placeholder="这笔钱花在了哪里？" value={form.note} onChange={(e) => update('note', e.target.value)} />
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>取消</button><button type="submit" className="button primary"><Check size={17} /> 保存交易</button></div>
      </form>
    </div>
  </div>
}

function ConfirmModal({ title, description, actionLabel, onClose, onConfirm }) {
  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}><div className="modal small-modal" role="dialog" aria-modal="true"><div className="modal-head"><div><span className="eyebrow">PLEASE CONFIRM</span><h2>{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="关闭"><X size={20} /></button></div><p className="confirm-description">{description}</p><div className="modal-actions"><button className="button secondary" onClick={onClose}>取消</button><button className="button danger" onClick={onConfirm}>{actionLabel}</button></div></div></div>
}

function TrendChart({ transactions, selectedMonth }) {
  const [year, month] = selectedMonth.split('-').map(Number)
  const points = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(year, month - 6 + i, 1)
    const key = localMonth(d)
    const s = summarize(transactions.filter((t) => monthKey(t.date) === key))
    return { label: `${d.getMonth() + 1}月`, ...s }
  })
  const max = Math.max(...points.flatMap((p) => [p.income, p.expense]), 1)
  return <div className="trend-chart">
    <div className="chart-grid"><span>{money(max, 0)}</span><span>{money(max / 2, 0)}</span><span>¥0</span></div>
    <div className="chart-columns">{points.map((p, i) => <div className="chart-column" key={i}><div className="bar-pair"><div className="bar income-bar" style={{ height: `${Math.max((p.income / max) * 100, p.income ? 3 : 0)}%` }} title={`收入 ${money(p.income)}`} /><div className="bar expense-bar" style={{ height: `${Math.max((p.expense / max) * 100, p.expense ? 3 : 0)}%` }} title={`支出 ${money(p.expense)}`} /></div><span>{p.label}</span></div>)}</div>
  </div>
}

function DonutChart({ data, total }) {
  let cumulative = 0
  const gradient = data.length ? data.map((d) => {
    const from = cumulative
    cumulative += d.value / total * 100
    return `${d.color} ${from}% ${cumulative}%`
  }).join(', ') : '#edf1ed 0% 100%'
  return <div className="donut" style={{ background: `conic-gradient(${gradient})` }}><div><small>总支出</small><strong>{money(total, 0)}</strong></div></div>
}

function TransactionList({ transactions, onEdit, onDelete, compact = false }) {
  if (!transactions.length) return <div className="empty-state"><Wallet size={34} /><strong>这里还没有交易</strong><span>添加一笔记录，开始了解自己的消费。</span></div>
  return <div className="transaction-list">{transactions.map((t) => <div className="transaction-row" key={t.id}>
    <CategoryIcon name={t.category} />
    <div className="transaction-name"><strong>{t.note || t.category}</strong><span>{t.category} · {new Date(`${t.date}T12:00:00`).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}</span></div>
    {!compact && <span className="transaction-date">{t.date}</span>}
    <div className={`transaction-amount ${t.type === 'income' ? 'positive' : ''}`}><strong>{t.type === 'income' ? '+' : '−'}{originalMoney(t)}</strong>{t.currency !== 'CNY' && <span title={t.rateDate ? `汇率 ${t.fxRate} · ${t.rateDate} · ${t.rateSource}` : '演示汇率'}>≈ {money(toCny(t))}</span>}</div>
    {!compact && <div className="row-actions"><button aria-label={`编辑 ${t.note}`} onClick={() => onEdit(t)}><Pencil size={16} /></button><button aria-label={`删除 ${t.note}`} onClick={() => onDelete(t)}><Trash2 size={16} /></button></div>}
  </div>)}</div>
}

function RecoveryCodesPanel() {
  const [remaining, setRemaining] = useState(null)
  const [password, setPassword] = useState('')
  const [codes, setCodes] = useState(null)
  const [saved, setSaved] = useState(false)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    api.recoveryCodeStatus().then((result) => { if (active) setRemaining(result.remaining) }).catch((problem) => { if (active) setError(problem.message) })
    return () => { active = false }
  }, [])

  async function regenerate(event) {
    event.preventDefault()
    setWorking(true)
    setError('')
    try {
      const result = await api.regenerateRecoveryCodes(password)
      setCodes(result.codes)
      setRemaining(result.remaining)
      setPassword('')
      setSaved(false)
    } catch (problem) {
      setError(problem.message)
    } finally {
      setWorking(false)
    }
  }

  return <section className="panel settings-panel wide recovery-panel">
    <h2>密码恢复码</h2>
    <p>忘记密码时，可用注册邮箱和一个恢复码重设密码。{remaining === null ? '正在查询恢复码状态…' : `当前剩余 ${remaining} 个可用恢复码。`}</p>
    {codes ? <>
      <RecoveryCodes codes={codes} />
      <label className="recovery-confirm"><input type="checkbox" checked={saved} onChange={(event) => setSaved(event.target.checked)} /> 我已将这组新恢复码保存到安全位置</label>
      <button className="button primary" disabled={!saved} onClick={() => setCodes(null)}>完成</button>
    </> : <form onSubmit={regenerate}>
      <p>生成新恢复码会立即使旧恢复码失效。请先输入当前密码确认。</p>
      <label className="field-label" htmlFor="recovery-password">当前密码</label>
      <input id="recovery-password" className="form-control" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
      <button className="button secondary" type="submit" disabled={working}>{working ? '生成中…' : '生成新恢复码'}</button>
    </form>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </section>
}

function SettingsContent({ remote, account, onExport, onReset, onSignOut, onDeleteAccount }) {
  return <div className="settings-grid">
    <section className="panel settings-panel"><div className="settings-icon"><Download size={23} /></div><h2>导出交易数据</h2><p>将全部交易下载为 CSV 文件，包含每笔外币交易的折算汇率、汇率日期和来源。</p><button className="button primary" onClick={onExport}><Download size={17} /> 导出全部记录</button></section>
    {remote ? <section className="panel settings-panel"><div className="settings-icon mint"><Wallet size={23} /></div><h2>账户与数据</h2><p>已登录为 {account?.email}。交易和预算保存在 PostgreSQL 中，仅当前账户可读取。</p><button className="button secondary" onClick={onSignOut}>退出登录</button></section> : <section className="panel settings-panel"><div className="settings-icon mint"><Wallet size={23} /></div><h2>演示数据</h2><p>当前展示的数据仅保存在这个浏览器中。你可以随时恢复初始演示账本。</p><button className="button secondary" onClick={onReset}>恢复演示数据</button></section>}
    {remote && <RecoveryCodesPanel />}
    <section className="panel settings-panel wide"><div className="settings-icon peach"><CircleHelp size={23} /></div><h2>关于这个作品</h2><p>{remote ? '登录版使用 PostgreSQL 保存账户、交易、预算和每笔外币交易的汇率快照。汇率服务不可用时，你可以手动录入汇率；数据可随时导出。' : '这是基于 Tango Finance 课程项目重新设计的独立前端演示。交易和预算保存在本地浏览器，多币种折算使用固定演示汇率。'}</p><div className="about-chips"><span>React</span><span>Vite</span><span>{remote ? 'PostgreSQL' : 'LocalStorage'}</span><span>响应式设计</span></div></section>
    {remote && <section className="panel settings-panel wide danger-panel"><h2>删除账户</h2><p>删除后，账户、交易、预算和登录会话会从数据库中移除。请先导出数据备份。</p><button className="button danger" onClick={onDeleteAccount}>删除账户和数据</button></section>}
  </div>
}

function DeleteAccountModal({ onClose, onDelete }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [working, setWorking] = useState(false)
  return <div className="modal-backdrop"><div className="modal small-modal" role="dialog" aria-modal="true"><div className="modal-head"><div><span className="eyebrow">DELETE ACCOUNT</span><h2>永久删除账户？</h2></div><button className="icon-button" onClick={onClose} aria-label="关闭"><X size={20} /></button></div><p className="confirm-description">此操作会删除你的全部交易和预算。请先导出备份，再输入密码确认。</p><form onSubmit={async (event) => { event.preventDefault(); setWorking(true); try { await onDelete(password) } catch (problem) { setError(problem.message); setWorking(false) } }}><label className="field-label" htmlFor="delete-password">账户密码</label><input id="delete-password" className="form-control" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />{error && <p className="form-error">{error}</p>}<div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>取消</button><button type="submit" className="button danger" disabled={working}>{working ? '删除中…' : '确认永久删除'}</button></div></form></div></div>
}

export default function App({ remote = false, account = null, onSignOut }) {
  const [transactions, setTransactions] = useState(() => remote ? [] : readStored('tango.transactions.v1', DEMO_TRANSACTIONS))
  const [budgets, setBudgets] = useState(() => remote ? {} : readStored('tango.budgets.v1', DEFAULT_BUDGETS))
  const [remoteLoading, setRemoteLoading] = useState(remote)
  const [remoteError, setRemoteError] = useState('')
  const [page, setPage] = useState('overview')
  const [month, setMonth] = useState(currentMonth())
  const [modal, setModal] = useState(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [mobileNav, setMobileNav] = useState(false)
  const [toast, setToast] = useState('')
  const [budgetEdit, setBudgetEdit] = useState(null)
  const [confirmation, setConfirmation] = useState(null)
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false)
  useEffect(() => { if (!remote) localStorage.setItem('tango.transactions.v1', JSON.stringify(transactions)) }, [transactions, remote])
  useEffect(() => { if (!remote) localStorage.setItem('tango.budgets.v1', JSON.stringify(budgets)) }, [budgets, remote])
  useEffect(() => {
    if (!remote) return
    let cancelled = false
    Promise.all([api.transactions(), api.budgets()]).then(([items, data]) => { if (!cancelled) { setTransactions(items); setBudgets(data.budgets); setRemoteLoading(false) } }).catch((error) => { if (!cancelled) { setRemoteError(error.message); setRemoteLoading(false) } })
    return () => { cancelled = true }
  }, [remote])
  useEffect(() => { if (toast) { const timer = setTimeout(() => setToast(''), 3200); return () => clearTimeout(timer) } }, [toast])

  const monthTransactions = useMemo(() => transactions.filter((t) => monthKey(t.date) === month), [transactions, month])
  const summary = useMemo(() => summarize(monthTransactions), [monthTransactions])
  const lastMonth = useMemo(() => { const [y, m] = month.split('-').map(Number); return localMonth(new Date(y, m - 2, 1)) }, [month])
  const lastSummary = useMemo(() => summarize(transactions.filter((t) => monthKey(t.date) === lastMonth)), [transactions, lastMonth])
  const sorted = useMemo(() => [...monthTransactions].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)), [monthTransactions])
  const filtered = useMemo(() => sorted.filter((t) => {
    const query = search.trim().toLowerCase()
    return (filter === 'all' || t.type === filter) && (categoryFilter === 'all' || t.category === categoryFilter) && (!query || `${t.note} ${t.category} ${t.currency}`.toLowerCase().includes(query))
  }), [sorted, filter, categoryFilter, search])
  const categorySpending = useMemo(() => CATEGORIES.filter((c) => c.type === 'expense').map((c) => ({ ...c, value: monthTransactions.filter((t) => t.type === 'expense' && t.category === c.name).reduce((s, t) => s + toCny(t), 0) })).filter((c) => c.value > 0).sort((a, b) => b.value - a.value), [monthTransactions])
  const totalBudget = Object.values(budgets).reduce((a, b) => a + Number(b || 0), 0)
  const budgetPct = totalBudget ? Math.round(summary.expense / totalBudget * 100) : 0
  const changeMonth = (delta) => { const [y, m] = month.split('-').map(Number); setMonth(localMonth(new Date(y, m - 1 + delta, 1))) }
  const saveTransaction = async (t) => {
    try {
      const saved = remote ? (t.id ? await api.updateTransaction(t) : await api.createTransaction(t)).item : { ...t, id: t.id || crypto.randomUUID() }
      setTransactions((current) => [saved, ...current.filter((item) => item.id !== saved.id)])
      setModal(null); setToast('交易已保存')
    } catch (error) { setToast(error.message) }
  }
  const deleteTransaction = (t) => setConfirmation({ title: '删除这笔交易？', description: `“${t.note}”将从账本中移除。`, actionLabel: '确认删除', onConfirm: async () => { try { if (remote) await api.deleteTransaction(t.id); setTransactions((current) => current.filter((item) => item.id !== t.id)); setToast('交易已删除'); setConfirmation(null) } catch (error) { setToast(error.message) } } })
  const saveBudget = async (amount) => { try { if (remote) await api.saveBudget(budgetEdit, amount); setBudgets((b) => ({ ...b, [budgetEdit]: amount })); setBudgetEdit(null); setToast('预算已更新') } catch (error) { setToast(error.message) } }
  const resetDemo = () => setConfirmation({ title: '恢复演示数据？', description: '当前浏览器中的交易和预算将被初始演示数据覆盖。建议先导出 CSV 备份。', actionLabel: '确认恢复', onConfirm: () => { setTransactions(DEMO_TRANSACTIONS); setBudgets(DEFAULT_BUDGETS); setToast('已恢复演示数据'); setConfirmation(null) } })
  const navigate = (next) => { setPage(next); setMobileNav(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const monthCompare = lastSummary.expense ? Math.round((summary.expense - lastSummary.expense) / lastSummary.expense * 100) : null
  const savingsRate = summary.income ? Math.round((summary.income - summary.expense) / summary.income * 100) : 0

  if (remoteLoading) return <div className="boot-screen"><div className="boot-mark">T</div> 正在载入你的账本…</div>
  if (remoteError) return <div className="boot-screen error-screen"><strong>账本暂时无法载入</strong><span>{remoteError}</span><button className="button primary" onClick={() => window.location.reload()}>重试</button></div>

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'mobile-open' : ''}`}>
      <div className="brand"><span className="brand-mark"><span /></span><span>Tango<span className="brand-light">Finance</span></span></div>
      <div className="sidebar-label">工作空间</div>
      <nav className="side-nav">{NAV.map(({ id, label, icon: Icon }) => <button key={id} className={page === id ? 'active' : ''} onClick={() => navigate(id)}><Icon size={19} strokeWidth={1.9} /><span>{label}</span>{page === id && <span className="active-dot" />}</button>)}</nav>
      <div className="sidebar-label sidebar-label-lower">更多</div>
      <nav className="side-nav"><button className={page === 'settings' ? 'active' : ''} onClick={() => navigate('settings')}><Settings2 size={19} /><span>设置与数据</span></button></nav>
      <div className="sidebar-bottom"><div className="side-insight"><div className="insight-symbol"><Sparkles size={20} /></div><strong>财务小提示</strong><p>每天花 1 分钟记账，月底就能更从容地做决定。</p><button onClick={() => setModal({})}>记一笔 <ArrowRight size={15} /></button></div><div className="side-profile"><Avatar name={account?.name || (remote ? '账户' : '演示')} /><div><strong>{remote ? (account?.name ? `${account.name} 的账本` : '我的账本') : '演示账本'}</strong><span>{remote ? '个人空间 · 云端账户' : '示例数据 · 仅存当前浏览器'}</span></div><ChevronDown size={16} /></div></div>
    </aside>

    <div className="main-layout">
      <header className="topbar"><button className="mobile-menu icon-button" onClick={() => setMobileNav(!mobileNav)} aria-label="打开菜单"><Menu size={22} /></button><div className="breadcrumb">个人空间 <ChevronRight size={15} /> <strong>{NAV.find((n) => n.id === page)?.label || '设置与数据'}</strong></div><div className="topbar-actions"><span className="today-text">{new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}</span><span className="topbar-separator" /><button className="icon-button notification" title={remote ? '你的数据保存在账户中' : '所有数据仅保存在当前浏览器'} onClick={() => setToast(remote ? '账户数据已保存在服务器中' : '演示版数据保存在当前浏览器中')}><Bell size={20} /><span /></button><Avatar name={account?.name || (remote ? '账户' : '演示')} /></div></header>
      <main className="content">
        <div className="page-heading"><div><div className="eyebrow">YOUR FINANCIAL SPACE</div><h1>{page === 'overview' ? '财务总览' : NAV.find((n) => n.id === page)?.label || '设置与数据'}<span className="heading-sparkle">✳</span></h1><p>{page === 'overview' ? '把每一笔收支，变成更清晰的生活。' : page === 'transactions' ? '所有收支都在这里，一目了然。' : page === 'analytics' ? '从数字中看见你的消费习惯。' : page === 'budgets' ? '给想要的生活留出更多空间。' : '管理你的演示数据与导出记录。'}</p></div><div className="heading-actions"><div className="month-switch"><button onClick={() => changeMonth(-1)} aria-label="上个月"><ChevronLeft size={17} /></button><span><CalendarDays size={16} /> {monthLabel(month)}</span><button onClick={() => changeMonth(1)} aria-label="下个月"><ChevronRight size={17} /></button></div><button className="button primary add-button" onClick={() => setModal({})}><Plus size={19} /> 记一笔</button></div></div>

        {page === 'overview' && <>
          <section className="hero-card"><div className="hero-content"><div className="hero-label"><span className="pulse-dot" /> 本月财务概况</div><div className="hero-title">每一步，都算数。</div><p>你正在用更清晰的方式，掌握自己的财务节奏。</p><div className="hero-stats"><div><span>本月结余</span><strong>{money(summary.income - summary.expense)}</strong></div><div><span>储蓄率</span><strong>{savingsRate}%</strong></div></div></div><div className="hero-art"><div className="art-ring ring-one" /><div className="art-ring ring-two" /><div className="art-ring ring-three" /><div className="art-core"><TrendingUp size={34} /></div><span className="art-star star-one">✦</span><span className="art-star star-two">✳</span></div></section>
          <section className="metrics-grid"><div className="metric-card"><div className="metric-top"><span>本月收入</span><span className="metric-icon income-icon"><ArrowDownLeft size={20} /></span></div><strong>{money(summary.income)}</strong><div className="metric-foot"><span className="muted">上月 {money(lastSummary.income, 0)}</span></div></div><div className="metric-card"><div className="metric-top"><span>本月支出</span><span className="metric-icon expense-icon"><ArrowUpRight size={20} /></span></div><strong>{money(summary.expense)}</strong><div className="metric-foot"><span className={monthCompare !== null && monthCompare > 0 ? 'metric-rise' : 'metric-fall'}>{monthCompare === null ? '—' : `${monthCompare > 0 ? '+' : ''}${monthCompare}%`}</span><span className="muted">较上月</span></div></div><div className="metric-card"><div className="metric-top"><span>预算使用</span><span className="metric-icon budget-icon"><Target size={20} /></span></div><strong>{budgetPct}%</strong><div className="metric-foot progress-foot"><div className="mini-progress"><span style={{ width: `${Math.min(budgetPct, 100)}%` }} /></div><span className="muted">{money(totalBudget - summary.expense, 0)} 可用</span></div></div></section>
          <section className="dashboard-grid"><div className="panel trend-panel"><div className="panel-title"><div><h2>收支趋势</h2><p>近 6 个月的财务变化</p></div><div className="chart-legend"><span><i className="legend-income" /> 收入</span><span><i className="legend-expense" /> 支出</span></div></div><TrendChart transactions={transactions} selectedMonth={month} /></div><div className="panel spending-panel"><div className="panel-title"><div><h2>支出去向</h2><p>本月分类占比</p></div><button className="subtle-link" onClick={() => navigate('analytics')}>查看详情 <ArrowRight size={15} /></button></div><div className="spending-body"><DonutChart data={categorySpending} total={summary.expense} /><div className="spending-legend">{categorySpending.slice(0, 4).map((c) => <div key={c.name}><span><i style={{ background: c.color }} />{c.name}</span><strong>{Math.round(c.value / summary.expense * 100)}%</strong></div>)}{!categorySpending.length && <span className="muted">本月暂无支出</span>}</div></div></div></section>
          <section className="panel recent-panel"><div className="panel-title"><div><h2>最近交易</h2><p>本月最新的资金动向</p></div><button className="subtle-link" onClick={() => navigate('transactions')}>查看全部 <ArrowRight size={15} /></button></div><TransactionList transactions={sorted.slice(0, 5)} compact /></section>
        </>}

        {page === 'transactions' && <section className="panel full-panel"><div className="panel-title"><div><h2>交易明细</h2><p>本月共 {monthTransactions.length} 笔记录</p></div><button className="button secondary export-button" onClick={() => { downloadCsv(filtered); setToast('CSV 文件已导出') }}><Download size={17} /> 导出 CSV</button></div><div className="filter-bar"><div className="search-box"><Search size={18} /><input placeholder="搜索备注、分类或币种" value={search} onChange={(e) => setSearch(e.target.value)} /></div><div className="filter-select"><SlidersHorizontal size={17} /><select aria-label="交易类型" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">全部类型</option><option value="expense">支出</option><option value="income">收入</option></select></div><div className="filter-select"><select aria-label="分类" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}><option value="all">全部分类</option>{CATEGORIES.map((c) => <option key={c.name}>{c.name}</option>)}</select><ChevronDown size={16} /></div></div><div className="list-caption"><span>交易</span><span>日期</span><span>金额</span><span>操作</span></div><TransactionList transactions={filtered} onEdit={setModal} onDelete={deleteTransaction} /><div className="list-footer">显示 {filtered.length} 条记录 · 金额按原币展示，{remote ? '多币种统计使用每笔交易保存的历史汇率' : '多币种统计按演示汇率折算人民币'}</div></section>}

        {page === 'analytics' && <><section className="analytics-intro"><div><span className="eyebrow">MONTHLY INSIGHT</span><h2>钱花在哪里，答案就在这里。</h2><p>通过分类和趋势认识你的消费习惯，让下一个月更有计划。</p></div><div className="analytics-big-number"><span>本月结余</span><strong>{money(summary.income - summary.expense)}</strong></div></section><section className="dashboard-grid analytics-grid"><div className="panel trend-panel"><div className="panel-title"><div><h2>半年收支趋势</h2><p>收入与支出对比</p></div><div className="chart-legend"><span><i className="legend-income" /> 收入</span><span><i className="legend-expense" /> 支出</span></div></div><TrendChart transactions={transactions} selectedMonth={month} /></div><div className="panel spending-panel"><div className="panel-title"><div><h2>分类分布</h2><p>本月支出结构</p></div></div><div className="spending-body"><DonutChart data={categorySpending} total={summary.expense} /><div className="spending-legend">{categorySpending.slice(0, 5).map((c) => <div key={c.name}><span><i style={{ background: c.color }} />{c.name}</span><strong>{Math.round(c.value / summary.expense * 100)}%</strong></div>)}</div></div></div></section><section className="panel category-panel"><div className="panel-title"><div><h2>支出分类排行</h2><p>看看哪些类别占用了最多预算</p></div></div>{categorySpending.length ? categorySpending.map((c, i) => <div className="category-ranking" key={c.name}><span className="rank-number">{String(i + 1).padStart(2, '0')}</span><CategoryIcon name={c.name} /><div className="ranking-main"><div><strong>{c.name}</strong><span>{money(c.value)}</span></div><div className="ranking-track"><span style={{ width: `${c.value / summary.expense * 100}%`, background: c.color }} /></div></div><span className="ranking-pct">{Math.round(c.value / summary.expense * 100)}%</span></div>) : <div className="empty-state">本月暂无支出数据</div>}</section></>}

        {page === 'budgets' && <><section className="budget-hero"><div><span className="eyebrow">SPEND WITH INTENTION</span><h2>给每一分开支，一个合适的位置。</h2><p>为常用分类设置月度预算，消费时更有把握。</p></div><div className="budget-hero-total"><span>总预算</span><strong>{money(totalBudget, 0)}</strong><div className="budget-hero-progress"><span style={{ width: `${Math.min(budgetPct, 100)}%` }} /></div><small>已使用 {money(summary.expense, 0)} · 剩余 {money(totalBudget - summary.expense, 0)}</small></div></section><section className="budget-grid">{CATEGORIES.filter((c) => c.type === 'expense').map((c) => { const used = categorySpending.find((s) => s.name === c.name)?.value || 0; const limit = Number(budgets[c.name] || 0); const pct = limit ? used / limit * 100 : 0; return <div className="budget-card" key={c.name}><div className="budget-card-head"><CategoryIcon name={c.name} /><div><strong>{c.name}</strong><span>{money(used, 0)} / {money(limit, 0)}</span></div><button aria-label={`编辑${c.name}预算`} onClick={() => setBudgetEdit(c.name)}><Pencil size={16} /></button></div><div className="budget-progress"><span className={pct > 100 ? 'over-budget' : ''} style={{ width: `${Math.min(pct, 100)}%`, background: pct > 100 ? '#e27364' : c.color }} /></div><div className="budget-card-foot"><span>{pct > 100 ? '已超出预算' : '预算使用率'}</span><strong>{Math.round(pct)}%</strong></div></div> })}</section></>}

        {page === 'settings' && <SettingsContent remote={remote} account={account} onExport={() => { downloadCsv(transactions); setToast('全部交易已导出') }} onReset={resetDemo} onSignOut={async () => { try { await onSignOut() } catch (error) { setToast(error.message) } }} onDeleteAccount={() => setDeleteAccountOpen(true)} />}
      </main>
    </div>
    {mobileNav && <div className="nav-scrim" onClick={() => setMobileNav(false)} />}
    {modal && <TransactionModal item={modal.id ? modal : null} remote={remote} onClose={() => setModal(null)} onSave={saveTransaction} />}
    {budgetEdit && <BudgetModal category={budgetEdit} amount={budgets[budgetEdit]} onClose={() => setBudgetEdit(null)} onSave={saveBudget} />}
    {confirmation && <ConfirmModal {...confirmation} onClose={() => setConfirmation(null)} />}
    {deleteAccountOpen && <DeleteAccountModal onClose={() => setDeleteAccountOpen(false)} onDelete={async (password) => { await api.deleteAccount(password); setDeleteAccountOpen(false); onSignOut() }} />}
    {toast && <div className="toast"><Check size={17} /> {toast}</div>}
  </div>
}

function BudgetModal({ category, amount, onClose, onSave }) {
  const [value, setValue] = useState(amount)
  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}><div className="modal small-modal" role="dialog" aria-modal="true"><div className="modal-head"><div><span className="eyebrow">MONTHLY BUDGET</span><h2>设置 {category} 预算</h2></div><button className="icon-button" onClick={onClose} aria-label="关闭"><X size={20} /></button></div><form onSubmit={(e) => { e.preventDefault(); onSave(Math.max(0, Number(value) || 0)) }}><label className="field-label" htmlFor="budget-amount">每月预算（人民币）</label><div className="amount-entry"><span>¥</span><input id="budget-amount" autoFocus type="number" min="0" step="1" value={value} onChange={(e) => setValue(e.target.value)} /></div><div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>取消</button><button className="button primary" type="submit"><Check size={17} /> 保存预算</button></div></form></div></div>
}
