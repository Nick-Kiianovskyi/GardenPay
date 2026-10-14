# Garden Association Management System — Solution Architecture

Project: **GardenPay** (garden-association-management) · Stack: React + TypeScript + Supabase (Postgres, Auth, Storage, Realtime, Edge Functions)

---

## 1. Business Goals

| # | Goal | Success Metric |
|---|------|----------------|
| G1 | Digitize membership administration (plots, members, renewals) | 100% of member records in system; <5 min to onboard a member |
| G2 | Automate fee/dues collection (membership fees, plot rent, special assessments) | ≥90% of dues collected digitally; <2% manual reconciliation effort |
| G3 | Reduce administrative workload of the volunteer board | ≥70% reduction in manual bookkeeping hours per season |
| G4 | Provide financial transparency to members | Real-time balance/ledger view; published annual report in ≤1 day |
| G5 | Coordinate communal work & maintenance (workdays, tasks, equipment) | Attendance tracked automatically; task SLA visibility |
| G6 | Enable communication (announcements, votes, documents) | Announcement read-receipts; e-voting quorum verifiable |
| G7 | Ensure legal/audit readiness (GDPR, retention, traceability) | Immutable audit log; data export/deletion on request |
| G8 | Low operating cost & easy handover between boards | Zero-infrastructure (Supabase); documented, typed codebase |

---

## 2. Functional Modules

**M1 — Membership & Registry**
Members, households, plot allocation, membership status (active/suspended/reserved), join/leave history, contact data, document vault (contracts, ID for KYC-light), photo gallery of plots.

**M2 — Plots & Land Registry**
Plot registry (number, area, soil type, location map), ownership/tenancy history, waiting list, assignment workflow, satellite/plan imagery overlay (optional).

**M3 — Fees & Payments (core, GardenPay)**
Fee schedules (annual dues, plot rent, water, late fees, special assessments), invoicing/billing runs, invoice generation, payment recording (bank transfer, SEPA direct debit, cash→manual entry), auto-matching of bank transactions (CSV import), member credit/balance, aging & dunning (reminders, reminders-plus-fee), refunds, accounting exports (DATEV/CSV).

**M4 — Accounting & Reporting**
Double-entry-style ledger (invoices, payments, adjustments), cash book, annual statement per member and per association, revenue/expense categories, reports (revenue by category, outstanding AR, aging, membership stats), audit trail.

**M5 — Events & Workdays**
Calendar, mandatory communal workdays, attendance check-in (QR/geo optional), substitution management, penalties for non-attendance (fee automation).

**M6 — Tasks & Maintenance**
Facility/garden maintenance tasks (water pump, paths, fences), assignment, status, photo evidence, recurring tasks, tool/equipment reservation inventory.

**M7 — Communication**
Announcements (role-targeted), news feed, email/optional push via Supabase Edge Functions + transactional mail provider, in-app notifications, read tracking.

**M8 — Governance & Voting**
Documents/statutes repository (versioned), general assembly agenda/minutes, e-voting with eligibility check (1 member = 1 vote), vote results with quorum computation, proxies.

**M9 — Administration & Configuration**
Role management, fee schedule configuration, seasonal settings, status workflows, public registration/waitlist, integrations (bank CSV, mail provider).

**M10 — Platform**
Auth (email + magic link/OAuth), profile, audit log, GDPR tools (export, anonymize), dashboard/analytics for board.

---

## 3. User Roles

| Role | Description | Key Permissions |
|------|-------------|-----------------|
| **Guest / Public** | Non-member visitor | View public info, apply for waiting list, pay join fee (optional) |
| **Member** | Plot holder / associate member | Own profile, plot, invoices, payments, balance; announcements; vote when open; task/attendance history |
| **Tenant** *(variant of Member)* | Rents without ownership | Same as member with restricted plot rights |
| **Workday Lead / Group Leader** | Group coordinator | Manage attendance, tasks, events for assigned area |
| **Treasurer** | Finance officer | All M3/M4: fee configs, billing runs, payment matching, reports, refunds |
| **Board Member** | Board role (Chair, Secretary…) | Read all modules, manage members/plots, publish announcements, manage documents |
| **Administrator** | System admin | Users, roles, config, integrations, audit log (no silent ledger edits) |
| **Auditor (read-only)** | External accountant/tax advisor | Read-only access to ledger and reports, scoped and time-limited |

Authorization model: **Postgres RLS** — roles stored in `profiles.roles` (or a `members.roles` join table); helper functions like `has_role('treasurer')`, `is_board()`, `member_id()` used in policies. Fine-grained permissions via a `permissions` table if roles multiply.

---

## 4. System Architecture

```
┌─────────────────────────────── Client (React + TS) ───────────────────────────────┐
│  Vite/Next-style SPA                                                              │
│  ├─ Routes (React Router)         ├─ Feature modules (M1…M10)                     │
│  ├─ State: TanStack Query (server) + Zustand/context (UI)                        │
│  ├─ Forms: React Hook Form + Zod (shared schemas)                                 │
│  ├─ UI kit (shadcn/Tailwind), i18n (de/en)                                       │
│  └─ Supabase JS client (typed via supabase-gen types)                             │
└───────────────────────────────┬──────────────────────────────────────────────────┘
                                │ HTTPS (REST + Realtime WebSocket)
┌───────────────────────────────▼──────────────────────────────────────────────────┐
│ Supabase                                                                         │
│  ├─ Auth ──────── JWT, RLS claims (role, member_id)                               │
│  ├─ Postgres ──── schema: core / finance / ops / governance                       │
│  │               RLS policies, views, triggers, functions, jobs                   │
│  ├─ Storage ───── documents, plot photos (private buckets, signed URLs)           │
│  ├─ Realtime ──── notifications, invoice status, task board updates               │
│  ├─ Edge Functions (Deno/TS)                                                      │
│  │    ├─ invoice-generation (billing run, idempotent)                             │
│  │    ├─ payment-reconciliation (bank CSV import, matching)                       │
│  │    ├─ dunning-job (scheduled reminders)                                        │
│  │    ├─ send-email (transactional provider: Resend/Postmark)                     │
│  │    ├─ vote-closure (quorum tally)                                              │
│  │    └─ gdpr-export / webhooks                                                   │
│  └─ Cron (pg_cron / Supabase schedules) ── billing runs, dunning, reminders       │
└───────────────────────────────┬──────────────────────────────────────────────────┘
                                │
                     External: mail provider, optional payment
                     provider (Stripe/SEPA), bank CSV feeds
```

**Layering rules**

- **All business rules enforced in Postgres** (constraints, triggers, RLS) — the client is never the authority. React code is a convenience layer.
- **Money is integer minor units** (`bigint` cents) — never floats.
- **Ledger is append-only**: `payments`, `adjustments` insert-only; corrections via compensating entries.
- **Idempotency keys** on invoice generation and payment import.
- **Type safety end-to-end**: DB types generated into `src/types/database.ts`; Zod schemas for form/API validation.

**Key schema sketch (domain entities)**

```
core:        profiles, memberships, roles, plots, plot_history, documents, waiting_list
finance:     fee_schedules, invoices, invoice_lines, payments, ledger_entries,
             bank_transactions, reconciliation_links, dunning_events
ops:         events, attendance, tasks, equipment, reservations
governance:  announcements, announcement_reads, votes, vote_options, vote_ballots, meeting_minutes
platform:    audit_log, notifications, settings
```

---

## 5. Data Flow

**A. Member onboarding**
Application (public form) → `waiting_list` → board approves → `profiles` + `memberships` created (trigger) → welcome email (Edge Function) → member logs in (magic link) → signs plot contract (upload to Storage) → plot assigned in `plot_history` → fee schedule applied.

**B. Billing run (core money flow)**
Treasurer/cron triggers billing run → `invoice-generation` function reads `fee_schedules` + active `memberships` → creates `invoices` + `invoice_lines` (idempotent per period) → ledger entries (AR debit) → invoice emailed → member sees it in dashboard (Realtime) → member pays (bank transfer/SEPA) → bank CSV imported → `payment-reconciliation` matches by reference/amount/date → `payments` posted, AR credited, member balance updated → unmatched items go to manual review queue.

**C. Dunning**
Scheduled job → finds overdue invoices → sends reminder (respecting grace period) → after N days adds late fee invoice → escalation flags visible to treasurer.

**D. Attendance & penalties**
Board creates event/workday → members notified → check-in recorded (`attendance`) → no-show triggers optional penalty fee invoice (same flow as B).

**E. Voting**
Board creates vote with eligibility snapshot (active members at cutoff) → member submits encrypted/unique ballot (one-per-member constraint) → on close, function tallies → result + quorum stored → immutable record + audit log.

**F. Read path**
React → TanStack Query → Postgres views (e.g., `v_member_statement`, `v_ar_aging`) → RLS filters by `auth.uid()` → cached, invalidated on Realtime events.

**G. Audit**
Every privileged mutation writes `audit_log` (actor, action, entity, before/after JSONB) via trigger.

---

## 6. Development Roadmap

**Phase 0 — Foundations (Week 1–2)**
Repo scaffold, Vite + React + TS + Tailwind, Supabase project, CI (lint, typecheck, tests), DB branching/migrations (supabase CLI), DB types pipeline, auth flow, RLS helper functions, base schema `core`.

**Phase 1 — MVP: Membership + Plots (Week 3–5)**
M1 + M2 + M10: profiles, roles/RLS, member CRUD, plot registry & assignment, waiting list, document storage, dashboard shell, audit log. *Exit criteria: board can run the registry fully in-app.*

**Phase 2 — Money MVP (Week 6–9)** ⭐ highest value
M3 + M4: fee schedules, invoice generation, manual payment entry, member statements, aging report, CSV bank import + auto-matching, basic ledger & treasurer dashboard. *Exit: one full billing cycle executed digitally.*

**Phase 3 — Operations (Week 10–12)**
M5 + M6: events/workdays, attendance, tasks, notifications (Realtime + email).

**Phase 4 — Communication & Governance (Week 13–15)**
M7 + M8: announcements, document repository, e-voting, minutes.

**Phase 5 — Automation & Hardening (Week 16–18)**
Scheduled dunning, SEPA/Stripe integration (optional), report pack (annual statement), performance indexes, GDPR export/anonymization, security review of RLS policies.

**Phase 6 — Pilot & Rollout (Week 19–22)**
Import historical data (members, plots, balances), train board, parallel-run one season with legacy process, feedback loop, v1.0 launch, documentation/handover.

**Cross-cutting tracks:** testing (vitest + RLS test harness with pgTAP/supabase test utils), e2e (Playwright on key flows: billing, reconciliation), accessibility/i18n, monitoring (Supabase logs + error tracking).

---

## Open Decisions

1. **Region/compliance**: Supabase project region vs. members' data residency (GDPR).
2. **Payment rails**: bank-transfer + CSV matching only (cheapest), vs. SEPA direct debit / Stripe (more automation, more compliance effort).
3. **Framework**: pure SPA (Vite) vs. Next.js SSR — SPA is sufficient if no public SEO needs.
4. **Voting**: binding e-votes required now, or Phase 4-deferrable?
