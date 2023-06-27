import { z } from 'zod'
import { createCaptcha } from '../lib/captcha.js'
import { createTRPCRouter, rateLimitProcedure } from '../lib/trpc.js'
import { VoidSchema } from '../schemas/index.js'

const PREFIX = '/captcha'

export const captchaRouter = createTRPCRouter({
  get: rateLimitProcedure
    .meta({ openapi: { method: 'GET', path: `${PREFIX}/get` } })
    .input(VoidSchema)
    .output(
      z.object({
        randomString: z.string(),
        imageUrl: z.string(),
        audioUrl: z.string(),
      })
    )
    .query(() => {
      return createCaptcha()
    }),
})
