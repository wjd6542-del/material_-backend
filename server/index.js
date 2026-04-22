import Fastify from "fastify";
import multipart from "@fastify/multipart";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";
import { Server as SocketIOServer } from "socket.io";

import errorHandlerPlugin from "./plugins/errorHandler.plugin.js";

import auditHook from "./plugins/auditHook.js";
import { attachChatSocket } from "./socket/chat.socket.js";

// 통계용 자동 크론
// import "./cron/cron.js";

const app = Fastify({ logger: true });

/**
 * 요청에서 실제 클라이언트 IP 추출
 * (x-forwarded-for → req.ip → 소켓 원격주소 순, IPv6 매핑 IPv4 변환 처리)
 * @param {FastifyRequest} req
 * @returns {string}
 */
function getClientIp(req) {
  let ip =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.ip ||
    req.socket?.remoteAddress ||
    "";

  // 🔥 IPv6 → IPv4 변환 (::ffff:127.0.0.1)
  if (ip.includes("::ffff:")) {
    ip = ip.replace("::ffff:", "");
  }

  return ip;
}

await app.register(cors, {
  // origin: "https://honors-slides-ceo-addresses.trycloudflare.com",
  origin: true,
  credentials: true,
});
await app.register(errorHandlerPlugin);
await app.register(multipart, {
  limits: {
    fileSize: 20 * 1024 * 1024,
    files: 10,
  },
});

// ----------------------------
// ✅ 전역 헤더 검사 + IP 제한
// ----------------------------
/**
 * /api/* 요청 공통 전처리 훅
 * 1) x-api-key 검증
 * 2) Authorization Bearer 토큰이 있으면 JWT 검증 후 request.user 주입
 * 3) ip_restrict=true && !is_super 일 경우 UserIpWhitelist 검사
 * (토큰 없는 경우는 통과 → 로그인/회원가입 API 에서 사용)
 */
app.addHook("onRequest", async (request, reply) => {
  const apiKey = request.headers["x-api-key"];

  if (!request.url.startsWith("/api/")) return;

  // 1️⃣ API KEY 체크
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return reply.code(401).send({ error: "Unauthorized" });
  }

  const authHeader = request.headers.authorization;

  // 🔥 토큰 없는 경우는 그냥 통과 (로그인 API 등)
  if (!authHeader) return;

  const token = authHeader.replace("Bearer ", "");

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 🔥 request.user 확장 (나중에 계속 쓰니까 여기서 세팅)
    request.user = {
      id: decoded.userId,
      username: decoded.username,
      is_super: decoded.is_super,
      ip_restrict: decoded.ip_restrict,
    };

    // ----------------------------
    // 🔥 IP 제한 체크
    // ----------------------------
    if (decoded.ip_restrict && !decoded.is_super) {
      const ip = getClientIp(request);

      const allow = await prisma.userIpWhitelist.findFirst({
        where: {
          user_id: decoded.userId,
          ip: ip,
          is_active: true,
        },
      });

      if (!allow) {
        return reply.code(403).send({
          error: "허용되지 않은 IP 입니다.",
        });
      }
    }
  } catch (err) {
    return reply.code(401).send({ error: "Invalid token" });
  }
});

// 처리 진행
await app.register(auditHook);

// ----------------------------
// ✅ static
// ----------------------------
app.register(fastifyStatic, {
  root: path.join(process.cwd(), "uploads"),
  prefix: "/uploads/",
});

// ----------------------------
// ✅ routes 자동 로드
// ----------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const routesPath = path.join(__dirname, "routes");
const routeFiles = fs.readdirSync(routesPath);
for (const file of routeFiles) {
  if (!file.endsWith(".js")) continue;

  const routeModule = await import(`./routes/${file}`);

  // 파일명 기반 prefix 생성
  const name = file.replace(".js", "");
  const prefix = `/api/${name}`;

  app.register(routeModule.default, { prefix });

  console.log(`✅ Route loaded: ${prefix}`);
}

// ----------------------------
// ✅ Socket.IO 부착 (채팅 실시간)
// ----------------------------
await app.ready();

const io = new SocketIOServer(app.server, {
  cors: {
    origin: true,
    credentials: true,
  },
});

attachChatSocket(io);
console.log("✅ Socket.IO attached: /socket.io");

// ----------------------------
// 서버 시작
// ----------------------------
app.listen({ port: 3001, host: "0.0.0.0" });
