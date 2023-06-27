import { z } from 'zod'
import jwt from 'jsonwebtoken'
import type { CookieOptions, Request } from 'express'
import { env } from './env.js'
import { TRPCError } from './trpc.js'

const AUTH_COOKIE = '_auth'

const JWT_SECRET = env('JWT_SECRET')

const DecodedTokenSchema = z.object({
  id: z.string(),
  csrfToken: z.string(),
})

export function createToken(
  { id, csrfToken }: { id: string | number; csrfToken: string },
  expiresIn = '1d'
) {
  const payload = { id: String(id), csrfToken } satisfies z.infer<
    typeof DecodedTokenSchema
  >
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn,
  })
}

export function decodeToken(token: unknown) {
  if (typeof token !== 'string') {
    return null
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    return DecodedTokenSchema.parse(decoded)
  } catch {
    return null
  }
}

export function toExpressCookie(
  values:
    | {
        id: string | number
        csrfToken: string
      }
    | string
) {
  const oneDay = 24 * 60 * 60 * 1000
  const expirationDate = new Date(Date.now() + oneDay)

  return [
    AUTH_COOKIE,
    typeof values === 'string'
      ? values
      : createToken({ id: values.id, csrfToken: values.csrfToken }),
    {
      expires: expirationDate,
      httpOnly: false,
    } satisfies CookieOptions,
  ] as const
}

toExpressCookie.cookieName = function () {
  return AUTH_COOKIE
}

export function extractTokenFromExpressReq(req: Request) {
  const token = req.cookies[AUTH_COOKIE]
  const decoded = decodeToken(token)
  if (env.isDev && !decoded) {
    const devToken = req.headers['x-dev-token']
    return decodeToken(devToken)
  }
  return decoded
}

export function checkCsrf(
  userToken: string,
  formToken?: string | null | undefined
) {
  if (!formToken || userToken !== formToken) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Нет авторизации!',
    })
  }
}
