import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createConsola,
  getLogger,
  type Logger,
  logger,
  setLogger,
  setSilentMode,
} from "../src/index";

describe("@raypx/logger", () => {
  beforeEach(() => {
    // Reset logger before each test
    const freshLogger = createConsola({
      level: process.env.NODE_ENV === "production" ? 3 : 4,
      formatOptions: {
        colors: true,
        date: true,
        compact: false,
      },
    });
    setLogger(freshLogger);
  });

  describe("logger instance", () => {
    it("should export a logger instance", () => {
      expect(logger).toBeDefined();
      expect(typeof logger).toBe("object");
    });

    it("should have standard logging methods", () => {
      expect(typeof logger.log).toBe("function");
      expect(typeof logger.info).toBe("function");
      expect(typeof logger.warn).toBe("function");
      expect(typeof logger.error).toBe("function");
      expect(typeof logger.debug).toBe("function");
      expect(typeof logger.success).toBe("function");
    });

    it("should support logging calls without throwing", () => {
      expect(() => logger.log("test message")).not.toThrow();
      expect(() => logger.info("info message")).not.toThrow();
      expect(() => logger.warn("warning message")).not.toThrow();
      expect(() => logger.error("error message")).not.toThrow();
      expect(() => logger.debug("debug message")).not.toThrow();
    });
  });

  describe("getLogger", () => {
    it("should return the current logger instance", () => {
      const currentLogger = getLogger();
      expect(currentLogger).toBeDefined();
      expect(typeof currentLogger.log).toBe("function");
    });

    it("should return the same instance as the proxy logger delegates to", () => {
      const currentLogger = getLogger();
      expect(currentLogger.level).toBe(logger.level);
    });
  });

  describe("setLogger", () => {
    it("should replace the logger instance", () => {
      const customLogger = createConsola({
        level: 0,
        formatOptions: {
          colors: false,
          date: false,
          compact: true,
        },
      });

      setLogger(customLogger);
      const currentLogger = getLogger();

      expect(currentLogger.level).toBe(0);
      expect(currentLogger).toBe(customLogger);
    });

    it("should affect the proxy logger behavior", () => {
      const customLogger = createConsola({ level: 0 });
      setLogger(customLogger);

      expect(logger.level).toBe(0);
    });
  });

  describe("setSilentMode", () => {
    it("should set logger to error-only mode when silent is true", () => {
      setSilentMode(true);
      expect(getLogger().level).toBe(1);
    });

    it("should restore normal log level when silent is false", () => {
      setSilentMode(false);
      const expectedLevel = process.env.NODE_ENV === "production" ? 3 : 4;
      expect(getLogger().level).toBe(expectedLevel);
    });

    it("should toggle between silent and normal modes", () => {
      const expectedNormalLevel = process.env.NODE_ENV === "production" ? 3 : 4;

      setSilentMode(true);
      expect(getLogger().level).toBe(1);

      setSilentMode(false);
      expect(getLogger().level).toBe(expectedNormalLevel);

      setSilentMode(true);
      expect(getLogger().level).toBe(1);
    });
  });

  describe("createConsola", () => {
    it("should be exported and callable", () => {
      expect(createConsola).toBeDefined();
      expect(typeof createConsola).toBe("function");
    });

    it("should create a new consola instance", () => {
      const newLogger = createConsola({ level: 2 });
      expect(newLogger).toBeDefined();
      expect(newLogger.level).toBe(2);
    });

    it("should create independent logger instances", () => {
      const logger1 = createConsola({ level: 1 });
      const logger2 = createConsola({ level: 4 });

      expect(logger1.level).toBe(1);
      expect(logger2.level).toBe(4);
    });
  });

  describe("Logger type", () => {
    it("should export Logger type", () => {
      const testLogger: Logger = createConsola({ level: 3 });
      expect(testLogger).toBeDefined();
    });
  });

  describe("default log levels", () => {
    it("should use level 3 (info) in production", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      const prodLogger = createConsola({
        level: process.env.NODE_ENV === "production" ? 3 : 4,
      });

      expect(prodLogger.level).toBe(3);

      process.env.NODE_ENV = originalEnv;
    });

    it("should use level 4 (debug) in development", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      const devLogger = createConsola({
        level: process.env.NODE_ENV === "production" ? 3 : 4,
      });

      expect(devLogger.level).toBe(4);

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe("proxy behavior", () => {
    it("should delegate method calls to the underlying logger", () => {
      const mockLogger = createConsola({ level: 4 });
      const logSpy = vi.spyOn(mockLogger, "log");

      setLogger(mockLogger);
      logger.log("test");

      expect(logSpy).toHaveBeenCalledWith("test");
    });

    it("should reflect property changes in the underlying logger", () => {
      const customLogger = createConsola({ level: 2 });
      setLogger(customLogger);

      expect(logger.level).toBe(2);

      customLogger.level = 4;
      expect(logger.level).toBe(4);
    });
  });

  describe("withTag feature", () => {
    it("should support creating tagged loggers", () => {
      const taggedLogger = createConsola({ level: 4 }).withTag("TestTag");

      expect(taggedLogger).toBeDefined();
      expect(typeof taggedLogger.log).toBe("function");
    });

    it("should create independent tagged loggers", () => {
      const logger1 = createConsola({ level: 3 }).withTag("Module1");
      const logger2 = createConsola({ level: 4 }).withTag("Module2");

      expect(logger1).not.toBe(logger2);
    });
  });
});
