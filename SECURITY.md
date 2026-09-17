# Security Policy

This file covers `@cruxgarden/plasma-ui`, the React liquid panels library.
The desktop app has its own policy in the `app` repository, the API in `api`, and the
command line tool in `cli`.

The library renders WebGL in the page it is installed into. It ships no server, reads no
credentials and makes no network requests.

## Supported Versions

Security fixes go into the current release line only (`version` in `package.json`).

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| older   | :x:                |

## Reporting a Vulnerability

We take the security of Crux Garden seriously. If you believe you have found a security
vulnerability, please report it to us as described below.

### Please do NOT:

- Open a public GitHub issue for security vulnerabilities
- Publicly disclose the vulnerability before it has been addressed

### Please DO:

1. **Report privately** - Email security details to [keeper@crux.garden](mailto:keeper@crux.garden)
2. **Provide details** - Include steps to reproduce, potential impact, and any suggested fixes
3. **Allow time** - Give us reasonable time to address the issue before any public disclosure

### What to include in your report:

- Type of vulnerability (e.g. command injection through an argument, a secret written to disk or
  to logs, a container exposed beyond localhost)
- Full paths of source file(s) related to the vulnerability
- Location of the affected source code (tag/branch/commit or direct URL)
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the vulnerability, including how an attacker might exploit it

### What to expect:

- **Acknowledgment** - We will acknowledge receipt of your vulnerability report within 48 hours
- **Assessment** - We will assess the vulnerability and determine its impact and severity
- **Updates** - We will send you regular updates about our progress
- **Resolution** - Once the vulnerability is fixed, we will notify you and may publicly disclose it (with your permission)
- **Credit** - We will credit you in the security advisory (unless you prefer to remain anonymous)

## What the library is, and what to watch

`@cruxgarden/plasma-ui` is a React component library. It publishes a single bundled ESM
file and its type declarations; React and React DOM stay peer dependencies and are not
bundled. It has no account, sends nothing to crux.garden, and collects no telemetry.

### What the library does and does not do

- It compiles and runs a WebGL shader in the host page and reads pointer and resize events.
  It does not read cookies, storage or credentials, and it makes no network requests.
- Shader source and geometry come from the library itself. Panel content is rendered by React
  in the host application, so escaping that content stays the host's responsibility.
- No build step of the published package executes code on install. There is no `postinstall`.

### Reporting-worthy issues in the library itself

- Any code path that sends data off the page
- A prop reaching `innerHTML`, `eval`, or shader source concatenation unescaped
- A dependency added to `dependencies` rather than `peerDependencies` or `devDependencies`
- A published tarball containing anything beyond `dist`, `README.md`, `LICENSE` and `CHANGELOG.md`

## Security Updates

Security fixes are published to npm as new `@cruxgarden/plasma-ui` versions; `npm install
@cruxgarden/plasma-ui@latest` picks them up. Watch this repository to be notified.

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [npm supply chain best practices](https://docs.npmjs.com/packages-and-modules/securing-your-code)

## Contact

For security concerns, please contact us at [keeper@crux.garden](mailto:keeper@crux.garden).

Thank you for helping keep Crux Garden and our users safe!
