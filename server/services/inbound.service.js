import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";
import { generateQR } from "../utils/qrcode.js";
import { ensureAndLockStock } from "./stock.lock.js";

/**
 * InboundItem 배열을 supplier_id 별 supply_amount 합계 Map 으로 집계
 * - supplier_id 가 없는 항목은 제외
 * - 각 item 의 supply_amount 를 우선 사용, 없으면 quantity * price 로 재계산
 * @param {Array} items
 * @returns {Map<number, number>}
 */
function aggregateSupplierAmounts(items) {
  const map = new Map();
  for (const item of items) {
    if (!item?.supplier_id) continue;
    const amount = Number(
      item.supply_amount ??
        Number(item.quantity ?? 0) * Number(item.price ?? 0),
    );
    map.set(item.supplier_id, (map.get(item.supplier_id) || 0) + amount);
  }
  return map;
}

/**
 * 거래처 payable(미지급금) 증감 반영 + SupplierHistory 스냅샷 기록 (트랜잭션 내)
 * @param {Prisma.TransactionClient} tx
 * @param {Map<number, number>} deltaMap supplier_id → 증감액 (양수: 증가, 음수: 감소)
 * @param {number|null} userId 처리자 ID
 * @param {string} inboundNo 참조 입고번호 (이력 reason 용)
 */
async function applySupplierPayableDelta(tx, deltaMap, userId, inboundNo) {
  for (const [supplierId, delta] of deltaMap) {
    if (!delta) continue;

    const updated = await tx.supplier.update({
      where: { id: supplierId },
      data: { payable: { increment: delta } },
    });

    await tx.supplierHistory.create({
      data: {
        supplier_id: supplierId,
        type: updated.type,
        receivable: updated.receivable,
        payable: updated.payable,
        action: "UPDATE",
        updated_by: userId,
        reason: `입고 ${inboundNo} 반영 (${delta > 0 ? "+" : ""}${delta})`,
      },
    });
  }
}

export default {
  /**
   * 입고 전표 전체 리스트 (user, items 포함)
   */
  async getAllList() {
    return prisma.inbound.findMany({
      include: {
        user: true,
        items: true,
      },
    });
  },

  /**
   * 입고 전표 리스트 (inbound_no 검색, 기간 필터)
   * 각 전표에 username / 입고번호 QR 포함 반환
   */
  async getList(data) {
    const where = {};

    if (data?.inbound_no) {
      where.inbound_no = {
        contains: data.inbound_no,
      };
    }

    if (data?.startDate && data?.endDate) {
      where.created_at = {
        gte: new Date(data.startDate),
        lte: new Date(data.endDate),
      };
    }

    const rows = await prisma.inbound.findMany({
      where,
      include: {
        user: true,
        items: true,
        supplier: true,
      },
      orderBy: { created_at: "desc" },
    });

    const result = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        username: row.user?.username ?? "",
        qrcode: await generateQR(row.inbound_no),
      })),
    );

    return result;
  },

  /**
   * 입고 전표 페이지네이션 리스트 (getList 와 동일 필터 + page/limit)
   * @param {{page?:number,limit?:number,inbound_no?:string,startDate?:string,endDate?:string}} data
   * @returns {Promise<{rows:Array,total:number,page:number,limit:number,totalPages:number}>}
   */
  async getPageList(data) {
    const where = {};

    if (data?.inbound_no) {
      where.inbound_no = { contains: data.inbound_no };
    }

    if (data?.startDate && data?.endDate) {
      where.created_at = {
        gte: new Date(data.startDate),
        lte: new Date(data.endDate),
      };
    }

    const page = Math.max(1, Number(data?.page) || 1);
    const limit = Math.max(1, Math.min(Number(data?.limit) || 20, 100));
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      prisma.inbound.findMany({
        where,
        include: {
          user: true,
          items: true,
          supplier: true,
        },
        orderBy: { created_at: "desc" },
        skip,
        take: limit,
      }),
      prisma.inbound.count({ where }),
    ]);

    const result = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        username: row.user?.username ?? "",
        qrcode: await generateQR(row.inbound_no),
      })),
    );

    return {
      rows: result,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },

  /**
   * 입고 아이템(InboundItem) 리스트 (품목/창고/위치/공급업체/기간 필터)
   * @param {Object} data
   */
  async detailList(data) {
    const where = {};

    if (data.material_id) {
      where.material_id = data.material_id;
    }

    if (data.warehouse_id) {
      where.warehouse_id = data.warehouse_id;
    }

    if (data.location_id) {
      where.location_id = data.location_id;
    }

    if (data.location_id) {
      where.location_id = data.location_id;
    }

    if (data.supplier_id) {
      where.supplier_id = data.supplier_id;
    }

    if (data.startDate && data.endDate) {
      where.inbound = {
        created_at: {
          gte: new Date(data.startDate),
          lte: new Date(data.endDate),
        },
      };
    }

    const rows = await prisma.inboundItem.findMany({
      where,
      include: {
        inbound: true,
        material: true,
        supplier: true,
        warehouse: true,
        location: true,
      },
      orderBy: {
        inbound: { created_at: "desc" },
      },
    });

    const result = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        inbound_code: row.inbound?.inbound_no ?? "",
        material_code: row.material?.code ?? "",
        material_name: row.material?.name ?? "",
        supplier_name: row.supplier?.name ?? "",
        warehouse_name: row.warehouse?.name ?? "",
        location_name: row.location?.name ?? "",

        created_at: row.inbound?.created_at ?? "",
        qrcode: await generateQR(row.inbound.inbound_no),
      })),
    );

    return result;
  },

  /**
   * 입고 아이템 페이지네이션 리스트 (detailList 와 동일 필터 + page/limit)
   * @param {Object} data
   * @returns {Promise<{rows:Array,total:number,page:number,limit:number,totalPages:number}>}
   */
  async detailPageList(data) {
    const where = {};

    if (data.material_id) where.material_id = data.material_id;
    if (data.warehouse_id) where.warehouse_id = data.warehouse_id;
    if (data.location_id) where.location_id = data.location_id;
    if (data.supplier_id) where.supplier_id = data.supplier_id;

    if (data.startDate && data.endDate) {
      where.inbound = {
        created_at: {
          gte: new Date(data.startDate),
          lte: new Date(data.endDate),
        },
      };
    }

    const page = Math.max(1, Number(data?.page) || 1);
    const limit = Math.max(1, Math.min(Number(data?.limit) || 20, 100));
    const skip = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      prisma.inboundItem.findMany({
        where,
        include: {
          inbound: true,
          material: true,
          supplier: true,
          warehouse: true,
          location: true,
        },
        orderBy: {
          inbound: { created_at: "desc" },
        },
        skip,
        take: limit,
      }),
      prisma.inboundItem.count({ where }),
    ]);

    const result = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        inbound_code: row.inbound?.inbound_no ?? "",
        material_code: row.material?.code ?? "",
        material_name: row.material?.name ?? "",
        supplier_name: row.supplier?.name ?? "",
        warehouse_name: row.warehouse?.name ?? "",
        location_name: row.location?.name ?? "",
        created_at: row.inbound?.created_at ?? "",
        qrcode: await generateQR(row.inbound.inbound_no),
      })),
    );

    return {
      rows: result,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },

  /**
   * 입고 전표 단건 조회 (user/items/warehouse/material/location 포함)
   */
  async getById(id) {
    if (!id) throw new AppError("ID가 필요합니다.", 400, "INVALID_ID");

    const item = await prisma.inbound.findUnique({
      where: { id },
      include: {
        user: true,
        supplier: true,
        items: {
          include: {
            warehouse: true,
            material: true,
            location: true,
            supplier: true,
          },
        },
      },
    });

    if (!item) {
      throw new AppError("존재하지 않는 데이터 입니다.", 404, "NOT_FOUND");
    }

    return item;
  },

  /**
   * 재고(Stock) 증감 + StockHistory 이력 기록 헬퍼 (트랜잭션 내 호출 전용)
   * @param {Prisma.TransactionClient} tx
   * @param {{material_id:number,warehouse_id:number,location_id:number,shelf_id?:number,price?:number}} item
   * @param {number} diffQty 증감값 (음수면 OUTBOUND 타입으로 기록)
   * @param {string} refTable 참조 테이블명 (예: 'inbound', 'inbound_cancel')
   * @param {number} refId 참조 레코드 ID
   * @param {number} userId 처리자 ID
   */
  async updateStock(tx, item, diffQty, refTable, refId, userId) {
    const uniqueKey = {
      material_id: item.material_id,
      warehouse_id: item.warehouse_id,
      location_id: item.location_id,
      shelf_id: item.shelf_id ?? null,
    };

    // 동시성 보호: 행 보장 + FOR UPDATE 잠금 후 최신 값 조회
    const locked = await ensureAndLockStock(tx, uniqueKey, userId);

    const beforeQty = locked.quantity;
    const afterQty = beforeQty + diffQty;
    const oldAvgCost = locked.avg_cost;
    const unitCost = Number(item.price ?? 0);

    // 이동평균 단가 계산
    // - 입고(diffQty>0): (기존 수량·단가 + 입고 수량·단가) / 전체 수량
    // - 출고/롤백(diffQty<0): 기존 avg_cost 유지
    // - 재고 0 소진 시 avg_cost=0 초기화
    let newAvgCost = oldAvgCost;
    if (afterQty <= 0) {
      newAvgCost = 0;
    } else if (diffQty > 0) {
      newAvgCost = (beforeQty * oldAvgCost + diffQty * unitCost) / afterQty;
    }
    const stockValue = afterQty * newAvgCost;

    const amount = unitCost * diffQty;

    const stockRow = await tx.stock.update({
      where: { id: locked.id },
      data: {
        quantity: afterQty,
        avg_cost: newAvgCost,
        stock_value: stockValue,
        updated_by: userId,
      },
    });

    await tx.stockHistory.create({
      data: {
        material_id: item.material_id,
        warehouse_id: item.warehouse_id,
        location_id: item.location_id,
        shelf_id: item.shelf_id ?? null,
        stock_id: stockRow.id,
        type: diffQty > 0 ? "INBOUND" : "OUTBOUND",
        quantity: diffQty,
        before_qty: beforeQty,
        after_qty: afterQty,
        unit_cost: unitCost,
        amount: amount,
        ref_table: refTable,
        ref_id: refId,
        created_by: userId,
      },
    });
  },

  /**
   * 입고 전표 일괄 삭제 (각 건별 deleteById 실행, 실패 건 인덱스 포함 에러)
   * @param {Array<{id:number}>} data
   */
  async batchDelete(data = [], user) {
    if (!data.length) {
      throw new AppError("요청데이터가 없습니다.", 400, "NOT_FOUND_DATA");
    }

    const results = await Promise.all(
      data.map((row, idx) =>
        this.deleteById(row.id, user).catch(() => {
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
   * 입고 전표 단건 삭제 (트랜잭션)
   * - 각 InboundItem 에 대해 updateStock(-quantity) 호출 → 재고 롤백 + 이력 기록
   * - Inbound cascade 로 InboundItem 정리
   * @param {number} id
   */
  async deleteById(id, user) {
    return prisma.$transaction(async (tx) => {
      const inbound = await tx.inbound.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!inbound) {
        throw new AppError("입고 전표가 없습니다.");
      }

      for (const item of inbound.items) {
        await this.updateStock(
          tx,
          item,
          -item.quantity,
          "inbound_cancel",
          inbound.id,
          inbound.user_id,
        );
      }

      // 거래처 미지급금 롤백: 이 입고의 모든 supplier 금액을 음수 delta 로 적용
      // is_unpaid=false (지급 완료 처리된 전표) 인 경우 payable 에 반영된 적이 없으므로 롤백 생략
      if (inbound.is_unpaid) {
        const rollbackAmounts = aggregateSupplierAmounts(inbound.items);
        const deltaMap = new Map();
        for (const [sid, amount] of rollbackAmounts) {
          if (amount !== 0) deltaMap.set(sid, -amount);
        }
        await applySupplierPayableDelta(
          tx,
          deltaMap,
          user?.id ?? inbound.user_id,
          `${inbound.inbound_no}(삭제)`,
        );
      }

      await tx.inbound.delete({
        where: { id },
      });

      return true;
    });
  },

  /**
   * 입고 전표 생성/수정 트랜잭션
   * - id 없음: 신규 Inbound + items 생성 + 각 item 재고 증가
   * - id 존재: 기존 items 재고를 한번 롤백(-qty) 후 수정 반영(+qty)
   *   미포함된 기존 items 는 삭제하며 재고 롤백
   * - 모든 item 변경 시 StockHistory 이력 기록
   * - 알림(NotificationType.INBOUND) 생성
   * @param {Object} data { id?, inbound_no, memo, items[] }
   * @param {Object} user 로그인 사용자
   */
  async save(data, user) {
    return prisma.$transaction(async (tx) => {
      let inbound;

      const vatApplied = data.vat_applied !== false;
      const newUnpaid = data.is_unpaid !== false;

      const headerData = {
        supplier_id: data.supplier_id ?? null,
        purchase_date: data.purchase_date ?? null,
        vat_applied: vatApplied,
        is_unpaid: newUnpaid,
      };

      // 기존 전표(items + is_unpaid) 스냅샷을 update 전에 확보 — payable delta 산정에 사용
      const oldInbound = data.id
        ? await tx.inbound.findUnique({
            where: { id: data.id },
            include: { items: true },
          })
        : null;
      const oldUnpaid = oldInbound?.is_unpaid ?? false;

      if (!data.id) {
        inbound = await tx.inbound.create({
          data: {
            inbound_no: data.inbound_no,
            user_id: user.id,
            memo: data.memo,
            created_by: user.id,
            updated_by: user.id,
            ...headerData,
          },
        });

        // 알림 등록처리
        await prisma.notification.create({
          data: {
            user_id: user.id,
            type: "INBOUND",
            title: "입고 확인",
            action: "CREATE",
            message: `${data.inbound_no} 입고 정보가 등록되었습니다.`,
            target_type: "inbound",
            target_id: inbound.id,
          },
        });
      } else {
        inbound = await tx.inbound.update({
          where: { id: data.id },
          data: {
            inbound_no: data.inbound_no,
            user_id: user.id,
            memo: data.memo,
            updated_by: user.id,
            ...headerData,
          },
        });

        // 알림 등록처리
        await prisma.notification.create({
          data: {
            user_id: user.id,
            type: "INBOUND",
            title: "입고 확인",
            action: "UPDATE",
            message: `${data.inbound_no} 입고 정보가 수정되었습니다.`,
            target_type: "inbound",
            target_id: inbound.id,
          },
        });
      }

      const oldItems = oldInbound?.items ?? [];

      const oldMap = new Map(oldItems.map((i) => [i.id, i]));

      const keepIds = [];

      for (const item of data.items) {
        if (item.id && oldMap.has(item.id)) {
          const oldItem = oldMap.get(item.id);

          await this.updateStock(
            tx,
            oldItem,
            -oldItem.quantity,
            "inbound_update_cancel",
            inbound.id,
            user.id,
          );

          await tx.inboundItem.update({
            where: { id: item.id },
            data: {
              material_id: item.material_id,
              warehouse_id: item.warehouse_id,
              supplier_id: item.supplier_id,
              location_id: item.location_id,
              shelf_id: item.shelf_id,
              quantity: item.quantity,
              price: item.price,
              supply_amount: item.quantity * item.price,
              vat: vatApplied ? (item.vat ?? 0) : 0,
            },
          });

          await this.updateStock(
            tx,
            item,
            item.quantity,
            "inbound_update",
            inbound.id,
            user.id,
          );

          keepIds.push(item.id);
        } else {
          const created = await tx.inboundItem.create({
            data: {
              inbound_id: inbound.id,
              material_id: item.material_id,
              warehouse_id: item.warehouse_id,
              supplier_id: item.supplier_id,
              location_id: item.location_id,
              shelf_id: item.shelf_id,
              quantity: item.quantity,
              price: item.price,
              supply_amount: item.quantity * item.price,
              vat: vatApplied ? (item.vat ?? 0) : 0,
            },
          });

          await this.updateStock(
            tx,
            item,
            item.quantity,
            "inbound",
            inbound.id,
            user.id,
          );

          keepIds.push(created.id);
        }
      }

      const deleteItems = oldItems.filter((i) => !keepIds.includes(i.id));

      for (const item of deleteItems) {
        await this.updateStock(
          tx,
          item,
          -item.quantity,
          "inbound_delete",
          inbound.id,
          user.id,
        );

        await tx.inboundItem.delete({
          where: { id: item.id },
        });
      }

      // 거래처 미지급금 반영:
      // - 이전 items 합계 vs 신규 items 합계의 차이를 supplier 별로 계산
      // - is_unpaid=false (지급 완료) 인 측은 0 으로 취급해 payable 미반영
      //   → 미수→완료 전이는 이전 금액만큼 차감, 완료→미수 전이는 신규 금액만큼 가산
      // - 0 이 아닌 delta 에 대해서만 supplier.payable 증감 + SupplierHistory 기록
      const oldAmounts = oldUnpaid
        ? aggregateSupplierAmounts(oldItems)
        : new Map();
      const newAmounts = newUnpaid
        ? aggregateSupplierAmounts(data.items)
        : new Map();
      const supplierIds = new Set([...oldAmounts.keys(), ...newAmounts.keys()]);

      const deltaMap = new Map();
      for (const sid of supplierIds) {
        const delta = (newAmounts.get(sid) ?? 0) - (oldAmounts.get(sid) ?? 0);
        if (delta !== 0) deltaMap.set(sid, delta);
      }

      await applySupplierPayableDelta(
        tx,
        deltaMap,
        user.id,
        inbound.inbound_no,
      );

      return inbound;
    });
  },
};
