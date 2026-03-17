import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";

export default {
  // 필터링 적용 리스트
  async getList(data) {
    const where = {};

    // 권한검색
    if (data.user) {
      where.role_id = data.role_id;
    }

    // 권한 검색
    if (data.keyword) {
      where.OR = [
        {
          username: {
            contains: data.keyword,
          },
        },
        {
          name: {
            contains: data.keyword,
          },
        },
      ];
    }

    // 날짜 검색
    if (data.startDate && data.endDate) {
      where.updated_at = {
        gte: new Date(data.startDate),
        lte: new Date(data.endDate),
      };
    }

    const rows = await prisma.user.findMany({
      where,
      include: {
        role: true,
      },
      orderBy: { updated_at: "asc" },
    });

    return rows.map((row) => ({
      ...row,
      role_name: row.role?.name ?? "",
      role_description: row.role?.description ?? "",
    }));
  },

  async getById(id) {
    if (!id) throw new AppError("ID가 필요합니다.", 400, "INVALID_ID");

    const item = await prisma.user.findUnique({ where: { id } });
    if (!item) {
      throw new AppError("존재하지 않는 정보입니다.", 404, "NOT_FOUND");
    }
    return item;
  },
};
