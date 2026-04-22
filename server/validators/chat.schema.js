import { z } from "zod";

export const ensurePublicRoomSchema = z.object({
  name: z.string().trim().max(100).optional(),
});

export const dmSchema = z.object({
  target_user_id: z.coerce
    .number()
    .int()
    .min(1, "대상 사용자 ID가 필요합니다."),
});

export const roomIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const roomRefSchema = z.object({
  room_id: z.coerce.number().int().positive(),
});

export const messagesSchema = z.object({
  room_id: z.coerce.number().int().positive(),
  beforeId: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export const sendMessageSchema = z.object({
  room_id: z.coerce.number().int().positive(),
  content: z.string().trim().min(1, "내용이 비어 있습니다.").max(2000),
});

export const usersSchema = z.object({
  keyword: z.string().trim().optional(),
});

export const deleteMessageSchema = z.object({
  message_id: z.coerce.number().int().positive(),
});

export const addMembersSchema = z.object({
  room_id: z.coerce.number().int().positive(),
  user_ids: z
    .array(z.coerce.number().int().positive())
    .min(1, "추가할 사용자를 선택해주세요."),
});
