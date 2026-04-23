import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";

/** 이력 추적 대상 요율 컬럼 (Material 의 요율 컬럼명과 일치) */
const RATE_FIELDS = [
  "outbound_rate1",
  "outbound_rate2",
  "wholesale_rate1",
  "wholesale_rate2",
  "online_rate",
];

/** 객체에서 요율 5종만 추출해 숫자로 정규화 */
function pickRates(obj) {
  const out = {};
  for (const k of RATE_FIELDS) {
    out[k] = Number(obj?.[k] ?? 0);
  }
  return out;
}

/** 두 스냅샷 비교 */
function ratesDiffer(before, after) {
  return RATE_FIELDS.some((k) => before[k] !== after[k]);
}

export default {
  /**
   * 자재 요율 공통 설정 조회 (싱글톤)
   * - 없으면 null 반환 (프론트에서 기본값으로 초기화)
   */
  async getInfo() {
    return prisma.materialRate.findFirst({
      orderBy: { id: "asc" },
    });
  },

  /**
   * 자재 요율 저장/수정
   * - 싱글톤: 최상위 1건만 유지 (id 없으면 create, 있으면 update)
   * - 기존 대비 요율이 하나라도 변경되면 MaterialRateHistory 에 스냅샷 기록
   * - CREATE 시에도 초기 스냅샷 1건 기록
   * @param {Object} data 저장할 요율 값들
   * @param {{id: number}} user 로그인 사용자
   */
  async save(data, user) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.materialRate.findFirst({
        orderBy: { id: "asc" },
      });

      const ratePayload = {
        outbound_rate1: data.outbound_rate1 ?? 0,
        outbound_rate2: data.outbound_rate2 ?? 0,
        wholesale_rate1: data.wholesale_rate1 ?? 0,
        wholesale_rate2: data.wholesale_rate2 ?? 0,
        online_rate: data.online_rate ?? 0,
        updated_by: user?.id ?? null,
      };

      let row;
      let action;

      if (!existing) {
        row = await tx.materialRate.create({ data: ratePayload });
        action = "CREATE";
      } else {
        const before = pickRates(existing);
        const after = pickRates(ratePayload);

        row = await tx.materialRate.update({
          where: { id: existing.id },
          data: ratePayload,
        });

        // 값이 하나라도 바뀐 경우에만 이력 기록
        action = ratesDiffer(before, after) ? "UPDATE" : null;
      }

      if (action) {
        await tx.materialRateHistory.create({
          data: {
            rate_id: row.id,
            outbound_rate1: row.outbound_rate1,
            outbound_rate2: row.outbound_rate2,
            wholesale_rate1: row.wholesale_rate1,
            wholesale_rate2: row.wholesale_rate2,
            online_rate: row.online_rate,
            updated_by: user?.id ?? null,
          },
        });
      }

      return row;
    });
  },

  /**
   * 요율 변경 이력 리스트 (역방향 페이지네이션, 수정자 이름 포함)
   * @param {{beforeId?: number, limit?: number}} data
   */
  async getHistory(data) {
    const limit = Math.min(Math.max(Number(data?.limit) || 50, 1), 200);
    const beforeId = data?.beforeId ? Number(data.beforeId) : undefined;

    const rows = await prisma.materialRateHistory.findMany({
      where: beforeId ? { id: { lt: beforeId } } : undefined,
      orderBy: { id: "desc" },
      take: limit,
    });

    const userIds = [
      ...new Set(rows.map((r) => r.updated_by).filter((v) => v != null)),
    ];

    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, username: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    return rows.map((r) => ({
      ...r,
      updated_by_name: userMap.get(r.updated_by)?.name ?? "",
      updated_by_username: userMap.get(r.updated_by)?.username ?? "",
    }));
  },
};
