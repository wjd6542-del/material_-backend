import jwt from "jsonwebtoken";
import prisma from "../lib/prisma.js";
export const permission = (code) => {
  return async (req, reply) => {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "");

      if (!token) {
        return reply.code(401).send({ message: "인증 필요" });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // 🔥 DB 조회 없음
      if (decoded.is_super) {
        req.user = decoded;
        return;
      }

      const permissions = decoded.permissions || [];

      if (code && !permissions.includes(code)) {
        return reply.code(403).send({ message: "권한 없음" });
      }

      req.user = decoded;
    } catch (err) {
      return reply.code(401).send({ message: "토큰 오류" });
    }
  };
};
