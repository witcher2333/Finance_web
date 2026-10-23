import { useState } from 'react'

export default function RecoveryCodes({ codes }) {
  const [copied, setCopied] = useState(false)

  async function copyCodes() {
    try {
      await navigator.clipboard.writeText(codes.join('\n'))
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return <div className="recovery-codes">
    <div className="recovery-code-grid">{codes.map((code) => <code key={code}>{code}</code>)}</div>
    <button type="button" className="button secondary" onClick={copyCodes}>{copied ? '已复制' : '复制全部恢复码'}</button>
    <p>恢复码只在这里显示一次。每个只能使用一次，请保存在密码管理器或其他安全位置。</p>
  </div>
}
