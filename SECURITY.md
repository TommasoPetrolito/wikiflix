# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Which versions are eligible for receiving such patches depends on the CVSS v3.0 Rating:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please **do not** open a public issue. Instead, please email security concerns to the repository maintainer.

Please include the following information:
- Type of vulnerability
- Full paths of source file(s) related to the vulnerability
- The location of the affected source code
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue

We will respond within 48 hours and keep you updated on the progress.

## Security Best Practices

### For Users

- **Never commit `.env` files** - Always use `.env.example` as a template
- **Rotate API keys** - If keys are exposed, regenerate them immediately
- **Use environment variables** - Never hardcode sensitive data
- **Keep dependencies updated** - Run `npm audit` regularly

### For Developers

- **Review PRs carefully** - Check for accidental key commits
- **Use branch protection** - Enable on main branch
- **Scan dependencies** - Use `npm audit` before merging
- **Validate inputs** - Sanitize user inputs and API responses

## Known Security Considerations

### API Keys
- API keys are exposed client-side (VITE_ prefix)
- This is expected behavior for Vite applications
- Keys should have rate limits configured
- Consider using API key restrictions if available

### Third-Party APIs
- This project uses external APIs (TMDB, Vidking, etc.)
- Users are responsible for API terms of service compliance
- No copyrighted content is stored - only metadata

### Streaming Content
- Video streaming is handled by third-party services
- This project does not host or distribute video content
- Users must comply with applicable laws and ToS

## Disclosure Policy

- Security vulnerabilities will be disclosed after a patch is available
- Patches will be released as quickly as possible
- Credit will be given to security researchers (if desired)

---

**Thank you for helping keep Flux secure!**

