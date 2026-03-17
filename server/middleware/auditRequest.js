import { setAuditContext } from "../lib/auditContext.js";

export function auditRequest(req, res, next) {
  const context = {
    user_id: req.user?.user_id || null,
    ip: req.ip,
    user_agent: req.headers["user-agent"],
    page: req.baseUrl,
  };

  setAuditContext(context, () => {
    next();
  });
}
