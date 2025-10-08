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
- Configurable booster pricing with гарантированным бонусом инвестору: новая формула всегда оставляет минимум заданный процент прибыли от цены даже при минимальном депозите
- Minimal white dashboard with capital, lift and yield stats surfaced in real time, including per-day/project revenue splits
- Time-aware booster analytics: lift per active hour, aggregated booster-hours, payback windows and row-level booster ROI shareouts
- Booster analytics table showing ROI, payback horizon and portfolio coverage for every option
- Expanded tariff catalogue with level-gated plans and open-access programmes that can be launched without level requirements
- Yield bands on every tariff/programme with editable min/max/base rates; planner surfaces the spread while the scenario slider biases calculations within the band
- Range-aware profit analytics that surface minimum/maximum investor payout corridors (per day and over the full term) in both the planner and the cohort simulator
- Programme entry fees with automatic break-even analytics, recommended deposit hints and amortised accounting in portfolio stats
- Programme premium controls to enforce relative/absolute lift versus free tariffs, compute recommended deposits and cap entry fees while tracking portfolio-level premium health
- Editors for quickly prototyping new tariffs (with slot limits, category/access toggles) and boosters (with block lists)
- Simulation lab for modeling multiple investor cohorts, aggregating deposits, payouts and project revenue streams
- Scenario slider in the simulation lab that blends worst-to-best acquisition assumptions (marketing burn, churn, reinvest share) and projects marketing spend, reinvested deposits and average daily onboarding
- MMM-style survival model that charts how long reserves last without new deposits, complete with reserve vs. time visualisation
- MMM survival model now guards against runaway reinvest queues/horizons, truncating gracefully and labelling the chart when limits are hit instead of freezing the page
- Redesigned tariff catalogue with iconography, locked-state messaging and richer programme callouts for quicker portfolio assembly
- Compact dropdown-based tariff picker with an inline preview (yield band, slot availability, recommended deposit and premium hints)
- Dropdown picker now allows staging the deposit before adding and surfaces net min/max profit together with entry-fee payback hints
- Booster deposits now treated as refundable escrow – excluded from project revenue and surfaced in planner/simulation totals
- Booster pricing управляется единственным параметром «гарантированный бонус»: цена берёт фактическую чистую прибыль
  портфеля (или опорный депозит, если портфель пустой) и делится на `(1 + бонус)` с учётом min/max порогов
- Compressed yield bands to keep daily percentage spreads tight, with min/max corridors reflected across planner analytics
- Refined glassmorphism-inspired UI with gradient background, pill toggles and softened cards for a contemporary white dashboard look
- Local persistence of tariff/booster catalogs plus booster pricing and programme premium controls via `localStorage`
- Scenario lab includes crisis/base/growth presets and defers heavy MMM recalculations so the tab stays responsive for larger portfolios

Self-tests covering ROI maths and pricing safeguards execute automatically on load (see `runSelfTests` inside `ArbPlanBuilder.tsx`).

## Booster pricing formula

Расчёт стоимости бустера строится на чистой прибыли портфеля и двух управляемых параметрах: доля прибыли, которую забирает бустер, и гарантированный бонус инвестору.

1. **Net-прибыль.** Суммируем чистый доход тарифов, на которые распространяется бустер, умножая на процент бустера и долю покрытия по времени. Учтены комиссии проекта и входные взносы программ. Если портфель пустой, используется опорный депозит из настроек и ближайший доступный тариф.
2. **Доля захвата.** Базовая цена — это `net × captureShare`, где `captureShare` задаётся в настройках (например, 30 %). Так легко повторить табличные расчёты команды.
3. **Гарантия инвестору.** Цена дополнительно ограничивается потолком `net / (1 + bonusShare)` — инвестор всегда получает минимум `bonusShare` (например, 20 %) поверх возврата цены бустера. Минимальная и максимальная планки применяются только если они не нарушают это ограничение.

Таким образом цена масштабируется вместе с реальной прибылью портфеля, остаётся выгодной даже при минимальном депозите и повторяет логику внутренних таблиц (чистая прибыль × процент захвата × ROI-ограничение).
