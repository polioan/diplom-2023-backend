import z from 'zod'
import { TRPCError, adminProcedure, createTRPCRouter } from '../lib/trpc.js'
import type { NoUndefinedField } from '../types/helpers.js'
import { CsrfSchema } from '../schemas/index.js'
import { checkCsrf } from '../lib/authToken.js'

const PREFIX = '/content'

function areDatesInOrder(dates: Date[]) {
  return dates.every((date, i) => {
    if (i > 0) {
      return date > dates[i - 1]!
    }
    return true
  })
}

export const contentRouter = createTRPCRouter({
  changeCommon: adminProcedure
    .meta({
      openapi: {
        method: 'PATCH',
        path: `${PREFIX}/changeCommon`,
        protect: true,
      },
    })
    .input(
      z
        .object({
          address: z
            .string({
              invalid_type_error: 'Адрес не является строкой!',
              required_error: 'Адрес не указан!',
            })
            .min(5, { message: 'Адрес слишком короткий!' })
            .max(50, { message: 'Адрес слишком длинный!' })
            .optional(),
          city: z
            .string({
              invalid_type_error: 'Город не является строкой!',
              required_error: 'Город не указан!',
            })
            .min(3, { message: 'Город слишком короткий!' })
            .max(50, { message: 'Город слишком длинный!' })
            .optional(),
          dateStart: z
            .date({
              invalid_type_error: 'Неверная дата!',
              required_error: 'Дата не указана!',
            })
            .optional(),
          dateEnd: z
            .date({
              invalid_type_error: 'Неверная дата!',
              required_error: 'Дата не указана!',
            })
            .optional(),
          latitude: z
            .number({
              invalid_type_error: 'Неверная широта!',
              required_error: 'Широта не указана!',
            })
            .optional(),
          longitude: z
            .number({
              invalid_type_error: 'Неверная долгота!',
              required_error: 'Долгота не указана!',
            })
            .optional(),
        })
        .merge(CsrfSchema)
    )
    .output(z.void())
    .mutation(async ({ ctx, input }) => {
      const { csrfToken, ...rest } = input
      checkCsrf(ctx.adminCsrfToken, csrfToken)
      await ctx.prisma.info.update({
        where: { id: 0 },
        data: rest as NoUndefinedField<typeof rest>,
      })
    }),
  changeSchedule: adminProcedure
    .meta({
      openapi: {
        method: 'PUT',
        path: `${PREFIX}/changeSchedule`,
        protect: true,
      },
    })
    .input(
      z
        .object({
          days: z
            .array(
              z.object({
                sections: z
                  .array(
                    z.object(
                      {
                        time: z.date({
                          invalid_type_error: 'Неверное время!',
                          required_error: 'Время не введено!',
                        }),
                        name: z.string({
                          required_error: 'Описание не введено!',
                          invalid_type_error: 'Описание должно быть строкой!',
                        }),
                      },
                      {
                        required_error: 'Секция не введена!',
                        invalid_type_error: 'Секция неверная!',
                      }
                    ),
                    {
                      required_error: 'Секции дня не введены!',
                      invalid_type_error: 'Секции дня сформированы неверно!',
                    }
                  )
                  .min(2, { message: 'Должно быть хотя бы 2 секции!' })
                  .max(65, { message: 'Слишком много секций!' }),
              }),
              {
                required_error: 'Дни не введены!',
                invalid_type_error: 'Дни сформированы неверно!',
              }
            )
            .min(1, { message: 'Должен быть хотя бы один день!' })
            .max(20, { message: 'Слишком много дней!' }),
        })
        .merge(CsrfSchema)
    )
    .output(z.void())
    .mutation(async ({ ctx, input }) => {
      const { csrfToken, days } = input
      checkCsrf(ctx.adminCsrfToken, csrfToken)

      const allDates: Date[] = []
      days.forEach(day => {
        day.sections.forEach(section => {
          allDates.push(section.time)
        })
      })
      if (!areDatesInOrder(allDates)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Дни идут не по порядку!',
        })
      }

      await ctx.prisma.scheduleDay.deleteMany()
      for (const { sections } of days) {
        const firstDay = sections[0]?.time!
        const firstDayClamped = new Date(
          firstDay.getFullYear(),
          firstDay.getMonth(),
          firstDay.getDate()
        )
        const scheduleDay = await ctx.prisma.scheduleDay.create({
          data: {
            day: firstDayClamped,
            infoId: 0,
          },
        })
        for (const { name, time } of sections) {
          if (
            time.getFullYear() !== firstDayClamped.getFullYear() ||
            time.getMonth() !== firstDayClamped.getMonth() ||
            time.getDate() !== firstDayClamped.getDate()
          ) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Неправильные дни в секции!',
            })
          }
          await ctx.prisma.scheduleDaySection.create({
            data: {
              name,
              time,
              scheduleDayId: scheduleDay.id,
            },
          })
        }
      }
    }),
})
