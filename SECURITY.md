# Security Policy

## Supported Versions

We actively support the following versions of Raypx Kit packages:

| Package | Version | Supported          |
| ------- | ------- | ------------------ |
| @raypx/env | 0.0.x   | :white_check_mark: |
| @raypx/i18n | 0.0.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please follow these steps:

### 1. **Do NOT** create a public issue

Please do not report security vulnerabilities through public GitHub issues.

### 2. Report privately

Send a detailed report to: **security@raypx.com** (or use GitHub Security Advisories)

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### 3. What to expect

- **Acknowledgment**: We'll confirm receipt within 48 hours
- **Investigation**: We'll investigate and assess the severity
- **Fix**: We'll develop and test a fix
- **Disclosure**: We'll coordinate disclosure timing with you
- **Credit**: We'll credit you in the release notes (if desired)

### Response Timeline

| Stage | Timeline |
|-------|----------|
| Initial Response | Within 48 hours |
| Severity Assessment | Within 1 week |
| Fix Development | 2-4 weeks (depending on severity) |
| Public Disclosure | After fix is released |

## Security Best Practices

When using Raypx Kit packages:

### @raypx/env

- ✅ **Never commit `.env` files** to version control
- ✅ **Use different secrets** for development and production
- ✅ **Validate all environment variables** at startup
- ✅ **Use strong secrets** (minimum 32 characters)
- ❌ **Never expose server-side env vars** to the client

```typescript
// ✅ Good: Separate client and server env
const env = createEnv({
  client: {
    NEXT_PUBLIC_API_URL: z.string().url(),
  },
  server: {
    DATABASE_URL: z.string(),
    API_SECRET: z.string().min(32),
  },
});

// ❌ Bad: Exposing secrets to client
const env = createEnv({
  client: {
    API_SECRET: z.string(), // Never do this!
  },
});
```

### @raypx/i18n

- ✅ **Sanitize user input** in translation strings
- ✅ **Validate locale values** to prevent path traversal
- ✅ **Use CSP headers** to prevent XSS
- ❌ **Never trust user-provided locales** without validation

```typescript
// ✅ Good: Whitelist locales
const validLocales = ['en', 'zh', 'ja'];
const locale = validLocales.includes(userLocale) ? userLocale : 'en';

// ❌ Bad: Using user input directly
const locale = req.query.locale; // Potential path traversal
```

## Known Security Considerations

### Environment Variables (@raypx/env)

**Risk**: Environment variables can be accessed by any code in your process.

**Mitigation**:
- Use principle of least privilege
- Rotate secrets regularly
- Monitor for suspicious access patterns

### Translation Files (@raypx/i18n)

**Risk**: Malicious translation files could contain XSS payloads.

**Mitigation**:
- Only load translations from trusted sources
- Sanitize user-generated content
- Use Content Security Policy headers

## Dependency Security

We regularly update dependencies to patch known vulnerabilities:

- Automated dependency updates via Dependabot
- Security audits with `pnpm audit`
- Regular reviews of dependency licenses

## Vulnerability Disclosure Policy

We follow responsible disclosure:

1. **Private disclosure** to maintainers
2. **Fix development** in private
3. **Security advisory** published
4. **Public disclosure** after fix is available

## Security Updates

Subscribe to security updates:

- Watch this repository for security advisories
- Follow [@raypx](https://twitter.com/raypx) on Twitter
- Subscribe to our [mailing list](https://raypx.com/security)

## Bug Bounty Program

We currently do not offer a bug bounty program, but we deeply appreciate responsible disclosure and will credit researchers in our release notes.

## Contact

- **Security Issues**: security@raypx.com
- **General Questions**: support@raypx.com
- **GitHub Security Advisory**: [Create an advisory](https://github.com/raypx/raypx-kit/security/advisories/new)

## License

This security policy is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
