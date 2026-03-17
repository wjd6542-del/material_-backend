import errorHandler from "../errors/errorHandler.js";

export default async function errorHandlerPlugin(fastify) {
  fastify.setErrorHandler(errorHandler);
}
