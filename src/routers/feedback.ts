import { z } from 'zod'
import {
  TRPCError,
  adminProcedure,
  createTRPCRouter,
  rateLimitProcedure,
} from '../lib/trpc.js'
import { validateCaptchaOrThrowTRPCError } from '../lib/captcha.js'
import {
  CaptchaSchema,
  ConsentProcessingOfPersonalDataSchema,
  CsrfSchema,
  EmailSchema,
  VoidSchema,
} from '../schemas/index.js'
import { sendMailOrThrowTRPCError } from '../lib/mail.js'
import { checkCsrf } from '../lib/authToken.js'

const PREFIX = '/feedback'

export const feedbackRouter = createTRPCRouter({
  create: rateLimitProcedure
    .meta({ openapi: { method: 'POST', path: `${PREFIX}/create` } })
    .input(
      z
        .object({
          name: z
            .string({
              invalid_type_error: 'Имя не является строкой!',
              required_error: 'Имя не указано!',
            })
            .min(3, { message: 'Имя слишком короткое!' })
            .max(40, { message: 'Имя слишком длинное!' }),
          commandName: z
            .string({
              invalid_type_error: 'Название не является строкой!',
              required_error: 'Название не указано!',
            })
            .min(3, { message: 'Название слишком короткое!' })
            .max(70, { message: 'Название слишком длинное!' })
            .nullable(),
          message: z
            .string({
              invalid_type_error: 'Сообщение не является строкой!',
              required_error: 'Сообщение не указано!',
            })
            .max(2015, { message: 'Сообщение слишком длинное!' }),
        })
        .merge(CaptchaSchema)
        .merge(ConsentProcessingOfPersonalDataSchema)
        .merge(EmailSchema)
    )
    .output(z.void())
    .mutation(async ({ ctx, input }) => {
      const { randomString, captchaText, email, message, name, commandName } =
        input
      validateCaptchaOrThrowTRPCError(randomString, captchaText)
      await ctx.prisma.feedback.create({
        data: {
          email,
          message,
          name,
          commandName,
          fingerprint: ctx.fingerprint,
        },
      })
    }),
  get: adminProcedure
    .meta({ openapi: { method: 'GET', path: `${PREFIX}/get`, protect: true } })
    .input(VoidSchema)
    .output(
      z.object({
        feedback: z.array(
          z.object({
            id: z.number(),
            createdAt: z.date(),
            updatedAt: z.date(),
            answered: z.boolean(),
            fingerprint: z.string(),
            name: z.string(),
            email: z.string(),
            commandName: z.string().nullable(),
            message: z.string(),
          })
        ),
        count: z.number(),
      })
    )
    .query(async ({ ctx }) => {
      const feedback = await ctx.prisma.feedback.findMany()
      return { feedback, count: feedback.length }
    }),
  deleteById: adminProcedure
    .meta({
      openapi: {
        method: 'DELETE',
        path: `${PREFIX}/deleteById`,
        protect: true,
      },
    })
    .input(
      z
        .object({
          id: z
            .number({
              invalid_type_error: 'Неверное число!',
              required_error: 'Id не введен!',
            })
            .int('Число должно быть целым!')
            .nonnegative('Число должно быть позитивным!'),
        })
        .merge(CsrfSchema)
    )
    .output(z.void())
    .mutation(async ({ ctx, input }) => {
      checkCsrf(ctx.adminCsrfToken, input.csrfToken)
      await ctx.prisma.feedback.delete({ where: { id: input.id } })
    }),
  reply: adminProcedure
    .meta({
      openapi: { method: 'POST', path: `${PREFIX}/reply`, protect: true },
    })
    .input(
      z
        .object({
          id: z
            .number({
              invalid_type_error: 'Неверное число!',
              required_error: 'Id не введен!',
            })
            .int('Число должно быть целым!')
            .nonnegative('Число должно быть позитивным!'),
          text: z.string({
            required_error: 'Не введен текст!',
            invalid_type_error: 'Текст не является строкой!',
          }),
        })
        .merge(CsrfSchema)
    )
    .output(z.void())
    .mutation(async ({ ctx, input }) => {
      const { id, text, csrfToken } = input
      checkCsrf(ctx.adminCsrfToken, csrfToken)
      const feedback = await ctx.prisma.feedback.findUnique({ where: { id } })
      if (!feedback) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Вопрос не найден!' })
      }
      await sendMailOrThrowTRPCError({
        to: feedback.email,
        subject: 'Ответ на вопрос',
        html: text,
      })
      await ctx.prisma.feedback.update({
        where: { id },
        data: { answered: true },
      })
    }),
})
