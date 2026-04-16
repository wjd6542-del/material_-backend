import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";

export default {
  /**
   * 감사 로그 리스트
   * - status (SUCCESS/FAIL)
   * - search_field: 'target_type' | 'ip' 화이트리스트 기반 부분 매칭
   * - 기간 필터 (created_at)
   * - action: CREATE/UPDATE/DELETE/VIEW/LOGIN/LOGOUT 화이트리스트
   * @param {Object} data
   */
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
