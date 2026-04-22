import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";

/**
 * 채팅 서비스
 * - PUBLIC: 전체 공지방 (모든 직원 공용, 자동 참여)
 * - DM:     1:1 개인 메시지 (쌍 중복 방지를 위해 dm_key 사용)
 *
 * 소켓 핸들러가 이 서비스의 메서드를 호출해 DB 반영 → 실시간 브로드캐스트 수행
 */
export default {
  /**
   * DM 쌍 식별 키 생성 (작은 id 먼저)
   * @param {number} a
   * @param {number} b
   */
  dmKey(a, b) {
    const [x, y] = a < b ? [a, b] : [b, a];
    return `${x}_${y}`;
  },

  /**
   * 삭제된 메시지는 content 를 빈 문자열로 마스킹하여 반환
   * (프론트는 is_deleted 플래그로 "삭제된 메시지입니다" 표시)
   * @template {{is_deleted?: boolean, content?: string}} T
   * @param {T} msg
   * @returns {T}
   */
  maskIfDeleted(msg) {
    if (!msg) return msg;
    if (msg.is_deleted) {
      return { ...msg, content: "" };
    }
    return msg;
  },

  /**
   * 사용자 멤버십 검증 (없으면 throw)
   * @param {number} roomId
   * @param {number} userId
   */
  async assertMember(roomId, userId) {
    const member = await prisma.chatRoomMember.findUnique({
      where: { room_id_user_id: { room_id: roomId, user_id: userId } },
    });
    if (!member) {
      throw new AppError("채팅방 참여자가 아닙니다.", 403, "NOT_A_MEMBER");
    }
    return member;
  },

  /**
   * 전체 공지방 보장 (없으면 생성, 호출 사용자 자동 참여)
   * - 기본 dm_key=null, 이름 지정 가능 (default: "전체 공지방")
   * @param {{name?: string}} data
   * @param {{id: number}} user
   */
  async ensurePublicRoom(data, user) {
    const name = data?.name?.trim() || "전체 공지방";

    let room = await prisma.chatRoom.findFirst({
      where: { type: "PUBLIC", name },
    });

    if (!room) {
      room = await prisma.chatRoom.create({
        data: { type: "PUBLIC", name },
      });
    }

    await prisma.chatRoomMember.upsert({
      where: {
        room_id_user_id: { room_id: room.id, user_id: user.id },
      },
      update: {},
      create: { room_id: room.id, user_id: user.id },
    });

    return room;
  },

  /**
   * DM 방 get-or-create (두 사용자 자동 참여)
   * @param {{target_user_id: number}} data
   * @param {{id: number}} user
   */
  async getOrCreateDmRoom(data, user) {
    const target = Number(data?.target_user_id);
    if (!target) {
      throw new AppError("대상 사용자 ID가 필요합니다.", 400, "INVALID_USER");
    }
    if (target === user.id) {
      throw new AppError(
        "본인과는 DM 을 생성할 수 없습니다.",
        400,
        "SELF_DM_NOT_ALLOWED",
      );
    }

    const exists = await prisma.user.findUnique({ where: { id: target } });
    if (!exists) {
      throw new AppError("대상 사용자가 없습니다.", 404, "USER_NOT_FOUND");
    }

    const key = this.dmKey(user.id, target);

    let room = await prisma.chatRoom.findUnique({ where: { dm_key: key } });

    if (!room) {
      room = await prisma.$transaction(async (tx) => {
        const created = await tx.chatRoom.create({
          data: { type: "DM", dm_key: key },
        });
        await tx.chatRoomMember.createMany({
          data: [
            { room_id: created.id, user_id: user.id },
            { room_id: created.id, user_id: target },
          ],
        });
        return created;
      });
    }

    return room;
  },

  /**
   * 내 채팅방 리스트 (마지막 메시지 + 미읽음 건수 + DM 상대 정보 포함)
   * @param {Object} data
   * @param {{id: number}} user
   */
  async getMyRooms(data, user) {
    const members = await prisma.chatRoomMember.findMany({
      where: { user_id: user.id },
      include: {
        room: {
          include: {
            members: {
              include: {
                user: {
                  select: { id: true, name: true, username: true },
                },
              },
            },
            messages: {
              orderBy: { created_at: "desc" },
              take: 1,
              include: {
                sender: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    const rows = await Promise.all(
      members.map(async (m) => {
        const { room, last_read_at } = m;

        // 미읽음 수: 내가 last_read_at 이후 + 내가 보낸 건 제외
        const unread = await prisma.chatMessage.count({
          where: {
            room_id: room.id,
            sender_id: { not: user.id },
            created_at: last_read_at ? { gt: last_read_at } : undefined,
          },
        });

        // DM 상대 추출
        const peer =
          room.type === "DM"
            ? room.members.find((x) => x.user_id !== user.id)?.user ?? null
            : null;

        const last = room.messages[0] ?? null;

        return {
          id: room.id,
          type: room.type,
          name: room.type === "DM" ? peer?.name ?? "" : room.name ?? "",
          dm_key: room.dm_key,
          peer,
          last_message: last
            ? {
                id: last.id,
                content: last.is_deleted ? "" : last.content,
                sender_id: last.sender_id,
                sender_name: last.sender?.name ?? "",
                created_at: last.created_at,
                is_deleted: last.is_deleted,
              }
            : null,
          last_read_at,
          unread,
          updated_at: room.updated_at,
        };
      }),
    );

    // 마지막 메시지 최신순 정렬 (없으면 updated_at 기준)
    rows.sort((a, b) => {
      const ta =
        a.last_message?.created_at?.getTime?.() ?? a.updated_at.getTime();
      const tb =
        b.last_message?.created_at?.getTime?.() ?? b.updated_at.getTime();
      return tb - ta;
    });

    return rows;
  },

  /**
   * 채팅방 단건 정보 조회 (참여자 포함)
   * @param {{id: number}} data
   * @param {{id: number}} user
   */
  async getRoom(data, user) {
    const id = Number(data?.id);
    if (!id) throw new AppError("ID가 필요합니다.", 400, "INVALID_ID");

    await this.assertMember(id, user.id);

    const room = await prisma.chatRoom.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, username: true } },
          },
        },
      },
    });

    if (!room) {
      throw new AppError("채팅방이 없습니다.", 404, "ROOM_NOT_FOUND");
    }

    return room;
  },

  /**
   * 메시지 이력 조회 (역방향 페이지네이션)
   * - beforeId 없으면 최신부터 limit 건
   * - beforeId 있으면 해당 메시지 이전의 limit 건 (오래된 메시지 불러오기)
   * - 반환: 오래된 → 최신 순으로 정렬된 배열
   * @param {{room_id: number, beforeId?: number, limit?: number}} data
   * @param {{id: number}} user
   */
  async getMessages(data, user) {
    const roomId = Number(data?.room_id);
    if (!roomId) throw new AppError("room_id 가 필요합니다.", 400, "INVALID_ID");

    await this.assertMember(roomId, user.id);

    const limit = Math.min(Math.max(Number(data?.limit) || 50, 1), 200);
    const beforeId = data?.beforeId ? Number(data.beforeId) : undefined;

    const rows = await prisma.chatMessage.findMany({
      where: {
        room_id: roomId,
        ...(beforeId ? { id: { lt: beforeId } } : {}),
      },
      include: {
        sender: { select: { id: true, name: true, username: true } },
      },
      orderBy: { id: "desc" },
      take: limit,
    });

    return rows.reverse().map((r) => this.maskIfDeleted(r));
  },

  /**
   * 메시지 전송 (DB 저장) — 소켓 핸들러가 호출 후 브로드캐스트
   * @param {{room_id: number, content: string}} data
   * @param {{id: number}} user
   */
  async sendMessage(data, user) {
    const roomId = Number(data?.room_id);
    const content = (data?.content ?? "").toString().trim();

    if (!roomId) throw new AppError("room_id 가 필요합니다.", 400, "INVALID_ID");
    if (!content) throw new AppError("내용이 비어 있습니다.", 400, "EMPTY_CONTENT");
    if (content.length > 2000) {
      throw new AppError("2000자 이내로 입력해주세요.", 400, "CONTENT_TOO_LONG");
    }

    await this.assertMember(roomId, user.id);

    return prisma.$transaction(async (tx) => {
      const msg = await tx.chatMessage.create({
        data: {
          room_id: roomId,
          sender_id: user.id,
          content,
        },
        include: {
          sender: { select: { id: true, name: true, username: true } },
        },
      });

      // 방 updated_at 갱신 → 리스트 정렬용
      await tx.chatRoom.update({
        where: { id: roomId },
        data: { updated_at: new Date() },
      });

      // 보낸 사람은 자동으로 읽음 처리
      await tx.chatRoomMember.update({
        where: { room_id_user_id: { room_id: roomId, user_id: user.id } },
        data: { last_read_at: new Date() },
      });

      return msg;
    });
  },

  /**
   * 메시지 소프트 삭제
   * - 권한: 본인이 보낸 메시지 또는 is_super(관리자)
   * - is_deleted=true, deleted_at=now, deleted_by=user.id
   * - content 는 DB 에 그대로 유지 (감사/복구용), 응답 시 마스킹 처리
   * - 이미 삭제된 메시지는 "ALREADY_DELETED" 반환
   * @param {{message_id: number}} data
   * @param {{id: number, is_super?: boolean}} user
   * @returns 마스킹된 메시지 객체 (sender 포함)
   */
  async deleteMessage(data, user) {
    const messageId = Number(data?.message_id);
    if (!messageId) {
      throw new AppError("message_id 가 필요합니다.", 400, "INVALID_ID");
    }

    const msg = await prisma.chatMessage.findUnique({
      where: { id: messageId },
    });
    if (!msg) {
      throw new AppError("메시지가 없습니다.", 404, "MESSAGE_NOT_FOUND");
    }
    if (msg.is_deleted) {
      throw new AppError(
        "이미 삭제된 메시지입니다.",
        400,
        "ALREADY_DELETED",
      );
    }

    const isOwner = msg.sender_id === user.id;
    const isAdmin = !!user.is_super;
    if (!isOwner && !isAdmin) {
      throw new AppError(
        "삭제 권한이 없습니다.",
        403,
        "DELETE_FORBIDDEN",
      );
    }

    const updated = await prisma.chatMessage.update({
      where: { id: messageId },
      data: {
        is_deleted: true,
        deleted_at: new Date(),
        deleted_by: user.id,
      },
      include: {
        sender: { select: { id: true, name: true, username: true } },
      },
    });

    return this.maskIfDeleted(updated);
  },

  /**
   * 읽음 처리 (last_read_at = now)
   * @param {{room_id: number}} data
   * @param {{id: number}} user
   */
  async markRead(data, user) {
    const roomId = Number(data?.room_id);
    if (!roomId) throw new AppError("room_id 가 필요합니다.", 400, "INVALID_ID");

    await this.assertMember(roomId, user.id);

    return prisma.chatRoomMember.update({
      where: { room_id_user_id: { room_id: roomId, user_id: user.id } },
      data: { last_read_at: new Date() },
    });
  },

  /**
   * 전체 미읽음 건수 (헤더 배지용)
   * - 내가 속한 방들의 last_read_at 이후, 내가 보낸 건 제외
   * @param {Object} data
   * @param {{id: number}} user
   */
  async unreadCount(data, user) {
    const members = await prisma.chatRoomMember.findMany({
      where: { user_id: user.id },
      select: { room_id: true, last_read_at: true },
    });

    if (!members.length) return 0;

    const counts = await Promise.all(
      members.map((m) =>
        prisma.chatMessage.count({
          where: {
            room_id: m.room_id,
            sender_id: { not: user.id },
            created_at: m.last_read_at ? { gt: m.last_read_at } : undefined,
          },
        }),
      ),
    );

    return counts.reduce((a, b) => a + b, 0);
  },

  /**
   * 방에 사용자 초대 (다건)
   * - 권한: 방 멤버이면 누구나 가능 (assertMember 로 검증)
   * - DM 방은 초대 금지 (쌍 구조 유지)
   * - 이미 참여 중인 사용자는 스킵 (에러 아님)
   * - 존재하지 않거나 비활성 사용자는 제외하고 진행, 최종 추가된 목록만 반환
   * @param {{room_id: number, user_ids: number[]}} data
   * @param {{id: number}} user
   * @returns {{room_id: number, added: Array<{user_id, user}>, skipped: Array<{user_id, reason}>}}
   */
  async addMembersToRoom(data, user) {
    const roomId = Number(data?.room_id);
    const rawIds = Array.isArray(data?.user_ids) ? data.user_ids : [];
    if (!roomId) {
      throw new AppError("room_id 가 필요합니다.", 400, "INVALID_ID");
    }
    if (!rawIds.length) {
      throw new AppError(
        "추가할 사용자 ID가 없습니다.",
        400,
        "NO_USER_IDS",
      );
    }

    // 호출자 멤버십 검증
    await this.assertMember(roomId, user.id);

    const room = await prisma.chatRoom.findUnique({ where: { id: roomId } });
    if (!room) {
      throw new AppError("채팅방이 없습니다.", 404, "ROOM_NOT_FOUND");
    }
    if (room.type === "DM") {
      throw new AppError(
        "DM 방에는 멤버를 추가할 수 없습니다.",
        400,
        "DM_INVITE_FORBIDDEN",
      );
    }

    const userIds = [...new Set(rawIds.map((v) => Number(v)).filter(Boolean))];

    // 유효한 활성 사용자만 필터링
    const users = await prisma.user.findMany({
      where: { id: { in: userIds }, is_active: true },
      select: { id: true, name: true, username: true },
    });
    const validIds = new Set(users.map((u) => u.id));

    // 이미 멤버인 사용자 조회
    const existing = await prisma.chatRoomMember.findMany({
      where: { room_id: roomId, user_id: { in: userIds } },
      select: { user_id: true },
    });
    const existingIds = new Set(existing.map((e) => e.user_id));

    const toInsert = users.filter((u) => !existingIds.has(u.id));
    const skipped = [];

    for (const id of userIds) {
      if (!validIds.has(id)) {
        skipped.push({ user_id: id, reason: "USER_NOT_FOUND_OR_INACTIVE" });
      } else if (existingIds.has(id)) {
        skipped.push({ user_id: id, reason: "ALREADY_MEMBER" });
      }
    }

    if (toInsert.length) {
      await prisma.chatRoomMember.createMany({
        data: toInsert.map((u) => ({ room_id: roomId, user_id: u.id })),
        skipDuplicates: true,
      });
    }

    return {
      room_id: roomId,
      added: toInsert.map((u) => ({ user_id: u.id, user: u })),
      skipped,
    };
  },

  /**
   * 방 나가기 (PUBLIC 은 멤버십만 해제, DM 은 방 자체 유지)
   * @param {{room_id: number}} data
   * @param {{id: number}} user
   */
  async leaveRoom(data, user) {
    const roomId = Number(data?.room_id);
    if (!roomId) throw new AppError("room_id 가 필요합니다.", 400, "INVALID_ID");

    const member = await prisma.chatRoomMember.findUnique({
      where: { room_id_user_id: { room_id: roomId, user_id: user.id } },
      include: { room: true },
    });
    if (!member) {
      throw new AppError("참여 중이 아닙니다.", 404, "NOT_A_MEMBER");
    }

    if (member.room.type === "DM") {
      throw new AppError("DM 방은 나갈 수 없습니다.", 400, "DM_LEAVE_FORBIDDEN");
    }

    await prisma.chatRoomMember.delete({
      where: { room_id_user_id: { room_id: roomId, user_id: user.id } },
    });

    return { success: true };
  },

  /**
   * 대화 가능한 사용자 목록 (DM 상대 선택용)
   * - is_active 유저, 본인 제외
   * @param {{keyword?: string}} data
   * @param {{id: number}} user
   */
  async listChattableUsers(data, user) {
    const keyword = data?.keyword?.trim();

    return prisma.user.findMany({
      where: {
        is_active: true,
        id: { not: user.id },
        ...(keyword
          ? {
              OR: [
                { name: { contains: keyword } },
                { username: { contains: keyword } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        username: true,
        code: true,
      },
      orderBy: { name: "asc" },
    });
  },
};
