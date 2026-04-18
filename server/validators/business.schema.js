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
  registration_no: z
    .string()
    .trim()
    .min(1, "사업자등록번호를 입력해주세요.")
    .max(20),
  company_name: z.string().trim().min(1, "회사명을 입력해주세요.").max(200),
  ceo_name: z.string().trim().min(1, "대표명을 입력해주세요.").max(100),
  zipcode: z.string().trim().max(500).nullable().optional(),
  address: z.string().trim().max(500).nullable().optional(),
  address_detail: z.string().trim().max(500).nullable().optional(),
  phone: z.string().trim().max(50).nullable().optional(),
  mobile: z.string().trim().max(50).nullable().optional(),
  fax: z.string().trim().max(50).nullable().optional(),
});

export const batchSaveSchema = z
  .array(saveSchema)
  .min(1, "저장할 데이터가 없습니다.");

export const batchDeleteSchema = z
  .array(idParamSchema)
  .min(1, "삭제할 데이터가 없습니다.");
