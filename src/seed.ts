import { PrismaClient } from '@prisma/client'
import { createAdmin } from './commonServices/createAdmin.js'

const prisma = new PrismaClient()

async function createScheduleDaySections(
  id: string,
  values: { name: string; time: Date }[]
) {
  for (const { name, time } of values) {
    await prisma.scheduleDaySection.create({
      data: {
        name,
        time,
        scheduleDayId: id,
      },
    })
  }
}

async function createInfo() {
  const info = await prisma.info.create({
    data: {
      address: 'Площадь Гагарина, 1 к7',
      city: 'Ростов-на-Дону',
      latitude: 47.2383,
      longitude: 39.71168,
      dateStart: new Date(2023, 8, 3),
      dateEnd: new Date(2023, 8, 5),
    },
  })

  for (const day of [
    new Date(2023, 8, 3),
    new Date(2023, 8, 4),
    new Date(2023, 8, 5),
  ]) {
    const scheduleDay = await prisma.scheduleDay.create({
      data: {
        day,
        infoId: info.id,
      },
    })

    const date = day.getDate()

    switch (date) {
      case 3:
        await createScheduleDaySections(scheduleDay.id, [
          { name: 'Регистрация участников', time: new Date(2023, 8, 3, 9, 0) },
          {
            name: 'Открытие хакатона, приветствие организаторов',
            time: new Date(2023, 8, 3, 10, 0),
          },
          {
            name: 'Представление технических заданий и правил хакатона',
            time: new Date(2023, 8, 3, 10, 30),
          },
          {
            name: 'Командообразование и начало работы',
            time: new Date(2023, 8, 3, 11, 0),
          },
          { name: 'Обед', time: new Date(2023, 8, 3, 13, 0) },
          {
            name: 'Менторская поддержка и консультации',
            time: new Date(2023, 8, 3, 14, 0),
          },
        ])
        break
      case 4:
        await createScheduleDaySections(scheduleDay.id, [
          {
            name: 'Завтрак и продолжение работы',
            time: new Date(2023, 8, 4, 9, 0),
          },
          {
            name: 'Мастер-классы и технические лекции',
            time: new Date(2023, 8, 4, 10, 0),
          },
          {
            name: 'Обед',
            time: new Date(2023, 8, 4, 12, 0),
          },
          {
            name: 'Продолжение работы и менторская поддержка',
            time: new Date(2023, 8, 4, 13, 0),
          },
          {
            name: 'Ужин и неформальное общение',
            time: new Date(2023, 8, 4, 19, 0),
          },
        ])
        break
      case 5:
        await createScheduleDaySections(scheduleDay.id, [
          {
            name: 'Завтрак и продолжение работы',
            time: new Date(2023, 8, 5, 9, 0),
          },
          {
            name: 'Подготовка презентаций и финальных проектов',
            time: new Date(2023, 8, 5, 11, 0),
          },
          {
            name: 'Обед',
            time: new Date(2023, 8, 5, 13, 0),
          },
          {
            name: 'Подготовка к питч-сессии и оформление презентаций',
            time: new Date(2023, 8, 5, 15, 0),
          },
          {
            name: 'Питч-сессия технических кейсов',
            time: new Date(2023, 8, 5, 16, 0),
          },
          {
            name: 'Заключительное слово и награждение победителей',
            time: new Date(2023, 8, 5, 17, 30),
          },
          {
            name: 'Фотографирование и торжественное закрытие хакатона',
            time: new Date(2023, 8, 5, 18, 0),
          },
        ])
        break
      default:
        throw new Error(`Day ${date} is not valid`)
    }
  }
}

async function createNewAdmin() {
  const { login, password } = await createAdmin(prisma)
  console.info('Login was created while seeding - ', login)
  console.info('Password was created while seeding - ', password)
}

async function main() {
  await createInfo()
  await createNewAdmin()
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async e => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
