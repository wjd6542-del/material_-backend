import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";
import chatService from "../services/chat.service.js";

/**
 * 채팅 소켓 핸들러
 *
 * 룸 구조:
 * - user:{userId}  → 각 사용자 전용 (멀티 탭, 배지 업데이트용)
 * - chat:{roomId}  → 특정 채팅방을 현재 보고 있는 클라이언트 (읽음 이벤트 브로드캐스트용)
 *
 * 이벤트:
 *   C→S: room:join, room:leave, message:send, message:read
 *   S→C: message:new, message:read, chat:error
 */
export function attachChatSocket(io) {
  /**
   * JWT 인증 미들웨어 (연결 시 1회)
   * 토큰은 socket.handshake.auth.token 또는 Authorization 헤더로 전달
   */
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace("Bearer ", "");

      if (!token) return next(new Error("NO_TOKEN"));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      socket.user = {
        id: decoded.userId,
        username: decoded.username,
        is_super: decoded.is_super,
      };
      next();
    } catch (e) {
      next(new Error("INVALID_TOKEN"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.user.id;

    // 개인 룸 자동 참여 (다른 방에서도 배지 업데이트 받기 위함)
    socket.join(`user:${userId}`);

    /**
     * 방 구독: 현재 이 방을 보고 있음을 등록
     * - 멤버십 검증 후 chat:{roomId} 룸 참여
     */
    socket.on("room:join", async (payload, ack) => {
      try {
        const roomId = Number(payload?.room_id);
        if (!roomId) throw new Error("INVALID_ROOM_ID");

        await chatService.assertMember(roomId, userId);
        socket.join(`chat:${roomId}`);

        ack?.({ success: true });
      } catch (e) {
        ack?.({ success: false, error: e.code || e.message || "JOIN_FAILED" });
      }
    });

    /** 방 구독 해제 (멤버십은 유지, 소켓 브로드캐스트만 해제) */
    socket.on("room:leave", (payload, ack) => {
      const roomId = Number(payload?.room_id);
      if (roomId) socket.leave(`chat:${roomId}`);
      ack?.({ success: true });
    });

    /**
     * 메시지 전송
     * 1) DB 저장 (service)
     * 2) 방 멤버 전원의 개인 룸에 message:new 브로드캐스트 → 관람 여부와 무관하게 배지 업데이트 가능
     */
    socket.on("message:send", async (payload, ack) => {
      try {
        const roomId = Number(payload?.room_id);
        const content = payload?.content;

        const message = await chatService.sendMessage(
          { room_id: roomId, content },
          socket.user,
        );

        const members = await prisma.chatRoomMember.findMany({
          where: { room_id: roomId },
          select: { user_id: true },
        });

        for (const m of members) {
          io.to(`user:${m.user_id}`).emit("message:new", { message });
        }

        ack?.({ success: true, message });
      } catch (e) {
        ack?.({
          success: false,
          error: e.errorCode || e.code || e.message || "SEND_FAILED",
        });
      }
    });

    /**
     * 방에 멤버 초대 (다건)
     * - 권한: 방 멤버이면 누구나 (service.addMembersToRoom 에서 assertMember)
     * - 기존 멤버 + 신규 추가자 모두에게 room:member:added 브로드캐스트
     *   (신규 초대자는 방 목록/배지 갱신용, 기존 멤버는 참여자 리스트 갱신용)
     */
    socket.on("room:member:add", async (payload, ack) => {
      try {
        const roomId = Number(payload?.room_id);
        const userIds = Array.isArray(payload?.user_ids) ? payload.user_ids : [];

        const result = await chatService.addMembersToRoom(
          { room_id: roomId, user_ids: userIds },
          socket.user,
        );

        // 브로드캐스트 대상: 추가 후 방의 전체 멤버 (기존 + 신규)
        const members = await prisma.chatRoomMember.findMany({
          where: { room_id: roomId },
          select: { user_id: true },
        });

        const eventPayload = {
          room_id: roomId,
          added: result.added,           // [{ user_id, user: { id, name, username } }]
          invited_by: socket.user.id,
        };

        for (const m of members) {
          io.to(`user:${m.user_id}`).emit("room:member:added", eventPayload);
        }

        ack?.({ success: true, ...result });
      } catch (e) {
        ack?.({
          success: false,
          error: e.errorCode || e.code || e.message || "ADD_MEMBER_FAILED",
        });
      }
    });

    /**
     * 메시지 삭제 (soft delete)
     * - 권한 검증은 service.deleteMessage 에서 수행 (본인/관리자만)
     * - 방 멤버 전원의 개인 룸에 message:deleted 브로드캐스트
     */
    socket.on("message:delete", async (payload, ack) => {
      try {
        const messageId = Number(payload?.message_id);
        const updated = await chatService.deleteMessage(
          { message_id: messageId },
          socket.user,
        );

        const members = await prisma.chatRoomMember.findMany({
          where: { room_id: updated.room_id },
          select: { user_id: true },
        });

        const eventPayload = {
          message_id: updated.id,
          room_id: updated.room_id,
          deleted_at: updated.deleted_at,
          deleted_by: updated.deleted_by,
        };

        for (const m of members) {
          io.to(`user:${m.user_id}`).emit("message:deleted", eventPayload);
        }

        ack?.({ success: true });
      } catch (e) {
        ack?.({
          success: false,
          error: e.errorCode || e.code || e.message || "DELETE_FAILED",
        });
      }
    });

    /**
     * 읽음 처리
     * - 본인 last_read_at 갱신
     * - 해당 방을 현재 보고 있는 멤버들에게 message:read 브로드캐스트 (상대 읽음 표시용)
     */
    socket.on("message:read", async (payload, ack) => {
      try {
        const roomId = Number(payload?.room_id);
        const res = await chatService.markRead(
          { room_id: roomId },
          socket.user,
        );

        io.to(`chat:${roomId}`).emit("message:read", {
          user_id: userId,
          room_id: roomId,
          last_read_at: res.last_read_at,
        });

        ack?.({ success: true });
      } catch (e) {
        ack?.({ success: false, error: e.code || e.message || "READ_FAILED" });
      }
    });
  });

  io.engine.on("connection_error", (err) => {
    // 인증 실패 등 연결 단계 에러 로깅
    console.error("[socket] connection_error:", err.code, err.message);
  });
}
