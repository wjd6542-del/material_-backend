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

export const transferSchema = z.object({
  material_id: z.coerce.number().positive("품목 정보가 올바르지 않습니다."),
  from_location_id: z.coerce.number().positive("출발지 정보가 누락되었습니다."),
  to_location_id: z.coerce.number().positive("도착지를 선택해 주세요."),
  quantity: z.coerce.number().positive("이동 수량은 1개 이상이어야 합니다."),
});

export const batchSaveSchema = z
  .array(saveSchema)
  .min(1, "저장할 데이터가 없습니다.");

export const batchDeleteSchema = z
  .array(saveSchema)
  .min(1, "삭제할 데이터가 없습니다.");
