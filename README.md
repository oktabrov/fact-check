# Fact-Check

> Check the evidence. Think before you share.

Fact-Check is an evidence-led Media and Information Literacy (MIL) web prototype. It helps people investigate a claim or image context through a transparent, curated source registry, then brings them back to the original evidence.

It is an independent youth-built prototype created for the [UNESCO Youth Hackathon 2026](https://www.unesco.org/en/articles/unesco-youth-hackathon-2026?hub=390). It is not affiliated with or endorsed by UNESCO.

## The idea

AI can make misleading content faster, cheaper, and more convincing to produce. The answer should not be another opaque tool that simply says "true" or "false."

Fact-Check turns verification into a practical habit:

1. Ask a clear question about a claim or image.
2. Search only a public, administrator-managed source registry.
3. Show the evidence, direct links, time of check, and source-list version.
4. Make uncertainty visible when the selected sources do not provide enough evidence.

The goal is not to replace journalists, experts, or human judgment. It is to help young people and communities ask better questions before they believe or share information.

## PostgreSQL-backed data

Fact-Check now uses PostgreSQL for its production data, rather than JSON files:

- **trusted_sources** stores the transparent public registry and administrator edits.
- **source_registry** stores the version and update time shown on results.
- **app_users** stores user accounts with salted, scrypt-hashed passwords.
- **auth_sessions** stores hashed, expiring user and administrator sessions, so sessions survive an app restart.

The bundled **data/trusted-sources.json** file is a one-time seed of 100 starter sources. It is not the live production database after setup.

## Prototype features

- Responsive home, checker, trusted-source directory, methodology, about, contact, login, sign-up, account, and separate admin views.
- Home-page overview of the live trusted-source registry, grouped by source type.
- 100 starter sources across international authorities, public agencies, verification organisations, and public-interest journalism.
- Downloadable, versioned PDF of the active source list.
- Separate administrator credentials from **ADMIN_USER** and **ADMIN_PASSWORD**; ordinary accounts never receive source-management access.
- PostgreSQL-backed user accounts and sessions using HttpOnly cookies.
- Source-restricted OpenAI Responses API integration with server-side citation filtering and optional image input.

## Run locally

1. Run **npm install**.
2. Copy the values from **environment.example.env** into a private **environment.env** file.
3. Set **DATABASE_URL** to your PostgreSQL database, for example **postgresql://postgres:your-password@localhost:5432/fact_check**.
4. Set **api_key**, **ADMIN_USER**, and a strong **ADMIN_PASSWORD**.
5. Run **npm run db:setup** to apply the schema and seed the 100 trusted sources.
6. Run **npm start**, then open **http://localhost:3000**.

The setup command is safe to run repeatedly: migrations are recorded, and the source seed only runs if the live registry is empty.

## Database commands

- **npm run db:migrate** applies versioned PostgreSQL migrations.
- **npm run db:seed** imports the initial trusted-source registry only when the table is empty.
- **npm run db:setup** runs both commands in order.

## Safety and deployment notes

- Put the app behind HTTPS before public deployment.
- Keep **environment.env** private; it contains the OpenAI key, database URL, and administrator credentials.
- Set **DATABASE_SSL=true** when your managed PostgreSQL provider requires TLS.
- Do not make the administrator URL part of public navigation. It remains available at **/admin** and is protected by the server-side credentials.
- The registry enforces a maximum of 100 active domains, preserving the trusted-source-only search boundary.
- Publish a clear source-admission policy, privacy notice for image uploads, and human-review route before a public pilot.

## Short pitch

**Fact-Check helps people build the habit of checking before sharing: it uses AI to organize evidence from a transparent source list, while keeping the final judgment with the person reading it.**
