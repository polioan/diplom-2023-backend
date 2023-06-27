import { z } from 'zod'

export const EmailSchema = z.object({
  email: z
    .string({
      invalid_type_error: 'Email не является строкой!',
      required_error: 'Email не указан!',
    })
    .email({ message: 'Неверный email!' }),
})
