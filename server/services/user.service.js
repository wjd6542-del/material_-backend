import prisma from "../lib/prisma.js";
import AppError from "../errors/AppError.js";

export default {
  // 필터링 적용 리스트
  async getList(data) {
    const where = {};

    // 권한검색
    if (data?.role_id) {
      where.role_id = data.role_id;
    }

    // 권한 검색
    if (data?.keyword) {
      where.OR = [
        {
          username: {
            contains: data.keyword,
          },
        },
        {
          name: {
            contains: data.keyword,
          },
        },
      ];
    }

    // 날짜 검색
    if (data?.startDate && data?.endDate) {
      where.updated_at = {
        gte: new Date(data.startDate),
        lte: new Date(data.endDate),
      };
    }

    const rows = await prisma.user.findMany({
      where,
      include: {
        role: true,
      },
      orderBy: { updated_at: "desc" },
    });

    return rows.map((row) => ({
      ...row,
      role_name: row.role?.name ?? "",
      role_description: row.role?.description ?? "",
    }));
  },

  // 회원 아이피 리스트
  async getUserIpList(data) {
    const where = {};

    // 회원 아이디로 조회
    if (data?.user_id) {
      where.user_id = data.user_id;
    }

    const rows = await prisma.userIpWhitelist.findMany({
      where,
      include: {
        user: true,
      },
      orderBy: { created_at: "desc" },
    });

    return rows;
  },

  async getById(id) {
    if (!id) throw new AppError("ID가 필요합니다.", 400, "INVALID_ID");

    const item = await prisma.user.findUnique({ where: { id } });
    if (!item) {
      throw new AppError("존재하지 않는 정보입니다.", 404, "NOT_FOUND");
    }
    return item;
  },

  // 계정권한 설정
  async setPermission(data) {
    return await prisma.user.update({
      where: { id: data.user_id },
      data: {
        role_id: data.role_id,
      },
    });
  },

  // 아이피 정보 저장 처리
  // 아이피 정보 일괄 저장 처리
  async batchIpSave(data) {
    const { user_id, ipList } = data;
    return await prisma.$transaction(async (tx) => {
      const results = [];

      for (const item of ipList) {
        // 1. ID가 있고 0보다 큰 경우 -> 기존 데이터 수정 (Update)
        if (item.id && item.id > 0) {
          const updated = await tx.userIpWhitelist.update({
            where: { id: Number(item.id) },
            data: {
              ip: item.ip,
              memo: item.memo,
              is_active: item.is_active,
            },
          });
          results.push(updated);
        }
        // 2. ID가 없거나 null인 경우 -> 신규 데이터 생성 (Create)
        else {
          const created = await tx.userIpWhitelist.create({
            data: {
              user_id: Number(user_id),
              ip: item.ip,
              memo: item.memo,
              is_active: item.is_active ?? true,
            },
          });
          results.push(created);
        }
      }

      return results;
    });
  },

  // 아이피 정보 일괄 삭제
  async batchIpDelete(data) {
    const { user_id, ipList } = data;

    // 2. 삭제 대상 ID 추출 (숫자로 변환)
    // 프론트에서 넘어온 객체 배열에서 id값만 뽑아냅니다.
    const deleteIds = ipList
      .filter((item) => item.id !== null && item.id !== undefined)
      .map((item) => Number(item.id));

    if (deleteIds.length === 0) {
      throw new AppError("데이터 정보가 없습니다.", 400, "NOT_FOUND");
    }

    // 3. 삭제 실행
    const result = await prisma.userIpWhitelist.deleteMany({
      where: {
        id: { in: deleteIds },
        user_id: Number(user_id), // 본인 소유의 IP만 삭제되도록 보안 강화
      },
    });

    return result;
  },

  // 계정의 권한 정보 확인
  async PermissionGrop(data) {
    const { user_id } = data;
  },

  // 회원 계정 아이피 토글 여부
  async ipToggle(data) {
    if (!data.user_id) {
      new AppError("회원 정보가 없습니다", 400, "NOT_FOUND");
    }

    if (!data.ip_restrict) {
      new AppError("활성정보가 없습니다", 400, "NOT_FOUND");
    }

    // 업데이트 진행
    const result = await prisma.user.update({
      where: {
        id: Number(data.user_id),
      },
      data: {
        ip_restrict: data.ip_restrict,
      },
    });

    return result;
  },
};
