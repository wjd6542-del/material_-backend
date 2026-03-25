import { z } from "zod";

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const itemsSchema = z.object({
  id: z.coerce
    .number()
    .optional()
    .transform((val) => {
      if (val === undefined) return undefined;
      return val < 0 ? 0 : val;
    }),
  material_id: z.coerce.number().int().min(1, "자재를 선택해야 합니다."),
  //supplier_id: z.coerce.number().int().min(1, "거래처를 선택해야 합니다."),
  warehouse_id: z.coerce.number().int().min(1, "창고를 선택해야 합니다."),
  location_id: z.coerce.number().int().min(1, "창고위치를 선택해야 합니다."),
  quantity: z.coerce.number().int().min(1, "수량은 1 이상이어야 합니다."),
  unit_price: z.coerce.number().min(1, "금액은 1 이상이어야 합니다."),
});

export const saveSchema = z.object({
  id: z.coerce
    .number()
    .optional()
    .transform((val) => {
      if (val === undefined) return undefined;
      return val < 0 ? 0 : val;
    }),
  inbound_no: z.string().trim(),
  memo: z.string().trim(),
  items: z.array(itemsSchema),
});

export const batchSaveSchema = z
  .array(saveSchema)
  .min(1, "저장할 데이터가 없습니다.");

export const batchDeleteSchema = z
  .array(idParamSchema)
  .min(1, "삭제할 데이터가 없습니다.");
