import { z } from 'zod'

export const CsrfSchema = z.object({
  csrfToken: z.string().optional(),
})
