import { z } from 'zod'

export const CaptchaSchema = z.object({
  captchaText: z.string({
    required_error: 'Текст капчи не введен!',
    invalid_type_error: 'Текст капчи не является текстом!',
  }),
  randomString: z.string({
    required_error: 'Секрет капчи не найден!',
    invalid_type_error: 'Секрет капчи не является текстом!',
  }),
})
