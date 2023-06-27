import express from 'express'
import cors from 'cors'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createExpressMiddleware } from '@trpc/server/adapters/express'
import {
  createOpenApiExpressMiddleware,
  generateOpenApiDocument,
} from 'trpc-openapi'
import { createTRPCContext, createTRPCRouter } from './lib/trpc.js'
import swaggerUI from 'swagger-ui-express'
import fingerprint from 'express-fingerprint'
import cookieParser from 'cookie-parser'
import { env } from './lib/env.js'
import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server'
// routers
import { infoRouter } from './routers/info.js'
import { adminRouter } from './routers/admin.js'
import { contentRouter } from './routers/content.js'
import { feedbackRouter } from './routers/feedback.js'
import { captchaRouter } from './routers/captcha.js'
import { applicationsRouter } from './routers/applications.js'

const expressApp = express()

expressApp.use(cors({ origin: env.isDev ? '*' : env('CORS_URLS') }))
expressApp.use(express.json())
expressApp.disable('x-powered-by')
expressApp.use(cookieParser(env('COOKIE_SECRET')))
expressApp.use(
  (fingerprint as unknown as (...args: any[]) => any)({
    parameters: [
      (fingerprint as any).useragent,
      (fingerprint as any).acceptHeaders,
      (fingerprint as any).geoip,
    ],
  })
)

global.__filename = fileURLToPath(import.meta.url)
global.__dirname = path.dirname(__filename)

export const appRouter = createTRPCRouter({
  info: infoRouter,
  admin: adminRouter,
  content: contentRouter,
  feedback: feedbackRouter,
  captcha: captchaRouter,
  applications: applicationsRouter,
})

export type AppRouter = typeof appRouter

export type RouterInputs = inferRouterInputs<AppRouter>

export type RouterOutputs = inferRouterOutputs<AppRouter>

expressApp.use(
  '/api/trpc',
  createExpressMiddleware({
    router: appRouter,
    createContext: createTRPCContext,
    onError: env.isProd
      ? undefined!
      : ({ path, error }) => {
          console.error(
            `tRPC failed on ${path ?? '<no-path>'}: ${error.message}`
          )
        },
  })
)

expressApp.use(
  '/api',
  createOpenApiExpressMiddleware({
    router: appRouter,
    createContext: createTRPCContext,
    onError: env.isProd
      ? undefined!
      : () => {
          console.error('tRPC failed while using openapi')
        },
    responseMeta: undefined!,
    maxBodySize: undefined!,
  })
)

const openApiDocument = generateOpenApiDocument(appRouter, {
  title: 'sp-hack API',
  version: '1.0.1',
  baseUrl: `${env('BASE_URL')}/api`,
})

expressApp.use('/api-docs', swaggerUI.serve)
expressApp.get('/api-docs', swaggerUI.setup(openApiDocument))
expressApp.get('/openapi.json', (_, res) => {
  res.status(200).json(openApiDocument)
})

expressApp.use(
  '/',
  express.static(path.join(__dirname, '..', '..', 'frontend', 'dist'))
)
expressApp.get('*', (_, res) => {
  res.sendFile(
    path.join(__dirname, '..', '..', 'frontend', 'dist', 'index.html')
  )
})

async function start() {
  await new Promise<void>(resolve => expressApp.listen(env('PORT'), resolve))
}

start()
  .then(() => console.log(`Server ready at port ${env('PORT')}`))
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
