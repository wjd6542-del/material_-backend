import { z } from "zod";

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const saveSchema = z.object({
  id: z.coerce
    .number()
    .optional()
    .transform((val) => {
      if (val === undefined) return undefined;
      return val < 0 ? 0 : val;
    }),
  location_id: z.coerce.number().optional(),
  code: z.string().trim(),
  name: z.string().trim().nullable().optional(),
  x: z.coerce.number().default(0),
  y: z.coerce.number().default(0),
  width: z.coerce.number().default(0),
  height: z.coerce.number().default(0),
  sort: z.coerce.number().optional(),
});

export const batchSaveSchema = z
  .array(saveSchema)
  .min(1, "저장할 데이터가 없습니다.");

export const batchDeleteSchema = z
  .array(idParamSchema)
  .min(1, "삭제할 데이터가 없습니다.");
