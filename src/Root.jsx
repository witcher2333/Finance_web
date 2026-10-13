import { useEffect, useState } from 'react'
import { ArrowRight, LockKeyhole, Mail, Sparkles, Wallet } from 'lucide-react'
import Dashboard from './App.jsx'
import { api } from './api.js'

function AuthScreen({ onSuccess, onDemo }) {
  const [register, setRegister] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [working, setWorking] = useState(false)
  async function submit(event) {
    event.preventDefault()
    setWorking(true); setError('')
    try { const result = register ? await api.register(name, email, password) : await api.login(email, password); onSuccess(result.user) }
    catch (problem) { setError(problem.message) }
    finally { setWorking(false) }
  }
  return <div className="auth-layout"><section className="auth-story"><div className="auth-brand"><span className="brand-mark"><span /></span>Tango Finance</div><div className="auth-story-content"><div className="auth-kicker"><Sparkles size={16} /> 让财务更清晰</div><h1>看见每一笔，<br />也看见更好的未来。</h1><p>从记录到理解，让你的钱去往真正重要的地方。</p><div className="auth-art"><div className="auth-art-circle"><Wallet size={49} /></div><span className="auth-art-orbit orbit-a" /><span className="auth-art-orbit orbit-b" /><span className="auth-art-star">✳</span></div></div><span className="auth-footnote">TANGO FINANCE STUDIO · PERSONAL FINANCE, MADE SIMPLE</span></section><section className="auth-form-side"><div className="auth-form-wrap"><div className="auth-form-icon"><LockKeyhole size={22} /></div><span className="eyebrow">WELCOME TO TANGO</span><h2>{register ? '创建你的账户' : '欢迎回来'}</h2><p className="auth-subtitle">{register ? '开始你的个人财务管理空间。' : '登录后，随时查看你的真实账本。'}</p><form onSubmit={submit}>{register && <label className="auth-field">名字<input value={name} onChange={(e) => setName(e.target.value)} maxLength="50" required placeholder="怎么称呼你？" /></label>}<label className="auth-field">邮箱<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" required placeholder="you@example.com" /></label><label className="auth-field">密码<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete={register ? 'new-password' : 'current-password'} minLength="12" required placeholder={register ? '至少 12 个字符' : '输入你的密码'} /></label>{error && <div className="auth-error">{error}</div>}<button className="button primary auth-submit" disabled={working}>{working ? '请稍候…' : register ? '创建账户' : '登录账户'} <ArrowRight size={18} /></button></form><div className="auth-switch">{register ? '已有账户？' : '还没有账户？'} <button onClick={() => { setRegister(!register); setError('') }}>{register ? '立即登录' : '免费注册'}</button></div><div className="auth-divider"><span>或</span></div><button className="auth-demo" onClick={onDemo}><Wallet size={19} /><span><strong>先体验演示模式</strong><small>无需注册，使用示例数据浏览功能</small></span><ArrowRight size={17} /></button><p className="auth-privacy"><Mail size={14} /> 登录数据只用于这个作品；密码以加盐哈希存储。</p></div></section></div>
}

export default function Root() {
  const [mode, setMode] = useState('checking')
  const [user, setUser] = useState(null)
  useEffect(() => {
    let cancelled = false
    api.health().then(() => api.me().then((result) => {
      if (!cancelled) { setUser(result.user); setMode('account') }
    }).catch((error) => { if (!cancelled) setMode(error.status === 401 ? 'auth' : 'unavailable') }))
      .catch(() => { if (!cancelled) setMode('demo') })
    return () => { cancelled = true }
  }, [])
  if (mode === 'checking') return <div className="boot-screen"><div className="boot-mark">T</div> 正在打开 Tango Finance…</div>
  if (mode === 'unavailable') return <div className="boot-screen error-screen"><strong>账户服务暂时不可用</strong><span>服务器已启动，但暂时无法读取账户数据。</span><button className="button primary" onClick={() => window.location.reload()}>重试</button><button className="button secondary" onClick={() => setMode('demo')}>进入演示模式</button></div>
  if (mode === 'auth') return <AuthScreen onSuccess={(account) => { setUser(account); setMode('account') }} onDemo={() => setMode('demo')} />
  return <Dashboard key={mode} remote={mode === 'account'} account={user} onSignOut={async () => { if (mode === 'account') { try { await api.logout() } catch (error) { if (error.status !== 401) throw error } setUser(null); setMode('auth') } else { try { await api.health(); setMode('auth') } catch { window.location.reload() } } }} />
}
