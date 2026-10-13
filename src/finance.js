export const CURRENCIES = {
  CNY: { symbol: '¥', label: '人民币', rate: 1 },
  GBP: { symbol: '£', label: '英镑', rate: 9.25 },
  USD: { symbol: '$', label: '美元', rate: 7.15 },
  EUR: { symbol: '€', label: '欧元', rate: 7.85 },
}

export const CATEGORIES = [
  { name: '餐饮美食', icon: 'utensils', color: '#eb8b6b', type: 'expense' },
  { name: '购物消费', icon: 'bag', color: '#a78dd9', type: 'expense' },
  { name: '交通出行', icon: 'car', color: '#79a9d9', type: 'expense' },
  { name: '住房账单', icon: 'home', color: '#d4ab68', type: 'expense' },
  { name: '娱乐休闲', icon: 'sparkles', color: '#e7a0ab', type: 'expense' },
  { name: '学习成长', icon: 'book', color: '#7cae9c', type: 'expense' },
  { name: '医疗健康', icon: 'heart', color: '#e39e8c', type: 'expense' },
  { name: '其他支出', icon: 'more', color: '#9da4ad', type: 'expense' },
  { name: '工资收入', icon: 'briefcase', color: '#48a88d', type: 'income' },
  { name: '副业收入', icon: 'sparkles', color: '#67aa8c', type: 'income' },
  { name: '其他收入', icon: 'more', color: '#92b9a7', type: 'income' },
]

export const localDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const localMonth = (d) => localDate(d).slice(0, 7)

const at = (day, monthOffset = 0) => {
  const d = new Date()
  return localDate(new Date(d.getFullYear(), d.getMonth() + monthOffset, day, 12))
}

export const DEMO_TRANSACTIONS = [
  { id: 'demo-1', note: '月度工资', category: '工资收入', type: 'income', amount: 18500, currency: 'CNY', date: at(2) },
  { id: 'demo-2', note: '自由设计项目', category: '副业收入', type: 'income', amount: 3200, currency: 'CNY', date: at(7) },
  { id: 'demo-3', note: '房租与物业', category: '住房账单', type: 'expense', amount: 4200, currency: 'CNY', date: at(3) },
  { id: 'demo-4', note: '超市采购', category: '餐饮美食', type: 'expense', amount: 268.5, currency: 'CNY', date: at(5) },
  { id: 'demo-5', note: '通勤地铁', category: '交通出行', type: 'expense', amount: 128, currency: 'CNY', date: at(6) },
  { id: 'demo-6', note: '咖啡与早午餐', category: '餐饮美食', type: 'expense', amount: 86, currency: 'CNY', date: at(8) },
  { id: 'demo-7', note: '线上课程', category: '学习成长', type: 'expense', amount: 399, currency: 'CNY', date: at(9) },
  { id: 'demo-8', note: '周末电影', category: '娱乐休闲', type: 'expense', amount: 96, currency: 'CNY', date: at(10) },
  { id: 'demo-9', note: '设计素材订阅', category: '购物消费', type: 'expense', amount: 12, currency: 'USD', date: at(11) },
  { id: 'demo-10', note: '日用品', category: '购物消费', type: 'expense', amount: 178.9, currency: 'CNY', date: at(12) },
  { id: 'demo-11', note: '月度工资', category: '工资收入', type: 'income', amount: 18000, currency: 'CNY', date: at(2, -1) },
  { id: 'demo-12', note: '房租与物业', category: '住房账单', type: 'expense', amount: 4200, currency: 'CNY', date: at(3, -1) },
  { id: 'demo-13', note: '短途旅行', category: '娱乐休闲', type: 'expense', amount: 1180, currency: 'CNY', date: at(15, -1) },
  { id: 'demo-14', note: '朋友聚餐', category: '餐饮美食', type: 'expense', amount: 338, currency: 'CNY', date: at(20, -1) },
  { id: 'demo-15', note: '月度工资', category: '工资收入', type: 'income', amount: 18000, currency: 'CNY', date: at(2, -2) },
  { id: 'demo-16', note: '房租与物业', category: '住房账单', type: 'expense', amount: 4200, currency: 'CNY', date: at(3, -2) },
]

export const DEFAULT_BUDGETS = {
  '餐饮美食': 1800, '购物消费': 1500, '交通出行': 800,
  '住房账单': 4500, '娱乐休闲': 1200, '学习成长': 800,
  '医疗健康': 500, '其他支出': 600,
}

export const toCny = (t) => Number.isFinite(Number(t.amountCny)) && t.amountCny !== undefined ? Number(t.amountCny) : Number(t.amount) * (CURRENCIES[t.currency]?.rate || 1)
export const money = (n, digits = 2) => `${Number(n || 0) < 0 ? '-' : ''}¥${Math.abs(Number(n || 0)).toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
export const originalMoney = (t) => `${CURRENCIES[t.currency]?.symbol || '¥'}${Number(t.amount).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`
export const monthKey = (date) => String(date).slice(0, 7)
export const currentMonth = () => localMonth(new Date())
export const monthLabel = (key) => { const [year, month] = key.split('-'); return `${year}年${Number(month)}月` }
export const categoryOf = (name) => CATEGORIES.find((c) => c.name === name) || CATEGORIES[7]

export function summarize(transactions) {
  return transactions.reduce((acc, t) => {
    acc[t.type] += toCny(t)
    return acc
  }, { income: 0, expense: 0 })
}

export function transactionsToCsv(transactions) {
  const csvCell = (value) => {
    const raw = String(value ?? '')
    const safe = /^[\s]*[=+\-@]/.test(raw) ? `'${raw}` : raw
    return `"${safe.replaceAll('"', '""')}"`
  }
  const rows = [
    ['日期', '类型', '分类', '备注', '原币金额', '币种', '人民币折算', '使用汇率', '汇率日期', '汇率来源'],
    ...transactions.map((t) => [t.date, t.type === 'income' ? '收入' : '支出', t.category, t.note, t.amount, t.currency, toCny(t).toFixed(2), t.fxRate ?? CURRENCIES[t.currency]?.rate ?? 1, t.rateDate ?? '', t.rateSource ?? 'DEMO']),
  ]
  return '\ufeff' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n')
}

export function downloadCsv(transactions) {
  const csv = transactionsToCsv(transactions)
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `tango-finance-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
