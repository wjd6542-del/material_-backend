import { z } from "zod";

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

// 저장 처리
export const saveSchema = z.object({
  id: z.coerce.number().int().optional(),
  code: z.string().trim(),
  name: z.string().trim(),
  memo: z.string().trim().nullable().optional(),
  sort: z.coerce.number().int().default(0),
  points: z.array(z.any()).nullable().optional(),
  rotation: z.coerce.number().default(0),
  color: z.string().trim().nullable().optional(),
});

export const batchSaveSchema = z
  .array(saveSchema)
  .min(1, "저장할 데이터가 없습니다.");

export const batchDeleteSchema = z
  .array(idParamSchema)
  .min(1, "삭제할 데이터가 없습니다.");
