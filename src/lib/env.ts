import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config()

const EnvSchema = z.object({
  NODE_ENV: z.enum(['production', 'development', 'seed']),
  PORT: z.coerce.number().int().positive().default(5000),
  DATABASE_URL: z.string().url(),
  BASE_URL: z.string().url(),
  CORS_URLS: z.string().transform(str => {
    const arr = JSON.parse(str)
    return z.array(z.string().url()).parse(arr)
  }),
  RATE_LIMIT: z.coerce.number().int().positive(),
  RATE_LIMIT_TIME: z.coerce.number().int().positive(),
  COOKIE_SECRET: z.string(),
  JWT_SECRET: z.string(),
  CAPTCHAS_CLIENT: z.string(),
  CAPTCHAS_SECRET: z.string(),
  EMAIL_USER: z.string(),
  EMAIL_PASSWORD: z.string(),
  EMAIL_HOST: z.string(),
  EMAIL_PORT: z.coerce.number().int().positive(),
  ALLOW_FORBIDDEN: z.coerce.boolean(),
})

const parsed = EnvSchema.parse(process.env)

export function env<T extends keyof typeof parsed>(key: T) {
  return parsed[key]
}

env.isProd = parsed.NODE_ENV === 'production'
env.isDev = parsed.NODE_ENV === 'development'
