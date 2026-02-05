/** Mock for logger.ts - no-op logger for s3.server tests */
import type { Logger } from "../logger.ts";

const noop = (): void => {};

export function createLogger(_prefix: string, _envVar?: string): Logger {
  return {
    debug: noop,
    info: noop,
    warn: noop,
    error: noop,
  };
}
