function getPostgresErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  if ("code" in error) {
    const code = (error as { code?: string }).code;
    if (code) {
      return code;
    }
  }

  if ("cause" in error) {
    const cause = (error as { cause?: unknown }).cause;
    if (typeof cause === "object" && cause !== null && "code" in cause) {
      const code = (cause as { code?: string }).code;
      if (code) {
        return code;
      }
    }
  }

  return undefined;
}

export function isUniqueViolation(error: unknown): boolean {
  return getPostgresErrorCode(error) === "23505";
}
