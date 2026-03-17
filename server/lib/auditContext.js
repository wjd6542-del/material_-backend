import { AsyncLocalStorage } from "node:async_hooks";

export const auditContext = new AsyncLocalStorage();

export function runAuditContext(data, callback) {
  return auditContext.run(data, callback);
}

export function getAuditContext() {
  return auditContext.getStore();
}
