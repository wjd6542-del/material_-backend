import Fastify from "fastify";
import multipart from "@fastify/multipart";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";

import errorHandlerPlugin from "./plugins/errorHandler.plugin.js";

import auditHook from "./plugins/auditHook.js";

// 통계용 자동 크론
// import "./cron/cron.js";

const app = Fastify({ logger: true });
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
// ✅ 전역 헤더 검사
// ----------------------------
app.addHook("onRequest", async (request, reply) => {
  const apiKey = request.headers["x-api-key"];

  if (request.url.startsWith("/api/")) {
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const authHeader = request.headers.authorization;

    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        request.user = {
          id: decoded.userId,
          username: decoded.username,
        };
      } catch (err) {
        return reply.code(401).send({ error: "Invalid token" });
      }
    }
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
// 서버 시작
// ----------------------------
app.listen({ port: 3001, host: "0.0.0.0" });
