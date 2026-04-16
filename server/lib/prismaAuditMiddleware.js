import { getAuditContext } from "./auditContext.js";

/**
 * Prisma 자동 감사 미들웨어
 * - create / update / delete / upsert / createMany / updateMany / deleteMany 액션에 한정해 작동
 * - AuditLog 모델 자기 자신은 제외 (재귀 방지)
 * - update/delete/upsert 시 수정/삭제 전 스냅샷을 before_data 로 기록
 * - upsert 는 beforeData 유무로 CREATE/UPDATE 판별
 * - createMany/updateMany/deleteMany 는 건수 요약(Batch) 메시지로 기록
 * - 예외 발생 시 status=FAIL 로 기록 후 원본 에러 재던짐
 * @param {import('@prisma/client').PrismaClient} prisma
 */
export function auditMiddleware(prisma) {
  prisma.$use(async (params, next) => {
    const ctx = getAuditContext();

    if (!ctx) {
      return next(params);
    }

    const { user_id, ip, user_agent, page } = ctx;

    const model = params.model;
    const action = params.action;

    if (!model) return next(params);

    // AuditLog 자기 자신 제외
    if (model === "AuditLog") {
      return next(params);
    }

    const singleActions = ["create", "update", "delete", "upsert"];
    const manyActions = ["createMany", "updateMany", "deleteMany"];

    if (![...singleActions, ...manyActions].includes(action)) {
      return next(params);
    }

    let beforeData = null;
    let result;
    let logAction = action.toUpperCase();

    try {
      // ----------------------
      // BEFORE DATA
      // ----------------------
      if (action === "update" || action === "delete") {
        beforeData = await prisma[model].findUnique({
          where: params.args.where,
        });
      }

      if (action === "upsert") {
        beforeData = await prisma[model].findUnique({
          where: params.args.where,
        });
      }

      // ----------------------
      // 실제 쿼리 실행
      // ----------------------
      result = await next(params);

      // ----------------------
      // UPSERT Action 판별
      // ----------------------
      if (action === "upsert") {
        logAction = beforeData ? "UPDATE" : "CREATE";
      }

      // ----------------------
      // MANY ACTION 처리
      // ----------------------
      if (manyActions.includes(action)) {
        await prisma.auditLog.create({
          data: {
            user_id,
            page,
            action: logAction,
            target_type: model,
            description: `Batch ${action} count: ${result.count}`,
            ip,
            user_agent,
            status: "SUCCESS",
          },
        });

        return result;
      }

      // ----------------------
      // SINGLE ACTION
      // ----------------------
      await prisma.auditLog.create({
        data: {
          user_id,
          page,
          action: logAction,
          target_type: model,
          target_id: result?.id ?? null,
          before_data: beforeData,
          after_data: result,
          ip,
          user_agent,
          status: "SUCCESS",
        },
      });

      return result;
    } catch (err) {
      await prisma.auditLog.create({
        data: {
          user_id,
          page,
          action: logAction,
          target_type: model,
          description: err.message,
          ip,
          user_agent,
          status: "FAIL",
        },
      });

      throw err;
    }
  });
}
