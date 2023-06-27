import { CaptchaJs } from '@solarwinter/captchajs'
import { env } from './env.js'
import { TRPCError } from './trpc.js'

const captcha = new CaptchaJs({
  client: env('CAPTCHAS_CLIENT'),
  secret: env('CAPTCHAS_SECRET'),
})

export function createCaptcha() {
  const randomString = captcha.getRandomString()
  const imageUrl = captcha.getImageUrl({ randomString: randomString })
  const audioUrl = captcha.getAudioUrl({ randomString: randomString })
  return { randomString, imageUrl, audioUrl } as const
}

export function validateCaptcha(randomString: string, captchaText: string) {
  if (env.isDev && captchaText === 'ok') {
    return 'ok'
  }
  if (!captcha.validateRandomString(randomString)) {
    return 'expired-used'
  } else if (!captcha.verifyPassword(randomString, captchaText)) {
    return 'wrong'
  } else {
    return 'ok'
  }
}

export function validateCaptchaOrThrowTRPCError(
  randomString: string,
  captchaText: string
) {
  const captchaStatus = validateCaptcha(randomString, captchaText)
  if (captchaStatus === 'expired-used') {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Капча устарела или уже была использована!',
    })
  } else if (captchaStatus === 'wrong') {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Неправильная капча!',
    })
  }
}
