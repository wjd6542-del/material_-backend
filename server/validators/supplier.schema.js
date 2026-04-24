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
  name: z.string().trim(),
  type: z.enum(["INBOUND", "OUTBOUND"]).optional(),
  registration_no: z.string().trim().max(20).nullable().optional(),
  phone: z.string().trim(),
  mobile: z.string().trim().max(50).nullable().optional(),
  fax: z.string().trim().max(50).nullable().optional(),
  email: z.string().trim(),
  account_no: z.string().trim().max(50).nullable().optional(),
  memo: z.string().trim(),
  zipcode: z.string().trim().max(500).nullable().optional(),
  address: z.string().trim().max(500).nullable().optional(),
  address_detail: z.string().trim().max(500).nullable().optional(),
  receivable: z.coerce.number().min(0).optional(),
  payable: z.coerce.number().min(0).optional(),
  sort: z.coerce.number().optional(),
});

export const historyListSchema = z.object({
  supplier_id: z.coerce.number().int().positive(),
  beforeId: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export const batchSaveSchema = z
  .array(saveSchema)
  .min(1, "저장할 데이터가 없습니다.");

export const batchDeleteSchema = z
  .array(saveSchema)
  .min(1, "삭제할 데이터가 없습니다.");
