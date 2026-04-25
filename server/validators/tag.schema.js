import { z } from "zod";

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const tagNodeSchema = z.object({
  id: z.coerce
    .number()
    .optional()
    .transform((val) => {
      if (val === undefined) return undefined;
      return val < 0 ? 0 : val;
    }),
  name: z.string().trim().min(1, "태그명을 1자 이상 입력해주세요"),
  sort: z.coerce.number().optional(),
});

export const saveSchema = tagNodeSchema;

export const batchSaveSchema = z
  .array(tagNodeSchema)
  .min(1, "저장할 데이터가 없습니다.");

export const batchDeleteSchema = z
  .array(
    z.object({
      id: z.coerce.number().int().positive(),
    }),
  )
  .min(1, "삭제할 데이터가 없습니다.");

// 품목-태그 연결 스키마
export const materialTagLinkSchema = z.object({
  material_id: z.coerce.number().int().positive(),
  tag_ids: z.array(z.coerce.number().int().positive()).default([]),
});
