import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";

export default {
  // 필터링 적용 리스트
  async getList(data) {
    const where = {};

    if (data.status) {
      where.status = data.status;
    }

    const allowFields = ["target_type", "ip"];
    if (allowFields.includes(data.search_field) && data.search_text) {
      where[data.search_field] = {
        contains: data.search_text,
      };
    }

    // 날짜 검색
    if (data.startDate && data.endDate) {
      where.created_at = {
        gte: new Date(data.startDate),
        lte: new Date(data.endDate),
      };
    }

    const actoin_check = [
      "CREATE",
      "UPDATE",
      "DELETE",
      "VIEW",
      "LOGIN",
      "LOGOUT",
    ];

    if (data.action && actoin_check.includes(data.action)) {
      where.action = data.action;
    }

    return prisma.auditLog.findMany({
      where,
      orderBy: { created_at: "desc" },
    });
  },
};
