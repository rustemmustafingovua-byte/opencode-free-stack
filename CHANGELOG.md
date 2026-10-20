# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- hosted registry API with an x402 price
- adapters for more free providers (Groq, Cerebras, Google AI Studio, GitLab Duo, Cloudflare Workers AI)
- policy file to pin which providers may be used at all

### Fixed
- OpenCode plugin: continues a turn with the next free model on `402`/`429`

## [0.1.0] - 2026-10-20

### Added
- provider registry with RPM limits, daily token pools and model weights
- sliding-window RPM limiter
- daily pool accounting charged as `tokens × weight`
- fallback router with error classification (`rate_limit`, `quota_exhausted`, `auth`, `upstream`)
- CLI `ofs` with `models`, `status`, `chain` and `route`
- public model registry (`models.json`) refreshed every 6 hours
- CI on Node 20/22/24, npm publishing on tag
- strategy, launch kit and a growth digest script
