import { z } from 'zod'
import {
  TRPCError,
  adminProcedure,
  createTRPCRouter,
  rateLimitProcedure,
} from '../lib/trpc.js'
import {
  CaptchaSchema,
  ConsentProcessingOfPersonalDataSchema,
  CsrfSchema,
  EmailSchema,
  VoidSchema,
} from '../schemas/index.js'
import { validateCaptchaOrThrowTRPCError } from '../lib/captcha.js'
import { checkCsrf } from '../lib/authToken.js'
import { sendMail } from '../lib/mail.js'

const PREFIX = '/applications'

function getMinDate() {
  const currentDate = new Date()
  return new Date(
    currentDate.getFullYear() - 35,
    currentDate.getMonth(),
    currentDate.getDate()
  )
}

const minDate = getMinDate()

function getMaxDate() {
  const currentDate = new Date()
  return new Date(
    currentDate.getFullYear() - 12,
    currentDate.getMonth(),
    currentDate.getDate()
  )
}

const maxDate = getMaxDate()

export const applicationsRouter = createTRPCRouter({
  create: rateLimitProcedure
    .meta({ openapi: { method: 'POST', path: `${PREFIX}/create` } })
    .input(
      z
        .object({
          commandName: z
            .string({
              invalid_type_error: 'Название не является строкой!',
              required_error: 'Название не указано!',
            })
            .min(3, { message: 'Название слишком короткое!' })
            .max(70, { message: 'Название слишком длинное!' }),
          format: z.enum(['online', 'offline', 'онлайн', 'оффлайн'], {
            errorMap: () => ({ message: 'Ожидалось "онлайн" или "оффлайн"!' }),
          }),
          participants: z
            .array(
              z
                .object({
                  firstName: z
                    .string({
                      invalid_type_error: 'Имя не является строкой!',
                      required_error: 'Имя не указано!',
                    })
                    .min(3, { message: 'Имя слишком короткое!' })
                    .max(30, { message: 'Имя слишком длинное!' }),
                  lastName: z
                    .string({
                      invalid_type_error: 'Фамилия не является строкой!',
                      required_error: 'Фамилия не указана!',
                    })
                    .min(3, { message: 'Фамилия слишком короткая!' })
                    .max(30, { message: 'Фамилия слишком длинная!' }),
                  middleName: z
                    .string({
                      invalid_type_error: 'Отчество не является строкой!',
                      required_error: 'Отчество не указано!',
                    })
                    .min(3, { message: 'Отчество слишком короткое!' })
                    .max(30, { message: 'Отчество слишком длинное!' })
                    .nullable(),
                  organization: z
                    .string({
                      invalid_type_error: 'Организация не является строкой!',
                      required_error: 'организация не указана!',
                    })
                    .min(3, {
                      message: 'Название организации слишком короткое!',
                    })
                    .max(200, {
                      message: 'Название организации слишком длинное!',
                    }),
                  dateOfBirth: z
                    .date({
                      invalid_type_error: 'Неверная дата!',
                      required_error: 'Дата не указана!',
                    })
                    .min(minDate, { message: 'Возраст слишком маленький!' })
                    .max(maxDate, { message: 'Возраст слишком большой!' }),
                  phoneNumber: z
                    .string({
                      invalid_type_error: 'Неверный телефон!',
                      required_error: 'Телефон не указан!',
                    })
                    .min(4, { message: 'Телефон слишком короткий!' })
                    .max(25, { message: 'Телефон слишком длинный!' }),
                  specialization: z.enum(
                    ['frontend', 'backend', 'devops', 'techlead', 'uxui'],
                    {
                      errorMap: () => ({
                        message:
                          'Ожидалось "frontend", "backend", "devops", "techlead" или "uxui"!',
                      }),
                    }
                  ),
                  stack: z
                    .string({
                      invalid_type_error: 'Стек не является строкой!',
                      required_error: 'Стек не указан!',
                    })
                    .min(3, { message: 'Описание стека слишком короткое!' })
                    .max(2015, { message: 'Описание стека слишком длинное!' }),
                })
                .merge(EmailSchema),
              {
                invalid_type_error: 'Неверный список!',
                required_error: 'Список не указан!',
              }
            )
            .min(2, { message: 'Слишком мало участников!' })
            .max(6, { message: 'Слишком много участников!' }),
        })
        .merge(CaptchaSchema)
        .merge(ConsentProcessingOfPersonalDataSchema)
    )
    .output(z.void())
    .mutation(async ({ ctx, input }) => {
      const { randomString, captchaText, commandName, format, participants } =
        input
      validateCaptchaOrThrowTRPCError(randomString, captchaText)
      const register = await ctx.prisma.register.create({
        data: {
          commandName,
          format:
            format === 'online' || format === 'онлайн' ? 'online' : 'offline',
          fingerprint: ctx.fingerprint,
        },
      })

      await ctx.prisma.participant.createMany({
        data: participants.map(participant => {
          return {
            ...participant,
            registerId: register.id,
          }
        }),
      })
    }),
  get: adminProcedure
    .meta({ openapi: { method: 'GET', path: `${PREFIX}/get`, protect: true } })
    .input(VoidSchema)
    .output(
      z.object({
        registered: z.array(
          z.object({
            commandName: z.string(),
            createdAt: z.date(),
            updatedAt: z.date(),
            answered: z.boolean(),
            fingerprint: z.string(),
            id: z.number(),
            format: z.enum(['online', 'offline']),
            participants: z.array(
              z.object({
                dateOfBirth: z.date(),
                email: z.string(),
                firstName: z.string(),
                id: z.number(),
                lastName: z.string(),
                middleName: z.string().nullable(),
                organization: z.string(),
                phoneNumber: z.string(),
                specialization: z.enum([
                  'frontend',
                  'backend',
                  'devops',
                  'techlead',
                  'uxui',
                ]),
                stack: z.string(),
              })
            ),
          })
        ),
        count: z.number(),
      })
    )
    .query(async ({ ctx }) => {
      const registered = await ctx.prisma.register.findMany({
        include: { participants: true },
      })
      return { registered, count: registered.length }
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
      await ctx.prisma.register.delete({ where: { id: input.id } })
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
    .output(
      z.object({
        unsuccessfulEmails: z.array(z.string()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, text, csrfToken } = input
      checkCsrf(ctx.adminCsrfToken, csrfToken)
      const register = await ctx.prisma.register.findUnique({
        where: { id },
        include: { participants: true },
      })
      if (!register) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Запись не найдена!',
        })
      }
      const unsuccessfulEmails: string[] = []
      for (const participant of register.participants) {
        const status = await sendMail({
          to: participant.email,
          subject: 'Участие в хакатоне',
          html: text,
        })
        if (status !== 'ok') {
          unsuccessfulEmails.push(participant.email)
        }
      }
      if (unsuccessfulEmails.length === register.participants.length) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Не удалось отправить email ни одному из списка!',
        })
      }
      await ctx.prisma.register.update({
        where: { id },
        data: { answered: true },
      })
      return { unsuccessfulEmails }
    }),
})
