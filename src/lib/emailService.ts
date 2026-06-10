/**
 * EmailJS — configuração e envio de e-mails
 *
 * Para ativar e-mails reais:
 * 1. Crie conta gratuita em https://emailjs.com
 * 2. Adicione um serviço de e-mail (Gmail, Outlook, etc.)
 * 3. Crie dois templates:
 *    - Template de OTP   (variáveis: {{to_name}}, {{otp_code}}, {{expire_min}})
 *    - Template de Reset (variáveis: {{to_name}}, {{reset_link}}, {{expire_min}})
 * 4. Preencha as constantes abaixo com seus IDs
 * 5. Remova a flag DEV_MODE
 */

import emailjs from '@emailjs/browser'

/* eslint-disable @typescript-eslint/no-explicit-any */
const env = (import.meta as any).env ?? {}
const SERVICE_ID   = env.VITE_EMAILJS_SERVICE_ID  || ''
const OTP_TPL_ID   = env.VITE_EMAILJS_OTP_TPL     || ''
const RESET_TPL_ID = env.VITE_EMAILJS_RESET_TPL   || ''
const PUBLIC_KEY   = env.VITE_EMAILJS_PUBLIC_KEY  || ''

/** Quando true, exibe o código/link na tela em vez de enviar e-mail real */
export const DEV_MODE = !(SERVICE_ID && OTP_TPL_ID && RESET_TPL_ID && PUBLIC_KEY)

export interface EmailResult {
  ok: boolean
  devCode?: string   // apenas no DEV_MODE
  devLink?: string
  error?: string
}

export async function sendOTP(toEmail: string, toName: string, code: string): Promise<EmailResult> {
  if (DEV_MODE) {
    console.info(`[DEV] OTP para ${toEmail}: ${code}`)
    return { ok: true, devCode: code }
  }
  try {
    await emailjs.send(SERVICE_ID, OTP_TPL_ID, {
      to_email:   toEmail,
      to_name:    toName,
      otp_code:   code,
      expire_min: '10',
    }, PUBLIC_KEY)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

export async function sendResetLink(toEmail: string, toName: string, link: string): Promise<EmailResult> {
  if (DEV_MODE) {
    console.info(`[DEV] Link de reset para ${toEmail}: ${link}`)
    return { ok: true, devLink: link }
  }
  try {
    await emailjs.send(SERVICE_ID, RESET_TPL_ID, {
      to_email:   toEmail,
      to_name:    toName,
      reset_link: link,
      expire_min: '30',
    }, PUBLIC_KEY)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

// ─── OTP helpers ─────────────────────────────────────────────────────────────

const OTP_KEY = 'pavcon_otp'
const RESET_KEY = 'pavcon_reset_token'

export function generateOTP(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export function saveOTP(email: string, code: string) {
  const expires = Date.now() + 10 * 60 * 1000 // 10 min
  localStorage.setItem(OTP_KEY, JSON.stringify({ email, code, expires }))
}

export function verifyOTP(email: string, code: string): boolean {
  try {
    const stored = JSON.parse(localStorage.getItem(OTP_KEY) || 'null')
    if (!stored) return false
    if (stored.email !== email) return false
    if (stored.code !== code) return false
    if (Date.now() > stored.expires) return false
    localStorage.removeItem(OTP_KEY)
    return true
  } catch { return false }
}

// ─── Reset token helpers ──────────────────────────────────────────────────────

export function generateResetToken(email: string): string {
  const token = crypto.randomUUID()
  const expires = Date.now() + 30 * 60 * 1000 // 30 min
  localStorage.setItem(RESET_KEY, JSON.stringify({ email, token, expires }))
  return token
}

export function verifyResetToken(token: string): string | null {
  try {
    const stored = JSON.parse(localStorage.getItem(RESET_KEY) || 'null')
    if (!stored) return null
    if (stored.token !== token) return null
    if (Date.now() > stored.expires) return null
    return stored.email
  } catch { return null }
}

export function clearResetToken() {
  localStorage.removeItem(RESET_KEY)
}
