import { useState } from 'react'
import { ArrowRight, LockKeyhole, Mail, Sparkles, Wallet } from 'lucide-react'
import { api } from './api.js'

export default function AuthScreen({ onSuccess, onDemo }) {
  const [view, setView] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [working, setWorking] = useState(false)

  function changeView(next) {
    setView(next)
    setPassword('')
    setConfirmPassword('')
    setRecoveryCode('')
    setError('')
    setNotice('')
  }

  async function submit(event) {
    event.preventDefault()
    setWorking(true)
    setError('')
    try {
      if (view === 'recover') {
        if (password !== confirmPassword) throw new Error('两次输入的密码不一致')
        await api.recoverAccount(email, recoveryCode, password)
        changeView('login')
        setNotice('密码已重设，其他设备上的登录也已失效。请用新密码登录。')
      } else {
        const result = view === 'register' ? await api.register(name, email, password) : await api.login(email, password)
        onSuccess(result.user, result.recoveryCodes)
      }
    } catch (problem) {
      setError(problem.message)
    } finally {
      setWorking(false)
    }
  }

  return <div className="auth-layout">
    <section className="auth-story">
      <div className="auth-brand"><span className="brand-mark"><span /></span>Tango Finance</div>
      <div className="auth-story-content">
        <div className="auth-kicker"><Sparkles size={16} /> 让财务更清晰</div>
        <h1>看见每一笔，<br />也看见更好的未来。</h1>
        <p>从记录到理解，让你的钱去往真正重要的地方。</p>
        <div className="auth-art"><div className="auth-art-circle"><Wallet size={49} /></div><span className="auth-art-orbit orbit-a" /><span className="auth-art-orbit orbit-b" /><span className="auth-art-star">✳</span></div>
      </div>
      <span className="auth-footnote">TANGO FINANCE STUDIO · PERSONAL FINANCE, MADE SIMPLE</span>
    </section>
    <section className="auth-form-side"><div className="auth-form-wrap">
      <div className="auth-form-icon"><LockKeyhole size={22} /></div>
      <span className="eyebrow">WELCOME TO TANGO</span>
      <h2>{view === 'register' ? '创建你的账户' : view === 'recover' ? '用恢复码重设密码' : '欢迎回来'}</h2>
      <p className="auth-subtitle">{view === 'recover' ? '输入注册邮箱、之前保存的恢复码和新密码。' : view === 'register' ? '开始你的个人财务管理空间。' : '登录后，随时查看你的真实账本。'}</p>
      <form onSubmit={submit}>
        {view === 'register' && <label className="auth-field">名字<input value={name} onChange={(event) => setName(event.target.value)} maxLength="50" required placeholder="怎么称呼你？" /></label>}
        <label className="auth-field">邮箱<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required placeholder="you@example.com" /></label>
        {view === 'recover' && <label className="auth-field">恢复码<input value={recoveryCode} onChange={(event) => setRecoveryCode(event.target.value)} autoComplete="off" required placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX" /></label>}
        <label className="auth-field">{view === 'recover' ? '新密码' : '密码'}<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete={view === 'login' ? 'current-password' : 'new-password'} minLength="12" required placeholder={view === 'login' ? '输入你的密码' : '至少 12 个字符'} /></label>
        {view === 'recover' && <label className="auth-field">确认新密码<input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} type="password" autoComplete="new-password" minLength="12" required placeholder="再次输入新密码" /></label>}
        {error && <div className="auth-error" role="alert">{error}</div>}
        {notice && <div className="auth-notice" role="status">{notice}</div>}
        <button className="button primary auth-submit" disabled={working}>{working ? '请稍候…' : view === 'register' ? '创建账户' : view === 'recover' ? '重设密码' : '登录账户'} <ArrowRight size={18} /></button>
      </form>
      {view === 'login' && <div className="auth-switch"><button type="button" onClick={() => changeView('recover')}>忘记密码？使用恢复码</button></div>}
      <div className="auth-switch">{view === 'register' ? '已有账户？' : view === 'recover' ? '想起密码了？' : '还没有账户？'} <button type="button" onClick={() => changeView(view === 'login' ? 'register' : 'login')}>{view === 'login' ? '免费注册' : '返回登录'}</button></div>
      {view === 'recover' && <p className="recovery-hint">尚未保存恢复码且已经退出账户时，暂时无法自助找回密码。</p>}
      <div className="auth-divider"><span>或</span></div>
      <button className="auth-demo" onClick={onDemo}><Wallet size={19} /><span><strong>先体验演示模式</strong><small>无需注册，使用示例数据浏览功能</small></span><ArrowRight size={17} /></button>
      <p className="auth-privacy"><Mail size={14} /> 登录数据只用于这个作品；密码以加盐哈希存储。</p>
    </div></section>
  </div>
}
