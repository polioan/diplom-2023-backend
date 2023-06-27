import nodemailer from 'nodemailer'
import { env } from './env.js'
import type Mail from 'nodemailer/lib/mailer/index.js'
import { TRPCError } from './trpc.js'

function getClient() {
  return nodemailer.createTransport({
    host: env('EMAIL_HOST'),
    port: env('EMAIL_PORT'),
    secure: true,
    auth: {
      user: env('EMAIL_USER'),
      pass: env('EMAIL_PASSWORD'),
    },
  })
}

const client = getClient()

interface SendMailOptions
  extends Omit<Mail.Options, 'from' | 'to' | 'subject' | 'html'> {
  to: string
  subject: string
  html: Exclude<Mail.Options['html'], undefined>
}

export async function sendMail(options: SendMailOptions) {
  try {
    await client.sendMail({
      from: env('EMAIL_USER'),
      ...options,
    })
    return 'ok'
  } catch (e) {
    if (e instanceof Error && 'code' in e && typeof e.code === 'string') {
      if (e.code === 'EENVELOPE') {
        return 'no-recipient-error'
      }
      return 'unknown-mail-error'
    }
    return 'unknown-error'
  }
}

export async function sendMailOrThrowTRPCError(options: SendMailOptions) {
  const status = await sendMail(options)
  switch (status) {
    case 'unknown-error':
    case 'unknown-mail-error':
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Неизвестная ошибка отправки!',
      })
    case 'no-recipient-error':
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Неверный адрес почты!',
      })
    default:
      break
  }
}
