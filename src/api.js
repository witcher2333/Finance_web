export class ApiError extends Error {
  constructor(message, code, status) { super(message); this.code = code; this.status = status }
}

async function request(path, options = {}) {
  let response
  try {
    response = await fetch(`/api${path}`, {
      credentials: 'same-origin',
      headers: options.body ? { 'Content-Type': 'application/json' } : {},
      ...options,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(10_000),
    })
  } catch { throw new ApiError('无法连接服务器，请检查网络或稍后重试', 'NETWORK_ERROR', 0) }
  if (response.status === 204) return null
  let data
  try { data = await response.json() } catch { throw new ApiError('服务器响应无效', 'BAD_RESPONSE', response.status) }
  if (!response.ok) throw new ApiError(data.error || '请求失败', data.code || 'REQUEST_FAILED', response.status)
  return data
}

export const api = {
  health: () => request('/health'),
  me: () => request('/auth/me'),
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  register: (name, email, password) => request('/auth/register', { method: 'POST', body: { name, email, password } }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  deleteAccount: (password) => request('/account', { method: 'DELETE', body: { password } }),
  budgets: () => request('/budgets'),
  saveBudget: (category, amount) => request(`/budgets/${encodeURIComponent(category)}`, { method: 'PUT', body: { amount } }),
  createTransaction: (item) => request('/transactions', { method: 'POST', body: item }),
  updateTransaction: (item) => request(`/transactions/${item.id}`, { method: 'PUT', body: item }),
  deleteTransaction: (id) => request(`/transactions/${id}`, { method: 'DELETE' }),
  async transactions() {
    const all = []
    for (let offset = 0; ; offset += 100) {
      const data = await request(`/transactions?offset=${offset}`)
      all.push(...data.items)
      if (!data.hasMore) return all
    }
  },
}
