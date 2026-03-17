import { PrismaClient } from "@prisma/client";
import { auditMiddleware } from "./prismaAuditMiddleware.js";

const prisma = new PrismaClient();

auditMiddleware(prisma);

export default prisma;
