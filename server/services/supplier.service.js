import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";
import userService from "./user.service.js";

/** 이력으로 추적하는 Supplier 필드 (type / 금액) */
const TRACK_FIELDS = ["type", "receivable", "payable"];

/** 정규화 (Decimal/enum 비교를 위해 문자열·숫자로 변환) */
function pickTracked(obj) {
  return {
    type: String(obj?.type ?? "INBOUND"),
    receivable: Number(obj?.receivable ?? 0),
    payable: Number(obj?.payable ?? 0),
  };
}

/** type 또는 금액이 변경되었는지 확인 */
function trackedDiffer(before, after) {
  return TRACK_FIELDS.some((k) => before[k] !== after[k]);
}

export default {
  /** 공급업체 전체 리스트 — 기본 활성만 */
  async getAllList(data) {
    const where = {};
    if (!data?.includeInactive) where.is_active = true;
    return prisma.supplier.findMany({
      where,
      orderBy: { sort: "asc" },
    });
  },

  /** 공급업체 리스트 (key/keys 필터) */
  async getList(data) {
    const where = {};
    if (!data?.includeInactive) where.is_active = true;
    if (data?.key) {
      where.key = data.key;
    }

    // 키 배열 검색
    if (data?.keys?.length) {
      where.key = {
        in: data.keys,
      };
    }

    return prisma.supplier.findMany({
      where,
      orderBy: { sort: "asc" },
    });
  },

  /** key 기준 그룹핑 */
  async getKeyGroup() {
    const res = await prisma.supplier.groupBy({
      by: ["key"],
    });
    return res;
  },

  /** 드롭다운 표시용 축약 리스트 (id/text/value, 기본 활성만) */
  async getViewList(data) {
    const where = {};
    if (!data?.includeInactive) where.is_active = true;
    if (data?.key) {
      where.key = data.key;
    }

    return prisma.supplier.findMany({
      where,
      orderBy: { sort: "asc" },
      select: {
        id: true,
        text: true,
        value: true,
      },
    });
  },

  /** 공급업체 활성/비활성 토글 */
  async setActive(data, user) {
    if (!data?.id) throw new AppError("ID가 필요합니다.", 400, "INVALID_ID");
    if (typeof data.is_active !== "boolean") {
      throw new AppError("is_active 값이 필요합니다.", 400, "INVALID_PARAMS");
    }
    return prisma.supplier.update({
      where: { id: Number(data.id) },
      data: { is_active: data.is_active },
    });
  },

  /** 공급업체 단건 조회 */
  async getById(id) {
    if (!id) throw new AppError("ID가 필요합니다.", 400, "INVALID_ID");

    const item = await prisma.supplier.findUnique({ where: { id } });
    if (!item) {
      throw new AppError("존재하지 않는 거래처 입니다.", 404, "NOT_FOUND");
    }
    return item;
  },

  /** 공급업체 단건 삭제 (cascade 로 history/items 정리, 트랜잭션 보장) */
  async deleteById(id) {
    if (!id) throw new AppError("ID가 필요합니다.", 400, "INVALID_ID");
    return prisma.$transaction(async (tx) => {
      const exists = await tx.supplier.findUnique({ where: { id } });
      if (!exists) {
        throw new AppError("존재하지 않는 거래처 입니다.", 404, "NOT_FOUND");
      }
      await tx.supplier.delete({ where: { id } });
      return true;
    });
  },

  /**
   * 일괄 삭제
   * @param {*} data
   */
  async batchDelete(data = []) {
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

  /**
   * 일괄 저장
   * @param {*} data
   * @param {{id: number}} [user]
   */
  async batchSave(data = [], user) {
    if (!data.length) {
      throw new AppError("요청데이터가 없습니다.", 400, "NOT_FOUND_DATA");
    }

    const results = await Promise.all(
      data.map((row, idx) =>
        this.save(row, user).catch(() => {
          throw new AppError(
            `${idx + 1}번째 데이터 저장 실패`,
            400,
            "BATCH_SAVE_FAILED",
          );
        }),
      ),
    );

    return results;
  },

  /**
   * 공급업체/거래처 생성·수정 트랜잭션
   * - id 없거나 0 → create / 아니면 update
   * - type/receivable/payable 중 하나라도 변경되면 SupplierHistory 스냅샷 1행 기록
   * - CREATE 시에는 항상 스냅샷 기록
   * @param {Object} data
   * @param {{id: number}} [user]
   */
  async save(data, user) {
    return prisma.$transaction(async (tx) => {
      const isCreate = !data.id || data.id === 0;
      let row;
      let action;

      if (isCreate) {
        const createData = { ...data };
        delete createData.id;
        row = await tx.supplier.create({ data: createData });
        action = "CREATE";
      } else {
        const before = await tx.supplier.findUnique({ where: { id: data.id } });
        if (!before) {
          throw new AppError("존재하지 않는 거래처입니다.", 404, "NOT_FOUND");
        }

        row = await tx.supplier.update({
          where: { id: data.id },
          data,
        });

        action = trackedDiffer(pickTracked(before), pickTracked(row))
          ? "UPDATE"
          : null;
      }

      if (action) {
        await tx.supplierHistory.create({
          data: {
            supplier_id: row.id,
            type: row.type,
            receivable: row.receivable,
            payable: row.payable,
            action,
            updated_by: user?.id ?? null,
          },
        });
      }

      return row;
    });
  },

  /**
   * 거래처 변경 이력 리스트 (역방향 페이지네이션, 수정자 이름 포함)
   * @param {{supplier_id: number, beforeId?: number, limit?: number}} data
   */
  async getHistory(data) {
    const supplierId = Number(data?.supplier_id);
    if (!supplierId) {
      throw new AppError("supplier_id 가 필요합니다.", 400, "INVALID_ID");
    }

    const limit = Math.min(Math.max(Number(data?.limit) || 50, 1), 200);
    const beforeId = data?.beforeId ? Number(data.beforeId) : undefined;

    const rows = await prisma.supplierHistory.findMany({
      where: {
        supplier_id: supplierId,
        ...(beforeId ? { id: { lt: beforeId } } : {}),
      },
      orderBy: { id: "desc" },
      take: limit,
    });

    const userMap = await userService.getMapByIds(rows.map((r) => r.updated_by));

    return rows.map((r) => ({
      ...r,
      updated_by_name: userMap.get(r.updated_by)?.name ?? "",
      updated_by_username: userMap.get(r.updated_by)?.username ?? "",
    }));
  },
};
