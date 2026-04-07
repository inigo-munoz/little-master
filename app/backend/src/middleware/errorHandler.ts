import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { AppError, ErrorCode } from "@dnd/shared";

export function errorHandler(
  error: FastifyError | AppError | ZodError | Error,
  request: FastifyRequest,
  reply: FastifyReply
) {
  request.log.error({ err: error }, "Request error");

  // Zod validation errors
  if (error instanceof ZodError) {
    return reply.status(400).send({
      success: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: "Validation failed",
        details: error.format(),
      },
    });
  }

  // Domain errors
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
  }

  // Fastify built-in errors (e.g. 404 from sensible)
  if ("statusCode" in error && typeof error.statusCode === "number") {
    return reply.status(error.statusCode).send({
      success: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: error.message,
      },
    });
  }

  // Provider-specific errors with actionable codes
  if (error.message?.startsWith("INSUFFICIENT_CREDITS:")) {
    return reply.status(402).send({
      success: false,
      error: {
        code: "INSUFFICIENT_CREDITS",
        message: "El proveedor de IA no tiene crédito suficiente. Ve a Settings y recarga tu cuenta.",
        details: { provider: (error as any).provider },
      },
    });
  }

  if (error.message?.startsWith("INVALID_API_KEY:")) {
    return reply.status(401).send({
      success: false,
      error: {
        code: "INVALID_API_KEY",
        message: "API key inválida. Ve a Settings y verifica tu clave.",
        details: { provider: (error as any).provider },
      },
    });
  }

  if (error.message?.startsWith("RATE_LIMITED:")) {
    return reply.status(429).send({
      success: false,
      error: {
        code: "RATE_LIMITED",
        message: "Límite de peticiones alcanzado. Espera unos segundos e inténtalo de nuevo.",
        details: { provider: (error as any).provider },
      },
    });
  }

  // Unexpected errors — don't leak internals
  return reply.status(500).send({
    success: false,
    error: {
      code: ErrorCode.INTERNAL_ERROR,
      message: "An unexpected error occurred",
    },
  });
}
