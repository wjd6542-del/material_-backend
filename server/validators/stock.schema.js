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
  code: z.string().trim(),
  name: z.string().trim(),
  location: z.string().trim(),
  memo: z.string().trim(),
  sort: z.coerce.number().optional(),
});

export const batchSaveSchema = z
  .array(saveSchema)
  .min(1, "저장할 데이터가 없습니다.");

export const batchDeleteSchema = z
  .array(saveSchema)
  .min(1, "삭제할 데이터가 없습니다.");
