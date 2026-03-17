import { getAuditContext } from "./auditContext.js";

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
