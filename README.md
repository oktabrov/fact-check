# Fact-Check

> Check the evidence. Think before you share.

Fact-Check is an evidence-led Media and Information Literacy platform. It helps people investigate a claim or image context through a transparent, categorized source registry, then returns a concise result with direct links to the evidence.

Fact-Check is independently built by Umrbek Oktyabrov for the UNICEF Youth Hackathon 2026. It is not affiliated with or endorsed by UNICEF.

## How verification works

Fact-Check deliberately separates routing from evidence generation:

1. **Category routing** — A first OpenAI request receives the claim and the fixed source taxonomy. It selects the smallest relevant set of source categories. This request has no web-search tool and cannot return a verdict.
2. **Restricted evidence search** — A separate OpenAI request receives only the domains and source links in those selected categories. Its web search is restricted by an allowed-domain boundary, then all returned citations are validated server-side.
3. **Short, inspectable result** — The platform displays a concise evidence outcome, categories used, source count, direct citations, check time, and registry version.

For example, a question about whether cash can be used in Uzbekistan is routed to **Economy and finance** and **Government and law** before it can search evidence. It does not search unrelated weather, health, social-media, or open-web sources.

## Trusted-source governance

The public registry currently seeds **214 reviewed sources** across ten categories:

- International institutions
- Government and law
- Economy and finance
- Public health
- Weather and emergencies
- Science and environment
- Elections and civic information
- Cyber and digital safety
- Fact-checking and verification
- Public-interest journalism

The initial expansion prioritizes first-party official sources, including Uzbekistan's Government Portal, Lex.uz, Central Bank, Statistics Agency, and Central Election Commission alongside international public authorities.

New administrator submissions are handled as a source-admission workflow:

1. The candidate must use HTTPS and cannot be a social-platform domain.
2. An AI source-review request searches only that candidate domain and assigns a category.
3. The review must be high confidence and eligible.
4. The administrator must manually confirm official ownership and evidence scope.
5. The review outcome is written to a PostgreSQL audit table.

Social platforms such as Telegram, Facebook, Instagram, X, TikTok, and YouTube are intentionally excluded from the automated registry. An allowed-domain filter for a platform would authorize every account on that platform, not only an official channel.

The registry may grow beyond 100 domains, but each individual evidence search is capped at **100 selected domains**. This keeps a category-scoped check focused rather than silently widening it to the open web.

The enforced boundary is an approved HTTPS **domain** selected from the public registry, because web search works at domain scope. It is not a claim that every page on that domain proves every claim; citations are shown so people can inspect the specific evidence themselves.

## Platform architecture

Fact-Check stores production data in PostgreSQL:

- **trusted_sources** — public source registry, category keys, active state, and rationale
- **source_registry** — version and update timestamp for reproducible results
- **source_admission_reviews** — AI admission assessment and manual-review audit entries
- **app_users** — regular and administrator accounts with salted scrypt password hashes and explicit roles
- **auth_sessions** — hashed, expiring user and administrator sessions

The source list is public at /sources and downloadable at /api/sources.pdf. The administrator workspace remains at /admin and uses a database-backed `admin` role bootstrapped from private server environment values.

## Run locally

1. Run npm install.
2. Copy the values in environment.example.env into a private environment.env file.
3. Set DATABASE_URL, for example: postgresql://postgres:your-password@localhost:5432/fact_check
4. Set OPENAI_API_KEY (or api_key), ADMIN_EMAIL, and a strong ADMIN_PASSWORD. The administrator account is bootstrapped into PostgreSQL as an `admin` role when setup runs.
5. Run npm run db:setup.
6. Run npm start, then open http://localhost:3000.

## Database commands

- npm run db:migrate applies versioned PostgreSQL migrations.
- npm run db:seed adds missing reviewed seed sources without overwriting existing administrator-managed records.
- npm run db:setup runs migrations and the source seed in sequence.

## Deployment essentials

- Deploy behind HTTPS.
- Keep environment.env private; it contains the OpenAI key, PostgreSQL URL, and administrator credentials.
- Set DATABASE_SSL=true when the PostgreSQL provider requires TLS. Certificate validation stays on by default; only disable it when a provider explicitly requires that exception.
- Add edge/WAF rate limiting and bot protection before a multi-instance public launch; the application also limits anonymous verification requests to control paid AI use.
- Run npm test before deployment.
- Publish a privacy notice, accessibility statement, and human-review escalation route before opening the platform to the public.

## Product principle

**Fact-Check does not claim to be a universal truth machine. It shows what a defined, public, category-relevant source boundary supports at the time of a check — and gives the person using it the evidence to inspect.**
