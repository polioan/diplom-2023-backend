import { z } from 'zod'

export const ConsentProcessingOfPersonalDataSchema = z.object({
  consentProcessingOfPersonalData: z.literal(true, {
    errorMap: () => ({
      message: 'Не дано согласие на обработку данных!',
    }),
  }),
})
