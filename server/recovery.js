import { randomBytes } from 'node:crypto'
import { InputError } from './domain.js'
import { tokenHash } from './security.js'

const CODE_COUNT = 8

export function generateRecoveryCodes() {
  return Array.from({ length: CODE_COUNT }, () => randomBytes(16).toString('hex').toUpperCase().match(/.{1,8}/g).join('-'))
}

export function recoveryCodeHash(value) {
  const code = String(value || '').replaceAll('-', '').replaceAll(' ', '').toLowerCase()
  if (!/^[a-f0-9]{32}$/.test(code)) throw new InputError('邮箱或恢复码无效', 'INVALID_RECOVERY', 401)
  return tokenHash(code)
}

export async function replaceRecoveryCodes(client, userId, codes) {
  await client.query('DELETE FROM recovery_codes WHERE user_id=$1', [userId])
  for (const code of codes) await client.query('INSERT INTO recovery_codes (user_id, code_hash) VALUES ($1,$2)', [userId, recoveryCodeHash(code)])
}
