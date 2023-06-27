import crypto from 'node:crypto'
import argon2 from 'argon2'
import type { PrismaClient } from '@prisma/client'

function randomStr(length = 12) {
  const characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&()-_=+[{]};,.'
  let str = ''

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length)
    str += characters.charAt(randomIndex)
  }

  return str
}

export async function createAdmin(prisma: PrismaClient) {
  const login = randomStr()
  const password = randomStr()
  const salt = crypto.randomBytes(16)
  const hashedPassword = await argon2.hash(password, { salt })
  await prisma.admin.create({
    data: { login, password: hashedPassword },
  })
  return { login, password } as const
}
