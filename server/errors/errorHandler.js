export default function errorHandler(error, request, reply) {
  const isOperational = error.isOperational === true;

  const statusCode = error.statusCode || 500;
  const code = error.code || "INTERNAL_SERVER_ERROR";
  const message = isOperational ? error.message : "서버 오류가 발생했습니다.";

  if (!isOperational) {
    request.log.error(error);
  }

  return reply.status(statusCode).send({
    success: false,
    code,
    message,
  });
}
