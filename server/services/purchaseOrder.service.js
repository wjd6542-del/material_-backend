import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";
import { generateQR } from "../utils/qrcode.js";

export default {
  /**
   * created_by / updated_by 에 해당하는 User 정보를 조회해 Map 으로 반환
   * @param {Array<number|null|undefined>} ids
   * @returns {Promise<Map<number, {id:number,name:string,username:string}>>}
   */
  async getUserMap(ids) {
    const uniq = [...new Set(ids.filter((v) => v != null))];
    if (!uniq.length) return new Map();

    const users = await prisma.user.findMany({
      where: { id: { in: uniq } },
      select: { id: true, name: true, username: true },
    });
    return new Map(users.map((u) => [u.id, u]));
  },

  /**
   * 발주 전표 리스트 (order_no 검색, 기간·상태·거래처 필터)
   * 각 전표에 supplier_name / 발주번호 QR / items 품목명 / 작성자·수정자 이름 포함 반환
   */
  async getList(data) {
    const where = {};

    if (data?.order_no) {
      where.order_no = { contains: data.order_no };
    }

    if (data?.status) {
      where.status = data.status;
    }

    if (data?.supplier_id) {
      where.supplier_id = Number(data.supplier_id);
    }

    // 생성일 기준
    if (data?.startDate && data?.endDate) {
      where.created_at = {
        gte: new Date(data.startDate),
        lte: new Date(data.endDate),
      };
    }

    // 발주일자
    if (data?.orderStartDate && data?.orderEndDate) {
      where.order_date = {
        gte: new Date(data.orderStartDate),
        lte: new Date(data.orderEndDate),
      };
    }

    // 납기일자
    if (data?.deliveryStartDate && data?.deliveryEndDate) {
      where.delivery_date = {
        gte: new Date(data.deliveryStartDate),
        lte: new Date(data.deliveryEndDate),
      };
    }

    const rows = await prisma.purchaseOrder.findMany({
      where,
      include: {
        supplier: true,
        items: {
          include: {
            material: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
    });

    const userMap = await this.getUserMap(
      rows.flatMap((r) => [r.created_by, r.updated_by]),
    );

    const result = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        supplier_name: row.supplier?.name ?? "",
        created_by_name: userMap.get(row.created_by)?.name ?? "",
        updated_by_name: userMap.get(row.updated_by)?.name ?? "",
        qrcode: await generateQR(row.order_no),
        items: row.items.map((it) => ({
          ...it,
          material_code: it.material?.code ?? "",
          material_name: it.material?.name ?? "",
          spec: it.material?.spec ?? "",
        })),
      })),
    );

    return result;
  },

  /**
   * 발주 품목(PurchaseOrderItem) 리스트 (품목/거래처/상태/기간 필터)
   * - startDate/endDate: 발주 전표 created_at
   * - orderStartDate/orderEndDate: 발주일자 order_date
   * - deliveryStartDate/deliveryEndDate: 납기일자 delivery_date
   * @param {Object} data
   */
  async detailList(data) {
    const where = {};

    if (data.material_id) {
      where.material_id = Number(data.material_id);
    }

    if (data.supplier_id) {
      where.supplier_id = Number(data.supplier_id);
    }

    const poWhere = {};

    if (data.status) {
      poWhere.status = data.status;
    }

    if (data.order_no) {
      poWhere.order_no = { contains: data.order_no };
    }

    if (data.startDate && data.endDate) {
      poWhere.created_at = {
        gte: new Date(data.startDate),
        lte: new Date(data.endDate),
      };
    }

    if (data.orderStartDate && data.orderEndDate) {
      poWhere.order_date = {
        gte: new Date(data.orderStartDate),
        lte: new Date(data.orderEndDate),
      };
    }

    if (data.deliveryStartDate && data.deliveryEndDate) {
      poWhere.delivery_date = {
        gte: new Date(data.deliveryStartDate),
        lte: new Date(data.deliveryEndDate),
      };
    }

    if (Object.keys(poWhere).length) {
      where.purchaseOrder = poWhere;
    }

    const rows = await prisma.purchaseOrderItem.findMany({
      where,
      include: {
        purchaseOrder: true,
        material: true,
        supplier: true,
      },
      orderBy: {
        purchaseOrder: { created_at: "desc" },
      },
    });

    const userMap = await this.getUserMap(
      rows.flatMap((r) => [
        r.purchaseOrder?.created_by,
        r.purchaseOrder?.updated_by,
      ]),
    );

    const result = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        order_no: row.purchaseOrder?.order_no ?? "",
        order_date: row.purchaseOrder?.order_date ?? null,
        delivery_date: row.purchaseOrder?.delivery_date ?? null,
        status: row.purchaseOrder?.status ?? "",
        vat_applied: row.purchaseOrder?.vat_applied ?? true,
        material_code: row.material?.code ?? "",
        material_name: row.material?.name ?? "",
        spec: row.material?.spec ?? "",
        supplier_name: row.supplier?.name ?? "",
        created_at: row.purchaseOrder?.created_at ?? null,
        created_by_name:
          userMap.get(row.purchaseOrder?.created_by)?.name ?? "",
        updated_by_name:
          userMap.get(row.purchaseOrder?.updated_by)?.name ?? "",
        qrcode: row.purchaseOrder?.order_no
          ? await generateQR(row.purchaseOrder.order_no)
          : "",
      })),
    );

    return result;
  },

  /**
   * 발주 전표 단건 조회 (items/material/supplier 포함)
   */
  async getById(id) {
    if (!id) throw new AppError("ID가 필요합니다.", 400, "INVALID_ID");

    const item = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        items: {
          include: {
            material: true,
          },
        },
      },
    });

    if (!item) {
      throw new AppError("존재하지 않는 데이터 입니다.", 404, "NOT_FOUND");
    }

    const userMap = await this.getUserMap([item.created_by, item.updated_by]);

    return {
      ...item,
      supplier_name: item.supplier?.name ?? "",
      created_by_name: userMap.get(item.created_by)?.name ?? "",
      updated_by_name: userMap.get(item.updated_by)?.name ?? "",
      qrcode: await generateQR(item.order_no),
      items: item.items.map((it) => ({
        ...it,
        material_code: it.material?.code ?? "",
        material_name: it.material?.name ?? "",
        spec: it.material?.spec ?? "",
      })),
    };
  },

  /**
   * 발주 전표 일괄 삭제
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
   * 발주 전표 단건 삭제 (cascade 로 items 정리)
   */
  async deleteById(id) {
    const po = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!po) {
      throw new AppError("발주 전표가 없습니다.", 404, "NOT_FOUND");
    }

    await prisma.purchaseOrder.delete({ where: { id } });
    return true;
  },

  /**
   * 발주번호 자동 발급 (PO- + timestamp)
   */
  generateOrderNo() {
    return `PO-${Date.now()}`;
  },

  /**
   * 발주 전표 생성/수정 트랜잭션
   * - id 없음: 신규 PurchaseOrder + items 생성
   * - id 존재: 기존 items 대비 upsert/삭제 처리
   * - vat_applied=false 이면 모든 item 의 vat 을 0 으로 강제
   * - items memo 그대로 저장
   * @param {Object} data { id?, order_no?, supplier_id, order_date, delivery_date, status, vat_applied, memo, items[] }
   * @param {Object} user 로그인 사용자
   */
  async save(data, user) {
    return prisma.$transaction(async (tx) => {
      const orderNo = data.order_no?.trim() || this.generateOrderNo();
      const vatApplied = data.vat_applied !== false;

      let po;

      if (!data.id) {
        po = await tx.purchaseOrder.create({
          data: {
            order_no: orderNo,
            supplier_id: data.supplier_id,
            order_date: data.order_date ?? null,
            delivery_date: data.delivery_date ?? null,
            status: data.status ?? "draft",
            vat_applied: vatApplied,
            memo: data.memo ?? null,
            created_by: user.id,
            updated_by: user.id,
          },
        });

        // 알림 등록처리
        await prisma.notification.create({
          data: {
            user_id: user.id,
            type: "PURCHASEORDER",
            title: "발주 확인",
            action: "CREATE",
            message: `${orderNo} 발주 정보가 등록되었습니다.`,
            target_type: "purchaseOrder",
            target_id: po.id,
          },
        });
      } else {
        const exists = await tx.purchaseOrder.findUnique({
          where: { id: data.id },
        });
        if (!exists) {
          throw new AppError("발주 전표가 없습니다.", 404, "NOT_FOUND");
        }

        po = await tx.purchaseOrder.update({
          where: { id: data.id },
          data: {
            order_no: orderNo,
            supplier_id: data.supplier_id,
            order_date: data.order_date ?? null,
            delivery_date: data.delivery_date ?? null,
            status: data.status ?? exists.status,
            vat_applied: vatApplied,
            memo: data.memo ?? null,
            updated_by: user.id,
          },
        });

        // 알림 등록처리
        await prisma.notification.create({
          data: {
            user_id: user.id,
            type: "PURCHASEORDER",
            title: "발주 확인",
            action: "UPDATE",
            message: `${orderNo} 발주 정보가 수정되었습니다.`,
            target_type: "purchaseOrder",
            target_id: po.id,
          },
        });
      }

      const oldItems = data.id
        ? await tx.purchaseOrderItem.findMany({
            where: { purchase_order_id: po.id },
          })
        : [];

      const oldMap = new Map(oldItems.map((i) => [i.id, i]));
      const keepIds = [];

      for (const item of data.items) {
        const payload = {
          material_id: item.material_id,
          supplier_id: data.supplier_id,
          quantity: item.quantity,
          price: item.price,
          supply_amount: item.supply_amount ?? 0,
          vat: vatApplied ? (item.vat ?? 0) : 0,
          memo: item.memo ?? null,
        };

        if (item.id && oldMap.has(item.id)) {
          await tx.purchaseOrderItem.update({
            where: { id: item.id },
            data: payload,
          });
          keepIds.push(item.id);
        } else {
          const created = await tx.purchaseOrderItem.create({
            data: {
              ...payload,
              purchase_order_id: po.id,
            },
          });
          keepIds.push(created.id);
        }
      }

      const deleteItems = oldItems.filter((i) => !keepIds.includes(i.id));
      if (deleteItems.length) {
        await tx.purchaseOrderItem.deleteMany({
          where: { id: { in: deleteItems.map((i) => i.id) } },
        });
      }

      return po;
    });
  },
};
