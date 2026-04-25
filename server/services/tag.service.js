import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";

export default {
  /** 태그 전체 리스트 (sort asc, id asc) */
  async getAllList() {
    return prisma.tag.findMany({
      orderBy: [{ sort: "asc" }, { id: "asc" }],
    });
  },

  /** 태그 리스트 (name 부분 매칭, material_id 로 연결된 태그만) */
  async getList(data) {
    const where = {};
    if (data?.name) {
      where.name = { contains: data.name };
    }
    if (data?.material_id) {
      where.materials = {
        some: { material_id: Number(data.material_id) },
      };
    }

    return prisma.tag.findMany({
      where,
      orderBy: [{ sort: "asc" }, { id: "asc" }],
    });
  },

  /** 태그 단건 조회 */
  async getById(id) {
    if (!id) throw new AppError("ID가 필요합니다.", 400, "INVALID_ID");

    const item = await prisma.tag.findUnique({ where: { id } });
    if (!item) {
      throw new AppError("존재하지 않는 태그입니다.", 404, "NOT_FOUND");
    }
    return item;
  },

  /** 태그 단건 삭제 (MaterialTag cascade) */
  async deleteById(id) {
    if (!id) throw new AppError("ID가 필요합니다.", 400, "INVALID_ID");
    return prisma.tag.delete({ where: { id } });
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
   * 일괄 저장
   */
  async batchSave(data = []) {
    if (!data.length) {
      throw new AppError("요청데이터가 없습니다.", 400, "NOT_FOUND_DATA");
    }

    return prisma.$transaction(async (tx) => {
      const results = [];
      for (let i = 0; i < data.length; i++) {
        try {
          const saved = await this.save(data[i], tx);
          results.push(saved);
        } catch (e) {
          throw new AppError(
            `${i + 1}번째 데이터 저장 실패: ${e.message}`,
            400,
            "BATCH_SAVE_FAILED",
          );
        }
      }
      return results;
    });
  },

  /**
   * 태그 생성/수정 (name + sort 저장)
   * @param {Prisma.TransactionClient} [tx=prisma]
   */
  async save(data, tx = prisma) {
    const { id, name, sort } = data;
    const saveData = { name, sort: sort ?? 0 };

    if (!id || id === 0) {
      return tx.tag.create({ data: saveData });
    }

    return tx.tag.update({
      where: { id },
      data: saveData,
    });
  },

  /**
   * 특정 품목에 연결된 태그 목록 (tag.sort asc)
   */
  async getByMaterial(material_id) {
    if (!material_id) {
      throw new AppError("material_id가 필요합니다.", 400, "INVALID_PARAM");
    }

    const rows = await prisma.materialTag.findMany({
      where: { material_id: Number(material_id) },
      include: { tag: true },
      orderBy: { tag: { sort: "asc" } },
    });
    return rows.map((r) => r.tag);
  },

  /**
   * 품목-태그 매핑 동기화 (기존 매핑 전부 삭제 후 tag_ids 로 재생성)
   * @param {{material_id:number, tag_ids:number[]}} param
   */
  async syncMaterialTags({ material_id, tag_ids = [] }) {
    if (!material_id) {
      throw new AppError("material_id가 필요합니다.", 400, "INVALID_PARAM");
    }

    return prisma.$transaction(async (tx) => {
      await tx.materialTag.deleteMany({
        where: { material_id: Number(material_id) },
      });

      if (tag_ids.length) {
        await tx.materialTag.createMany({
          data: tag_ids.map((tag_id) => ({
            material_id: Number(material_id),
            tag_id: Number(tag_id),
          })),
          skipDuplicates: true,
        });
      }

      return tx.materialTag.findMany({
        where: { material_id: Number(material_id) },
        include: { tag: true },
      });
    });
  },
};
