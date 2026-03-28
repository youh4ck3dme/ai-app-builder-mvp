# AI App Builder MVP

A small Next.js App Router skeleton for building your own **Lovable/v0-style AI app builder**.

## What this MVP already does

- creates projects from a natural-language prompt
- starts a durable workflow for generation
- plans a file architecture
- generates files one-by-one
- stores plan, files, status, and timeline in a persistent SQLite database through Prisma
- shows live-ish progress in the dashboard via polling

## Stack

- Next.js App Router
- Vercel Workflow DevKit
- Vercel AI SDK
- Prisma + SQLite
- Zod

## Quick start

```bash
npm install
DATABASE_URL='file:./dev.db' npm run prisma:generate
DATABASE_URL='file:./dev.db' npm run prisma:push
npm run dev
```

Open `http://localhost:3000`.

## Useful workflow commands

```bash
npm run workflow:web
npm run workflow:runs
```

## Project shape

```txt
app/
  api/projects/...
  projects/[id]/page.tsx
components/
lib/
  mock-services.ts
  prisma.ts
  project-repository.ts
  workflows/app-generator.ts
prisma/
  schema.prisma
types/
```

## MVP flow

1. User creates a project.
2. `POST /api/projects/[id]/generate` starts the workflow.
3. Workflow generates an architecture plan.
4. Status flips to `generating-code`.
5. Each file is generated in its own durable step.
6. Generated files are saved into the database.
7. Status flips to `completed`.

## What to swap next for a real builder

- move from SQLite to Postgres / Neon / Supabase
- replace polling with workflow stream output or SSE
- push generated files into Vercel Sandbox or a preview workspace
- add build/test/fix loops
- add template packs and guardrails
