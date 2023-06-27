import { PrismaClient } from '@prisma/client'
import { env } from './env.js'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.isProd ? ['error'] : ['error', 'warn', 'query'],
  })

export * from '@prisma/client'

if (env.isDev) {
  globalForPrisma.prisma = prisma
}
