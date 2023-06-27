import { z } from 'zod'
import { createTRPCRouter, publicProcedure } from '../lib/trpc.js'
import {
  format,
  isSameMonth,
  isSameYear,
  isSameDay,
  differenceInSeconds,
  intervalToDuration,
  formatDuration,
} from 'date-fns'
import ru from 'date-fns/locale/ru/index.js'
import { VoidSchema } from '../schemas/index.js'

const PREFIX = '/info'

function formatDateRange(start: Date, end: Date) {
  const sameDay = isSameDay(start, end)
  const sameMonth = isSameMonth(start, end)
  const sameYear = isSameYear(start, end)

  if (sameDay && sameMonth && sameYear) {
    return format(start, 'd MMMM yyyyг', { locale: ru })
  }

  if (sameMonth && sameYear) {
    return `${format(start, 'd', { locale: ru })} - ${format(end, 'd', {
      locale: ru,
    })} ${format(start, 'MMMM yyyyг', { locale: ru })}`
  }

  return ''
}

function formatToTwoDigits(number?: number | undefined) {
  if (!number || isNaN(number)) {
    return '00'
  }
  return number < 10 ? `0${number}` : number.toString()
}

export const infoRouter = createTRPCRouter({
  eventDate: publicProcedure
    .meta({ openapi: { method: 'GET', path: `${PREFIX}/eventDate` } })
    .input(VoidSchema)
    .output(
      z.object({
        start: z.date(),
        end: z.date(),
        startAsString: z.string(),
        endAsString: z.string(),
        rangeAsString: z.string(),
        timeLeft: z.object({
          months: z.number(),
          days: z.number(),
          hours: z.number(),
          minutes: z.number(),
          seconds: z.number(),
          monthsAsString: z.string(),
          daysAsString: z.string(),
          hoursAsString: z.string(),
          minutesAsString: z.string(),
          secondsAsString: z.string(),
        }),
        timeLeftAsFullString: z.string(),
      })
    )
    .query(async ({ ctx }) => {
      const { dateStart: start, dateEnd: end } =
        await ctx.prisma.info.findUniqueOrThrow({ where: { id: 0 } })

      const timeRemainingInSeconds = differenceInSeconds(start, new Date())
      const duration = intervalToDuration({
        start: 0,
        end: timeRemainingInSeconds * 1000,
      })

      return {
        start,
        end,
        startAsString: format(start, 'd MMMM yyyyг', { locale: ru }),
        endAsString: format(end, 'd MMMM yyyyг', { locale: ru }),
        rangeAsString: formatDateRange(start, end),
        timeLeft: {
          months: duration.months ?? 0,
          days: duration.days ?? 0,
          hours: duration.hours ?? 0,
          minutes: duration.minutes ?? 0,
          seconds: duration.seconds ?? 0,
          monthsAsString: (duration.months ?? 0).toString(),
          daysAsString: (duration.days ?? 0).toString(),
          hoursAsString: formatToTwoDigits(duration.hours),
          minutesAsString: formatToTwoDigits(duration.minutes),
          secondsAsString: formatToTwoDigits(duration.seconds),
        },
        timeLeftAsFullString: formatDuration(duration, { locale: ru }),
      }
    }),
  eventPlace: publicProcedure
    .meta({ openapi: { method: 'GET', path: `${PREFIX}/eventPlace` } })
    .input(VoidSchema)
    .output(
      z.object({
        address: z.string(),
        city: z.string(),
        latitude: z.number(),
        longitude: z.number(),
        latitudeAsString: z.string(),
        longitudeAsString: z.string(),
      })
    )
    .query(async ({ ctx }) => {
      const { address, city, latitude, longitude } =
        await ctx.prisma.info.findUniqueOrThrow({ where: { id: 0 } })

      return {
        address,
        city,
        latitude,
        longitude,
        latitudeAsString: latitude.toString(),
        longitudeAsString: longitude.toString(),
      }
    }),
  schedule: publicProcedure
    .meta({ openapi: { method: 'GET', path: `${PREFIX}/schedule` } })
    .input(VoidSchema)
    .output(
      z.array(
        z.object({
          day: z.date(),
          dayNumber: z.number(),
          dayAsString: z.string(),
          sections: z.array(
            z.object({
              time: z.date(),
              timeAsString: z.string(),
              timeRangeAsString: z.string(),
              name: z.string(),
            })
          ),
        })
      )
    )
    .query(async ({ ctx }) => {
      const { scheduleDays } = await ctx.prisma.info.findUniqueOrThrow({
        where: { id: 0 },
        select: {
          scheduleDays: {
            select: {
              sections: { select: { name: true, time: true } },
              day: true,
            },
          },
        },
      })

      return scheduleDays.map((schedule, i) => {
        return {
          day: schedule.day,
          dayAsString: format(schedule.day, 'd MMMM yyyyг', { locale: ru }),
          dayNumber: i + 1,
          sections: schedule.sections.map((section, i, arr) => {
            const nextElem = arr[i + 1]
            const timeRangeAsString = `${format(section.time, 'HH:mm', {
              locale: ru,
            })} ${nextElem ? '-' : ''} ${
              nextElem ? format(nextElem.time, 'HH:mm', { locale: ru }) : ''
            }`.trimEnd()
            return {
              ...section,
              timeAsString: format(section.time, 'd MMMM yyyyг HH:mm', {
                locale: ru,
              }),
              timeRangeAsString,
            }
          }),
        }
      })
    }),
})
