import { PrismaClient } from '@prisma/client'

/**
 * (레거시/미사용) 대체 Prisma 클라이언트
 * 실제 애플리케이션은 lib/prisma.js 의 감사 미들웨어 적용 인스턴스를 사용한다
 */
const prisma = new PrismaClient()

export default prisma