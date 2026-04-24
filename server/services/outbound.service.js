import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";
import { generateQR } from "../utils/qrcode.js";

export default {
  /**
   * 출고 전표 전체 리스트 (user, items 포함)
   */
  async getAllList() {
    return prisma.outbound.findMany({
      include: {
        user: true,
        items: true,
      },
    });
  },

  /**
   * 출고 현황 집계 (보드 카드/대시보드용)
   * - 전체 출고 전표 수
   * - 아이템 수량/판매금액/원가금액/이익 합계
   * - 자재명별 그룹 카운트 ($queryRaw 사용)
   */
  async boardCount() {
    const totalCount = await prisma.outbound.count();

    // 출고 수량
    const summary = await prisma.outboundItem.aggregate({
      _sum: {
        quantity: true,
        sale_amount: true,
        cost_amount: true,
        profit: true,
      },
    });

    const rows = await prisma.$queryRaw`
    SELECT 
      m.name,
      COUNT(*) as count
    FROM OutboundItem oi
    JOIN Material m ON m.id = oi.material_id
    GROUP BY m.name
  `;

    const result = rows.reduce((acc, row) => {
      acc[row.name] = Number(row.count);
      return acc;
    }, {});

    return {
      totalCount,
      groupCount: result,
      summary: summary._sum,
    };
  },

  /**
   * 출고 전표 리스트 (outbound_no 검색, 기간 필터, QR 포함)
   * @param {Object} data
   */
  async getList(data) {
    const where = {};

    if (data?.outbound_no) {
      where.outbound_no = {
        contains: data.outbound_no,
      };
    }

    if (data?.startDate && data?.endDate) {
      where.created_at = {
        gte: new Date(data.startDate),
        lte: new Date(data.endDate),
      };
    }

    const rows = await prisma.outbound.findMany({
      where,
      include: {
        user: true,
        items: true,
      },
      orderBy: { created_at: "desc" },
    });

    const result = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        username: row.user?.username ?? "",
        qrcode: await generateQR(row.outbound_no),
      })),
    );

    return result;
  },

  /**
   * 출고 아이템(OutboundItem) 리스트 (자재/창고/위치/기간 필터)
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

    if (data.startDate && data.endDate) {
      where.outbound = {
        created_at: {
          gte: new Date(data.startDate),
          lte: new Date(data.endDate),
        },
      };
    }

    const rows = await prisma.outboundItem.findMany({
      where,
      include: {
        outbound: true,
        material: true,
        warehouse: true,
        location: true,
      },
      orderBy: {
        outbound: { created_at: "desc" },
      },
    });

    const result = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        outbound_code: row.outbound?.outbound_no ?? "",
        material_code: row.material?.code ?? "",
        material_name: row.material?.name ?? "",
        warehouse_name: row.warehouse?.name ?? "",
        location: row.location?.code ?? "",
        created_at: row.outbound?.created_at ?? "",
        qrcode: await generateQR(row.outbound.outbound_no),
      })),
    );

    return result;
  },

  /**
   * 반품 가능 출고 아이템 목록 (반품 전표 작성 화면용)
   * material_id / searchText(자재명·코드) / 기간 필터
   */
  async returnList(data) {
    const where = {};

    if (data?.material_id) {
      where.material_id = data.material_id;
    }

    // 자재명, 자재코드 검색
    if (data?.searchText) {
      const materials = await prisma.material.findMany({
        where: {
          OR: [
            {
              name: {
                contains: data.searchText,
              },
            },
            {
              code: {
                contains: data.searchText,
              },
            },
          ],
        },
        select: {
          id: true,
        },
      });

      where.material_id = {
        in: materials.map((m) => m.id),
      };
    }

    if (data?.startDate && data?.endDate) {
      where.outbound = {
        created_at: {
          gte: new Date(data.startDate),
          lte: new Date(data.endDate),
        },
      };
    }

    const rows = await prisma.outboundItem.findMany({
      where,
      include: {
        outbound: true,
        material: true,
        warehouse: true,
        location: true,
      },
      orderBy: {
        outbound: { created_at: "desc" },
      },
    });

    const result = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        outbound_code: row.outbound?.outbound_no ?? "",
        material_code: row.material?.code ?? "",
        material_name: row.material?.name ?? "",
        warehouse_name: row.warehouse?.name ?? "",
        location: row.location?.code ?? "",
        created_at: row.outbound?.created_at ?? "",
        qrcode: await generateQR(row.outbound.outbound_no),
      })),
    );

    return result;
  },

  /**
   * 출고 전표 단건 조회 (user/items 및 각 item 의 warehouse/material/location 포함)
   */
  async getById(id) {
    if (!id) throw new AppError("ID가 필요합니다.", 400);

    const item = await prisma.outbound.findUnique({
      where: { id },
      include: {
        user: true,
        items: {
          include: {
            warehouse: true,
            material: true, // 자재
            location: true, // 위치
          },
        },
      },
    });

    if (!item) {
      throw new AppError("존재하지 않는 데이터 입니다.", 404);
    }

    return item;
  },

  /**
   * 출고용 재고 업데이트 + StockHistory 이력 기록 헬퍼 (트랜잭션 전용)
   * (출고는 diffQty 가 음수로 호출되어 OUTBOUND 이력 생성)
   * @param {Prisma.TransactionClient} tx
   * @param {Object} item 출고 아이템
   * @param {number} diffQty 증감값 (출고는 음수)
   * @param {string} refTable 참조 테이블명
   * @param {number} refId 참조 레코드 ID
   * @param {number} userId 처리자 ID
   */
  async updateStock(tx, item, diffQty, refTable, refId, userId) {
    const stock = await tx.stock.findUnique({
      where: {
        material_id_warehouse_id_location_id_shelf_id: {
          material_id: item.material_id,
          warehouse_id: item.warehouse_id,
          location_id: item.location_id,
          shelf_id: item.shelf_id ?? null,
        },
      },
    });

    if (!stock) {
      throw new AppError("재고가 존재하지 않습니다.");
    }

    const beforeQty = stock.quantity;
    const afterQty = beforeQty + diffQty;

    if (afterQty < 0) {
      throw new AppError("재고가 부족합니다.");
    }

    const unitCost = Number(stock.avg_cost ?? 0);
    const amount = unitCost * Math.abs(diffQty);

    // 출고 시 avg_cost 는 유지, stock_value 는 새 수량으로 재계산
    // (재고 0 소진 시 stock_value 도 0)
    const newStockValue = afterQty <= 0 ? 0 : afterQty * unitCost;

    const stockRow = await tx.stock.update({
      where: { id: stock.id },
      data: {
        quantity: afterQty,
        stock_value: newStockValue,
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
        type: diffQty < 0 ? "OUTBOUND" : "INBOUND",
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
   * 출고 전표 일괄 삭제 (각 건 deleteById 실행, 실패 건 인덱스 포함 에러)
   */
  async batchDelete(data = []) {
    if (!data.length) {
      throw new AppError("요청데이터가 없습니다.", 400);
    }

    const results = await Promise.all(
      data.map((row, idx) =>
        this.deleteById(row.id).catch(() => {
          throw new AppError(`${idx + 1} 번째 데이터 삭제 실패`);
        }),
      ),
    );

    return results;
  },

  /**
   * 출고 전표 단건 삭제 (트랜잭션)
   * - 각 OutboundItem 에 대해 updateStock(+quantity) 로 재고 복원 + 이력 기록
   * - Outbound cascade 로 OutboundItem 정리
   */
  async deleteById(id) {
    return prisma.$transaction(async (tx) => {
      const outbound = await tx.outbound.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!outbound) {
        throw new AppError("출고 전표가 없습니다.");
      }

      for (const item of outbound.items) {
        await this.updateStock(
          tx,
          item,
          item.quantity,
          "outbound_cancel",
          outbound.id,
          outbound.user_id,
        );
      }

      await tx.outbound.delete({
        where: { id },
      });

      return true;
    });
  },

  /**
   * 출고 전표 생성/수정 트랜잭션
   * - id 없음: outbound_no 중복 체크 → Outbound + OutboundItem 생성
   *   각 item 별로 Stock 이동평균 원가 기반 cost_price 산출, 판매금액·원가금액·이익 계산
   *   재고 차감 + StockHistory(OUTBOUND) 기록, 재고 부족 시 에러
   * - id 존재: 기존 items 재고 롤백 → 수정 반영 → 재고 차감
   *   미포함된 기존 items 는 삭제(재고 복원)
   * - 알림(NotificationType.OUTBOUND) 생성
   * @param {Object} data { id?, outbound_no, memo, items[] }
   * @param {Object} user 로그인 사용자
   */
  async save(data, user) {
    return prisma.$transaction(async (tx) => {
      let outbound;

      if (!data.id) {
        const exist = await tx.outbound.findFirst({
          where: {
            outbound_no: data.outbound_no,
            NOT: data.id ? { id: data.id } : undefined,
          },
        });

        if (exist) {
          throw new AppError("이미 존재하는 출고번호입니다.", 400);
        }

        outbound = await tx.outbound.create({
          data: {
            outbound_no: data.outbound_no,
            user_id: user.id,
            memo: data.memo,
            created_by: user.id,
            updated_by: user.id,
          },
        });

        // 알림 등록처리
        await prisma.notification.create({
          data: {
            user_id: user.id,
            type: "OUTBOUND",
            title: "출고 확인",
            action: "CREATE",
            message: `${data.outbound_no} 출고 정보가 등록 되었습니다.`,
            target_type: "outbound",
            target_id: outbound.id,
          },
        });
      } else {
        outbound = await tx.outbound.update({
          where: { id: data.id },
          data: {
            outbound_no: data.outbound_no,
            user_id: user.id,
            memo: data.memo,
            updated_by: user.id,
          },
        });

        // 알림 등록처리
        await prisma.notification.create({
          data: {
            user_id: user.id,
            type: "OUTBOUND",
            title: "출고 확인",
            action: "UPDATE",
            message: `${data.outbound_no} 출고 정보가 수정 되었습니다.`,
            target_type: "outbound",
            target_id: outbound.id,
          },
        });
      }

      const oldItems = data.id
        ? await tx.outboundItem.findMany({
            where: { outbound_id: outbound.id },
          })
        : [];

      const oldMap = new Map(oldItems.map((i) => [i.id, i]));
      const keepIds = [];

      for (const item of data.items) {
        if (item.id && oldMap.has(item.id)) {
          const oldItem = oldMap.get(item.id);

          await this.updateStock(
            tx,
            oldItem,
            oldItem.quantity,
            "outbound_update_cancel",
            outbound.id,
            user.id,
          );

          await tx.outboundItem.update({
            where: { id: item.id },
            data: {
              material_id: item.material_id,
              supplier_id: item.supplier_id,
              warehouse_id: item.warehouse_id,
              location_id: item.location_id,
              shelf_id: item.shelf_id,
              quantity: item.quantity,
              sale_price: item.sale_price,
              sale_amount: item.quantity * item.sale_price,
              cost_price: item.cost_price,
              cost_amount: item.quantity * item.cost_price,
              // 손익 = 판매가 - 원가
              profit: (item.sale_price - item.cost_price) * item.quantity,
            },
          });

          await this.updateStock(
            tx,
            item,
            -item.quantity,
            "outbound_update",
            outbound.id,
            user.id,
          );

          keepIds.push(item.id);
        } else {
          const created = await tx.outboundItem.create({
            data: {
              outbound_id: outbound.id,
              material_id: item.material_id,
              supplier_id: item.supplier_id,
              warehouse_id: item.warehouse_id,
              location_id: item.location_id,
              shelf_id: item.shelf_id,
              quantity: item.quantity,
              sale_price: item.sale_price,
              sale_amount: item.quantity * item.sale_price,
              cost_price: item.cost_price,
              cost_amount: item.quantity * item.cost_price,
              // 손익 = 판매가 - 원가
              profit: (item.sale_price - item.cost_price) * item.quantity,
            },
          });

          await this.updateStock(
            tx,
            item,
            -item.quantity,
            "outbound",
            outbound.id,
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
          item.quantity,
          "outbound_delete",
          outbound.id,
          user.id,
        );

        await tx.outboundItem.delete({
          where: { id: item.id },
        });
      }

      return outbound;
    });
  },
};
