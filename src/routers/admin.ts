import { z } from 'zod'
import {
  TRPCError,
  adminProcedure,
  createTRPCRouter,
  forbiddenProcedure,
  rateLimitProcedure,
} from '../lib/trpc.js'
import argon2 from 'argon2'
import { checkCsrf, createToken, toExpressCookie } from '../lib/authToken.js'
import { CaptchaSchema, CsrfSchema, VoidSchema } from '../schemas/index.js'
import { validateCaptchaOrThrowTRPCError } from '../lib/captcha.js'
import { createAdmin } from '../commonServices/createAdmin.js'
import { env } from '../lib/env.js'
import { v4 as uuid } from 'uuid'

const PREFIX = '/admin'

export const adminRouter = createTRPCRouter({
  create: forbiddenProcedure
    .meta({ openapi: { method: 'POST', path: `${PREFIX}/create` } })
    .input(VoidSchema)
    .output(
      z.object({
        login: z.string(),
        password: z.string(),
      })
    )
    .mutation(async ({ ctx }) => {
      return await createAdmin(ctx.prisma)
    }),
  login: rateLimitProcedure
    .meta({ openapi: { method: 'POST', path: `${PREFIX}/login` } })
    .input(
      z
        .object({
          password: z.string({
            invalid_type_error: 'Пароль не является строкой!',
            required_error: 'Пароль не указан!',
          }),
          login: z.string({
            invalid_type_error: 'Логин не является строкой!',
            required_error: 'Логин не указан!',
          }),
        })
        .merge(CaptchaSchema)
    )
    .output(
      z
        .object({
          csrfToken: z.string(),
        })
        .merge(env.isDev ? z.object({ token: z.string() }) : z.object({}))
    )
    .mutation(async ({ ctx, input }) => {
      const { login, password, captchaText, randomString } = input

      validateCaptchaOrThrowTRPCError(randomString, captchaText)

      const user = await ctx.prisma.admin.findUnique({ where: { login } })
      if (!user) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Неверный пользователь или пароль!',
        })
      }
      const isValidPassword = await argon2.verify(user.password, password)
      if (!isValidPassword) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Неверный пользователь или пароль!',
        })
      }

      const csrfToken = uuid()

      const token = createToken({ id: user.id, csrfToken })

      ctx.res.cookie(...toExpressCookie(token))

      return { csrfToken, token }
    }),
  logout: adminProcedure
    .meta({
      openapi: { method: 'POST', path: `${PREFIX}/logout` },
    })
    .input(CsrfSchema)
    .output(z.void())
    .mutation(({ ctx, input }) => {
      checkCsrf(ctx.adminCsrfToken, input.csrfToken)
      ctx.res.clearCookie(toExpressCookie.cookieName())
    }),
})
