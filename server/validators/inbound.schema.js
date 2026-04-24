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
  supplier_id: z.coerce.number().int().min(1, "거래처를 선택해야 합니다."),
  warehouse_id: z.coerce.number().int().min(1, "창고를 선택해야 합니다."),
  location_id: z.coerce.number().int().min(1, "창고위치를 선택해야 합니다."),
  shelf_id: z.coerce.number().int().min(1, "선반을 선택해야 합니다."),
  quantity: z.coerce.number().int().min(1, "수량은 1 이상이어야 합니다."),
  price: z.coerce.number().min(1, "금액은 1 이상이어야 합니다."),
  supply_amount: z.coerce.number().min(1, "금액은 1 이상이어야 합니다."),
  vat: z.coerce.number().min(0).optional(),
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
  supplier_id: z.coerce.number().int().positive().optional().nullable(),
  purchase_date: z.coerce.date().optional().nullable(),
  vat_applied: z.coerce.boolean().optional(),
  is_unpaid: z.coerce.boolean().optional(),
  memo: z.string().trim(),
  items: z.array(itemsSchema),
});

export const batchSaveSchema = z
  .array(saveSchema)
  .min(1, "저장할 데이터가 없습니다.");

export const batchDeleteSchema = z
  .array(idParamSchema)
  .min(1, "삭제할 데이터가 없습니다.");
