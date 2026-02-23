/** @file Tests for logger utility.
 *
 * Verifies createLogger returns a Logger with the expected methods, that
 * messages include the prefix, and that log level filtering works.
 */

import { assertEquals, assertExists } from "@std/assert";
import { createLogger } from "./logger.ts";

Deno.test("createLogger returns Logger with debug, info, warn, error methods", () => {
  const logger = createLogger("Test");
  assertExists(logger.debug, "Logger should have debug method");
  assertExists(logger.info, "Logger should have info method");
  assertExists(logger.warn, "Logger should have warn method");
  assertExists(logger.error, "Logger should have error method");
  assertEquals(typeof logger.debug, "function");
  assertEquals(typeof logger.info, "function");
  assertEquals(typeof logger.warn, "function");
  assertEquals(typeof logger.error, "function");
});

Deno.test("logger info messages include prefix", () => {
  const logCalls: unknown[][] = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => {
    logCalls.push(args);
    originalLog.apply(console, args);
  };
  try {
    const logger = createLogger("S3");
    logger.info("test message");
    const infoCall = logCalls.find(
      (args) =>
        typeof args[0] === "string" &&
        args[0].includes("test message") &&
        args[0].includes("[S3"),
    );
    assertExists(infoCall, "Expected info call with prefix and message");
    assertExists(
      (infoCall![0] as string).match(/^\[S3 INFO\] test message$/),
      "Message should match [S3 INFO] test message",
    );
  } finally {
    console.log = originalLog;
  }
});

Deno.test("logger debug is suppressed when LOG_LEVEL is INFO", () => {
  const savedLevel = Deno.env.get("LOG_LEVEL");
  const originalLog = console.log;
  try {
    Deno.env.set("LOG_LEVEL", "INFO");
    const logCalls: unknown[][] = [];
    console.log = (...args: unknown[]) => logCalls.push(args);
    const logger = createLogger("Test");
    logCalls.length = 0;
    logger.debug("should not appear");
    const debugCall = logCalls.find(
      (args) =>
        typeof args[0] === "string" && args[0].includes("should not appear"),
    );
    assertEquals(
      debugCall,
      undefined,
      "debug should not log when level is INFO",
    );
  } finally {
    if (savedLevel !== undefined) {
      Deno.env.set("LOG_LEVEL", savedLevel);
    } else {
      Deno.env.delete("LOG_LEVEL");
    }
    console.log = originalLog;
  }
});

Deno.test("logger debug logs when LOG_LEVEL is DEBUG", () => {
  const savedLevel = Deno.env.get("LOG_LEVEL");
  const originalLog = console.log;
  try {
    Deno.env.set("LOG_LEVEL", "DEBUG");
    const logCalls: unknown[][] = [];
    console.log = (...args: unknown[]) => logCalls.push(args);
    const logger = createLogger("API");
    logCalls.length = 0;
    logger.debug("debug message");
    const debugCall = logCalls.find(
      (args) =>
        typeof args[0] === "string" && args[0].includes("debug message"),
    );
    assertExists(debugCall, "debug should log when level is DEBUG");
    assertExists(
      (debugCall![0] as string).match(/^\[API DEBUG\] debug message$/),
      "Message should match [API DEBUG] debug message",
    );
  } finally {
    if (savedLevel !== undefined) {
      Deno.env.set("LOG_LEVEL", savedLevel);
    } else {
      Deno.env.delete("LOG_LEVEL");
    }
    console.log = originalLog;
  }
});

Deno.test("logger warn uses console.warn", () => {
  const savedLevel = Deno.env.get("LOG_LEVEL");
  const originalWarn = console.warn;
  try {
    Deno.env.set("LOG_LEVEL", "WARN");
    const warnCalls: unknown[][] = [];
    console.warn = (...args: unknown[]) => warnCalls.push(args);
    const logger = createLogger("X");
    warnCalls.length = 0;
    logger.warn("warn msg");
    assertExists(
      warnCalls.find(
        (args) => typeof args[0] === "string" && args[0].includes("warn msg"),
      ),
      "warn should call console.warn",
    );
  } finally {
    if (savedLevel !== undefined) {
      Deno.env.set("LOG_LEVEL", savedLevel);
    } else {
      Deno.env.delete("LOG_LEVEL");
    }
    console.warn = originalWarn;
  }
});

Deno.test("logger error uses console.error", () => {
  const savedLevel = Deno.env.get("LOG_LEVEL");
  const originalError = console.error;
  try {
    Deno.env.set("LOG_LEVEL", "ERROR");
    const errorCalls: unknown[][] = [];
    console.error = (...args: unknown[]) => errorCalls.push(args);
    const logger = createLogger("Y");
    errorCalls.length = 0;
    logger.error("err msg");
    assertExists(
      errorCalls.find(
        (args) => typeof args[0] === "string" && args[0].includes("err msg"),
      ),
      "error should call console.error",
    );
  } finally {
    if (savedLevel !== undefined) {
      Deno.env.set("LOG_LEVEL", savedLevel);
    } else {
      Deno.env.delete("LOG_LEVEL");
    }
    console.error = originalError;
  }
});

Deno.test("createLogger uses custom env var for log level when provided", () => {
  const savedLevel = Deno.env.get("LOG_LEVEL");
  const savedCustom = Deno.env.get("CUSTOM_LOG_LEVEL");
  const originalLog = console.log;
  try {
    Deno.env.set("LOG_LEVEL", "ERROR");
    Deno.env.set("CUSTOM_LOG_LEVEL", "DEBUG");
    const logCalls: unknown[][] = [];
    console.log = (...args: unknown[]) => logCalls.push(args);
    const logger = createLogger("Z", "CUSTOM_LOG_LEVEL");
    logCalls.length = 0;
    logger.debug("custom debug");
    const debugCall = logCalls.find(
      (args) => typeof args[0] === "string" && args[0].includes("custom debug"),
    );
    assertExists(
      debugCall,
      "Logger with CUSTOM_LOG_LEVEL=DEBUG should log debug despite LOG_LEVEL=ERROR",
    );
  } finally {
    if (savedLevel !== undefined) {
      Deno.env.set("LOG_LEVEL", savedLevel);
    } else {
      Deno.env.delete("LOG_LEVEL");
    }
    if (savedCustom !== undefined) {
      Deno.env.set("CUSTOM_LOG_LEVEL", savedCustom);
    } else {
      Deno.env.delete("CUSTOM_LOG_LEVEL");
    }
    console.log = originalLog;
  }
});

Deno.test("createLogger defaults to INFO when LOG_LEVEL is unset", () => {
  const savedLevel = Deno.env.get("LOG_LEVEL");
  const originalLog = console.log;
  try {
    Deno.env.delete("LOG_LEVEL");
    const logCalls: unknown[][] = [];
    console.log = (...args: unknown[]) => logCalls.push(args);
    const logger = createLogger("Default");
    const initCall = logCalls.find(
      (args) =>
        typeof args[0] === "string" && args[0].includes("Logger initialized"),
    );
    assertExists(initCall, "Logger should log initialization");
    assertExists(
      (initCall![0] as string).includes("level: INFO"),
      "Default level should be INFO when LOG_LEVEL unset",
    );
    logCalls.length = 0;
    logger.debug("no debug");
    assertEquals(
      logCalls.find((args) =>
        typeof args[0] === "string" && args[0].includes("no debug")
      ),
      undefined,
      "debug should not log at default INFO level",
    );
  } finally {
    if (savedLevel !== undefined) {
      Deno.env.set("LOG_LEVEL", savedLevel);
    } else {
      Deno.env.delete("LOG_LEVEL");
    }
    console.log = originalLog;
  }
});
