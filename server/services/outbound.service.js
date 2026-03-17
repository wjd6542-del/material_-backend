import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";
import { generateQR } from "../utils/qrcode.js";

export default {
  async getAllList() {
    return prisma.outbound.findMany({
      include: {
        user: true,
        items: true,
      },
    });
  },

  // 보드용 카운트
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

  // 출고 상세 리스트
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

  // 재고 처리
  async updateStock(tx, item, diffQty, refTable, refId) {
    const stock = await tx.stock.findUnique({
      where: {
        material_id_warehouse_id_location_id: {
          material_id: item.material_id,
          warehouse_id: item.warehouse_id,
          location_id: item.location_id,
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

    const unitCost = stock.avg_cost ?? 0;
    const amount = unitCost * Math.abs(diffQty);

    const stockRow = await tx.stock.update({
      where: { id: stock.id },
      data: {
        quantity: afterQty,
      },
    });

    await tx.stockHistory.create({
      data: {
        material_id: item.material_id,
        warehouse_id: item.warehouse_id,
        location_id: item.location_id,
        stock_id: stockRow.id,
        type: diffQty < 0 ? "OUTBOUND" : "INBOUND",
        quantity: diffQty,
        before_qty: beforeQty,
        after_qty: afterQty,
        unit_cost: unitCost,
        amount: amount,
        ref_table: refTable,
        ref_id: refId,
      },
    });
  },

  /**
   * 일괄 삭제
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
   * 출고 삭제
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
        );
      }

      await tx.outbound.delete({
        where: { id },
      });

      return true;
    });
  },

  /**
   * 출고 저장
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
          );

          await tx.outboundItem.update({
            where: { id: item.id },
            data: {
              material_id: item.material_id,
              warehouse_id: item.warehouse_id,
              location_id: item.location_id,
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
          );

          keepIds.push(item.id);
        } else {
          const created = await tx.outboundItem.create({
            data: {
              outbound_id: outbound.id,
              material_id: item.material_id,
              warehouse_id: item.warehouse_id,
              location_id: item.location_id,
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
        );

        await tx.outboundItem.delete({
          where: { id: item.id },
        });
      }

      return outbound;
    });
  },
};
