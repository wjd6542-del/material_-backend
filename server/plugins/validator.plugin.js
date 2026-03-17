import AppError from "../errors/AppError.js";

export function validate(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map((err) => ({
      path: err.path.join("."), // ex: 0.text
      message: err.message,
      code: err.code,
    }));

    throw new AppError(
      result.error.issues[0].message,
      400,
      "VALIDATION_ERROR",
      issues, // 🔥 여기 중요
    );
  }
  return result.data;
}
