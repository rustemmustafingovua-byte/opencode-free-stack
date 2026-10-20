# Security policy

## Supported versions

| Version | Supported |
|---|---|
| 0.1.x | ✅ |

## Reporting a vulnerability

Open a private security advisory on GitHub
(**Security → Report a vulnerability**) rather than a public issue.

## What this project does with keys

`opencode-free-stack` **never stores keys**. It reads them from the
environment (`OPENCODE_API_KEY`, `GITHUB_TOKEN`, `BEATAPI_API_KEY`,
`APINEX_API_KEY`) and forwards them to the provider you configured.

- keys are never written to disk by this package
- keys are never logged — error messages are truncated and never include headers
- the registry (`models.json`) is public data fetched without credentials

## Trust boundary

The router decides *which provider* serves a request. It does not change the
request body. If you let a model pick arbitrary providers, restrict the chain
yourself with `providers: [...]` in `router.chat()`.
