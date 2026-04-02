import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";

export default {
  async getAllList(data) {
    return prisma.materialCategory.findMany({
      orderBy: { sort: "asc" },
    });
  },

  /**
   * 트리 구조로 카테고리 조회
   */
  async getCategoryTree() {
    const list = await prisma.materialCategory.findMany({
      orderBy: { sort: "asc" },
    });

    const map = new Map();
    const roots = [];

    // 맵 생성
    for (const item of list) {
      map.set(item.id, { ...item, children: [] });
    }

    // 트리 구성
    for (const item of list) {
      const node = map.get(item.id);
      if (item.parentId && map.has(item.parentId)) {
        map.get(item.parentId).children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  },

  // 필터링 적용 리스트
  async getList(data) {
    const where = {};
    if (data?.key) {
      where.key = data.key;
    }

    // 키 배열 검색
    if (data?.keys?.length) {
      where.key = {
        in: data.keys,
      };
    }

    return prisma.materialCategory.findMany({
      where,
      orderBy: { sort: "asc" },
    });
  },

  // 필터링 적용 리스트
  async getViewList(data) {
    const where = {};
    if (data?.key) {
      where.key = data.key;
    }

    return prisma.materialCategory.findMany({
      where,
      orderBy: { sort: "asc" },
      select: {
        id: true,
        text: true,
        value: true,
      },
    });
  },

  async getById(id) {
    if (!id) throw new AppError("ID가 필요합니다.", 400, "INVALID_ID");

    const item = await prisma.materialCategory.findUnique({ where: { id } });
    if (!item) {
      throw new AppError("존재하지 않는 편의시설입니다.", 404, "NOT_FOUND");
    }
    return item;
  },

  async deleteById(id) {
    if (!id) throw new AppError("ID가 필요합니다.", 400, "INVALID_ID");
    return prisma.materialCategory.delete({ where: { id } });
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
   * 일괄 저장 (재귀 트리 구조)
   * @param {*} data
   */
  async batchSave(data = []) {
    if (!data.length) {
      throw new AppError("요청데이터가 없습니다.", 400, "NOT_FOUND_DATA");
    }

    return prisma.$transaction(async (tx) => {
      const results = [];
      for (let i = 0; i < data.length; i++) {
        try {
          const saved = await this.saveNode(data[i], null, tx);
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
   * 재귀 노드 저장
   * @param {*} node - 트리 노드 (children 포함)
   * @param {number|null} parentId - 부모 ID
   * @param {*} tx - 트랜잭션 클라이언트
   */
  async saveNode(node, parentId, tx) {
    const { children, ...nodeData } = node;

    // 부모 ID가 전달되면 덮어쓰기
    if (parentId !== null && parentId !== undefined) {
      nodeData.parentId = parentId;
    }

    const saved = await this.save(nodeData, tx);

    // children 재귀 저장
    if (children?.length) {
      saved.children = [];
      for (const child of children) {
        const savedChild = await this.saveNode(child, saved.id, tx);
        saved.children.push(savedChild);
      }
    }

    return saved;
  },

  async save(data, tx = prisma) {
    const { id, name, code, sort, parentId, path, depth, isNew } = data;
    const saveData = { name, code, sort, path, depth };

    if (isNew) {
      if (parentId) {
        saveData.parent = { connect: { id: parentId } };
      }
      return tx.materialCategory.create({ data: saveData });
    }

    // update 시 parent 관계 처리
    if (parentId) {
      saveData.parent = { connect: { id: parentId } };
    } else {
      saveData.parent = { disconnect: true };
    }

    return tx.materialCategory.update({
      where: { id },
      data: saveData,
    });
  },
};
