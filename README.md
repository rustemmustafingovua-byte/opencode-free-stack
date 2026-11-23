<div align="center">

# Opencode Free Stack

[![CI](https://github.com/rustemmustafingovua-byte/opencode-free-stack/actions/workflows/ci.yml/badge.svg)](https://github.com/rustemmustafingovua-byte/opencode-free-stack/actions/workflows/ci.yml) [![npm](https://img.shields.io/npm/v/opencode-free-stack?color=cb3837&logo=npm)](https://www.npmjs.com/package/opencode-free-stack) [![license](https://img.shields.io/badge/license-MIT-8b949e?logo=opensourceinitiative)](./LICENSE)

</div>

---

**Free-model stack for OpenCode — route every request to a model that costs $0, fall back automatically when a provider runs dry, and keep an eye on your daily quotas.**

---

⭐ **Star us on GitHub** if this project helps you build better agents!

---

## 🚀 Быстрый старт

```bash
git clone https://github.com/rustemmustafingovua-byte/opencode-free-stack
cd opencode-free-stack && npm install
opencode-free-stack models
```

---

## 🎯 Демо

```bash
opencode-free-stack models
opencode-free-stack status
opencode-free-stack route "привет"
```

---

## Supported Free-Tier Providers

Adding a new provider takes a single declarative entry in [`src/providers.js`](./src/providers.js). Both `FreeRouter` and `npm run sync-models` read from that registry automatically.

| Provider | ID | Environment Variable | RPM | Daily Token Pool | Notes |
| --- | --- | --- | --- | --- | --- |
| OpenCode Zen | `zen` | `OPENCODE_API_KEY` | — | — | `-free` models via OpenCode |
| GitHub Copilot | `copilot` | `GITHUB_TOKEN` | 30 | — | ~50 free premium requests/month |
| BeatAPI | `beatapi` | `BEATAPI_API_KEY` | 1 | — | 1 RPM free (10 RPM after top-up) |
| APInex | `apinex` | `APINEX_API_KEY` | 5 | 10M (weighted) | Resets 00:00 UTC |
| Groq | `groq` | `GROQ_API_KEY` | 30 | 500k | Free developer tier (`llama-3.3-70b-versatile`, `gpt-oss-120b`) |
| Cerebras | `cerebras` | `CEREBRAS_API_KEY` | 30 | 1M | Free tier (`gpt-oss-120b`, `qwen-3-32b`, `llama-3.3-70b`) |
| Google AI Studio | `google` | `GEMINI_API_KEY` / `GOOGLE_API_KEY` | 15 | — | OpenAI-compatible Gemini & Gemma free tier |
| GitLab Duo | `gitlab` | `GITLAB_TOKEN` | 20 | — | `$0` proxy models for eligible GitLab accounts |
| Cloudflare Workers AI | `cloudflare` | `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` | 30 | — | 10,000 free Neurons/day |
| Mistral La Plateforme | `mistral` | `MISTRAL_API_KEY` | 60 | — | Experiment free tier (`codestral-latest`, `mistral-small-latest`) |
| SambaNova | `sambanova` | `SAMBANOVA_API_KEY` | 20 | — | Fast free developer tier (`Meta-Llama-3.3-70B-Instruct`) |
| Nebius AI Studio | `nebius` | `NEBIUS_API_KEY` | 30 | — | OpenAI-compatible endpoint with free/trial models |
| Together AI | `together` | `TOGETHER_API_KEY` | 60 | — | Dedicated `-Free` endpoints |
| Venice AI | `venice` | `VENICE_API_KEY` | — | — | Paid x402 USDC fallback (no free models) |

Refresh [`models.json`](./models.json) from the registry and upstream catalogues:

```bash
npm run sync-models
```

---

## 💰 Монетизация

- **Custom provider plugins**: создание плагинов для новых free-tier провайдеров
- **Managed routing**: hosted-версия роутера для команд с SLA
- **Enterprise support**: приоритетная поддержка и кастомизация fallback-логики
- **Training & workshops**: обучение команд работе с free-tier AI-инфраструктурой

---

## Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/amazing-thing`)
3. Commit your changes (`git commit -m 'feat: add amazing thing'`)
4. Push to the branch (`git push origin feat/amazing-thing`)
5. Open a Pull Request

Bug reports and feature requests are welcome on the [Issues](https://github.com/rustemmustafingovua-byte/opencode-free-stack/issues) page.

MIT © rustemmustafingovua-byte
