import { z } from "zod";

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

/** 가격 6종 + 비율 5종 공통 필드 (저장/수정 스키마에서 재사용) */
const priceFields = {
  inbound_price: z.coerce.number().min(0).optional(),
  outbound_price1: z.coerce.number().min(0).optional(),
  outbound_price2: z.coerce.number().min(0).optional(),
  wholesale_price1: z.coerce.number().min(0).optional(),
  wholesale_price2: z.coerce.number().min(0).optional(),
  online_price: z.coerce.number().min(0).optional(),
  outbound_rate1: z.coerce.number().min(0).optional(),
  outbound_rate2: z.coerce.number().min(0).optional(),
  wholesale_rate1: z.coerce.number().min(0).optional(),
  wholesale_rate2: z.coerce.number().min(0).optional(),
  online_rate: z.coerce.number().min(0).optional(),
};

export const priceHistoryListSchema = z.object({
  material_id: z.coerce.number().int().positive(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  beforeId: z.coerce.number().int().positive().optional(),
});

export const saveSchema = z.object({
  id: z.coerce.number().optional(),

  name: z
    .string({
      required_error: "품목명을 입력해주세요.",
      invalid_type_error: "품목명이 올바르지 않습니다.",
    })
    .trim()
    .min(1, "품목명은 1자 이상 입력해주세요.")
    .max(200, "품목명은 100자 이하로 입력해주세요."),

  category_id: z.coerce.number({
    required_error: "카테고리를 선택해주세요.",
    invalid_type_error: "카테고리 형식이 올바르지 않습니다.",
  }),

  code: z
    .string({
      required_error: "품목코드를 입력해주세요.",
      invalid_type_error: "품목코드이 올바르지 않습니다.",
    })
    .trim()
    .min(1, "품목코드는 1자 이상 입력해주세요.")
    .max(200, "품목코드는 100자 이하로 입력해주세요."),

  spec: z.coerce.string().optional(),
  unit: z.coerce.string().optional(),
  memo: z.coerce.string().optional(),
  is_active: z.coerce.boolean().optional(),
  safety_stock: z.coerce.number().optional(),

  ...priceFields,

  tag_ids: z
    .union([z.array(z.coerce.number().int().positive()), z.string()])
    .optional()
    .transform((val) => {
      if (val === undefined) return undefined;
      if (Array.isArray(val)) return val.map(Number);
      try {
        const parsed = JSON.parse(val);
        return Array.isArray(parsed) ? parsed.map(Number) : [];
      } catch {
        return [];
      }
    }),
});

export const updateSchema = z.object({
  id: z.coerce.number().positive("수정 대상 ID가 필요합니다."),

  name: z
    .string({
      required_error: "품목명을 입력해주세요.",
      invalid_type_error: "품목명이 올바르지 않습니다.",
    })
    .trim()
    .min(1, "품목명은 1자 이상 입력해주세요.")
    .max(200, "품목명은 100자 이하로 입력해주세요."),

  category_id: z.coerce.number({
    required_error: "카테고리를 선택해주세요.",
    invalid_type_error: "카테고리 형식이 올바르지 않습니다.",
  }),

  code: z
    .string({
      required_error: "품목코드를 입력해주세요.",
      invalid_type_error: "품목코드이 올바르지 않습니다.",
    })
    .trim()
    .min(1, "품목코드는 1자 이상 입력해주세요.")
    .max(200, "품목코드는 100자 이하로 입력해주세요."),

  spec: z.coerce.string().optional(),
  unit: z.coerce.string().optional(),
  memo: z.coerce.string().optional(),
  is_active: z.coerce.boolean().optional(),
  safety_stock: z.coerce.number().optional(),

  ...priceFields,

  deleteImageIds: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return [];
      try {
        return JSON.parse(val);
      } catch {
        return [];
      }
    }),

  tag_ids: z
    .union([z.array(z.coerce.number().int().positive()), z.string()])
    .optional()
    .transform((val) => {
      if (val === undefined) return undefined;
      if (Array.isArray(val)) return val.map(Number);
      try {
        const parsed = JSON.parse(val);
        return Array.isArray(parsed) ? parsed.map(Number) : [];
      } catch {
        return [];
      }
    }),
});

export const batchDeleteSchema = z
  .array(idParamSchema)
  .min(1, "삭제할 데이터가 없습니다.");

/** 단가 일괄조정 — 품목별 조정된 가격 6종(부분 가능). 비율은 서버에서 재계산하므로 받지 않음 */
const batchPriceItemFields = {
  inbound_price: z.coerce.number().min(0).optional(),
  outbound_price1: z.coerce.number().min(0).optional(),
  outbound_price2: z.coerce.number().min(0).optional(),
  wholesale_price1: z.coerce.number().min(0).optional(),
  wholesale_price2: z.coerce.number().min(0).optional(),
  online_price: z.coerce.number().min(0).optional(),
};

export const batchUpdatePriceSchema = z.object({
  // 가격 변동 이력(MaterialPriceHistory.reason)에 기록될 사유 (선택)
  reason: z.string().trim().max(255).optional(),
  items: z
    .array(
      z.object({
        id: z.coerce.number().int().positive(),
        ...batchPriceItemFields,
      }),
    )
    .min(1, "조정할 품목이 없습니다.")
    .max(2000, "한 번에 최대 2000건까지 조정할 수 있습니다."),
});
