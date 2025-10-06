# Arb Plan Builder Canvas

This repository hosts a standalone Vite + React (TypeScript) playground for experimenting with tariff portfolios, ROI-aware booster pricing and multi-cohort revenue simulations for an arbitrage project.

## Structure

- `app/` – Vite project (React + TypeScript)
  - `src/components/ArbPlanBuilder.tsx` – main application canvas containing the planner, editors and simulation lab
  - `src/App.tsx`, `src/main.tsx`, `src/index.css` – application shell and styling
  - `package.json`, `tsconfig*.json`, `vite.config.ts` – tooling configuration

## Getting started

> **Note:** the execution environment used to build this change does not have internet access, so dependencies were not installed during the build. Run the steps below in an online environment to install dependencies.

```bash
cd app
npm install
npm run dev
```

If you are working behind a corporate proxy or a locked-down environment, you might need to explicitly allow access to the npm registry:

```bash
npm install --registry=https://registry.npmjs.org/
```

After the dependencies are installed, start the development server with `npm run dev` and open http://localhost:5173/ in your browser.

> **Troubleshooting tip:** in offline sandboxes (such as the evaluation environment used to produce this patch) the install step fails with a `403 Forbidden` error because external network access is blocked. In that case, clone the repository to a machine with internet access and run the commands above there.

## Key capabilities

- Dynamic booster pricing that increases with portfolio exposure and respects blocked tariffs
- Portfolio planner with ROI diagnostics per tariff and booster coverage analysis
- Editors for quickly prototyping new tariffs (with slot limits) and boosters (with block lists)
- Simulation lab for modeling multiple investor cohorts, aggregating deposits, payouts and project revenue streams

Self-tests covering ROI maths and pricing safeguards execute automatically on load (see `runSelfTests` inside `ArbPlanBuilder.tsx`).
