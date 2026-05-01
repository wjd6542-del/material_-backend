import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";

export default {
  /** 카테고리 전체 리스트 (평면, sort asc) — 기본 활성만 */
  async getAllList(data) {
    const where = {};
    if (!data?.includeInactive) where.is_active = true;
    return prisma.materialCategory.findMany({
      where,
      orderBy: { sort: "asc" },
    });
  },

  /**
   * 카테고리 트리 반환 (root → children 재귀 구성)
   * 평면 조회 후 Map 으로 parentId 기준 children 연결 — 기본 활성만
   */
  async getCategoryTree(data) {
    const where = {};
    if (!data?.includeInactive) where.is_active = true;
    const list = await prisma.materialCategory.findMany({
      where,
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

  /** 카테고리 리스트 (key/keys 필터) */
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

    return prisma.materialCategory.findMany({
      where,
      orderBy: { sort: "asc" },
    });
  },

  /** 드롭다운 표시용 축약 리스트 (기본 활성만) */
  async getViewList(data) {
    const where = {};
    if (!data?.includeInactive) where.is_active = true;
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

  /** 카테고리 활성/비활성 토글 */
  async setActive(data, user) {
    if (!data?.id) throw new AppError("ID가 필요합니다.", 400, "INVALID_ID");
    if (typeof data.is_active !== "boolean") {
      throw new AppError("is_active 값이 필요합니다.", 400, "INVALID_PARAMS");
    }
    return prisma.materialCategory.update({
      where: { id: Number(data.id) },
      data: { is_active: data.is_active },
    });
  },

  /** 카테고리 단건 조회 */
  async getById(id) {
    if (!id) throw new AppError("ID가 필요합니다.", 400, "INVALID_ID");

    const item = await prisma.materialCategory.findUnique({ where: { id } });
    if (!item) {
      throw new AppError("존재하지 않는 카테고리 입니다.", 404, "NOT_FOUND");
    }
    return item;
  },

  /** 카테고리 단건 삭제 (트랜잭션 보장 + 존재 검증) */
  async deleteById(id) {
    if (!id) throw new AppError("ID가 필요합니다.", 400, "INVALID_ID");
    return prisma.$transaction(async (tx) => {
      const exists = await tx.materialCategory.findUnique({ where: { id } });
      if (!exists) {
        throw new AppError("존재하지 않는 카테고리 입니다.", 404, "NOT_FOUND");
      }
      await tx.materialCategory.delete({ where: { id } });
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
   * 트리 노드들의 기존 DB ID 집합을 재귀로 수집 (신규 노드 제외)
   * batchSave 에서 삭제 대상 판별에 사용
   */
  collectIds(nodes, ids = new Set()) {
    for (const node of nodes) {
      if (node.id && !node.isNew) {
        ids.add(node.id);
      }
      if (node.children?.length) {
        this.collectIds(node.children, ids);
      }
    }
    return ids;
  },

  /**
   * 일괄 저장 (재귀 트리 구조)
   * - 프론트 트리에 없는 기존 노드는 삭제 처리
   * - 품목(Material)가 연결된 카테고리는 삭제하지 않음
   * @param {*} data
   */
  async batchSave(data = []) {
    if (!data.length) {
      throw new AppError("요청데이터가 없습니다.", 400, "NOT_FOUND_DATA");
    }

    return prisma.$transaction(async (tx) => {
      // 1. 프론트 트리에 포함된 기존 ID 수집
      const incomingIds = this.collectIds(data);

      // 2. DB 기존 전체 카테고리 조회
      const existingAll = await tx.materialCategory.findMany({
        select: { id: true },
      });

      // 3. 프론트 트리에 없는 노드 = 삭제 대상
      const deleteTargetIds = existingAll
        .map((row) => row.id)
        .filter((id) => !incomingIds.has(id));

      // 4. 삭제 대상 중 품목가 연결된 카테고리 확인
      if (deleteTargetIds.length > 0) {
        const linkedCategories = await tx.material.findMany({
          where: { category_id: { in: deleteTargetIds } },
          select: { category_id: true },
          distinct: ["category_id"],
        });
        const linkedIds = new Set(
          linkedCategories.map((m) => m.category_id),
        );

        const safeDeleteIds = deleteTargetIds.filter(
          (id) => !linkedIds.has(id),
        );

        // 자식 → 부모 순서로 삭제 (FK 제약 회피)
        if (safeDeleteIds.length > 0) {
          await tx.materialCategory.deleteMany({
            where: { id: { in: safeDeleteIds }, parentId: { not: null } },
          });
          await tx.materialCategory.deleteMany({
            where: { id: { in: safeDeleteIds } },
          });
        }
      }

      // 5. 트리 저장
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

  /**
   * 카테고리 단일 노드 저장
   * - isNew=true → create (parentId 있으면 parent connect)
   * - 아니면 update (parentId 있으면 connect, 없으면 disconnect 로 루트 전환)
   * @param {Prisma.TransactionClient} [tx=prisma]
   */
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
