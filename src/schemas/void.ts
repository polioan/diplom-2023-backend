import { z } from 'zod'

export const VoidSchema = z.void({
  invalid_type_error: 'Ожидался пустой ввод',
  required_error: 'Ожидался пустой ввод',
})
