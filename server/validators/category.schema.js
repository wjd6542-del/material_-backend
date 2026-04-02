import { z } from "zod";

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const categoryNodeSchema = z.lazy(() =>
  z.object({
    id: z.coerce
      .number()
      .optional()
      .transform((val) => {
        if (val === undefined) return undefined;
        return val < 0 ? 0 : val;
      }),
    name: z.string().trim().min(1, "text는 1자 이상 입력해주세요"),
    code: z.string().trim(),
    sort: z.coerce.number().optional(),
    parentId: z.coerce.number().nullable().optional(),
    path: z.string().optional(),
    depth: z.coerce.number().optional(),
    isNew: z.coerce.boolean(),
    children: z.array(categoryNodeSchema).optional().default([]),
  }),
);

export const saveSchema = categoryNodeSchema;

export const batchSaveSchema = z
  .array(categoryNodeSchema)
  .min(1, "저장할 데이터가 없습니다.");

export const batchDeleteSchema = z
  .array(saveSchema)
  .min(1, "삭제할 데이터가 없습니다.");
