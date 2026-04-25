import { z } from "zod";

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

/**
 * 프론트 전송 기준 유효성 검사
 * - material_id: 품목 PK (프론트 모달에서 선택되어 넘어옴, 필수)
 * - material_code / material_name / spec: 표시용 (서버 저장 시 무시)
 * - supply_amount / vat: 프론트 계산값이나 서버에서 재계산해 덮어씀
 * - memo: 적요 (DB 컬럼은 remark)
 */
export const itemsSchema = z.object({
  id: z.coerce
    .number()
    .optional()
    .transform((val) => {
      if (val === undefined) return undefined;
      return val < 0 ? 0 : val;
    }),
  material_id: z.coerce.number().int().min(1, "품목를 선택해야 합니다."),
  material_code: z.string().trim().optional(),
  material_name: z.string().trim().optional(),
  spec: z.string().trim().optional().nullable(),
  quantity: z.coerce.number().int().min(1, "수량은 1 이상이어야 합니다."),
  price: z.coerce.number().min(0, "단가는 0 이상이어야 합니다."),
  supply_amount: z.coerce.number().min(0).optional(),
  vat: z.coerce.number().min(0).optional(),
  memo: z.string().trim().optional().nullable(),
});

export const saveSchema = z.object({
  id: z.coerce
    .number()
    .optional()
    .transform((val) => {
      if (val === undefined) return undefined;
      return val < 0 ? 0 : val;
    }),
  order_no: z.string().trim().optional(),
  supplier_id: z.coerce.number().int().min(1, "거래처를 선택해야 합니다."),
  order_date: z.coerce.date().optional().nullable(),
  delivery_date: z.coerce.date().optional().nullable(),
  status: z
    .enum(["draft", "ordered", "received", "canceled"])
    .default("draft"),
  vat_applied: z.coerce.boolean().default(true),
  memo: z.string().trim().optional().nullable(),
  items: z.array(itemsSchema).min(1, "발주 품목이 없습니다."),
});

export const batchDeleteSchema = z
  .array(idParamSchema)
  .min(1, "삭제할 데이터가 없습니다.");
