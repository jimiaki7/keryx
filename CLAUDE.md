# Keryx Development Instructions

Keryx is a Japanese-first sermon planning and preparation workspace. The product owner is Jimi.

## Read First

Before proposing architecture or editing product behavior, read:

@docs/product/00_HANDOFF_INDEX.md
@docs/product/KERYX_PRODUCT_SPEC.md
@docs/product/TECHNICAL_ARCHITECTURE.md
@docs/product/ROADMAP.md
@docs/product/IMPLEMENTATION_BACKLOG.md

## Repository State

- This is the target monorepo (ADR-0002): pnpm workspaces + Turborepo, Next.js App Router in `apps/web`, shared domain packages in `packages/*`, Supabase migrations in `supabase/`.
- The legacy Vite prototype lives at `/Users/james/keryx` and is a read-only reference. Never edit it.
- Use the committed `pnpm` commands: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
- Do not rewrite broadly. Move through small, tested vertical slices tied to backlog IDs (KX-xxx).

## Product Non-Negotiables

- Separate `message` content from the `gathering` where it is delivered.
- Connect them through `message_deliveries`.
- Store liturgy as ordered, flexible `service_elements`; never add fixed columns for each hymn or ceremony.
- Allow multiple hymns and ceremonies in any order.
- IDs are generated automatically. UUIDs are canonical; human-readable IDs are display-only.
- Store Scripture passages as validated structured ranges, not only free text.
- Use `公同書簡`, not `一般書簡`, as the Japanese New Testament genre label.
- Keep series separate from liturgical observances.
- Japanese is the default product language.
- Do not store or redistribute copyrighted Bible text without an explicit licensed source.
- AI suggestions never become canonical data without user approval.

## Engineering Rules

- Read existing code and git status before editing.
- Preserve unrelated user changes.
- Keep each change scoped to one backlog story or a small vertical slice.
- Use TypeScript strict and Zod at trust boundaries.
- Keep domain logic out of React components — put it in `packages/*`.
- Use migrations as the source of truth for production database changes.
- Enable RLS on every exposed Supabase table, with allow and deny tests.
- Never expose a service role key or AI provider key to the browser.
- Never use client-side checks as the only authorization layer.
- Prefer soft delete and restoration for user content.
- Never log sermon bodies, secrets, auth tokens, or API keys.

## UX Rules

- Design for a calm, pastoral, scholarly workspace, not a generic admin dashboard.
- Optimize Quick Add and the next-sermon workflow before secondary features.
- Every async screen needs loading, empty, error, and success states.
- Support keyboard use and Japanese IME behavior (no accidental submit on 変換確定 Enter).
- Target WCAG 2.2 AA.
- Do not use color as the only status indicator.

## Required Workflow

1. Inspect relevant code, docs, migrations, and tests.
2. State assumptions and identify any irreversible decision.
3. For substantial work, write or update an ADR and implementation plan.
4. Implement the smallest complete vertical slice.
5. Add or update unit, integration, E2E, and RLS tests appropriate to risk.
6. Run lint, typecheck, tests, and build.
7. Report changed files, verification results, remaining risks, and the next backlog ID.

## Definition Of Done

- Acceptance criteria are met.
- Authorization and validation are enforced at the correct boundary.
- Data migration and rollback impact are documented when relevant.
- Tests cover the changed behavior and important denial cases.
- Japanese UI text is consistent.
- Lint, typecheck, test, and build pass.
- Related product docs or ADRs are updated.
