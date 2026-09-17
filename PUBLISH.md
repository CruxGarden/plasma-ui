# Publishing to npm

How to publish `@cruxgarden/plasma-ui` to npm. The workflow matches the Crux
Garden CLI: version, publish and push in one command.

## Prerequisites

- An [npm account](https://www.npmjs.com/signup)
- Publish access to the `@cruxgarden` scope on npm
- The git repository is up to date and pushed
- Node 22 (`nvm use`)

## First time setup

### 1. Log in to npm

```bash
npm login
```

You are prompted for username, password, email and a one-time password when
two-factor authentication is on, which it should be.

### 2. Check what ships

The package is an allowlist: `files` in `package.json` publishes `dist`,
`README.md`, `LICENSE` and `CHANGELOG.md` and nothing else. Confirm before the
first publish:

```bash
npm pack --dry-run
```

Source, tests, docs, examples and the site are development-only and stay out of
the tarball.

### 3. Verify

```bash
npm run verify
```

Typecheck, tests and the build. `prepublishOnly` runs the same three steps
again during publish, so a broken build cannot reach npm.

## Publishing a release

Pick the bump that matches the change, then run one command:

```bash
npm run publish:patch   # 0.1.0 -> 0.1.1  bug fixes
npm run publish:minor   # 0.1.0 -> 0.2.0  new features, backwards compatible
npm run publish:major   # 0.1.0 -> 1.0.0  breaking changes
```

Each script bumps the version, creates the git tag, publishes to npm and
pushes the commit and the tag.

The package is scoped, so `publishConfig.access` is `public`. Without it npm
would publish a scoped package as private and the install would fail for
everyone else.

## After publishing

- Add the release to `CHANGELOG.md`
- Check the package page at https://www.npmjs.com/package/@cruxgarden/plasma-ui
- Install it somewhere clean and import it once:

```bash
npm install @cruxgarden/plasma-ui
```

## Unpublishing

npm allows unpublishing within 72 hours of a release. Prefer a new patch
release over unpublishing, since anything already installed breaks.

```bash
npm unpublish @cruxgarden/plasma-ui@0.1.0
```

## Troubleshooting

**402 Payment Required** — the scoped package is being published as private.
Confirm `publishConfig.access` is `public`.

**403 Forbidden** — you are not a member of the `@cruxgarden` scope, or the
version already exists. Versions are immutable; bump and publish again.

**The tarball is missing files** — check `files` in `package.json`, then rerun
`npm pack --dry-run`.
