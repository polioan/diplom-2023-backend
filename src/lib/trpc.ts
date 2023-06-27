import { TRPCError, initTRPC } from '@trpc/server'
import type { OpenApiMeta } from 'trpc-openapi'
import type { CreateExpressContextOptions } from '@trpc/server/adapters/express'
import superjson from 'superjson'
import { ZodError } from 'zod'
import { prisma } from './prisma.js'
import { v4 as uuid } from 'uuid'
import { extractTokenFromExpressReq } from './authToken.js'
import { env } from './env.js'

export { TRPCError } from '@trpc/server'

export class MetaError extends Error {
  constructor(
    message?: string | undefined,
    public metaMessage?: string | undefined,
    options?: ErrorOptions | undefined
  ) {
    super(message, options)
  }
}

function createInnerTRPCContext(
  opts: CreateExpressContextOptions & {
    requestId: string
    fingerprint: string
    isClient: boolean
  }
) {
  return {
    ...opts,
    prisma,
  }
}

export async function createTRPCContext(opts: CreateExpressContextOptions) {
  const requestId = uuid()
  opts.res.setHeader('x-request-id', requestId)
  const fingerprint = opts.req.fingerprint?.hash ?? 'none'
  const isClient = typeof opts.req.headers['x-client-trpc'] === 'string'
  return createInnerTRPCContext({ ...opts, requestId, fingerprint, isClient })
}

function toMessage(error: TRPCError) {
  if (error.code === 'INTERNAL_SERVER_ERROR') {
    return 'Неизвестная ошибка!'
  }
  if (error.cause instanceof ZodError) {
    return error.cause.issues[0]?.message ?? 'Неверный ввод!'
  }
  if (error.cause instanceof Error) {
    return error.cause.message
  }
  return error.message
}

const t = initTRPC
  .context<typeof createTRPCContext>()
  .meta<OpenApiMeta>()
  .create({
    transformer: superjson,
    errorFormatter({ shape, error }) {
      return {
        ...shape,
        data: {
          ...shape.data,
          zodError:
            error.cause instanceof ZodError ? error.cause.flatten() : null,
          meta: {
            adminUnauthorized:
              error.cause instanceof MetaError &&
              error.cause.metaMessage === 'ADMIN_UNAUTHORIZED',
          },
        },
        message: toMessage(error),
      }
    },
  })

export const createTRPCRouter = t.router

const clientMiddleware = t.middleware(({ ctx, next }) => {
  if (!ctx.isClient && env.isProd) {
    throw new TRPCError({
      code: 'NOT_FOUND',
    })
  }
  return next({
    ctx: {
      isClient: true as const,
    },
  })
})

class RateLimitStorage {
  static limit = env('RATE_LIMIT')
  static limitTime = env('RATE_LIMIT_TIME')

  constructor(private storage = new Map<string, number>()) {
    setInterval(() => this.storage.clear(), RateLimitStorage.limitTime)
  }

  public isLimitExceeded(hash: string) {
    const value = this.storage.get(hash)
    if (value === undefined) {
      this.storage.set(hash, 1)
      return false
    } else {
      this.storage.set(hash, value + 1)
      return value >= RateLimitStorage.limit
    }
  }
}

const rateLimitStorage = new RateLimitStorage()

const rateLimitMiddleware = t.middleware(({ ctx, next }) => {
  if (rateLimitStorage.isLimitExceeded(ctx.fingerprint)) {
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: 'Слишком много запросов!',
    })
  }
  return next()
})

const adminMiddleware = t.middleware(({ ctx, next }) => {
  const admin = extractTokenFromExpressReq(ctx.req)
  if (!admin) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Нет авторизации!',
      cause: new MetaError(undefined, 'ADMIN_UNAUTHORIZED'),
    })
  }
  return next({ ctx: { adminId: admin.id, adminCsrfToken: admin.csrfToken } })
})

const forbiddenMiddleware = t.middleware(({ next }) => {
  if (!env('ALLOW_FORBIDDEN')) {
    throw new TRPCError({
      code: 'NOT_FOUND',
    })
  }
  return next()
})

export const publicProcedure = t.procedure.use(clientMiddleware)

export const rateLimitProcedure = t.procedure
  .use(clientMiddleware)
  .use(rateLimitMiddleware)

export const adminProcedure = t.procedure
  .use(clientMiddleware)
  .use(rateLimitMiddleware)
  .use(adminMiddleware)

export const forbiddenProcedure = t.procedure
  .use(clientMiddleware)
  .use(rateLimitMiddleware)
  .use(forbiddenMiddleware)
