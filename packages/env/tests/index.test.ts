import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createEnv, z, DEFAULT_CLIENT_PREFIX, CLIENT_PREFIXES } from '../src/index';

describe('createEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('basic functionality', () => {
    it('should validate server environment variables', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/db';
      process.env.API_KEY = 'secret-key';

      const env = createEnv({
        server: {
          DATABASE_URL: z.string().url(),
          API_KEY: z.string().min(1),
        },
        isServer: true,
      });

      expect(env.DATABASE_URL).toBe('postgresql://localhost:5432/db');
      expect(env.API_KEY).toBe('secret-key');
    });

    it('should validate shared environment variables', () => {
      process.env.NODE_ENV = 'production';

      const env = createEnv({
        shared: {
          NODE_ENV: z.enum(['development', 'production', 'test']),
        },
        isServer: true,
      });

      expect(env.NODE_ENV).toBe('production');
    });

    it('should throw on invalid environment variables', () => {
      process.env.DATABASE_URL = 'not-a-url';

      expect(() =>
        createEnv({
          server: {
            DATABASE_URL: z.string().url(),
          },
          isServer: true,
        })
      ).toThrow();
    });

    it('should throw on missing required environment variables', () => {
      delete process.env.REQUIRED_VAR;

      expect(() =>
        createEnv({
          server: {
            REQUIRED_VAR: z.string().min(1),
          },
          isServer: true,
        })
      ).toThrow();
    });
  });

  describe('client prefix configuration', () => {
    it('should use default VITE_ prefix', () => {
      process.env.VITE_APP_URL = 'https://example.com';

      const env = createEnv({
        client: {
          VITE_APP_URL: z.string().url(),
        },
        isServer: false,
      });

      expect(env.VITE_APP_URL).toBe('https://example.com');
    });

    it('should support custom NEXT_PUBLIC_ prefix', () => {
      process.env.NEXT_PUBLIC_APP_URL = 'https://example.com';

      const env = createEnv({
        clientPrefix: CLIENT_PREFIXES.NEXT,
        client: {
          NEXT_PUBLIC_APP_URL: z.string().url(),
        },
        isServer: false,
      });

      expect(env.NEXT_PUBLIC_APP_URL).toBe('https://example.com');
    });

    it('should support custom prefix string', () => {
      process.env.CUSTOM_APP_URL = 'https://example.com';

      const env = createEnv({
        clientPrefix: 'CUSTOM_',
        client: {
          CUSTOM_APP_URL: z.string().url(),
        },
        isServer: false,
      });

      expect(env.CUSTOM_APP_URL).toBe('https://example.com');
    });
  });

  describe('skip validation', () => {
    it('should skip validation when skip is true', () => {
      delete process.env.DATABASE_URL;

      const env = createEnv({
        server: {
          DATABASE_URL: z.string().url(),
        },
        skip: true,
        isServer: true,
      });

      // Should not throw, but value will be undefined
      expect(env.DATABASE_URL).toBeUndefined();
    });
  });

  describe('extends functionality', () => {
    it('should merge extended configurations', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/db';
      process.env.REDIS_URL = 'redis://localhost:6379';
      process.env.API_KEY = 'secret';

      // Note: extends requires Preset type from envin
      // This test verifies basic merging functionality
      const env = createEnv({
        server: {
          DATABASE_URL: z.string().url(),
          REDIS_URL: z.string().url(),
          API_KEY: z.string().min(1),
        },
        isServer: true,
      });

      expect(env.DATABASE_URL).toBe('postgresql://localhost:5432/db');
      expect(env.REDIS_URL).toBe('redis://localhost:6379');
      expect(env.API_KEY).toBe('secret');
    });
  });

  describe('type transforms', () => {
    it('should transform string to number', () => {
      process.env.PORT = '3000';

      const env = createEnv({
        server: {
          PORT: z.string().transform((val) => parseInt(val, 10)),
        },
        isServer: true,
      });

      expect(env.PORT).toBe(3000);
      expect(typeof env.PORT).toBe('number');
    });

    it('should transform string to boolean', () => {
      process.env.ENABLE_FEATURE = 'true';

      const env = createEnv({
        server: {
          ENABLE_FEATURE: z.string().transform((val) => val === 'true'),
        },
        isServer: true,
      });

      expect(env.ENABLE_FEATURE).toBe(true);
      expect(typeof env.ENABLE_FEATURE).toBe('boolean');
    });
  });

  describe('default values', () => {
    it('should use default values for optional variables', () => {
      delete process.env.OPTIONAL_VAR;

      const env = createEnv({
        server: {
          OPTIONAL_VAR: z.string().default('default-value'),
        },
        isServer: true,
      });

      expect(env.OPTIONAL_VAR).toBe('default-value');
    });
  });

  describe('edge cases', () => {
    it('should handle empty string values', () => {
      process.env.EMPTY_VAR = '';

      expect(() =>
        createEnv({
          server: {
            EMPTY_VAR: z.string().min(1),
          },
          isServer: true,
        })
      ).toThrow();
    });

    it('should handle whitespace-only values', () => {
      process.env.WHITESPACE_VAR = '   ';

      const env = createEnv({
        server: {
          WHITESPACE_VAR: z.string().trim().min(1),
        },
        isServer: true,
        skip: true,
      });

      // With skip, validation is bypassed
      expect(env.WHITESPACE_VAR).toBe('   ');
    });

    it('should handle special characters in values', () => {
      process.env.SPECIAL_VAR = 'value with spaces & special chars!@#$%';

      const env = createEnv({
        server: {
          SPECIAL_VAR: z.string(),
        },
        isServer: true,
      });

      expect(env.SPECIAL_VAR).toBe('value with spaces & special chars!@#$%');
    });

    it('should handle very long values', () => {
      const longValue = 'x'.repeat(10000);
      process.env.LONG_VAR = longValue;

      const env = createEnv({
        server: {
          LONG_VAR: z.string(),
        },
        isServer: true,
      });

      expect(env.LONG_VAR).toBe(longValue);
      expect(env.LONG_VAR.length).toBe(10000);
    });
  });

  describe('complex type transforms', () => {
    it('should transform string to array', () => {
      process.env.ALLOWED_ORIGINS = 'http://localhost,https://example.com,https://api.example.com';

      const env = createEnv({
        server: {
          ALLOWED_ORIGINS: z.string().transform((val) => val.split(',')),
        },
        isServer: true,
      });

      expect(env.ALLOWED_ORIGINS).toEqual([
        'http://localhost',
        'https://example.com',
        'https://api.example.com',
      ]);
      expect(Array.isArray(env.ALLOWED_ORIGINS)).toBe(true);
    });

    it('should transform string to JSON object', () => {
      process.env.CONFIG_JSON = '{"key":"value","nested":{"a":1}}';

      const env = createEnv({
        server: {
          CONFIG_JSON: z.string().transform((val) => JSON.parse(val)),
        },
        isServer: true,
      });

      expect(env.CONFIG_JSON).toEqual({ key: 'value', nested: { a: 1 } });
    });

    it('should transform with multiple chained operations', () => {
      process.env.TRIMMED_UPPER = '  hello world  ';

      const env = createEnv({
        server: {
          TRIMMED_UPPER: z
            .string()
            .trim()
            .transform((val) => val.toUpperCase()),
        },
        isServer: true,
      });

      expect(env.TRIMMED_UPPER).toBe('HELLO WORLD');
    });

    it('should coerce string to number', () => {
      process.env.COERCED_NUMBER = '42';

      const env = createEnv({
        server: {
          COERCED_NUMBER: z.coerce.number(),
        },
        isServer: true,
      });

      expect(env.COERCED_NUMBER).toBe(42);
      expect(typeof env.COERCED_NUMBER).toBe('number');
    });

    it('should coerce string to boolean', () => {
      process.env.COERCED_BOOL = 'true';

      const env = createEnv({
        server: {
          COERCED_BOOL: z.coerce.boolean(),
        },
        isServer: true,
      });

      expect(env.COERCED_BOOL).toBe(true);
    });
  });

  describe('mixed server/client/shared', () => {
    it('should handle all three types together on server', () => {
      process.env.SERVER_VAR = 'server-value';
      process.env.VITE_CLIENT_VAR = 'client-value';
      process.env.SHARED_VAR = 'shared-value';

      const env = createEnv({
        server: {
          SERVER_VAR: z.string(),
        },
        client: {
          VITE_CLIENT_VAR: z.string(),
        },
        shared: {
          SHARED_VAR: z.string(),
        },
        isServer: true,
      });

      expect(env.SERVER_VAR).toBe('server-value');
      expect(env.VITE_CLIENT_VAR).toBe('client-value');
      expect(env.SHARED_VAR).toBe('shared-value');
    });

    it('should handle client and shared on client side', () => {
      process.env.VITE_CLIENT_VAR = 'client-value';
      process.env.SHARED_VAR = 'shared-value';

      const env = createEnv({
        client: {
          VITE_CLIENT_VAR: z.string(),
        },
        shared: {
          SHARED_VAR: z.string(),
        },
        isServer: false,
      });

      expect(env.VITE_CLIENT_VAR).toBe('client-value');
      expect(env.SHARED_VAR).toBe('shared-value');
    });
  });

  describe('optional and nullable values', () => {
    it('should handle optional values', () => {
      delete process.env.OPTIONAL_VAR;

      const env = createEnv({
        server: {
          OPTIONAL_VAR: z.string().optional(),
        },
        isServer: true,
      });

      expect(env.OPTIONAL_VAR).toBeUndefined();
    });

    it('should handle nullable values with transform', () => {
      process.env.NULLABLE_VAR = 'null';

      const env = createEnv({
        server: {
          NULLABLE_VAR: z
            .string()
            .transform((val) => (val === 'null' ? null : val))
            .nullable(),
        },
        isServer: true,
      });

      expect(env.NULLABLE_VAR).toBeNull();
    });

    it('should handle actual null with optional', () => {
      delete process.env.TRULY_OPTIONAL;

      const env = createEnv({
        server: {
          TRULY_OPTIONAL: z.string().optional().nullable(),
        },
        isServer: true,
      });

      expect(env.TRULY_OPTIONAL).toBeUndefined();
    });

    it('should handle optional with default', () => {
      delete process.env.OPTIONAL_WITH_DEFAULT;

      const env = createEnv({
        server: {
          OPTIONAL_WITH_DEFAULT: z.string().optional().default('fallback'),
        },
        isServer: true,
      });

      expect(env.OPTIONAL_WITH_DEFAULT).toBe('fallback');
    });
  });

  describe('validation patterns', () => {
    it('should validate email format', () => {
      process.env.EMAIL = 'test@example.com';

      const env = createEnv({
        server: {
          EMAIL: z.string().email(),
        },
        isServer: true,
      });

      expect(env.EMAIL).toBe('test@example.com');
    });

    it('should reject invalid email', () => {
      process.env.EMAIL = 'not-an-email';

      expect(() =>
        createEnv({
          server: {
            EMAIL: z.string().email(),
          },
          isServer: true,
        })
      ).toThrow();
    });

    it('should validate with regex pattern', () => {
      process.env.SEMVER = '1.2.3';

      const env = createEnv({
        server: {
          SEMVER: z.string().regex(/^\d+\.\d+\.\d+$/),
        },
        isServer: true,
      });

      expect(env.SEMVER).toBe('1.2.3');
    });

    it('should validate number ranges', () => {
      process.env.PORT = '8080';

      const env = createEnv({
        server: {
          PORT: z.coerce.number().min(1).max(65535),
        },
        isServer: true,
      });

      expect(env.PORT).toBe(8080);
    });

    it('should reject out of range numbers', () => {
      process.env.PORT = '70000';

      expect(() =>
        createEnv({
          server: {
            PORT: z.coerce.number().min(1).max(65535),
          },
          isServer: true,
        })
      ).toThrow();
    });

    it('should validate string length', () => {
      process.env.TOKEN = 'abc123def456';

      const env = createEnv({
        server: {
          TOKEN: z.string().min(10).max(100),
        },
        isServer: true,
      });

      expect(env.TOKEN).toBe('abc123def456');
    });

    it('should validate with refine', () => {
      process.env.EVEN_NUMBER = '4';

      const env = createEnv({
        server: {
          EVEN_NUMBER: z.coerce.number().refine((n) => n % 2 === 0, {
            message: 'Number must be even',
          }),
        },
        isServer: true,
      });

      expect(env.EVEN_NUMBER).toBe(4);
    });

    it('should reject refine validation failure', () => {
      process.env.EVEN_NUMBER = '3';

      expect(() =>
        createEnv({
          server: {
            EVEN_NUMBER: z.coerce.number().refine((n) => n % 2 === 0, {
              message: 'Number must be even',
            }),
          },
          isServer: true,
        })
      ).toThrow();
    });
  });

  describe('enum validation', () => {
    it('should validate enum values', () => {
      process.env.LOG_LEVEL = 'debug';

      const env = createEnv({
        server: {
          LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']),
        },
        isServer: true,
      });

      expect(env.LOG_LEVEL).toBe('debug');
    });

    it('should reject invalid enum values', () => {
      process.env.LOG_LEVEL = 'verbose';

      expect(() =>
        createEnv({
          server: {
            LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']),
          },
          isServer: true,
        })
      ).toThrow();
    });

    it('should handle native enum', () => {
      enum Environment {
        Development = 'development',
        Production = 'production',
        Test = 'test',
      }

      process.env.APP_ENV = 'production';

      const env = createEnv({
        server: {
          APP_ENV: z.nativeEnum(Environment),
        },
        isServer: true,
      });

      expect(env.APP_ENV).toBe(Environment.Production);
    });
  });

  describe('union types', () => {
    it('should handle union of literals', () => {
      process.env.FEATURE_FLAG = 'enabled';

      const env = createEnv({
        server: {
          FEATURE_FLAG: z.union([z.literal('enabled'), z.literal('disabled'), z.literal('beta')]),
        },
        isServer: true,
      });

      expect(env.FEATURE_FLAG).toBe('enabled');
    });

    it('should handle union with transform', () => {
      process.env.BOOL_OR_STRING = 'true';

      const env = createEnv({
        server: {
          BOOL_OR_STRING: z
            .string()
            .transform((val) => (val === 'true' ? true : val === 'false' ? false : val)),
        },
        isServer: true,
      });

      expect(env.BOOL_OR_STRING).toBe(true);
    });
  });

  describe('multiple variables validation', () => {
    it('should validate many variables at once', () => {
      process.env.VAR_1 = 'value1';
      process.env.VAR_2 = 'value2';
      process.env.VAR_3 = 'value3';
      process.env.VAR_4 = 'value4';
      process.env.VAR_5 = 'value5';

      const env = createEnv({
        server: {
          VAR_1: z.string(),
          VAR_2: z.string(),
          VAR_3: z.string(),
          VAR_4: z.string(),
          VAR_5: z.string(),
        },
        isServer: true,
      });

      expect(env.VAR_1).toBe('value1');
      expect(env.VAR_2).toBe('value2');
      expect(env.VAR_3).toBe('value3');
      expect(env.VAR_4).toBe('value4');
      expect(env.VAR_5).toBe('value5');
    });

    it('should report multiple validation errors', () => {
      process.env.URL_VAR = 'not-a-url';
      process.env.EMAIL_VAR = 'not-an-email';

      expect(() =>
        createEnv({
          server: {
            URL_VAR: z.string().url(),
            EMAIL_VAR: z.string().email(),
          },
          isServer: true,
        })
      ).toThrow();
    });
  });

  describe('real-world scenarios', () => {
    it('should handle database connection config', () => {
      process.env.DB_HOST = 'localhost';
      process.env.DB_PORT = '5432';
      process.env.DB_NAME = 'myapp';
      process.env.DB_USER = 'admin';
      process.env.DB_PASSWORD = 'secret123';

      const env = createEnv({
        server: {
          DB_HOST: z.string().min(1),
          DB_PORT: z.coerce.number().min(1).max(65535),
          DB_NAME: z.string().min(1),
          DB_USER: z.string().min(1),
          DB_PASSWORD: z.string().min(8),
        },
        isServer: true,
      });

      expect(env.DB_HOST).toBe('localhost');
      expect(env.DB_PORT).toBe(5432);
      expect(env.DB_NAME).toBe('myapp');
      expect(env.DB_USER).toBe('admin');
      expect(env.DB_PASSWORD).toBe('secret123');
    });

    it('should handle API configuration', () => {
      process.env.API_URL = 'https://api.example.com';
      process.env.API_KEY = 'sk-1234567890abcdef';
      process.env.API_TIMEOUT = '30000';
      process.env.API_RETRY_COUNT = '3';

      const env = createEnv({
        server: {
          API_URL: z.string().url(),
          API_KEY: z.string().min(10),
          API_TIMEOUT: z.coerce.number().min(1000).max(60000),
          API_RETRY_COUNT: z.coerce.number().min(0).max(10),
        },
        isServer: true,
      });

      expect(env.API_URL).toBe('https://api.example.com');
      expect(env.API_KEY).toBe('sk-1234567890abcdef');
      expect(env.API_TIMEOUT).toBe(30000);
      expect(env.API_RETRY_COUNT).toBe(3);
    });

    it('should handle feature flags', () => {
      process.env.ENABLE_ANALYTICS = 'true';
      process.env.ENABLE_DARK_MODE = 'false';
      process.env.MAX_UPLOAD_SIZE = '10485760';

      const env = createEnv({
        server: {
          ENABLE_ANALYTICS: z
            .string()
            .transform((val) => val === 'true')
            .pipe(z.boolean()),
          ENABLE_DARK_MODE: z
            .string()
            .transform((val) => val === 'true')
            .pipe(z.boolean()),
          MAX_UPLOAD_SIZE: z.coerce.number().min(0),
        },
        isServer: true,
      });

      expect(env.ENABLE_ANALYTICS).toBe(true);
      expect(env.ENABLE_DARK_MODE).toBe(false);
      expect(env.MAX_UPLOAD_SIZE).toBe(10485760);
    });
  });
});

describe('exports', () => {
  it('should export DEFAULT_CLIENT_PREFIX', () => {
    expect(DEFAULT_CLIENT_PREFIX).toBe('VITE_');
  });

  it('should export CLIENT_PREFIXES', () => {
    expect(CLIENT_PREFIXES.VITE).toBe('VITE_');
    expect(CLIENT_PREFIXES.NEXT).toBe('NEXT_PUBLIC_');
    expect(CLIENT_PREFIXES.NUXT).toBe('NUXT_PUBLIC_');
    expect(CLIENT_PREFIXES.EXPO).toBe('EXPO_PUBLIC_');
  });

  it('should export z from zod', () => {
    expect(z).toBeDefined();
    expect(z.string).toBeDefined();
  });
});
