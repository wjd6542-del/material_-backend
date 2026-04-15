import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";
import { generateQR } from "../utils/qrcode.js";

export default {
  async getAllList() {
    return prisma.inbound.findMany({
      include: {
        user: true,
        items: true,
      },
    });
  },

  // 입고 목록
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

  // 입고 상세정보 리스트
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

  async getById(id) {
    if (!id) throw new AppError("ID가 필요합니다.", 400, "INVALID_ID");

    const item = await prisma.inbound.findUnique({
      where: { id },
      include: {
        user: true,
        items: {
          include: {
            warehouse: true,
            material: true,
            location: true,
          },
        },
      },
    });

    if (!item) {
      throw new AppError("존재하지 않는 데이터 입니다.", 404, "NOT_FOUND");
    }

    return item;
  },

  // 재고 처리
  async updateStock(tx, item, diffQty, refTable, refId, userId) {
    const stock = await tx.stock.findUnique({
      where: {
        material_id_warehouse_id_location_id: {
          material_id: item.material_id,
          warehouse_id: item.warehouse_id,
          location_id: item.location_id,
        },
      },
    });

    const beforeQty = stock?.quantity ?? 0;
    const afterQty = beforeQty + diffQty;

    const unitCost = item.unit_price ?? 0;
    const amount = unitCost * diffQty;

    const stockRow = await tx.stock.upsert({
      where: {
        material_id_warehouse_id_location_id: {
          material_id: item.material_id,
          warehouse_id: item.warehouse_id,
          location_id: item.location_id,
        },
      },
      update: {
        quantity: afterQty,
        updated_by: userId,
      },
      create: {
        material_id: item.material_id,
        warehouse_id: item.warehouse_id,
        location_id: item.location_id,
        quantity: afterQty,
        updated_by: userId,
      },
    });

    await tx.stockHistory.create({
      data: {
        material_id: item.material_id,
        warehouse_id: item.warehouse_id,
        location_id: item.location_id,
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
   * 일괄 삭제
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
   * 입고 삭제
   */
  async deleteById(id) {
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

      await tx.inbound.delete({
        where: { id },
      });

      return true;
    });
  },

  /**
   * 입고 저장
   */
  async save(data, user) {
    return prisma.$transaction(async (tx) => {
      let inbound;

      if (!data.id) {
        inbound = await tx.inbound.create({
          data: {
            inbound_no: data.inbound_no,
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

      const oldItems = data.id
        ? await tx.inboundItem.findMany({
            where: { inbound_id: inbound.id },
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
              unit_price: item.unit_price,
              amount: item.quantity * item.unit_price,
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
              unit_price: item.unit_price,
              amount: item.quantity * item.unit_price,
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

      return inbound;
    });
  },
};
