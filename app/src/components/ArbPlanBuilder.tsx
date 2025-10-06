import React, { useEffect, useMemo, useState } from 'react';

type Subscription = {
  id: string;
  name: string;
  fee: number;
  price: number;
  minLevel: number;
};

type Tariff = {
  id: string;
  name: string;
  durationDays: number;
  dailyRate: number;
  minLevel: number;
  baseMin: number;
  baseMax: number;
  reqSub: string | null;
  isLimited: boolean;
  capSlots: number | null;
};

type Booster = {
  id: string;
  name: string;
  scope: 'account';
  effect: { type: 'mult'; value: number };
  durationHours: number;
  price: number;
  minLevel: number;
  reqSub: string | null;
  blockedTariffs: string[];
  limitPerPortfolio: number;
};

type PortfolioItem = {
  id: string;
  tariffId: string;
  amount: number;
};

type PortfolioRow = {
  key: string;
  t: Tariff;
  amount: number;
  multiplier: number;
  notes: string[];
  applicable: Booster[];
  dailyGross: number;
  feePerDay: number;
  gross: number;
  fee: number;
  accAlloc: number;
  accPerDay: number;
  subAlloc: number;
  subPerDay: number;
  netPerDayAfter: number;
  netAfter: number;
  netPerDayFinal: number;
  netFinal: number;
  netNoBoost: number;
  netNoBoostPerDay: number;
  boosterLift: number;
  boosterLiftPerDay: number;
};

type Totals = {
  grossProfitTotal: number;
  feeTotal: number;
  accountCost: number;
  subCost: number;
  investorNet: number;
  investorNetPerDay: number;
  projectRevenue: number;
  baselineNet: number;
  baselineNetPerDay: number;
  capital: number;
};

type ProjectionEntry = {
  id: string;
  name: string;
  fee: number;
  price: number;
  noReinvest: number;
  autoRoll: number;
};

type ComputedState = {
  rows: PortfolioRow[];
  totals: Totals;
  projection30: {
    withCurrentSub: {
      noReinvest: number;
      autoRoll: number;
    };
    compareSubs: ProjectionEntry[];
  };
  boosterSummary: {
    liftNet: number;
    liftPerDay: number;
    spend: number;
    roi: number;
    paybackDays: number | null;
  };
};

type BoosterImpact = {
  booster: Booster;
  netGain: number;
  netPerDay: number;
  netAfterCost: number;
  roi: number | null;
  paybackDays: number | null;
  coverageDeposits: number;
  coverageShare: number;
  affectedTariffs: number;
};

type PricingControls = {
  baseCapturePct: number;
  whaleCapturePct: number;
  investorRoiFloorPct: number;
  minPrice: number;
  maxPrice: number;
};

type InvestorSegment = {
  id: string;
  name: string;
  investors: number;
  userLevel: number;
  subscriptionId: string;
  accountBoosters: string[];
  portfolio: PortfolioItem[];
};

const SUBSCRIPTIONS: Subscription[] = [
  { id: 'free', name: 'Free', fee: 0.2, price: 0, minLevel: 1 },
  { id: 'bronze', name: 'Bronze', fee: 0.18, price: 9, minLevel: 1 },
  { id: 'silver', name: 'Silver', fee: 0.16, price: 19, minLevel: 2 },
  { id: 'gold', name: 'Gold', fee: 0.14, price: 29, minLevel: 3 },
  { id: 'platinum', name: 'Platinum', fee: 0.12, price: 49, minLevel: 5 },
  { id: 'pro', name: 'PRO', fee: 0.1, price: 79, minLevel: 7 },
  { id: 'elite', name: 'Elite', fee: 0.08, price: 109, minLevel: 10 },
  { id: 'ultra', name: 'Ultra', fee: 0.06, price: 149, minLevel: 12 },
  { id: 'infinity', name: 'Infinity', fee: 0.05, price: 179, minLevel: 15 }
];

const INIT_TARIFFS: Tariff[] = [
  { id: 't_start', name: 'Start Day', durationDays: 1, dailyRate: 0.003, minLevel: 1, baseMin: 20, baseMax: 500, reqSub: null, isLimited: false, capSlots: null },
  { id: 't_weekly_a', name: 'Weekly A', durationDays: 7, dailyRate: 0.004, minLevel: 1, baseMin: 50, baseMax: 1500, reqSub: null, isLimited: false, capSlots: null },
  { id: 't_weekly_b', name: 'Weekly B', durationDays: 7, dailyRate: 0.005, minLevel: 3, baseMin: 100, baseMax: 2500, reqSub: null, isLimited: false, capSlots: null },
  { id: 't_flex14', name: 'Flex 14', durationDays: 14, dailyRate: 0.006, minLevel: 4, baseMin: 150, baseMax: 4000, reqSub: null, isLimited: false, capSlots: null },
  { id: 't_month_std', name: 'Month Std', durationDays: 30, dailyRate: 0.0065, minLevel: 5, baseMin: 200, baseMax: 6000, reqSub: null, isLimited: false, capSlots: null },
  { id: 't_month_plus', name: 'Month Plus', durationDays: 30, dailyRate: 0.0075, minLevel: 7, baseMin: 300, baseMax: 8000, reqSub: 'gold', isLimited: false, capSlots: null },
  { id: 't_quarter', name: 'Quarter 90', durationDays: 90, dailyRate: 0.008, minLevel: 10, baseMin: 500, baseMax: 15000, reqSub: 'platinum', isLimited: false, capSlots: null },
  { id: 't_liq_pool', name: 'Liquidity Pool', durationDays: 21, dailyRate: 0.0065, minLevel: 6, baseMin: 500, baseMax: 10000, reqSub: null, isLimited: true, capSlots: 100 },
  { id: 't_express3', name: 'Express 3d', durationDays: 3, dailyRate: 0.007, minLevel: 2, baseMin: 50, baseMax: 1200, reqSub: null, isLimited: true, capSlots: 200 },
  { id: 't_mm30', name: 'Market Making 30', durationDays: 30, dailyRate: 0.009, minLevel: 12, baseMin: 1000, baseMax: 20000, reqSub: 'pro', isLimited: true, capSlots: 50 },
  { id: 't_global60', name: 'Global 60', durationDays: 60, dailyRate: 0.0095, minLevel: 14, baseMin: 2000, baseMax: 30000, reqSub: 'elite', isLimited: true, capSlots: 40 },
  { id: 't_prime45', name: 'Prime 45', durationDays: 45, dailyRate: 0.01, minLevel: 16, baseMin: 2500, baseMax: 35000, reqSub: 'ultra', isLimited: true, capSlots: 30 },
  { id: 't_flash7', name: 'Flash Seven', durationDays: 7, dailyRate: 0.011, minLevel: 8, baseMin: 400, baseMax: 4500, reqSub: 'gold', isLimited: true, capSlots: 70 },
  { id: 't_dual21', name: 'Dual 21', durationDays: 21, dailyRate: 0.0072, minLevel: 9, baseMin: 600, baseMax: 9000, reqSub: 'platinum', isLimited: false, capSlots: null },
  { id: 't_swing28', name: 'Swing 28', durationDays: 28, dailyRate: 0.0083, minLevel: 11, baseMin: 800, baseMax: 12000, reqSub: null, isLimited: false, capSlots: null },
  { id: 't_spot18', name: 'Spot 18', durationDays: 18, dailyRate: 0.0078, minLevel: 6, baseMin: 350, baseMax: 5500, reqSub: null, isLimited: false, capSlots: null },
  { id: 't_meta60', name: 'Meta 60', durationDays: 60, dailyRate: 0.0105, minLevel: 18, baseMin: 5000, baseMax: 42000, reqSub: 'infinity', isLimited: true, capSlots: 25 },
  { id: 't_spread10', name: 'Spread 10', durationDays: 10, dailyRate: 0.0068, minLevel: 4, baseMin: 200, baseMax: 3800, reqSub: null, isLimited: true, capSlots: 120 },
  { id: 't_quant90', name: 'Quant 90', durationDays: 90, dailyRate: 0.0098, minLevel: 17, baseMin: 3200, baseMax: 38000, reqSub: 'elite', isLimited: true, capSlots: 35 },
  { id: 't_event5', name: 'Event 5', durationDays: 5, dailyRate: 0.012, minLevel: 7, baseMin: 500, baseMax: 5000, reqSub: null, isLimited: true, capSlots: 20 },
  { id: 't_ai45', name: 'AI 45', durationDays: 45, dailyRate: 0.0112, minLevel: 15, baseMin: 2500, baseMax: 28000, reqSub: 'pro', isLimited: true, capSlots: 40 },
  { id: 't_yield75', name: 'Yield 75', durationDays: 75, dailyRate: 0.0089, minLevel: 13, baseMin: 1800, baseMax: 25000, reqSub: 'elite', isLimited: false, capSlots: null }
];

const BASE_BOOSTERS: Booster[] = [
  { id: 'b5_24h', name: '+5% x24h', scope: 'account', effect: { type: 'mult', value: 0.05 }, durationHours: 24, price: 1.2, minLevel: 1, reqSub: null, blockedTariffs: [], limitPerPortfolio: 5 },
  { id: 'b10_24h', name: '+10% x24h', scope: 'account', effect: { type: 'mult', value: 0.1 }, durationHours: 24, price: 2.5, minLevel: 2, reqSub: null, blockedTariffs: [], limitPerPortfolio: 5 },
  { id: 'b15_24h', name: '+15% x24h', scope: 'account', effect: { type: 'mult', value: 0.15 }, durationHours: 24, price: 4, minLevel: 3, reqSub: null, blockedTariffs: [], limitPerPortfolio: 4 },
  { id: 'b8_12h', name: '+8% x12h', scope: 'account', effect: { type: 'mult', value: 0.08 }, durationHours: 12, price: 1, minLevel: 1, reqSub: null, blockedTariffs: [], limitPerPortfolio: 6 },
  { id: 'b100_24h', name: '+100% x24h', scope: 'account', effect: { type: 'mult', value: 1 }, durationHours: 24, price: 0.9, minLevel: 3, reqSub: null, blockedTariffs: [], limitPerPortfolio: 1 },
  { id: 'b200_24h', name: '+200% x24h', scope: 'account', effect: { type: 'mult', value: 2 }, durationHours: 24, price: 1.8, minLevel: 5, reqSub: 'silver', blockedTariffs: ['t_start'], limitPerPortfolio: 1 },
  { id: 'b300_24h', name: '+300% x24h', scope: 'account', effect: { type: 'mult', value: 3 }, durationHours: 24, price: 3, minLevel: 7, reqSub: 'gold', blockedTariffs: ['t_start', 't_express3'], limitPerPortfolio: 1 },
  { id: 'b400_48h', name: '+400% x48h', scope: 'account', effect: { type: 'mult', value: 4 }, durationHours: 48, price: 6, minLevel: 10, reqSub: 'platinum', blockedTariffs: ['t_start', 't_express3', 't_weekly_a'], limitPerPortfolio: 1 },
  { id: 'b30_24h', name: '+30% x24h', scope: 'account', effect: { type: 'mult', value: 0.3 }, durationHours: 24, price: 35, minLevel: 14, reqSub: 'elite', blockedTariffs: ['t_start', 't_express3', 't_weekly_a', 't_weekly_b'], limitPerPortfolio: 1 },
  { id: 'b40_24h', name: '+40% x24h', scope: 'account', effect: { type: 'mult', value: 0.4 }, durationHours: 24, price: 55, minLevel: 16, reqSub: 'ultra', blockedTariffs: ['t_start', 't_express3', 't_weekly_a', 't_weekly_b', 't_liq_pool'], limitPerPortfolio: 1 },
  { id: 'b5_10h', name: '+5% x10h', scope: 'account', effect: { type: 'mult', value: 0.05 }, durationHours: 10, price: 3.5, minLevel: 4, reqSub: 'silver', blockedTariffs: [], limitPerPortfolio: 1 },
  { id: 'b8_24h', name: '+8% x24h', scope: 'account', effect: { type: 'mult', value: 0.08 }, durationHours: 24, price: 8, minLevel: 7, reqSub: 'gold', blockedTariffs: [], limitPerPortfolio: 1 },
  { id: 'b12_24h', name: '+12% x24h', scope: 'account', effect: { type: 'mult', value: 0.12 }, durationHours: 24, price: 12, minLevel: 12, reqSub: 'pro', blockedTariffs: [], limitPerPortfolio: 1 }
];

const SUB_RANKS = new Map(SUBSCRIPTIONS.map((s, i) => [s.id, i]));

function fmtMoney(n: number, currency = 'USD') {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

function withinLevel(userLevel: number, minLevel: number) {
  return userLevel >= minLevel;
}

function subMeets(requiredSubId: string | null, activeSubId: string) {
  if (!requiredSubId) return true;
  const rankReq = SUB_RANKS.get(requiredSubId) ?? -1;
  const rankAct = SUB_RANKS.get(activeSubId) ?? -1;
  return rankAct >= rankReq;
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function boosterCoverageMultiplier(value: number, coverageFrac: number) {
  return 1 + value * clamp(coverageFrac, 0, 1);
}

const DEFAULT_PRICING: PricingControls = {
  baseCapturePct: 65,
  whaleCapturePct: 45,
  investorRoiFloorPct: 120,
  minPrice: 0.5,
  maxPrice: 1_000_000
};

function smartPriceBoostersDyn(
  boosterList: Booster[],
  tariffs: Tariff[],
  sub: Subscription,
  userLevel: number,
  portfolio: PortfolioItem[],
  pricing: PricingControls = DEFAULT_PRICING
) {
  const eligibleTs = tariffs.filter(
    (t) => withinLevel(userLevel, t.minLevel) && subMeets(t.reqSub, sub.id)
  );
  if (eligibleTs.length === 0) return boosterList;

  const sortedByMin = [...eligibleTs].sort((a, b) => a.baseMin - b.baseMin);
  const lowT = sortedByMin.slice(0, 3);

  const baseCapture = clamp(pricing.baseCapturePct / 100, 0, 1);
  const whaleCapture = clamp(pricing.whaleCapturePct / 100, 0, 1);
  const investorRoiFloor = Math.max(0, pricing.investorRoiFloorPct / 100);
  const minPrice = Math.max(0, pricing.minPrice);
  const maxPrice = Math.max(minPrice, pricing.maxPrice);

  const portfolioNetGain = (b: Booster) => {
    let sum = 0;
    for (const it of portfolio) {
      const t = tariffs.find((x) => x.id === it.tariffId);
      if (!t) continue;
      if (Array.isArray(b.blockedTariffs) && b.blockedTariffs.includes(t.id)) continue;
      const amount = Math.max(0, Number(it.amount) || 0);
      const hours = t.durationDays * 24;
      const cov = Math.min(b.durationHours, hours) / hours;
      const eff = b.effect?.value ?? 0;
      if (eff <= 0 || cov <= 0) continue;
      const grossGain = amount * t.dailyRate * t.durationDays * (eff * cov);
      sum += grossGain * (1 - sub.fee);
    }
    return sum;
  };

  const baselineNetGain = (b: Booster) => {
    let sum = 0;
    for (const t of lowT) {
      if (Array.isArray(b.blockedTariffs) && b.blockedTariffs.includes(t.id)) continue;
      const hours = t.durationDays * 24;
      const cov = Math.min(b.durationHours, hours) / hours;
      const eff = b.effect?.value ?? 0;
      if (eff <= 0 || cov <= 0) continue;
      const grossGain = t.baseMin * t.dailyRate * t.durationDays * (eff * cov);
      sum += grossGain * (1 - sub.fee);
    }
    return sum;
  };

  return boosterList.map((b) => {
    if (b.scope !== 'account') return b;

    const baseNet = baselineNetGain(b);
    const portNet = portfolioNetGain(b);

    const basePrice = Math.max(minPrice, Math.min(maxPrice, baseNet * baseCapture));
    let dynPrice = basePrice;
    if (portNet > baseNet) {
      dynPrice = basePrice + whaleCapture * (portNet - baseNet);
    }

    if (portNet > 0 && investorRoiFloor > 0) {
      const maxByBonus = portNet / (1 + investorRoiFloor);
      dynPrice = Math.min(dynPrice, maxByBonus);
    }

    dynPrice = Math.max(minPrice, Math.min(maxPrice, dynPrice));

    return { ...b, price: parseFloat(dynPrice.toFixed(2)) };
  });
}

type ComputeOptions = {
  portfolio: PortfolioItem[];
  boosters: Booster[];
  accountBoosters: string[];
  tariffs: Tariff[];
  activeSubId: string;
  userLevel: number;
};

function computePortfolioState({
  portfolio,
  boosters,
  accountBoosters,
  tariffs,
  activeSubId,
  userLevel
}: ComputeOptions): ComputedState {
  const activeSub = SUBSCRIPTIONS.find((s) => s.id === activeSubId) ?? SUBSCRIPTIONS[0];
  const feeRate = activeSub.fee;
  const chosenAcc = accountBoosters
    .map((id) => boosters.find((b) => b.id === id))
    .filter(Boolean) as Booster[];

  const rowsBase = portfolio
    .map((item) => {
      const t = tariffs.find((x) => x.id === item.tariffId);
      if (!t) return null;
      const amount = Math.max(0, Number(item.amount) || 0);
      const hours = t.durationDays * 24;
      const applicable = chosenAcc.filter(
        (b) => !Array.isArray(b.blockedTariffs) || !b.blockedTariffs.includes(t.id)
      );

      let multiplier = 1;
      const notes: string[] = [];
      for (const b of applicable) {
        const cov = Math.min(b.durationHours, hours) / hours;
        const mul = boosterCoverageMultiplier(b.effect.value, cov);
        multiplier *= mul;
        notes.push(`${b.name}: ×${mul.toFixed(3)} (cov ${(cov * 100).toFixed(0)}%)`);
      }

      const dailyGross = amount * t.dailyRate * multiplier;
      const feePerDay = dailyGross * feeRate;
      const gross = dailyGross * t.durationDays;
      const fee = feePerDay * t.durationDays;

      const dailyGrossBase = amount * t.dailyRate;
      const grossBase = dailyGrossBase * t.durationDays;
      const feeBase = grossBase * feeRate;
      const netBase = grossBase - feeBase;

      return {
        key: item.id,
        t,
        amount,
        multiplier,
        notes,
        applicable,
        dailyGross,
        feePerDay,
        gross,
        fee,
        netNoBoost: netBase,
        netNoBoostPerDay: netBase / t.durationDays
      } as Omit<PortfolioRow, 'accAlloc' | 'accPerDay' | 'subAlloc' | 'subPerDay' | 'netPerDayAfter' | 'netAfter' | 'netPerDayFinal' | 'netFinal'> & {
        applicable: Booster[];
      };
    })
    .filter(Boolean) as any[];

  const denomByBooster = new Map<string, number>();
  for (const b of chosenAcc) {
    const denom = rowsBase
      .filter((r: any) => r.applicable.includes(b))
      .reduce((s: number, r: any) => s + r.amount * r.t.durationDays, 0);
    denomByBooster.set(b.id, denom);
  }

  const subCost = activeSub.price;
  const capDaysAll = rowsBase.reduce((s: number, r: any) => s + r.amount * r.t.durationDays, 0);

  const rows: PortfolioRow[] = rowsBase.map((r: any) => {
    let accAlloc = 0;
    for (const b of r.applicable) {
      const denom = denomByBooster.get(b.id) || 0;
      const share = denom ? (r.amount * r.t.durationDays) / denom : 0;
      accAlloc += b.price * share;
    }
    const accPerDay = accAlloc / r.t.durationDays;

    const netPerDayBeforeSub = r.dailyGross - r.feePerDay - accPerDay;
    const netBeforeSub = r.gross - r.fee - accAlloc;

    const subShare = capDaysAll ? (r.amount * r.t.durationDays) / capDaysAll : 0;
    const subAlloc = subCost * subShare;
    const subPerDay = subAlloc / r.t.durationDays;

    const boosterLift = netBeforeSub - r.netNoBoost;
    const boosterLiftPerDay = netPerDayBeforeSub - r.netNoBoostPerDay;

    return {
      ...r,
      accAlloc,
      accPerDay,
      subAlloc,
      subPerDay,
      netPerDayAfter: netPerDayBeforeSub,
      netAfter: netBeforeSub,
      netPerDayFinal: netPerDayBeforeSub - subPerDay,
      netFinal: netBeforeSub - subAlloc,
      boosterLift,
      boosterLiftPerDay
    };
  });

  const investorNet = rows.reduce((s, r) => s + r.netFinal, 0);
  const investorNetPerDay = rows.reduce((s, r) => s + r.netPerDayFinal, 0);
  const feeTotal = rows.reduce((s, r) => s + r.fee, 0);
  const grossProfitTotal = rows.reduce((s, r) => s + r.gross, 0);
  const baselineNet = rows.reduce((s, r) => s + r.netNoBoost, 0);
  const baselineNetPerDay = rows.reduce((s, r) => s + r.netNoBoostPerDay, 0);
  const capital = rows.reduce((s, r) => s + r.amount, 0);

  let accCostApplied = 0;
  for (const b of chosenAcc) {
    const denom = denomByBooster.get(b.id) || 0;
    if (denom > 0) accCostApplied += b.price || 0;
  }

  const projectRevenue = feeTotal + accCostApplied + subCost;

  const liftNet = rows.reduce((s, r) => s + r.boosterLift, 0);
  const liftPerDay = rows.reduce((s, r) => s + r.boosterLiftPerDay, 0);
  const roi = accCostApplied > 0 ? liftNet / accCostApplied : 0;
  const paybackDays = liftPerDay > 0 ? accCostApplied / liftPerDay : null;

  const project30 = (subId: string, mode: 'no-reinvest' | 'auto-roll') => {
    const sub = SUBSCRIPTIONS.find((s) => s.id === subId)!;
    const feeRateLocal = sub.fee;
    const subCostLocal = sub.price;

    const base = rowsBase.map((r: any) => {
      const dailyGross = r.amount * r.t.dailyRate * r.multiplier;
      const feePerDayLocal = dailyGross * feeRateLocal;
      return { ...r, dailyGross, feePerDay: feePerDayLocal };
    });

    const denomMap = new Map<string, number>();
    for (const b of chosenAcc) {
      const d = base
        .filter((r: any) => r.applicable.includes(b))
        .reduce((s: number, r: any) => s + r.amount * r.t.durationDays, 0);
      denomMap.set(b.id, d);
    }

    let total = 0;
    let oneTimeAccCost = 0;

    for (const r of base) {
      const projDays = mode === 'auto-roll' ? 30 : Math.min(30, r.t.durationDays);
      let accAllocLocal = 0;
      for (const b of chosenAcc) {
        if (!r.applicable.includes(b)) continue;
        const d = denomMap.get(b.id) || 0;
        const share = d ? (r.amount * r.t.durationDays) / d : 0;
        accAllocLocal += b.price * share;
      }
      oneTimeAccCost += accAllocLocal;

      const netPerDayBefore = r.dailyGross - r.feePerDay;
      total += netPerDayBefore * projDays;
    }
    total -= oneTimeAccCost;
    total -= subCostLocal;
    return total;
  };

  const projection30 = {
    withCurrentSub: {
      noReinvest: project30(activeSubId, 'no-reinvest'),
      autoRoll: project30(activeSubId, 'auto-roll')
    },
    compareSubs: SUBSCRIPTIONS.filter((s) => withinLevel(userLevel, s.minLevel)).map((s) => ({
      id: s.id,
      name: s.name,
      fee: s.fee,
      price: s.price,
      noReinvest: project30(s.id, 'no-reinvest'),
      autoRoll: project30(s.id, 'auto-roll')
    }))
  };

  return {
    rows,
    totals: {
      grossProfitTotal,
      feeTotal,
      accountCost: accCostApplied,
      subCost,
      investorNet,
      investorNetPerDay,
      projectRevenue,
      baselineNet,
      baselineNetPerDay,
      capital
    },
    projection30,
    boosterSummary: {
      liftNet,
      liftPerDay,
      spend: accCostApplied,
      roi,
      paybackDays
    }
  };
}

function runSelfTests() {
  console.assert(boosterCoverageMultiplier(0.5, 0) === 1, 'cov 0 should be 1x');
  console.assert(Math.abs(boosterCoverageMultiplier(0.5, 1) - 1.5) < 1e-9, '+50% full day ≈ 1.5x');
  console.assert(Math.abs(boosterCoverageMultiplier(0.5, 2) - 1.5) < 1e-9, 'coverage clamps to 1');

  const tenDaysHours = 10 * 24;
  const cov = Math.min(24, tenDaysHours) / tenDaysHours;
  const mult = 1 + 1 * cov;
  console.assert(Math.abs(mult - 1.1) < 1e-9, '+100% x24h on 10d plan should be ×1.1');

  const fee = 0.2,
    rate = 0.01,
    days = 10,
    value = 1.0;
  const price = 100 * rate * days * value * cov * (1 - fee);
  const denom = rate * days * value * cov * (1 - fee);
  const beAmount = denom > 0 ? price / denom : Infinity;
  console.assert(Math.abs(beAmount - 100) < 1e-9, 'breakeven amount should round-trip');

  console.assert(subMeets('silver', 'gold') === true, 'gold should unlock silver');
  console.assert(subMeets('gold', 'silver') === false, 'silver should NOT unlock gold');
  console.assert(withinLevel(5, 5) && withinLevel(6, 5) && !withinLevel(4, 5), 'withinLevel checks');

  const elite = SUBSCRIPTIONS.find((s) => s.id === 'elite')!;
  const testBooster: Booster[] = [
    {
      id: 'test_dyn',
      name: '+100% x24h',
      scope: 'account',
      effect: { type: 'mult', value: 1 },
      durationHours: 24,
      price: 0,
      minLevel: 1,
      reqSub: null,
      blockedTariffs: [],
      limitPerPortfolio: 1
    }
  ];
  const smallPort: PortfolioItem[] = [{ tariffId: 't_weekly_a', amount: 100, id: 'a' }];
  const bigPort: PortfolioItem[] = [{ tariffId: 't_month_plus', amount: 10000, id: 'b' }];
  const pricedSmall = smartPriceBoostersDyn(testBooster, INIT_TARIFFS, elite, 10, smallPort)[0].price;
  const pricedBig = smartPriceBoostersDyn(testBooster, INIT_TARIFFS, elite, 10, bigPort)[0].price;
  console.assert(pricedBig > pricedSmall, 'dynamic price should grow with portfolio');

  const blockedBooster: Booster[] = [
    {
      id: 'test_block',
      name: '+100% x24h',
      scope: 'account',
      effect: { type: 'mult', value: 1 },
      durationHours: 24,
      price: 0,
      minLevel: 1,
      reqSub: null,
      blockedTariffs: ['t_month_plus'],
      limitPerPortfolio: 1
    }
  ];
  const priceBlocked = smartPriceBoostersDyn(blockedBooster, INIT_TARIFFS, elite, 10, bigPort)[0].price;
  console.assert(priceBlocked < pricedBig, 'when big plan is blocked, price should drop');

  const generousBonus = { ...DEFAULT_PRICING, investorRoiFloorPct: 200 };
  const pricedWithBonus = smartPriceBoostersDyn(
    testBooster,
    INIT_TARIFFS,
    elite,
    10,
    bigPort,
    generousBonus
  )[0].price;
  console.assert(pricedWithBonus <= pricedBig, 'stricter ROI floor should not raise price');
}

function evaluateBoosterAgainstPortfolio({
  booster,
  portfolio,
  tariffs,
  sub
}: {
  booster: Booster;
  portfolio: PortfolioItem[];
  tariffs: Tariff[];
  sub: Subscription;
}): BoosterImpact {
  const totalCapital = portfolio.reduce((sum, item) => sum + Math.max(0, Number(item.amount) || 0), 0);
  let netGain = 0;
  let netPerDay = 0;
  let coverageDeposits = 0;
  const affectedTariffs = new Set<string>();

  for (const item of portfolio) {
    const tariff = tariffs.find((t) => t.id === item.tariffId);
    if (!tariff) continue;
    if (Array.isArray(booster.blockedTariffs) && booster.blockedTariffs.includes(tariff.id)) continue;

    const amount = Math.max(0, Number(item.amount) || 0);
    const hours = tariff.durationDays * 24;
    const coverage = Math.min(booster.durationHours, hours) / hours;
    const effect = booster.effect?.value ?? 0;

    if (effect <= 0 || coverage <= 0) continue;

    const grossGain = amount * tariff.dailyRate * tariff.durationDays * (effect * coverage);
    const net = grossGain * (1 - sub.fee);
    if (net <= 0) continue;

    netGain += net;
    netPerDay += net / tariff.durationDays;
    coverageDeposits += amount;
    affectedTariffs.add(tariff.id);
  }

  const netAfterCost = netGain - booster.price;
  const roi = booster.price > 0 ? (netAfterCost / booster.price) : null;
  const paybackDays = netPerDay > 0 ? booster.price / netPerDay : null;
  const coverageShare = totalCapital > 0 ? coverageDeposits / totalCapital : 0;

  return {
    booster,
    netGain,
    netPerDay,
    netAfterCost,
    roi,
    paybackDays,
    coverageDeposits,
    coverageShare,
    affectedTariffs: affectedTariffs.size
  };
}

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function ArbPlanBuilder() {
  const [activeTab, setActiveTab] = useState<'planner' | 'simulation'>('planner');
  const [userLevel, setUserLevel] = useState(8);
  const [currency, setCurrency] = useState('USD');
  const [activeSubId, setActiveSubId] = useState('free');
  const [tariffs, setTariffs] = useState<Tariff[]>(INIT_TARIFFS);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [boostersRaw, setBoostersRaw] = useState<Booster[]>(BASE_BOOSTERS);
  const [pricingControls, setPricingControls] = useState<PricingControls>(DEFAULT_PRICING);
  const activeSub = SUBSCRIPTIONS.find((s) => s.id === activeSubId) || SUBSCRIPTIONS[0];
  const boosters = useMemo(
    () =>
      smartPriceBoostersDyn(
        boostersRaw,
        tariffs,
        activeSub,
        userLevel,
        portfolio,
        pricingControls
      ),
    [boostersRaw, tariffs, activeSub, userLevel, portfolio, pricingControls]
  );
  const [accountBoosters, setAccountBoosters] = useState<string[]>([]);
  const [segments, setSegments] = useState<InvestorSegment[]>(() => [
    {
      id: uid('seg'),
      name: 'Whales 10k+',
      investors: 4,
      userLevel: 12,
      subscriptionId: 'elite',
      accountBoosters: ['b400_48h'],
      portfolio: [
        { id: uid('pi'), tariffId: 't_quarter', amount: 8000 },
        { id: uid('pi'), tariffId: 't_month_plus', amount: 6000 }
      ]
    },
    {
      id: uid('seg'),
      name: 'Mid investors',
      investors: 25,
      userLevel: 7,
      subscriptionId: 'gold',
      accountBoosters: ['b15_24h', 'b8_24h'],
      portfolio: [
        { id: uid('pi'), tariffId: 't_weekly_b', amount: 800 },
        { id: uid('pi'), tariffId: 't_flex14', amount: 1200 }
      ]
    }
  ]);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const eligibleTariffs = tariffs.filter(
    (t) => withinLevel(userLevel, t.minLevel) && subMeets(t.reqSub, activeSubId)
  );
  const availableAccountBoosters = boosters.filter(
    (b) =>
      b.scope === 'account' &&
      withinLevel(userLevel, b.minLevel) &&
      subMeets(b.reqSub, activeSubId)
  );

  const boosterInsights = useMemo(() => {
    return availableAccountBoosters.map((booster) =>
      evaluateBoosterAgainstPortfolio({
        booster,
        portfolio,
        tariffs,
        sub: activeSub
      })
    );
  }, [availableAccountBoosters, portfolio, tariffs, activeSub]);

  const boosterImpactMap = useMemo(() => {
    return new Map(boosterInsights.map((impact) => [impact.booster.id, impact]));
  }, [boosterInsights]);

  const tariffSlotsUsed = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of portfolio) {
      map.set(it.tariffId, (map.get(it.tariffId) || 0) + 1);
    }
    return map;
  }, [portfolio]);

  const computed = useMemo(
    () =>
      computePortfolioState({
        portfolio,
        boosters,
        accountBoosters,
        tariffs,
        activeSubId,
        userLevel
      }),
    [portfolio, boosters, accountBoosters, tariffs, activeSubId, userLevel]
  );

  useEffect(() => {
    try {
      runSelfTests();
    } catch (e) {
      console.warn('Self-tests failed:', e);
    }
  }, []);

  const activeGlobal = new Set(accountBoosters);

  const resetAll = () => {
    setPortfolio([]);
    setAccountBoosters([]);
    setActiveSubId('free');
    setUserLevel(1);
  };

  const addTariff = (tariffId: string) => {
    const t = tariffs.find((x) => x.id === tariffId);
    if (!t) return;
    const used = tariffSlotsUsed.get(tariffId) || 0;
    if (t.isLimited && t.capSlots != null && used >= t.capSlots) {
      alert('Лимит слотов тарифа исчерпан');
      return;
    }
    const id = uid(tariffId);
    setPortfolio((prev) => [...prev, { id, tariffId, amount: t.baseMin }]);
  };

  const removeItem = (id: string) => {
    setPortfolio((prev) => prev.filter((p) => p.id !== id));
  };

  const updateAmount = (id: string, val: number) => {
    setPortfolio((prev) =>
      prev.map((p) => (p.id === id ? { ...p, amount: Math.max(0, Number(val) || 0) } : p))
    );
  };

  const toggleAccountBooster = (boosterId: string) => {
    setAccountBoosters((prev) =>
      prev.includes(boosterId) ? prev.filter((id) => id !== boosterId) : [...prev, boosterId]
    );
  };

  const updateSegments = (next: InvestorSegment[]) => setSegments(next);

  return (
    <div className="grid" style={{ gap: 24 }}>
      <header className="card" style={{ display: 'grid', gap: 16 }}>
        <div className="flex-between">
          <div>
            <h1 style={{ margin: 0, fontSize: 28 }}>Arb Plan Builder v3.5 — canvas edition</h1>
            <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>
              Белый минималистичный дашборд • гибкие ROI-пороги бустеров • симуляция по сегментам инвесторов
            </p>
          </div>
          <button className="ghost" onClick={() => setSettingsOpen((v) => !v)}>
            {settingsOpen ? 'Закрыть редакторы' : 'Настройка тарифов и бустеров'}
          </button>
        </div>
        <div className="flex" style={{ alignItems: 'center' }}>
          <label style={{ minWidth: 180 }}>
            <div className="section-subtitle">Валюта</div>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="UAH">UAH</option>
            </select>
          </label>
          <label style={{ minWidth: 220 }}>
            <div className="section-subtitle">Уровень</div>
            <input
              type="range"
              min={1}
              max={20}
              value={userLevel}
              onChange={(e) => setUserLevel(Number(e.target.value))}
            />
            <div style={{ fontSize: 13, color: '#2563eb' }}>Текущий уровень: Lv {userLevel}</div>
          </label>
          <label style={{ minWidth: 220 }}>
            <div className="section-subtitle">Подписка</div>
            <select value={activeSubId} onChange={(e) => setActiveSubId(e.target.value)}>
              {SUBSCRIPTIONS.filter((s) => withinLevel(userLevel, s.minLevel)).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — fee {(s.fee * 100).toFixed(0)}% ({fmtMoney(s.price, currency)}/30d)
                </option>
              ))}
            </select>
          </label>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
            <button className="ghost" onClick={resetAll}>
              Reset
            </button>
          </div>
        </div>
        <div>
          <div className="tab-group">
            <button
              className={`tab-button ${activeTab === 'planner' ? 'active' : ''}`}
              onClick={() => setActiveTab('planner')}
            >
              Портфель
            </button>
            <button
              className={`tab-button ${activeTab === 'simulation' ? 'active' : ''}`}
              onClick={() => setActiveTab('simulation')}
            >
              Симуляция потоков
            </button>
          </div>
        </div>
      </header>

      {settingsOpen && (
        <div className="grid" style={{ gap: 16 }}>
          <div className="card">
            <h2 className="section-title">Редактор тарифов</h2>
            <TariffEditor tariffs={tariffs} setTariffs={setTariffs} />
          </div>
          <div className="card">
            <h2 className="section-title">Редактор бустеров</h2>
            <BoosterEditor boosters={boostersRaw} setBoosters={setBoostersRaw} />
          </div>
          <div className="card">
            <h2 className="section-title">Ценообразование бустеров</h2>
            <p className="section-subtitle">
              Управляйте долей выгоды, которую забирает проект. Можно ограничить минимальную/максимальную цену и гарантировать
              инвестору бонус в процентах от стоимости бустера.
            </p>
            <PricingEditor pricing={pricingControls} setPricing={setPricingControls} />
          </div>
        </div>
      )}

      {activeTab === 'planner' ? (
        <>
          <PlannerStats computed={computed} currency={currency} />
          <div className="card" style={{ display: 'grid', gap: 16 }}>
            <div className="flex-between">
              <h2 className="section-title">Бустеры на аккаунт</h2>
              <p className="section-subtitle" style={{ maxWidth: 480 }}>
                Цена автоматически растёт при увеличении покрытия портфеля. Заблокированные тарифы не участвуют в расчётах выгоды.
              </p>
            </div>
            <div className="booster-select">
              {availableAccountBoosters.length === 0 && (
                <span className="section-subtitle">Нет доступных бустеров на вашем уровне / подписке.</span>
              )}
              {availableAccountBoosters.map((b) => {
                const insight = boosterImpactMap.get(b.id);
                return (
                  <label
                    key={b.id}
                    className={`booster-pill ${
                      activeGlobal.has(b.id) ? 'active' : ''
                    } ${insight && insight.roi != null && insight.roi < 0 ? 'risk' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={activeGlobal.has(b.id)}
                      onChange={() => toggleAccountBooster(b.id)}
                    />
                    <div className="pill-header">
                      <span>{b.name}</span>
                      <strong>{fmtMoney(b.price, currency)}</strong>
                    </div>
                    <div className="pill-meta">
                      <span>{b.durationHours}ч</span>
                      {insight && insight.roi != null && (
                        <span>
                          ROI{' '}
                          {insight.roi != null ? `${(insight.roi * 100).toFixed(0)}%` : '—'}
                        </span>
                      )}
                      {insight && insight.coverageShare > 0 && (
                        <span>Покрытие {(insight.coverageShare * 100).toFixed(0)}%</span>
                      )}
                      {Array.isArray(b.blockedTariffs) && b.blockedTariffs.length > 0 && (
                        <span>−{b.blockedTariffs.length} тарифов</span>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
            {boosterInsights.length > 0 && (
              <div className="table-wrapper booster-table">
                <table>
                  <thead>
                    <tr>
                      <th>Бустер</th>
                      <th>Цена</th>
                      <th>Чистая выгода (после цены)</th>
                      <th>ROI</th>
                      <th>Окупаемость</th>
                      <th>Покрытие портфеля</th>
                    </tr>
                  </thead>
                  <tbody>
                    {boosterInsights.map((insight) => (
                      <tr key={insight.booster.id}>
                        <td>{insight.booster.name}</td>
                        <td>{fmtMoney(insight.booster.price, currency)}</td>
                        <td title={`Без учёта цены: ${fmtMoney(insight.netGain, currency)}`}>
                          {fmtMoney(insight.netAfterCost, currency)}
                        </td>
                        <td>
                          {insight.roi != null
                            ? `${(insight.roi * 100).toFixed(1)}%`
                            : '—'}
                        </td>
                        <td>
                          {insight.paybackDays != null
                            ? `${insight.paybackDays.toFixed(1)} дн.`
                            : '—'}
                        </td>
                        <td>
                          {insight.coverageShare > 0
                            ? `${(insight.coverageShare * 100).toFixed(0)}% • ${fmtMoney(
                                insight.coverageDeposits,
                                currency
                              )}`
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3" style={{ gridTemplateColumns: '2fr 1fr', gap: 16 }}>
            <div className="card" style={{ display: 'grid', gap: 16 }}>
              <div className="flex-between">
                <h2 className="section-title">Добавить тариф</h2>
                <select onChange={(e) => e.target.value && addTariff(e.target.value)} value="">
                  <option value="" disabled>
                    Выбрать тариф (фильтр по уровню/подписке)
                  </option>
                  {eligibleTariffs.map((t) => {
                    const used = tariffSlotsUsed.get(t.id) || 0;
                    const left = t.isLimited && t.capSlots != null ? Math.max(0, t.capSlots - used) : null;
                    return (
                      <option key={t.id} value={t.id} disabled={left !== null && left === 0}>
                        {t.name} — {(t.dailyRate * 100).toFixed(2)}%/d × {t.durationDays}d{' '}
                        {left !== null ? `• слотов: ${left}` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              {portfolio.length === 0 && (
                <p className="section-subtitle">Тарифы не добавлены. Выберите тариф выше.</p>
              )}

              <div className="grid" style={{ gap: 16 }}>
                {portfolio.map((item) => (
                  <TariffRow
                    key={item.id}
                    item={item}
                    currency={currency}
                    removeItem={removeItem}
                    updateAmount={updateAmount}
                    userLevel={userLevel}
                    activeSubId={activeSubId}
                    tariffs={tariffs}
                    boosters={boosters}
                    accountBoosters={accountBoosters}
                  />
                ))}
              </div>
            </div>

            <div className="card" style={{ display: 'grid', gap: 16 }}>
              <h2 className="section-title">Итоги портфеля</h2>
              <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
                <div className="flex-between">
                  <span>Валовая прибыль:</span>
                  <strong>{fmtMoney(computed.totals.grossProfitTotal, currency)}</strong>
                </div>
                <div className="flex-between">
                  <span>Комиссия проекта ({(activeSub.fee * 100).toFixed(0)}%):</span>
                  <span>{fmtMoney(computed.totals.feeTotal, currency)}</span>
                </div>
                <div className="flex-between">
                  <span>Покупки бустеров:</span>
                  <span>{fmtMoney(computed.totals.accountCost, currency)}</span>
                </div>
                <div className="flex-between">
                  <span>Инвестору без бустеров:</span>
                  <span>{fmtMoney(computed.totals.baselineNet, currency)}</span>
                </div>
                <div className="flex-between">
                  <span>Лифт от бустеров (после оплаты):</span>
                  <span>{fmtMoney(computed.boosterSummary.liftNet, currency)}</span>
                </div>
                <div className="flex-between">
                  <span>Лифт в день:</span>
                  <span>{fmtMoney(computed.boosterSummary.liftPerDay, currency)}</span>
                </div>
                <div className="flex-between">
                  <span>ROI бустеров:</span>
                  <span>
                    {computed.boosterSummary.spend > 0
                      ? `${(computed.boosterSummary.roi * 100).toFixed(1)}%`
                      : '—'}
                  </span>
                </div>
                <div className="flex-between">
                  <span>Окупаемость бустеров:</span>
                  <span>
                    {computed.boosterSummary.paybackDays != null
                      ? `${computed.boosterSummary.paybackDays.toFixed(1)} дн.`
                      : '—'}
                  </span>
                </div>
                <div className="flex-between">
                  <span>Подписка (30d):</span>
                  <span>{fmtMoney(computed.totals.subCost, currency)}</span>
                </div>
                <div className="flex-between" style={{ marginTop: 8, borderTop: '1px solid #e2e8f0', paddingTop: 8 }}>
                  <span>Инвестору (после всего):</span>
                  <strong>{fmtMoney(computed.totals.investorNet, currency)}</strong>
                </div>
                <div className="flex-between">
                  <span>Начисление в день:</span>
                  <strong>{fmtMoney(computed.totals.investorNetPerDay, currency)}</strong>
                </div>
                <div className="flex-between">
                  <span>Доход проекта:</span>
                  <strong>{fmtMoney(computed.totals.projectRevenue, currency)}</strong>
                </div>
              </div>

              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
                <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>Проекция на 30 дней</h3>
                <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
                  <div className="flex-between">
                    <span>Без реинвеста:</span>
                    <span>{fmtMoney(computed.projection30.withCurrentSub.noReinvest, currency)}</span>
                  </div>
                  <div className="flex-between">
                    <span>Авто-пролонгация:</span>
                    <span>{fmtMoney(computed.projection30.withCurrentSub.autoRoll, currency)}</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 style={{ marginBottom: 8, fontSize: 13 }}>Сравнение подписок (30 дней)</h4>
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Подписка</th>
                        <th>Fee</th>
                        <th>Цена/30d</th>
                        <th>Без реинвеста</th>
                        <th>Авто-пролонгация</th>
                      </tr>
                    </thead>
                    <tbody>
                      {computed.projection30.compareSubs.map((r) => (
                        <tr key={r.id}>
                          <td>{r.name}</td>
                          <td style={{ textAlign: 'center' }}>{(r.fee * 100).toFixed(0)}%</td>
                          <td style={{ textAlign: 'center' }}>{fmtMoney(r.price, currency)}</td>
                          <td style={{ textAlign: 'center' }}>{fmtMoney(r.noReinvest, currency)}</td>
                          <td style={{ textAlign: 'center' }}>{fmtMoney(r.autoRoll, currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <div className="card" style={{ display: 'grid', gap: 16 }}>
            <h2 className="section-title">Доступные тарифы</h2>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              {tariffs.map((t) => {
                const used = tariffSlotsUsed.get(t.id) || 0;
                const left = t.isLimited && t.capSlots != null ? Math.max(0, t.capSlots - used) : null;
                const locked = !withinLevel(userLevel, t.minLevel) || !subMeets(t.reqSub, activeSubId);
                return (
                  <div key={t.id} className="card" style={{ padding: 16 }}>
                    <div style={{ fontWeight: 600 }}>{t.name}</div>
                    <div className="section-subtitle">
                      {(t.dailyRate * 100).toFixed(2)}%/d • {t.durationDays}d
                    </div>
                    <div className="flex">
                      <span className="badge">Lv ≥ {t.minLevel}</span>
                      {t.reqSub && <span className="badge">Req: {t.reqSub}</span>}
                      {t.isLimited && (
                        <span className="badge" style={{ background: '#fee2e2', color: '#b91c1c' }}>
                          Слотов: {left}
                        </span>
                      )}
                    </div>
                    <div className="section-subtitle">
                      Депозит: {fmtMoney(t.baseMin, currency)} – {fmtMoney(t.baseMax, currency)}
                    </div>
                    <button
                      className="primary"
                      style={{ width: '100%' }}
                      onClick={() => addTariff(t.id)}
                      disabled={(left !== null && left === 0) || locked}
                    >
                      Добавить в портфель
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <SimulationPanel
          segments={segments}
          setSegments={updateSegments}
          tariffs={tariffs}
          boosters={boostersRaw}
          currency={currency}
          pricing={pricingControls}
        />
      )}

      <footer style={{ textAlign: 'center', fontSize: 12, color: '#64748b', paddingBottom: 24 }}>
        v3.5 • минималистичный белый интерфейс • гибкий ROI-контроль бустеров • расширенная аналитика портфеля
      </footer>
    </div>
  );
}

type PlannerStatsProps = {
  computed: ComputedState;
  currency: string;
};

function PlannerStats({ computed, currency }: PlannerStatsProps) {
  const { totals, boosterSummary } = computed;
  const avgDailyYield = totals.capital > 0 ? totals.investorNetPerDay / totals.capital : 0;
  const boosterShare = totals.baselineNet > 0 ? boosterSummary.liftNet / totals.baselineNet : 0;

  const cards = [
    {
      label: 'Капитал в работе',
      value: fmtMoney(totals.capital, currency),
      hint: 'Сумма активных депозитов'
    },
    {
      label: 'Чистая прибыль без бустеров',
      value: fmtMoney(totals.baselineNet, currency),
      hint: `${fmtMoney(totals.baselineNetPerDay, currency)} в день`
    },
    {
      label: 'Чистая прибыль с бустерами',
      value: fmtMoney(totals.investorNet, currency),
      hint: `${fmtMoney(totals.investorNetPerDay, currency)} в день`
    },
    {
      label: 'Среднесуточная доходность',
      value: totals.capital > 0 ? `${(avgDailyYield * 100).toFixed(2)}%` : '—',
      hint: 'На основе чистой прибыли'
    },
    {
      label: 'Лифт от бустеров',
      value: fmtMoney(boosterSummary.liftNet, currency),
      hint: boosterSummary.liftNet > 0 ? `+${(boosterShare * 100).toFixed(1)}% к базе` : 'Без прироста'
    },
    {
      label: 'Доход проекта',
      value: fmtMoney(totals.projectRevenue, currency),
      hint: 'Комиссии + бустеры + подписка'
    }
  ];

  return (
    <div className="stats-grid">
      {cards.map((card) => (
        <StatTile key={card.label} label={card.label} value={card.value} hint={card.hint} />
      ))}
    </div>
  );
}

type StatTileProps = {
  label: string;
  value: string;
  hint: string;
};

function StatTile({ label, value, hint }: StatTileProps) {
  return (
    <div className="stat-card">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      <span className="stat-hint">{hint}</span>
    </div>
  );
}

type TariffRowProps = {
  item: PortfolioItem;
  currency: string;
  removeItem: (id: string) => void;
  updateAmount: (id: string, val: number) => void;
  userLevel: number;
  activeSubId: string;
  tariffs: Tariff[];
  boosters: Booster[];
  accountBoosters: string[];
};

function TariffRow({
  item,
  currency,
  removeItem,
  updateAmount,
  userLevel,
  activeSubId,
  tariffs,
  boosters,
  accountBoosters
}: TariffRowProps) {
  const t = tariffs.find((x) => x.id === item.tariffId)!;
  const warnLevel = userLevel < t.minLevel;
  const warnSub = !!t.reqSub && !subMeets(t.reqSub, activeSubId);

  return (
    <div className="card">
      <div className="flex-between">
        <div>
          <div style={{ fontWeight: 600 }}>{t.name}</div>
          <div className="flex">
            <span className="badge">Lv ≥ {t.minLevel}</span>
            {t.reqSub && <span className="badge">Req: {t.reqSub}</span>}
            <span className="badge">{t.durationDays}d</span>
            <span className="badge">{(t.dailyRate * 100).toFixed(2)}%/d</span>
            <span className="badge">
              {fmtMoney(t.baseMin, currency)} – {fmtMoney(t.baseMax, currency)}
            </span>
            {t.isLimited && (
              <span className="badge" style={{ background: '#fee2e2', color: '#b91c1c' }}>
                Лимит {t.capSlots}
              </span>
            )}
          </div>
        </div>
        <button className="danger" onClick={() => removeItem(item.id)}>
          Удалить
        </button>
      </div>

      {(warnLevel || warnSub) && (
        <div style={{ color: '#fbbf24', fontSize: 13 }}>
          Недоступно: {warnLevel && `уровень < ${t.minLevel}`} {warnLevel && warnSub && ' • '}
          {warnSub && `нужна подписка ${t.reqSub}`}
        </div>
      )}

      <label>
        <div className="section-subtitle">Сумма инвестиций</div>
        <input
          type="number"
          value={item.amount}
          min={0}
          onChange={(e) => updateAmount(item.id, Number(e.target.value))}
        />
      </label>

      <RowPreview
        item={item}
        currency={currency}
        tariffs={tariffs}
        boosters={boosters}
        accountBoosters={accountBoosters}
        activeSubId={activeSubId}
      />
    </div>
  );
}

type RowPreviewProps = {
  item: PortfolioItem;
  currency: string;
  tariffs: Tariff[];
  boosters: Booster[];
  accountBoosters: string[];
  activeSubId: string;
};

function RowPreview({ item, currency, tariffs, boosters, accountBoosters, activeSubId }: RowPreviewProps) {
  const t = tariffs.find((x) => x.id === item.tariffId)!;
  const sub = SUBSCRIPTIONS.find((s) => s.id === activeSubId)!;
  const feeRate = sub.fee;

  const amount = Math.max(0, Number(item.amount) || 0);
  const totalHours = t.durationDays * 24;

  const chosenAcc = accountBoosters
    .map((id) => boosters.find((b) => b.id === id))
    .filter(Boolean) as Booster[];
  const applicable = chosenAcc.filter(
    (b) => !Array.isArray(b.blockedTariffs) || !b.blockedTariffs.includes(t.id)
  );
  const blocked = chosenAcc.filter(
    (b) => Array.isArray(b.blockedTariffs) && b.blockedTariffs.includes(t.id)
  );

  let multiplier = 1;
  const notes: string[] = [];
  for (const b of applicable) {
    const cov = Math.min(b.durationHours, totalHours) / totalHours;
    const mul = boosterCoverageMultiplier(b.effect.value, cov);
    multiplier *= mul;
    notes.push(`${b.name}: ×${mul.toFixed(3)} (cov ${(cov * 100).toFixed(0)}%)`);
  }

  const dailyGross = amount * t.dailyRate * multiplier;
  const feePerDay = dailyGross * feeRate;
  const gross = dailyGross * t.durationDays;
  const fee = feePerDay * t.durationDays;

  const netBefore = gross - fee;
  const netPerDayBefore = dailyGross - feePerDay;

  const warns = applicable.map((b) => {
    const cov = Math.min(b.durationHours, totalHours) / totalHours;
    const gainGross = amount * t.dailyRate * t.durationDays * (b.effect.value * cov);
    const gainNet = gainGross * (1 - feeRate);
    const denom = t.dailyRate * t.durationDays * (b.effect.value * cov) * (1 - feeRate);
    const beAmount = denom > 0 ? b.price / denom : Infinity;
    const roi = gainNet - b.price;
    return { id: b.id, name: b.name, roi, beAmount };
  });

  return (
    <div
      style={{
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        padding: 12,
        fontSize: 13,
        display: 'grid',
        gap: 8
      }}
    >
      <div>
        <div className="section-subtitle" style={{ marginBottom: 4 }}>
          Эффективная ставка • заметки: {notes.join(' • ')}
        </div>
        <div className="flex" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <span>
            Валовая прибыль: <strong>{fmtMoney(gross, currency)}</strong>
          </span>
          <span>
            Комиссия: <strong>{fmtMoney(fee, currency)}</strong>
          </span>
          <span>
            Инвестору (до подписки): <strong>{fmtMoney(netBefore, currency)}</strong>
          </span>
          <span>
            Начисление в день: <strong>{fmtMoney(netPerDayBefore, currency)}</strong>
          </span>
        </div>
      </div>

      {blocked.length > 0 && (
        <div style={{ color: '#fca5a5' }}>
          🚫 На этот тариф не действуют: {blocked.map((b) => b.name).join(', ')}
        </div>
      )}

      {warns.length > 0 && (
        <div style={{ color: '#64748b', display: 'grid', gap: 4 }}>
          {warns.map((w) => (
            <div key={w.id}>
              {w.roi < 0 ? (
                <span style={{ color: '#fbbf24' }}>
                  ⚠️ {w.name}: −ROI при {fmtMoney(amount, currency)}. Брэйк-ивен ≈{' '}
                  {Number.isFinite(w.beAmount) ? fmtMoney(w.beAmount, currency) : '—'}.
                </span>
              ) : (
                <span>
                  ✅ {w.name}: ROI+ ≈ {fmtMoney(w.roi, currency)} при {fmtMoney(amount, currency)}.
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type TariffEditorProps = {
  tariffs: Tariff[];
  setTariffs: (tariffs: Tariff[]) => void;
};

type PricingEditorProps = {
  pricing: PricingControls;
  setPricing: (pricing: PricingControls) => void;
};

function PricingEditor({ pricing, setPricing }: PricingEditorProps) {
  const update = <K extends keyof PricingControls>(field: K, value: PricingControls[K]) => {
    setPricing({ ...pricing, [field]: value });
  };

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="grid" style={{ gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <label>
          <span className="section-subtitle">Доля выгоды с минимальных сумм (проекта)</span>
          <input
            type="number"
            min={0}
            max={100}
            value={pricing.baseCapturePct}
            onChange={(e) => update('baseCapturePct', Number(e.target.value))}
          />
        </label>
        <label>
          <span className="section-subtitle">Доля с «китовского» прироста</span>
          <input
            type="number"
            min={0}
            max={100}
            value={pricing.whaleCapturePct}
            onChange={(e) => update('whaleCapturePct', Number(e.target.value))}
          />
        </label>
        <label>
          <span className="section-subtitle">Минимальный бонус инвестору (ROI от цены, %)</span>
          <input
            type="number"
            min={0}
            max={500}
            value={pricing.investorRoiFloorPct}
            onChange={(e) => update('investorRoiFloorPct', Number(e.target.value))}
          />
        </label>
        <label>
          <span className="section-subtitle">Мин. цена бустера</span>
          <input
            type="number"
            min={0}
            step={0.1}
            value={pricing.minPrice}
            onChange={(e) => update('minPrice', Number(e.target.value))}
          />
        </label>
        <label>
          <span className="section-subtitle">Макс. цена бустера</span>
          <input
            type="number"
            min={pricing.minPrice}
            step={1}
            value={pricing.maxPrice}
            onChange={(e) => update('maxPrice', Number(e.target.value))}
          />
        </label>
      </div>
      <div className="section-subtitle" style={{ color: '#1e293b' }}>
        Значение 100% гарантирует, что инвестор заработает не меньше цены бустера сверху. Можно
        увеличивать параметр для щедрых промо или снижать для агрессивной монетизации.
      </div>
    </div>
  );
}

function TariffEditor({ tariffs, setTariffs }: TariffEditorProps) {
  const [drafts, setDrafts] = useState<Tariff[]>(tariffs);

  const update = (id: string, field: keyof Tariff, val: string | number | boolean | null) => {
    setDrafts((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              [field]: ['durationDays', 'minLevel', 'baseMin', 'baseMax', 'capSlots'].includes(field as string)
                ? Number(val)
                : field === 'dailyRate'
                ? Number(val)
                : val
            }
          : t
      )
    );
  };

  const add = () => {
    const id = uid('t');
    setDrafts((prev) => [
      ...prev,
      {
        id,
        name: 'New tariff',
        durationDays: 7,
        dailyRate: 0.005,
        minLevel: 1,
        baseMin: 50,
        baseMax: 3000,
        reqSub: null,
        isLimited: false,
        capSlots: null
      }
    ]);
  };

  const remove = (id: string) => {
    setDrafts((prev) => prev.filter((t) => t.id !== id));
  };

  const save = () => setTariffs(drafts);

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="flex-between">
        <p className="section-subtitle" style={{ maxWidth: 520 }}>
          Добавляйте сезонные тарифы, ограничивайте слоты и требования по подписке. При сохранении новые тарифы сразу доступны в портфеле и симуляции.
        </p>
        <button className="primary" onClick={add}>
          Добавить тариф
        </button>
      </div>
      <div className="table-wrapper" style={{ maxHeight: 360 }}>
        <table>
          <thead>
            <tr>
              <th>Название</th>
              <th>Дней</th>
              <th>%/день</th>
              <th>Мин Lv</th>
              <th>Мин</th>
              <th>Макс</th>
              <th>Req sub</th>
              <th>Лимит?</th>
              <th>Слоты</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {drafts.map((t) => (
              <tr key={t.id}>
                <td>
                  <input value={t.name} onChange={(e) => update(t.id, 'name', e.target.value)} />
                </td>
                <td style={{ width: 80 }}>
                  <input
                    type="number"
                    value={t.durationDays}
                    onChange={(e) => update(t.id, 'durationDays', Number(e.target.value))}
                  />
                </td>
                <td style={{ width: 100 }}>
                  <input
                    type="number"
                    step="0.0005"
                    value={t.dailyRate}
                    onChange={(e) => update(t.id, 'dailyRate', Number(e.target.value))}
                  />
                </td>
                <td style={{ width: 80 }}>
                  <input
                    type="number"
                    value={t.minLevel}
                    onChange={(e) => update(t.id, 'minLevel', Number(e.target.value))}
                  />
                </td>
                <td style={{ width: 100 }}>
                  <input
                    type="number"
                    value={t.baseMin}
                    onChange={(e) => update(t.id, 'baseMin', Number(e.target.value))}
                  />
                </td>
                <td style={{ width: 100 }}>
                  <input
                    type="number"
                    value={t.baseMax}
                    onChange={(e) => update(t.id, 'baseMax', Number(e.target.value))}
                  />
                </td>
                <td style={{ width: 120 }}>
                  <input
                    value={t.reqSub || ''}
                    onChange={(e) => update(t.id, 'reqSub', e.target.value || null)}
                  />
                </td>
                <td style={{ width: 90, textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={t.isLimited}
                    onChange={(e) => update(t.id, 'isLimited', e.target.checked)}
                  />
                </td>
                <td style={{ width: 90 }}>
                  <input
                    type="number"
                    value={t.capSlots ?? ''}
                    onChange={(e) => update(t.id, 'capSlots', e.target.value === '' ? null : Number(e.target.value))}
                  />
                </td>
                <td style={{ width: 60 }}>
                  <button className="danger" onClick={() => remove(t.id)}>
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex" style={{ justifyContent: 'flex-end' }}>
        <button className="ghost" onClick={() => setDrafts(tariffs)}>
          Сброс
        </button>
        <button className="primary" onClick={save}>
          Сохранить
        </button>
      </div>
    </div>
  );
}

type BoosterEditorProps = {
  boosters: Booster[];
  setBoosters: (boosters: Booster[]) => void;
};

function BoosterEditor({ boosters, setBoosters }: BoosterEditorProps) {
  const [drafts, setDrafts] = useState<Booster[]>(boosters);

  const update = (id: string, field: keyof Booster, val: any) => {
    setDrafts((prev) =>
      prev.map((b) =>
        b.id === id
          ? {
              ...b,
              [field]: ['price', 'minLevel', 'durationHours', 'limitPerPortfolio'].includes(field as string)
                ? Number(val)
                : val
            }
          : b
      )
    );
  };

  const updatePct = (id: string, val: number) => {
    setDrafts((prev) =>
      prev.map((b) => (b.id === id ? { ...b, effect: { type: 'mult', value: Number(val) } } : b))
    );
  };

  const updateBlocked = (id: string, raw: string) => {
    const list = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    setDrafts((prev) => prev.map((b) => (b.id === id ? { ...b, blockedTariffs: list } : b)));
  };

  const add = () => {
    const id = uid('b');
    setDrafts((prev) => [
      ...prev,
      {
        id,
        name: '+5% x24h',
        scope: 'account',
        effect: { type: 'mult', value: 0.05 },
        durationHours: 24,
        price: 1.2,
        minLevel: 1,
        reqSub: null,
        blockedTariffs: [],
        limitPerPortfolio: 5
      }
    ]);
  };

  const remove = (id: string) => setDrafts((prev) => prev.filter((b) => b.id !== id));
  const save = () => setBoosters(drafts);

  return (
    <div className="grid" style={{ gap: 12 }}>
      <div className="flex-between">
        <p className="section-subtitle" style={{ maxWidth: 520 }}>
          Бустеры покупаются на аккаунт и применяются ко всем тарифам, кроме указанных в блок-листе. Алгоритм динамического ценообразования дополнительно скорректирует итоговую стоимость под портфель.
        </p>
        <button className="primary" onClick={add}>
          Добавить бустер
        </button>
      </div>
      <div className="table-wrapper" style={{ maxHeight: 360 }}>
        <table>
          <thead>
            <tr>
              <th>Название</th>
              <th>% прироста</th>
              <th>Часы</th>
              <th>Базовая цена</th>
              <th>Мин Lv</th>
              <th>Req sub</th>
              <th>Blocked tariffs</th>
              <th>Лимит/портфель</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {drafts.map((b) => (
              <tr key={b.id}>
                <td>
                  <input value={b.name} onChange={(e) => update(b.id, 'name', e.target.value)} />
                </td>
                <td style={{ width: 120 }}>
                  <input
                    type="number"
                    step="0.01"
                    value={b.effect.value}
                    onChange={(e) => updatePct(b.id, Number(e.target.value))}
                  />
                </td>
                <td style={{ width: 90 }}>
                  <input
                    type="number"
                    value={b.durationHours}
                    onChange={(e) => update(b.id, 'durationHours', Number(e.target.value))}
                  />
                </td>
                <td style={{ width: 100 }}>
                  <input
                    type="number"
                    value={b.price}
                    onChange={(e) => update(b.id, 'price', Number(e.target.value))}
                  />
                </td>
                <td style={{ width: 90 }}>
                  <input
                    type="number"
                    value={b.minLevel}
                    onChange={(e) => update(b.id, 'minLevel', Number(e.target.value))}
                  />
                </td>
                <td style={{ width: 120 }}>
                  <input
                    value={b.reqSub || ''}
                    onChange={(e) => update(b.id, 'reqSub', e.target.value || null)}
                  />
                </td>
                <td style={{ width: 200 }}>
                  <textarea
                    value={b.blockedTariffs.join(',')}
                    onChange={(e) => updateBlocked(b.id, e.target.value)}
                  />
                </td>
                <td style={{ width: 120 }}>
                  <input
                    type="number"
                    value={b.limitPerPortfolio}
                    onChange={(e) => update(b.id, 'limitPerPortfolio', Number(e.target.value))}
                  />
                </td>
                <td style={{ width: 60 }}>
                  <button className="danger" onClick={() => remove(b.id)}>
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex" style={{ justifyContent: 'flex-end' }}>
        <button className="ghost" onClick={() => setDrafts(boosters)}>
          Сброс
        </button>
        <button className="primary" onClick={save}>
          Сохранить
        </button>
      </div>
    </div>
  );
}

type SimulationPanelProps = {
  segments: InvestorSegment[];
  setSegments: (segments: InvestorSegment[]) => void;
  tariffs: Tariff[];
  boosters: Booster[];
  currency: string;
  pricing: PricingControls;
};

function SimulationPanel({ segments, setSegments, tariffs, boosters, currency, pricing }: SimulationPanelProps) {
  const addSegment = () => {
    setSegments([
      ...segments,
      {
        id: uid('seg'),
        name: 'Новый сегмент',
        investors: 10,
        userLevel: 5,
        subscriptionId: 'bronze',
        accountBoosters: [],
        portfolio: []
      }
    ]);
  };

  const removeSegment = (segmentId: string) => {
    setSegments(segments.filter((s) => s.id !== segmentId));
  };

  const updateSegment = <K extends keyof InvestorSegment>(segmentId: string, field: K, value: InvestorSegment[K]) => {
    setSegments(
      segments.map((seg) => (seg.id === segmentId ? { ...seg, [field]: value } : seg))
    );
  };

  const addTariffToSegment = (segmentId: string, tariffId: string) => {
    const target = tariffs.find((t) => t.id === tariffId);
    if (!target) return;
    setSegments(
      segments.map((seg) =>
        seg.id === segmentId
          ? {
              ...seg,
              portfolio: [...seg.portfolio, { id: uid('sitem'), tariffId, amount: target.baseMin }]
            }
          : seg
      )
    );
  };

  const updateSegmentAmount = (segmentId: string, itemId: string, amount: number) => {
    setSegments(
      segments.map((seg) =>
        seg.id === segmentId
          ? {
              ...seg,
              portfolio: seg.portfolio.map((item) =>
                item.id === itemId ? { ...item, amount: Math.max(0, Number(amount) || 0) } : item
              )
            }
          : seg
      )
    );
  };

  const removeSegmentItem = (segmentId: string, itemId: string) => {
    setSegments(
      segments.map((seg) =>
        seg.id === segmentId
          ? { ...seg, portfolio: seg.portfolio.filter((item) => item.id !== itemId) }
          : seg
      )
    );
  };

  const toggleSegmentBooster = (segmentId: string, boosterId: string) => {
    setSegments(
      segments.map((seg) =>
        seg.id === segmentId
          ? {
              ...seg,
              accountBoosters: seg.accountBoosters.includes(boosterId)
                ? seg.accountBoosters.filter((id) => id !== boosterId)
                : [...seg.accountBoosters, boosterId]
            }
          : seg
      )
    );
  };

  const segmentSummaries = useMemo(() => {
    return segments.map((segment) => {
      const sub = SUBSCRIPTIONS.find((s) => s.id === segment.subscriptionId) ?? SUBSCRIPTIONS[0];
      const dynBoosters = smartPriceBoostersDyn(
        boosters,
        tariffs,
        sub,
        segment.userLevel,
        segment.portfolio,
        pricing
      );
      const availableBoosters = dynBoosters.filter(
        (b) => withinLevel(segment.userLevel, b.minLevel) && subMeets(b.reqSub, segment.subscriptionId)
      );
      const allowedBoosterIds = new Set(availableBoosters.map((b) => b.id));
      const chosenBoosterIds = segment.accountBoosters.filter((id) => allowedBoosterIds.has(id));
      const computed = computePortfolioState({
        portfolio: segment.portfolio,
        boosters: dynBoosters,
        accountBoosters: chosenBoosterIds,
        tariffs,
        activeSubId: segment.subscriptionId,
        userLevel: segment.userLevel
      });
      const depositPerInvestor = segment.portfolio.reduce((sum, item) => sum + item.amount, 0);
      return {
        segment,
        sub,
        dynBoosters,
        availableBoosters,
        chosenBoosterIds,
        computed,
        depositPerInvestor
      };
    });
  }, [segments, tariffs, boosters, pricing]);

  const totals = useMemo(() => {
    let investorsTotal = 0;
    let depositTotal = 0;
    let investorNetTotal = 0;
    let projectRevenueTotal = 0;
    let boosterRevenueTotal = 0;
    let subscriptionRevenueTotal = 0;
    let grossTotal = 0;
    let feeTotal = 0;
    let boosterLiftTotal = 0;
    let boosterLiftPerDayTotal = 0;

    segmentSummaries.forEach(({ segment, computed, depositPerInvestor }) => {
      investorsTotal += segment.investors;
      depositTotal += depositPerInvestor * segment.investors;
      investorNetTotal += computed.totals.investorNet * segment.investors;
      projectRevenueTotal += computed.totals.projectRevenue * segment.investors;
      boosterRevenueTotal += computed.totals.accountCost * segment.investors;
      subscriptionRevenueTotal += computed.totals.subCost * segment.investors;
      grossTotal += computed.totals.grossProfitTotal * segment.investors;
      feeTotal += computed.totals.feeTotal * segment.investors;
      boosterLiftTotal += computed.boosterSummary.liftNet * segment.investors;
      boosterLiftPerDayTotal += computed.boosterSummary.liftPerDay * segment.investors;
    });

    return {
      investorsTotal,
      depositTotal,
      investorNetTotal,
      projectRevenueTotal,
      boosterRevenueTotal,
      subscriptionRevenueTotal,
      grossTotal,
      feeTotal,
      boosterLiftTotal,
      boosterLiftPerDayTotal
    };
  }, [segmentSummaries]);

  const boosterRoiTotal = totals.boosterRevenueTotal > 0 ? totals.boosterLiftTotal / totals.boosterRevenueTotal : 0;
  const boosterPaybackTotal = totals.boosterLiftPerDayTotal > 0
    ? totals.boosterRevenueTotal / totals.boosterLiftPerDayTotal
    : null;

  return (
    <div className="card" style={{ display: 'grid', gap: 20 }}>
      <div className="flex-between">
        <div>
          <h2 className="section-title">Симуляция потоков инвесторов</h2>
          <p className="section-subtitle">
            Создавайте сегменты аудитории и анализируйте совокупные показатели: депозиты, выплаты инвесторам, доход проекта и долю бустеров.
          </p>
        </div>
        <button className="primary" onClick={addSegment}>
          Добавить сегмент
        </button>
      </div>

      <div className="sim-summary">
        <div className="sim-summary-card">
          <h4>Инвесторов</h4>
          <p>{totals.investorsTotal}</p>
        </div>
        <div className="sim-summary-card">
          <h4>Суммарный депозит</h4>
          <p>{fmtMoney(totals.depositTotal, currency)}</p>
        </div>
        <div className="sim-summary-card">
          <h4>Выплаты инвесторам</h4>
          <p>{fmtMoney(totals.investorNetTotal, currency)}</p>
        </div>
        <div className="sim-summary-card">
          <h4>Доход проекта</h4>
          <p>{fmtMoney(totals.projectRevenueTotal, currency)}</p>
        </div>
        <div className="sim-summary-card">
          <h4>Выручка от бустеров</h4>
          <p>{fmtMoney(totals.boosterRevenueTotal, currency)}</p>
        </div>
        <div className="sim-summary-card">
          <h4>Выручка от подписок</h4>
          <p>{fmtMoney(totals.subscriptionRevenueTotal, currency)}</p>
        </div>
        <div className="sim-summary-card">
          <h4>Лифт от бустеров</h4>
          <p>{fmtMoney(totals.boosterLiftTotal, currency)}</p>
        </div>
        <div className="sim-summary-card">
          <h4>ROI бустеров</h4>
          <p>
            {totals.boosterRevenueTotal > 0
              ? `${(boosterRoiTotal * 100).toFixed(1)}%`
              : '—'}
          </p>
        </div>
        <div className="sim-summary-card">
          <h4>Окупаемость бустеров</h4>
          <p>{boosterPaybackTotal != null ? `${boosterPaybackTotal.toFixed(1)} дн.` : '—'}</p>
        </div>
      </div>

      <div className="grid" style={{ gap: 16 }}>
        {segmentSummaries.map(({ segment, sub, availableBoosters, chosenBoosterIds, computed, depositPerInvestor }) => {
          const eligibleTariffs = tariffs.filter(
            (t) => withinLevel(segment.userLevel, t.minLevel) && subMeets(t.reqSub, segment.subscriptionId)
          );
          return (
            <div key={segment.id} className="card" style={{ display: 'grid', gap: 16 }}>
              <div className="flex-between">
                <div style={{ display: 'grid', gap: 6 }}>
                  <input
                    value={segment.name}
                    onChange={(e) => updateSegment(segment.id, 'name', e.target.value)}
                    style={{ fontWeight: 600 }}
                  />
                  <div className="section-subtitle">
                    {segment.investors} инвесторов • Lv {segment.userLevel} • {sub.name}
                  </div>
                </div>
                <button className="danger" onClick={() => removeSegment(segment.id)}>
                  Удалить сегмент
                </button>
              </div>

              <div className="flex" style={{ gap: 12 }}>
                <label style={{ minWidth: 140 }}>
                  <div className="section-subtitle">Инвесторов</div>
                  <input
                    type="number"
                    value={segment.investors}
                    min={0}
                    onChange={(e) => updateSegment(segment.id, 'investors', Number(e.target.value))}
                  />
                </label>
                <label style={{ minWidth: 140 }}>
                  <div className="section-subtitle">Уровень</div>
                  <input
                    type="number"
                    value={segment.userLevel}
                    min={1}
                    max={20}
                    onChange={(e) => updateSegment(segment.id, 'userLevel', Number(e.target.value))}
                  />
                </label>
                <label style={{ minWidth: 180 }}>
                  <div className="section-subtitle">Подписка</div>
                  <select
                    value={segment.subscriptionId}
                    onChange={(e) => updateSegment(segment.id, 'subscriptionId', e.target.value as InvestorSegment['subscriptionId'])}
                  >
                    {SUBSCRIPTIONS.filter((s) => withinLevel(segment.userLevel, s.minLevel)).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} — fee {(s.fee * 100).toFixed(0)}%
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div>
                <div className="section-subtitle">Бустеры сегмента</div>
                <div className="flex">
                  {availableBoosters.length === 0 && <span className="section-subtitle">Нет доступных бустеров.</span>}
                  {availableBoosters.map((b) => (
                    <label
                      key={b.id}
                      className="chip"
                      style={{ background: chosenBoosterIds.includes(b.id) ? '#dbeafe' : '#e2e8f0' }}
                    >
                      <input
                        type="checkbox"
                        checked={chosenBoosterIds.includes(b.id)}
                        onChange={() => toggleSegmentBooster(segment.id, b.id)}
                      />
                      <span>{b.name}</span>
                      <span className="badge">{fmtMoney(b.price, currency)}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="card" style={{ background: '#f8fafc', display: 'grid', gap: 12 }}>
                <div className="flex-between">
                  <h4 style={{ margin: 0 }}>Портфель сегмента</h4>
                  <select onChange={(e) => e.target.value && addTariffToSegment(segment.id, e.target.value)} value="">
                    <option value="" disabled>
                      Добавить тариф
                    </option>
                    {eligibleTariffs.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} — {(t.dailyRate * 100).toFixed(2)}%/d
                      </option>
                    ))}
                  </select>
                </div>
                {segment.portfolio.length === 0 && <span className="section-subtitle">Пока пусто.</span>}
                <div className="grid" style={{ gap: 12 }}>
                  {segment.portfolio.map((item) => {
                    const t = tariffs.find((x) => x.id === item.tariffId);
                    if (!t) return null;
                    return (
                      <div key={item.id} className="card">
                        <div className="flex-between">
                          <div>
                            <div style={{ fontWeight: 600 }}>{t.name}</div>
                            <div className="section-subtitle">
                              {(t.dailyRate * 100).toFixed(2)}%/d • {t.durationDays}d • {fmtMoney(t.baseMin, currency)}–{fmtMoney(t.baseMax, currency)}
                            </div>
                          </div>
                          <button className="danger" onClick={() => removeSegmentItem(segment.id, item.id)}>
                            Удалить
                          </button>
                        </div>
                        <label>
                          <div className="section-subtitle">Сумма</div>
                          <input
                            type="number"
                            value={item.amount}
                            min={0}
                            onChange={(e) => updateSegmentAmount(segment.id, item.id, Number(e.target.value))}
                          />
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="table-wrapper" style={{ maxHeight: 220 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Метрика</th>
                      <th>На 1 инвестора</th>
                      <th>На сегмент</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Депозит</td>
                      <td>{fmtMoney(depositPerInvestor, currency)}</td>
                      <td>{fmtMoney(depositPerInvestor * segment.investors, currency)}</td>
                    </tr>
                    <tr>
                      <td>Валовая прибыль</td>
                      <td>{fmtMoney(computed.totals.grossProfitTotal, currency)}</td>
                      <td>{fmtMoney(computed.totals.grossProfitTotal * segment.investors, currency)}</td>
                    </tr>
                    <tr>
                      <td>Комиссия проекта</td>
                      <td>{fmtMoney(computed.totals.feeTotal, currency)}</td>
                      <td>{fmtMoney(computed.totals.feeTotal * segment.investors, currency)}</td>
                    </tr>
                    <tr>
                      <td>Стоимость бустеров</td>
                      <td>{fmtMoney(computed.totals.accountCost, currency)}</td>
                      <td>{fmtMoney(computed.totals.accountCost * segment.investors, currency)}</td>
                    </tr>
                    <tr>
                      <td>Лифт от бустеров</td>
                      <td>{fmtMoney(computed.boosterSummary.liftNet, currency)}</td>
                      <td>{fmtMoney(computed.boosterSummary.liftNet * segment.investors, currency)}</td>
                    </tr>
                    <tr>
                      <td>Лифт в день</td>
                      <td>{fmtMoney(computed.boosterSummary.liftPerDay, currency)}</td>
                      <td>{fmtMoney(computed.boosterSummary.liftPerDay * segment.investors, currency)}</td>
                    </tr>
                    <tr>
                      <td>ROI бустеров</td>
                      <td>
                        {computed.boosterSummary.spend > 0
                          ? `${(computed.boosterSummary.roi * 100).toFixed(1)}%`
                          : '—'}
                      </td>
                      <td>
                        {computed.boosterSummary.spend > 0
                          ? `${(computed.boosterSummary.roi * 100).toFixed(1)}%`
                          : '—'}
                      </td>
                    </tr>
                    <tr>
                      <td>Окупаемость бустеров</td>
                      <td>
                        {computed.boosterSummary.paybackDays != null
                          ? `${computed.boosterSummary.paybackDays.toFixed(1)} дн.`
                          : '—'}
                      </td>
                      <td>
                        {computed.boosterSummary.paybackDays != null
                          ? `${computed.boosterSummary.paybackDays.toFixed(1)} дн.`
                          : '—'}
                      </td>
                    </tr>
                    <tr>
                      <td>Стоимость подписки</td>
                      <td>{fmtMoney(computed.totals.subCost, currency)}</td>
                      <td>{fmtMoney(computed.totals.subCost * segment.investors, currency)}</td>
                    </tr>
                    <tr>
                      <td>Выплата инвестору</td>
                      <td>{fmtMoney(computed.totals.investorNet, currency)}</td>
                      <td>{fmtMoney(computed.totals.investorNet * segment.investors, currency)}</td>
                    </tr>
                    <tr>
                      <td>Доход проекта</td>
                      <td>{fmtMoney(computed.totals.projectRevenue, currency)}</td>
                      <td>{fmtMoney(computed.totals.projectRevenue * segment.investors, currency)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
