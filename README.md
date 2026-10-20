<div align="center">

# SentinelScan

### Multi-Tenant Vulnerability Scanning and Security Intelligence Platform

**Queue-driven scanning, automated evidence capture, real-time alerting, and exportable reporting for security teams.**

[![Next.js](https://img.shields.io/badge/Next.js-16.4.0-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/Database-Neon_PostgreSQL-336791?logo=postgresql&logoColor=white)](https://neon.tech/)
[![Redis](https://img.shields.io/badge/Queue-Upstash_Redis-DC382D?logo=redis&logoColor=white)](https://upstash.com/)
[![pnpm](https://img.shields.io/badge/pnpm-monorepo-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE.md)

[Features](#2-features) · [Architecture](#3-architecture) · [Getting Started](#7-getting-started) · [Responsible Use](#9-responsible-use) · [Limitations](#10-limitations-and-non-goals)

</div>

---

## Document Control

| | |
| :--- | :--- |
| **Project** | SentinelScan |
| **Type** | Full-stack security platform (pnpm monorepo) |
| **Owner** | Muhammad Umer ([@MUmer007](https://github.com/MUmer007)) |
| **Runtime** | Node.js 20+, pnpm 9+ |
| **Repository** | [MUmer007/Senti_Intel_Scan](https://github.com/MUmer007/Senti_Intel_Scan) |
| **License** | MIT |

---

## Contents

1. [Overview](#1-overview)
2. [Features](#2-features)
3. [Architecture](#3-architecture)
4. [Scan Lifecycle](#4-scan-lifecycle)
5. [Tech Stack](#5-tech-stack)
6. [Repository Structure](#6-repository-structure)
7. [Getting Started](#7-getting-started)
8. [Configuration](#8-configuration)
9. [Responsible Use](#9-responsible-use)
10. [Limitations and Non-Goals](#10-limitations-and-non-goals)
11. [Roadmap](#11-roadmap)
12. [Contributing and Support](#12-contributing-and-support)
13. [Author](#13-author)
14. [License](#14-license)

---

## 1. Overview

Running vulnerability scans is easy. Running them continuously, across many targets, with evidence, alerting, and reports that stakeholders can read, is the harder part. SentinelScan wraps a proven open-source scanner in a platform that handles the operational work:

- Scans run as **background jobs**, so long-running work never blocks the web application.
- Each finding is backed by **captured evidence**.
- **High and Critical** findings trigger alerts immediately.
- Results export to **PDF and CSV** for compliance and stakeholder review.
- Tenants authenticate through **Clerk**, with data scoped per tenant.

SentinelScan orchestrates [ProjectDiscovery Nuclei](https://github.com/projectdiscovery/nuclei) for detection. It does not implement its own vulnerability checks, so detection coverage is that of the Nuclei templates in use.

---

## 2. Features

| Capability | Description |
| :--- | :--- |
| **Template-based scanning** | Runs Nuclei for fast, template-driven vulnerability detection. |
| **Evidence capture** | Uses Playwright to capture screenshots of target endpoints during scans, stored as base64. |
| **Decoupled job processing** | A dedicated worker consumes a BullMQ queue backed by Upstash Redis, keeping long scans off the Next.js API. |
| **Scheduled scans** | A `node-cron` scheduler queues recurring scans for verified targets. |
| **Real-time alerting** | Discord webhook notifications for High and Critical findings. |
| **Reporting** | One-click PDF and CSV report generation. |
| **Multi-tenant access** | Clerk-based authentication and session management with tenant-scoped data. |
| **Dashboard** | Responsive interface built with Tailwind CSS, shadcn/ui, and Recharts. |

---

## 3. Architecture

SentinelScan is a pnpm monorepo with a deliberate split between the request path and the scanning path.

```mermaid
graph LR
    U[User] --> W[Web App<br/>Next.js API]
    W -->|enqueue scan job| Q[(BullMQ<br/>Upstash Redis)]
    Q --> K[Worker<br/>Nuclei + Playwright]
    K -->|findings + evidence| D[(Neon PostgreSQL)]
    K -->|High / Critical| A[Discord Alert]
    W <-->|read / write| D
    S[node-cron Scheduler] -->|enqueue recurring scans| Q
    W -->|auth| C[Clerk]
```

### Components

| Component | Path | Responsibility |
| :--- | :--- | :--- |
| **Web app** | `apps/web` | Next.js 16 UI, Clerk authentication, API routes, report generation |
| **Worker** | `apps/worker` | Consumes the BullMQ queue, executes Nuclei scans, captures Playwright screenshots, sends alerts |
| **Database package** | `packages/db` | Shared Drizzle ORM schema for Neon PostgreSQL |
| **Shared package** | `packages/shared` | TypeScript types and normalization logic shared across apps |

### Why this shape

| Decision | Rationale | Trade-off |
| :--- | :--- | :--- |
| Separate worker process | Scans are long-running and need binaries (Nuclei) and a headless browser, which do not belong in a web request. | A second deployable that needs a long-running host. |
| BullMQ job queue | Retries, scheduling, and backpressure for scan jobs. | Adds a Redis dependency. |
| Shared `db` and `shared` packages | One schema and one set of types for web and worker. | Requires monorepo discipline. |
| Serverless Postgres (Neon) | No database server to operate; scales down when idle. | Cold-start latency on idle connections. |
| Clerk for identity | Avoids building authentication and session management. | Authorization and tenant isolation must still be enforced in application queries. |

---

## 4. Scan Lifecycle

1. **Request.** A user (or the scheduler) requests a scan for a target.
2. **Enqueue.** The web app validates the request and adds a job to the BullMQ queue.
3. **Execute.** The worker picks up the job and runs Nuclei against the target.
4. **Capture.** Playwright captures a screenshot of the target endpoint as evidence.
5. **Normalize and store.** Findings are normalized using shared logic and written to PostgreSQL with their evidence.
6. **Alert.** High and Critical findings trigger a Discord webhook notification.
7. **Review and export.** Users review findings in the dashboard and export PDF or CSV reports.

---

## 5. Tech Stack

| Category | Technologies |
| :--- | :--- |
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn/ui, Recharts, jsPDF |
| **Backend and worker** | Node.js, BullMQ, Playwright, Nuclei, node-cron, execa |
| **Database** | Neon (serverless PostgreSQL), Drizzle ORM, postgres.js |
| **Queue** | Upstash Redis |
| **Authentication** | Clerk (multi-tenant, session management) |
| **Infrastructure** | Vercel (web), Upstash (Redis), GitHub Actions |

---

## 6. Repository Structure

```text
Senti_Intel_Scan/
├── apps/
│   ├── web/        # Next.js 16 app: UI, Clerk auth, API routes
│   └── worker/     # BullMQ consumer: Nuclei scans, Playwright capture, alerts
├── packages/
│   ├── db/         # Drizzle ORM schema (Neon PostgreSQL)
│   └── shared/     # Shared TypeScript types and normalization logic
├── LICENSE.md
└── README.md
```

---

## 7. Getting Started

### Prerequisites

| Requirement | Notes |
| :--- | :--- |
| Node.js | v20 or later |
| pnpm | v9 or later |
| PostgreSQL | Local, or a cloud instance such as [Neon](https://neon.tech/) |
| Redis | Local (Docker) or [Upstash](https://upstash.com/) |
| Nuclei | Installed and available on the worker's `PATH` ([install guide](https://docs.projectdiscovery.io/opensource/nuclei/install)) |
| Playwright browsers | Installed for the worker (see step 4) |
| Clerk application | Publishable and secret keys |
| Discord webhook | Optional, for alerts |

### Installation

```bash
# 1. Clone
git clone https://github.com/MUmer007/Senti_Intel_Scan.git
cd Senti_Intel_Scan

# 2. Install dependencies
pnpm install

# 3. Configure environment (see Section 8)
cp .env.example .env   # if present; otherwise create .env manually

# 4. Install the Playwright browser used for screenshots
pnpm exec playwright install chromium
```

After configuring the environment, apply the Drizzle schema to your database, then start the web app and the worker as separate processes (each app's `package.json` lists its scripts).

---

## 8. Configuration

Create a `.env` file in the repository root, and in `apps/web` and `apps/worker` where those apps require it.

| Variable | Required | Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | Yes | PostgreSQL connection string (Neon or local) |
| `UPSTASH_REDIS_REST_URL` | Yes | Upstash Redis endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Yes | Upstash Redis token |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | Clerk publishable key |
| `CLERK_SECRET_KEY` | Yes | Clerk secret key |
| `DISCORD_WEBHOOK_URL` | No | Webhook for High and Critical alerts |

```bash
# Database
DATABASE_URL="postgresql://user:password@host:port/dbname"

# Redis (Upstash or local)
UPSTASH_REDIS_REST_URL="https://your-redis-url.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-redis-token"

# Authentication (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."

# Alerts
DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."
```

> **Never commit `.env` files or real keys.** Use your host's secret manager in deployed environments.

---

## 9. Responsible Use

SentinelScan sends active probes to the targets it scans.

- **Only scan systems you own or have explicit written authorization to test.** Unauthorized scanning can be illegal and may violate provider terms of service.
- Scheduled scans run only against **verified targets**.
- Findings may contain sensitive details about a target. Treat reports and stored evidence as confidential.
- The authors accept no liability for misuse of this software.

### Reporting a vulnerability in SentinelScan

Please use GitHub's private vulnerability reporting on this repository, or open an issue without exploit details and request a private channel.

---

## 10. Limitations and Non-Goals

1. **Detection is bounded by Nuclei templates.** SentinelScan does not perform its own crawling-based or logic-level vulnerability discovery. Findings and false-positive rates follow the templates in use.
2. **Evidence storage.** Screenshots are stored as base64 in PostgreSQL. This is simple, but it increases row size and database cost at scale. Object storage would be the next step for high volumes.
3. **Worker hosting.** The worker needs a long-running host with Nuclei and a Chromium install. It cannot run on a serverless web platform.
4. **No independent security audit.** Tenant isolation and access control have not been externally reviewed.
5. **Not a compliance product.** Reports support review and communication. They do not constitute a certified assessment.

---

## 11. Roadmap

- Move screenshot evidence from database rows to object storage.
- Add additional alert channels beyond Discord.
- Add finding triage workflow (status, assignment, suppression).
- Add automated tests and CI gates for the worker and shared packages.

---

## 12. Contributing and Support

Contributions are welcome.

1. Open an issue describing the change before large work.
2. Branch from `main` and keep pull requests focused.
3. Make sure linting and type checks pass before submitting.

For questions or bug reports, use [GitHub Issues](https://github.com/MUmer007/Senti_Intel_Scan/issues).

---

## 13. Author

**Muhammad Umer**
GitHub: [@MUmer007](https://github.com/MUmer007)

---

## 14. License

Released under the MIT License. See [LICENSE.md](LICENSE.md).
