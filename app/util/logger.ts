/** @File Logger utility with controllable log levels */

/** Log levels */
type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

/** Log levels and their corresponding numeric values */
const LOG_LEVELS: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

/**
 * Get the current log level from environment variable LOG_LEVEL
 * Defaults to INFO if not set or invalid
 */
const getLogLevel = (): LogLevel => {
  const envLevel = Deno.env.get("LOG_LEVEL")?.toUpperCase() as LogLevel;
  if (envLevel && Object.prototype.hasOwnProperty.call(LOG_LEVELS, envLevel)) {
    return envLevel;
  }
  return "INFO";
};

/**
 * Logger interface with controllable log levels
 */
export interface Logger {
  debug: (message: string, ...args: unknown[]) => void;
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
}

/**
 * Create a logger instance with a specific prefix
 * @param prefix Prefix to add to all log messages (e.g., "S3", "API", etc.)
 * @param envVar Optional environment variable name to override log level (defaults to LOG_LEVEL)
 * @returns Logger instance
 */
export function createLogger(
  prefix: string,
  envVar?: string,
): Logger {
  // Allow per-logger log level override via environment variable
  const getLoggerLevel = (): LogLevel => {
    if (envVar) {
      const envLevel = Deno.env.get(envVar)?.toUpperCase() as LogLevel;
      if (
        envLevel && Object.prototype.hasOwnProperty.call(LOG_LEVELS, envLevel)
      ) {
        return envLevel;
      }
    }
    return getLogLevel();
  };

  const loggerLevel = getLoggerLevel();
  const loggerLevelNum = LOG_LEVELS[loggerLevel];

  const logger: Logger = {
    debug: (message: string, ...args: unknown[]) => {
      if (loggerLevelNum <= LOG_LEVELS.DEBUG) {
        console.log(`[${prefix} DEBUG] ${message}`, ...args);
      }
    },
    info: (message: string, ...args: unknown[]) => {
      if (loggerLevelNum <= LOG_LEVELS.INFO) {
        console.log(`[${prefix} INFO] ${message}`, ...args);
      }
    },
    warn: (message: string, ...args: unknown[]) => {
      if (loggerLevelNum <= LOG_LEVELS.WARN) {
        console.warn(`[${prefix} WARN] ${message}`, ...args);
      }
    },
    error: (message: string, ...args: unknown[]) => {
      if (loggerLevelNum <= LOG_LEVELS.ERROR) {
        console.error(`[${prefix} ERROR] ${message}`, ...args);
      }
    },
  };

  logger.info(`Logger initialized with level: ${loggerLevel}`);

  return logger;
}
