export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Logger {
  debug: (msg: string, meta?: Record<string, unknown>, err?: unknown) => void;
  info: (msg: string, meta?: Record<string, unknown>, err?: unknown) => void;
  warn: (msg: string, meta?: Record<string, unknown>, err?: unknown) => void;
  error: (msg: string, meta?: Record<string, unknown>, err?: unknown) => void;
}

const LEVEL_INDEX: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function isLogLevel(value: unknown): value is LogLevel {
  return (
    value === "debug" ||
    value === "info" ||
    value === "warn" ||
    value === "error"
  );
}

function readClientLocalStorageLevel(): LogLevel | undefined {
  try {
    if (typeof window === "undefined") return undefined;
    const v = window.localStorage.getItem("LOG_LEVEL");
    if (v && isLogLevel(v.toLowerCase())) return v.toLowerCase() as LogLevel;
  } catch {
    // no-op
  }
  return undefined;
}

function readEnvLevel(): LogLevel | undefined {
  // Client precedence: localStorage > NEXT_PUBLIC_LOG_LEVEL
  if (typeof window !== "undefined") {
    const ls = readClientLocalStorageLevel();
    if (ls) return ls;
    const env = (process?.env?.NEXT_PUBLIC_LOG_LEVEL ?? "").toLowerCase();
    if (isLogLevel(env)) return env;
    return undefined;
  }
  // Server precedence: LOG_LEVEL
  const serverEnv = (process?.env?.LOG_LEVEL ?? "").toLowerCase();
  if (isLogLevel(serverEnv)) return serverEnv;
  return undefined;
}

function currentLogLevel(): LogLevel {
  return readEnvLevel() ?? "info";
}

function normalizeError(
  err: unknown,
): { name?: string; message?: string; stack?: string } | undefined {
  if (!err) return undefined;
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  try {
    const asAny = err as any;
    if (
      typeof asAny === "object" &&
      ("message" in asAny || "stack" in asAny || "name" in asAny)
    ) {
      return {
        name: typeof asAny.name === "string" ? asAny.name : undefined,
        message: typeof asAny.message === "string" ? asAny.message : undefined,
        stack: typeof asAny.stack === "string" ? asAny.stack : undefined,
      };
    }
  } catch {
    // fallthrough
  }
  return { message: String(err) };
}

function shouldLog(methodLevel: LogLevel): boolean {
  const configured = currentLogLevel();
  return LEVEL_INDEX[configured] <= LEVEL_INDEX[methodLevel];
}

function logWithConsole(
  method: "debug" | "info" | "warn" | "error",
  payload: Record<string, unknown>,
): void {
  console[method](payload);
}

export function createLogger(namespace: string): Logger {
  const base = { ns: namespace } as const;

  const make =
    (level: LogLevel) =>
    (msg: string, meta?: Record<string, unknown>, err?: unknown) => {
      if (!shouldLog(level)) return;
      const errorObj = normalizeError(err);
      const payload: Record<string, unknown> = {
        ts: new Date().toISOString(),
        ...base,
        msg,
        ...(meta ?? {}),
        ...(errorObj ? { error: errorObj } : {}),
      };
      logWithConsole(level, payload);
    };

  return {
    debug: make("debug"),
    info: make("info"),
    warn: make("warn"),
    error: make("error"),
  };
}

/*
Example usage:

import { createLogger } from "@/lib/logger";
const log = createLogger("Stream");
log.info("Thread ID set", { threadId: "abc123" });
log.error("Failed to fetch graph info", { apiUrl }, new Error("boom"));
*/
