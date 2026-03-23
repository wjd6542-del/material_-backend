import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";

export default {
  // 필터링 적용 리스트
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

  // 알람 읽기 처리
  async read(data, user) {
    return await prisma.notification.update({
      where: { id: data.id },
      data: { is_read: true, read_at: new Date() },
    });
  },

  // 알림 전체 읽기 처리
  async readAll(data, user) {
    return await prisma.notification.updateMany({
      where: { user_id: user.id, is_read: false },
      data: { is_read: true, read_at: new Date() },
    });
  },

  // 카운트 정보
  async count(data, user) {
    return prisma.notification.count({
      where: {
        user_id: user.id,
        is_read: false,
      },
    });
  },

  // 읽지 않은 그룹 카운트
  async countByType(data, user) {
    const rows = await prisma.notification.groupBy({
      by: ["type"],
      where: {
        user_id: user.id,
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
    };

    rows.forEach((r) => {
      result[r.type] = r._count.type;
    });

    return result;
  },

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

  // 일괄 삭제
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
};
