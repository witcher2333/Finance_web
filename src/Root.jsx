import { useEffect, useState } from 'react'
import Dashboard from './App.jsx'
import AuthScreen from './AuthScreen.jsx'
import RecoveryCodes from './RecoveryCodes.jsx'
import { api } from './api.js'

function RecoverySetup({ codes, onContinue }) {
  const [saved, setSaved] = useState(false)
  return <div className="recovery-setup-page"><section className="recovery-setup-card">
    <span className="eyebrow">ACCOUNT RECOVERY</span>
    <h1>先保存恢复码</h1>
    <p>忘记密码时，恢复码是目前唯一的自助找回方式。请现在保存；离开本页后无法再次查看这组码。</p>
    <RecoveryCodes codes={codes} />
    <label className="recovery-confirm"><input type="checkbox" checked={saved} onChange={(event) => setSaved(event.target.checked)} /> 我已将恢复码保存到安全位置</label>
    <button className="button primary" disabled={!saved} onClick={onContinue}>进入我的账本</button>
  </section></div>
}

export default function Root() {
  const [mode, setMode] = useState('checking')
  const [user, setUser] = useState(null)
  const [pendingCodes, setPendingCodes] = useState(null)
  useEffect(() => {
    let cancelled = false
    api.health().then(() => api.me().then((result) => {
      if (!cancelled) { setUser(result.user); setMode('account') }
    }).catch((error) => { if (!cancelled) setMode(error.status === 401 ? 'auth' : 'unavailable') }))
      .catch(() => { if (!cancelled) setMode(import.meta.env.PROD ? 'unavailable' : 'demo') })
    return () => { cancelled = true }
  }, [])
  if (mode === 'checking') return <div className="boot-screen"><div className="boot-mark">T</div> 正在打开 Tango Finance…</div>
  if (mode === 'unavailable') return <div className="boot-screen error-screen"><strong>账户服务暂时不可用</strong><span>服务器已启动，但暂时无法读取账户数据。</span><button className="button primary" onClick={() => window.location.reload()}>重试</button><button className="button secondary" onClick={() => setMode('demo')}>进入演示模式</button></div>
  if (mode === 'auth') return <AuthScreen onSuccess={(account, codes) => { setUser(account); setPendingCodes(codes || null); setMode('account') }} onDemo={() => setMode('demo')} />
  if (pendingCodes) return <RecoverySetup codes={pendingCodes} onContinue={() => setPendingCodes(null)} />
  return <Dashboard key={mode} remote={mode === 'account'} account={user} onSignOut={async () => { if (mode === 'account') { try { await api.logout() } catch (error) { if (error.status !== 401) throw error } setUser(null); setMode('auth') } else { try { await api.health(); setMode('auth') } catch { window.location.reload() } } }} />
}
