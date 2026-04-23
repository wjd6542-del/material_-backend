import { z } from "zod";

export const saveSchema = z.object({
  id: z.coerce
    .number()
    .optional()
    .transform((val) => {
      if (val === undefined) return undefined;
      return val < 0 ? 0 : val;
    }),
  outbound_rate1: z.coerce.number().min(0).optional(),
  outbound_rate2: z.coerce.number().min(0).optional(),
  wholesale_rate1: z.coerce.number().min(0).optional(),
  wholesale_rate2: z.coerce.number().min(0).optional(),
  online_rate: z.coerce.number().min(0).optional(),
});

export const historyListSchema = z.object({
  beforeId: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});
