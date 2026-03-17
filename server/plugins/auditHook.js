import fp from "fastify-plugin";
import { runAuditContext } from "../lib/auditContext.js";

export default fp(async function (fastify) {
  fastify.addHook("onRequest", (request, reply, done) => {
    const ctx = {
      user_id: request.user?.id ?? null,
      ip: request.ip,
      user_agent: request.headers["user-agent"],
      page: request.url,
      method: request.method,
    };

    runAuditContext(ctx, () => done());
  });
});
