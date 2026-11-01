import { DomainError } from '../domain/commands';

export async function sendSignInCode(email: string, code: string, local: boolean): Promise<'email' | 'console'> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.AUTH_EMAIL_FROM;
  if (!key || !from) {
    if (process.env.NODE_ENV === 'development' && local) {
      console.info(`[IRIVA 本地邮件预览] ${email} · 验证码 ${code} · 10 分钟内有效（未发送邮件）`);
      return 'console';
    }
    throw new DomainError(503, '邮箱登录暂未开通，请稍后再试。');
  }
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [email], subject: `${code} 是你的 iriva 验证码`, text: `你的 iriva 登录验证码是 ${code}。\n\n10 分钟内有效，仅可使用一次。如果不是你发起的请求，请忽略这封邮件。` }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('Email delivery rejected');
    return 'email';
  } catch {
    throw new DomainError(503, '验证码发送失败，请稍后重试。');
  }
}
