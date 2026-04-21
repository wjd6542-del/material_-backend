import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";

export default {
  /**
   * 알림 리스트 (id/type/action 필터, user 조인, 최신순)
   */
  async getList(data, user) {
    const where = {};

    if (data?.id) {
      where.id = Number(data.id);
    }

    // 타입별 리스트 출력
    if (data?.type) {
      where.type = data.type;
    }

    if (data?.action) {
      where.action = data.action;
    }

    return prisma.notification.findMany({
      where,
      include: {
        user: true,
      },
      orderBy: { created_at: "desc" },
    });
  },

  /** 알림 단건 읽음 처리 (is_read=true, read_at=now) */
  async read(data, user) {
    return await prisma.notification.update({
      where: { id: data.id },
      data: { is_read: true, read_at: new Date() },
    });
  },

  /** 현재 사용자의 미읽음 알림을 모두 읽음 처리 */
  async readAll(data, user) {
    return await prisma.notification.updateMany({
      where: { user_id: user.id, is_read: false },
      data: { is_read: true, read_at: new Date() },
    });
  },

  /** 현재 사용자의 미읽음 알림 건수 (헤더 배지용) */
  async count(data, user) {
    return prisma.notification.count({
      where: {
        user_id: user.id,
        is_read: false,
      },
    });
  },

  /**
   * 미읽음 알림을 NotificationType 별로 집계
   * (고정 키 INBOUND/OUTBOUND/MATERIAL/RETURNORDER/PURCHASEORDER 초기값 0 보장)
   */
  async countByType(data, user) {
    const rows = await prisma.notification.groupBy({
      by: ["type"],
      where: {
        is_read: false,
      },
      _count: {
        type: true,
      },
    });

    const result = {
      INBOUND: 0,
      OUTBOUND: 0,
      MATERIAL: 0,
      RETURNORDER: 0,
      PURCHASEORDER: 0,
    };

    rows.forEach((r) => {
      result[r.type] = r._count.type;
    });

    return result;
  },

  /** 알림 단건 삭제 */
  async deleteById(id) {
    if (!id) {
      throw new AppError("ID가 필요합니다.", 400, "INVALID_ID");
    }

    return await prisma.$transaction(async (tx) => {
      // 4️⃣ 게시물 삭제
      await tx.notification.delete({
        where: { id },
      });
      return { success: true };
    });
  },

  /** 알림 일괄 삭제 */
  async batchDelete(data = [], user) {
    if (!data.length) {
      throw new AppError("요청데이터가 없습니다.", 400, "NOT_FOUND_DATA");
    }

    const results = await Promise.all(
      data.map((row, idx) =>
        this.deleteById(row.id).catch(() => {
          throw new AppError(
            `${idx + 1} 번째 데이터 삭제 실패`,
            400,
            "BATCH_DELETE_FAILED",
          );
        }),
      ),
    );
    return results;
  },

  /** 알림 일괄 읽음 처리 */
  async batchRead(data = [], user) {
    if (!data.length) {
      throw new AppError("요청데이터가 없습니다.", 400, "NOT_FOUND_DATA");
    }

    const results = await Promise.all(
      data.map((row, idx) =>
        this.read(row, user).catch(() => {
          throw new AppError(
            `${idx + 1} 번째 데이터 읽기 실패`,
            400,
            "BATCH_DELETE_FAILED",
          );
        }),
      ),
    );
    return results;
  },
};
