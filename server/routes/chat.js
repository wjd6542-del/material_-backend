import chatService from "../services/chat.service.js";
import { validate } from "../plugins/validator.plugin.js";
import {
  ensurePublicRoomSchema,
  dmSchema,
  roomIdSchema,
  roomRefSchema,
  messagesSchema,
  usersSchema,
  deleteMessageSchema,
  addMembersSchema,
} from "../validators/chat.schema.js";

/**
 * 채팅(Chat) 라우트 (/api/chat/*)
 * 하이브리드 구조: 이력/목록/검색은 REST, 실시간 송수신은 Socket.io
 */
export default async function chatRoutes(app) {
  /** 전체 공지방 보장 + 자동 참여 @route POST /api/chat/public/ensure */
  app.post("/public/ensure", async (req) => {
    const body = validate(ensurePublicRoomSchema, req.body);
    return chatService.ensurePublicRoom(body, req.user);
  });

  /** DM 방 생성/조회 @route POST /api/chat/dm */
  app.post("/dm", async (req) => {
    const body = validate(dmSchema, req.body);
    return chatService.getOrCreateDmRoom(body, req.user);
  });

  /** 내 채팅방 목록 @route POST /api/chat/rooms */
  app.post("/rooms", async (req) => {
    return chatService.getMyRooms(req.body, req.user);
  });

  /** 채팅방 단건 조회 @route POST /api/chat/room */
  app.post("/room", async (req) => {
    const body = validate(roomIdSchema, req.body);
    return chatService.getRoom(body, req.user);
  });

  /** 메시지 이력 @route POST /api/chat/messages */
  app.post("/messages", async (req) => {
    const body = validate(messagesSchema, req.body);
    return chatService.getMessages(body, req.user);
  });

  /** 읽음 처리 @route POST /api/chat/read */
  app.post("/read", async (req) => {
    const body = validate(roomRefSchema, req.body);
    return chatService.markRead(body, req.user);
  });

  /** 전체 미읽음 건수 (헤더 배지) @route POST /api/chat/unreadCount */
  app.post("/unreadCount", async (req) => {
    return chatService.unreadCount(req.body, req.user);
  });

  /** 방 나가기 (DM 제외) @route POST /api/chat/leave */
  app.post("/leave", async (req) => {
    const body = validate(roomRefSchema, req.body);
    return chatService.leaveRoom(body, req.user);
  });

  /** DM 대상 유저 목록 @route POST /api/chat/users */
  app.post("/users", async (req) => {
    const body = validate(usersSchema, req.body);
    return chatService.listChattableUsers(body, req.user);
  });

  /** 메시지 삭제 (본인 또는 관리자) @route POST /api/chat/message/delete */
  app.post("/message/delete", async (req) => {
    const body = validate(deleteMessageSchema, req.body);
    return chatService.deleteMessage(body, req.user);
  });

  /** 방에 멤버 초대 (다건, 방 멤버 누구나 가능) @route POST /api/chat/room/members/add */
  app.post("/room/members/add", async (req) => {
    const body = validate(addMembersSchema, req.body);
    return chatService.addMembersToRoom(body, req.user);
  });
}
