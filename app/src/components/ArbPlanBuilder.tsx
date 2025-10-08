import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';

type Subscription = {
  id: string;
  name: string;
  fee: number;
  price: number;
  minLevel: number;
};

type TariffCategory = 'plan' | 'program';
type TariffAccess = 'level' | 'open';

type Tariff = {
  id: string;
  name: string;
  durationDays: number;
  dailyRateMin: number;
  dailyRateMax: number;
  dailyRateTarget: number;
  minLevel: number;
  baseMin: number;
  baseMax: number;
  reqSub: string | null;
  isLimited: boolean;
  capSlots: number | null;
  category: TariffCategory;
  access: TariffAccess;
  entryFee: number;
  recommendedPrincipal: number | null;
  payoutMode: 'stream' | 'locked';
};

type TariffSeed = Omit<
  Tariff,
  'dailyRateMin' | 'dailyRateMax' | 'dailyRateTarget'
> & {
  rate: number;
  rateRange?: [number, number];
  rateTarget?: number;
  bandTightness?: number;
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
  dailyGrossMin: number;
  dailyGrossMax: number;
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
  netPerDayFinalMin: number;
  netPerDayFinalMax: number;
  netFinalMin: number;
  netFinalMax: number;
  lockedNet: number;
  lockedNetPerDay: number;
  netNoBoost: number;
  netNoBoostPerDay: number;
  boosterLift: number;
  boosterLiftPerDay: number;
  boosterDetails: Record<string, { netGain: number; priceShare: number; paybackHours: number | null; coverage: number }>;
  programFee: number;
  programFeePerDay: number;
  breakevenAmount: number | null;
  recommendedPrincipal: number | null;
};

type ProgramInsight = {
  tariff: Tariff;
  baseReturn: number;
  competitor: Tariff | null;
  competitorReturn: number;
  requiredPremium: number;
  margin: number;
  breakevenAmount: number | null;
  recommendedPrincipal: number | null;
  premiumAtBaseMin: number | null;
  premiumAtTarget: number | null;
  advantageRatio: number | null;
  maxEntryFeeForTarget: number | null;
  entryFeeGap: number | null;
  targetDeposit: number;
  requirementMet: boolean;
};

type ProgramSummary = {
  count: number;
  avgPremium: number | null;
  flagged: number;
};

type Totals = {
  grossProfitTotal: number;
  feeTotal: number;
  accountCost: number;
  subCost: number;
  investorNet: number;
  investorNetPerDay: number;
  investorNetMin: number;
  investorNetMax: number;
  investorNetPerDayMin: number;
  investorNetPerDayMax: number;
  projectRevenue: number;
  baselineNet: number;
  baselineNetPerDay: number;
  capital: number;
  investorNetBeforeSub: number;
  investorNetPerDayBeforeSub: number;
  feePerDayTotal: number;
  accountCostPerDay: number;
  subCostPerDay: number;
  projectRevenuePerDay: number;
  programFees: number;
  programFeesPerDay: number;
  lockedNetTotal: number;
  lockedNetPerDay: number;
  unlockedNetTotal: number;
  unlockedNetPerDay: number;
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
    liftPerPlanDay: number;
    liftPerActiveHour: number;
    activeHours: number;
    netBeforeCost: number;
    netAfterCost: number;
    netAfterCostPerHour: number;
    spend: number;
    deposit: number;
    roi: number;
    paybackHours: number | null;
    coverageShare: number;
  };
  programInsights: Record<string, ProgramInsight>;
  programSummary: ProgramSummary;
};

type BoosterImpact = {
  booster: Booster;
  netGain: number;
  netPerActiveHour: number;
  netAfterCostPerHour: number;
  netAfterCost: number;
  roi: number | null;
  paybackHours: number | null;
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

type ProgramDesignControls = {
  relativePremiumPct: number;
  absolutePremiumPct: number;
  bufferMultiple: number;
};

type ScenarioProfile = {
  label: string;
  optimism: number;
  acquisitionMultiplier: number;
  expansionRate: number;
  topUpGrowth: number;
  churnProbability: number;
  reinvestShare: number;
  marketingCostPerInvestor: number;
  rampCompression: number;
  acquisitionFloor: number;
  dailyAdBudgetGrowth: number;
  seasonalityAmplitude: number;
  momentumMidpoint: number;
  momentumSlope: number;
  retentionBoost: number;
};

type InvestorSegment = {
  id: string;
  name: string;
  investors: number;
  userLevel: number;
  subscriptionId: string;
  accountBoosters: string[];
  portfolio: PortfolioItem[];
  rampDays: number;
  dailyTopUpPerInvestor: number;
};

const DEFAULT_RATE_SPREAD = 0.06;
const DEFAULT_RATE_COMPRESSION = 0.1;
const RATE_BAND_MAX_DELTA = 0.0005;

function createTariff(seed: TariffSeed): Tariff {
  const { rate, rateRange, rateTarget, bandTightness, ...rest } = seed;
  const [minRateRaw, maxRateRaw] =
    rateRange ?? [rate * (1 - DEFAULT_RATE_SPREAD), rate * (1 + DEFAULT_RATE_SPREAD)];
  const baseMin = Math.min(minRateRaw, maxRateRaw);
  const baseMax = Math.max(minRateRaw, maxRateRaw);
  const target = rateTarget ?? rate;
  const tighten = clamp(bandTightness ?? DEFAULT_RATE_COMPRESSION, 0.05, 1);
  const rawWidth = (baseMax - baseMin) * tighten;
  const width = rawWidth > 0 ? Math.min(rawWidth, RATE_BAND_MAX_DELTA) : 0;
  const halfWidth = width / 2;
  const centre = clamp(target, baseMin, baseMax);
  const minRate = clamp(centre - halfWidth, baseMin, centre);
  const maxRate = clamp(centre + halfWidth, centre, baseMax);
  return {
    ...rest,
    dailyRateMin: minRate,
    dailyRateMax: maxRate,
    dailyRateTarget: clamp(target, minRate, maxRate)
  };
}

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
  createTariff({ id: 't_start', name: 'Start Day', durationDays: 1, rate: 0.003, rateRange: [0.0015, 0.0042], minLevel: 1, baseMin: 20, baseMax: 500, reqSub: null, isLimited: false, capSlots: null, category: 'plan', access: 'level', entryFee: 0, recommendedPrincipal: null, payoutMode: 'stream' }),
  createTariff({ id: 't_weekly_a', name: 'Weekly A', durationDays: 7, rate: 0.004, rateRange: [0.0028, 0.0055], minLevel: 1, baseMin: 50, baseMax: 1500, reqSub: null, isLimited: false, capSlots: null, category: 'plan', access: 'level', entryFee: 0, recommendedPrincipal: null, payoutMode: 'stream' }),
  createTariff({ id: 't_weekly_b', name: 'Weekly B', durationDays: 7, rate: 0.005, rateRange: [0.0035, 0.0068], minLevel: 3, baseMin: 100, baseMax: 2500, reqSub: null, isLimited: false, capSlots: null, category: 'plan', access: 'level', entryFee: 0, recommendedPrincipal: null, payoutMode: 'stream' }),
  createTariff({ id: 't_flex14', name: 'Flex 14', durationDays: 14, rate: 0.006, rateRange: [0.0042, 0.0084], minLevel: 4, baseMin: 150, baseMax: 4000, reqSub: null, isLimited: false, capSlots: null, category: 'plan', access: 'level', entryFee: 0, recommendedPrincipal: null, payoutMode: 'stream' }),
  createTariff({ id: 't_month_std', name: 'Month Std', durationDays: 30, rate: 0.0065, rateRange: [0.0045, 0.009], minLevel: 5, baseMin: 200, baseMax: 6000, reqSub: null, isLimited: false, capSlots: null, category: 'plan', access: 'level', entryFee: 0, recommendedPrincipal: null, payoutMode: 'stream' }),
  createTariff({ id: 't_month_plus', name: 'Month Plus', durationDays: 30, rate: 0.0075, rateRange: [0.005, 0.0105], minLevel: 7, baseMin: 300, baseMax: 8000, reqSub: 'gold', isLimited: false, capSlots: null, category: 'plan', access: 'level', entryFee: 0, recommendedPrincipal: null, payoutMode: 'stream' }),
  createTariff({ id: 't_quarter', name: 'Quarter 90', durationDays: 90, rate: 0.008, rateRange: [0.0052, 0.011], minLevel: 10, baseMin: 500, baseMax: 15000, reqSub: 'platinum', isLimited: false, capSlots: null, category: 'plan', access: 'level', entryFee: 0, recommendedPrincipal: null, payoutMode: 'locked' }),
  createTariff({ id: 't_liq_pool', name: 'Liquidity Pool', durationDays: 21, rate: 0.0068, rateRange: [0.004, 0.0094], minLevel: 6, baseMin: 500, baseMax: 10000, reqSub: null, isLimited: true, capSlots: 80, category: 'plan', access: 'level', entryFee: 0, recommendedPrincipal: null, payoutMode: 'locked' }),
  createTariff({ id: 't_express3', name: 'Express 3d', durationDays: 3, rate: 0.007, rateRange: [0.0045, 0.0105], minLevel: 2, baseMin: 50, baseMax: 1200, reqSub: null, isLimited: true, capSlots: 200, category: 'plan', access: 'level', entryFee: 0, recommendedPrincipal: null, payoutMode: 'stream' }),
  createTariff({ id: 't_mm30', name: 'Market Making 30', durationDays: 30, rate: 0.0092, rateRange: [0.006, 0.0125], minLevel: 12, baseMin: 1000, baseMax: 20000, reqSub: 'pro', isLimited: true, capSlots: 40, category: 'plan', access: 'level', entryFee: 0, recommendedPrincipal: null, payoutMode: 'locked' }),
  createTariff({ id: 't_global60', name: 'Global 60', durationDays: 60, rate: 0.0098, rateRange: [0.0065, 0.0135], minLevel: 14, baseMin: 2000, baseMax: 30000, reqSub: 'elite', isLimited: true, capSlots: 30, category: 'plan', access: 'level', entryFee: 0, recommendedPrincipal: null, payoutMode: 'locked' }),
  createTariff({ id: 't_prime45', name: 'Prime 45', durationDays: 45, rate: 0.0102, rateRange: [0.007, 0.014], minLevel: 16, baseMin: 2500, baseMax: 35000, reqSub: 'ultra', isLimited: true, capSlots: 24, category: 'plan', access: 'level', entryFee: 0, recommendedPrincipal: null, payoutMode: 'stream' }),
  createTariff({ id: 't_flash7', name: 'Flash Seven', durationDays: 7, rate: 0.0115, rateRange: [0.007, 0.016], minLevel: 8, baseMin: 400, baseMax: 4500, reqSub: 'gold', isLimited: true, capSlots: 60, category: 'plan', access: 'level', entryFee: 0, recommendedPrincipal: null, payoutMode: 'stream' }),
  createTariff({ id: 't_dual21', name: 'Dual 21', durationDays: 21, rate: 0.0074, rateRange: [0.0048, 0.0104], minLevel: 9, baseMin: 600, baseMax: 9000, reqSub: 'platinum', isLimited: false, capSlots: null, category: 'plan', access: 'level', entryFee: 0, recommendedPrincipal: null, payoutMode: 'stream' }),
  createTariff({ id: 't_swing28', name: 'Swing 28', durationDays: 28, rate: 0.0085, rateRange: [0.0055, 0.0115], minLevel: 11, baseMin: 800, baseMax: 12000, reqSub: null, isLimited: false, capSlots: null, category: 'plan', access: 'level', entryFee: 0, recommendedPrincipal: null, payoutMode: 'stream' }),
  createTariff({ id: 't_spot18', name: 'Spot 18', durationDays: 18, rate: 0.008, rateRange: [0.005, 0.011], minLevel: 6, baseMin: 350, baseMax: 5500, reqSub: null, isLimited: false, capSlots: null, category: 'plan', access: 'level', entryFee: 0, recommendedPrincipal: null, payoutMode: 'stream' }),
  createTariff({ id: 't_meta60', name: 'Meta 60', durationDays: 60, rate: 0.0108, rateRange: [0.0068, 0.0148], minLevel: 18, baseMin: 5000, baseMax: 42000, reqSub: 'infinity', isLimited: true, capSlots: 20, category: 'plan', access: 'level', entryFee: 0, recommendedPrincipal: null, payoutMode: 'locked' }),
  createTariff({ id: 't_spread10', name: 'Spread 10', durationDays: 10, rate: 0.0069, rateRange: [0.0045, 0.0098], minLevel: 4, baseMin: 200, baseMax: 3800, reqSub: null, isLimited: true, capSlots: 110, category: 'plan', access: 'level', entryFee: 0, recommendedPrincipal: null, payoutMode: 'stream' }),
  createTariff({ id: 't_quant90', name: 'Quant 90', durationDays: 90, rate: 0.0101, rateRange: [0.0065, 0.0142], minLevel: 17, baseMin: 3200, baseMax: 38000, reqSub: 'elite', isLimited: true, capSlots: 28, category: 'plan', access: 'level', entryFee: 0, recommendedPrincipal: null, payoutMode: 'locked' }),
  createTariff({ id: 't_event5', name: 'Event 5', durationDays: 5, rate: 0.0125, rateRange: [0.007, 0.0185], minLevel: 7, baseMin: 500, baseMax: 5000, reqSub: null, isLimited: true, capSlots: 20, category: 'plan', access: 'level', entryFee: 0, recommendedPrincipal: null, payoutMode: 'stream' }),
  createTariff({ id: 't_ai45', name: 'AI 45', durationDays: 45, rate: 0.0115, rateRange: [0.0072, 0.0158], minLevel: 15, baseMin: 2500, baseMax: 28000, reqSub: 'pro', isLimited: true, capSlots: 32, category: 'plan', access: 'level', entryFee: 0, recommendedPrincipal: null, payoutMode: 'locked' }),
  createTariff({ id: 't_yield75', name: 'Yield 75', durationDays: 75, rate: 0.0091, rateRange: [0.006, 0.0124], minLevel: 13, baseMin: 1800, baseMax: 25000, reqSub: 'elite', isLimited: false, capSlots: null, category: 'plan', access: 'level', entryFee: 0, recommendedPrincipal: null, payoutMode: 'stream' }),
  createTariff({ id: 'p_premium28', name: 'Premium Access 28', durationDays: 28, rate: 0.0095, rateRange: [0.006, 0.0132], minLevel: 1, baseMin: 400, baseMax: 6000, reqSub: null, isLimited: true, capSlots: 75, category: 'program', access: 'open', entryFee: 180, recommendedPrincipal: 1800, payoutMode: 'locked' }),
  createTariff({ id: 'p_quant_elite30', name: 'Quant Elite 30', durationDays: 30, rate: 0.012, rateRange: [0.008, 0.0175], minLevel: 1, baseMin: 600, baseMax: 9000, reqSub: 'silver', isLimited: true, capSlots: 60, category: 'program', access: 'open', entryFee: 260, recommendedPrincipal: 2500, payoutMode: 'locked' }),
  createTariff({ id: 'p_launch_vip14', name: 'Launch VIP 14', durationDays: 14, rate: 0.0135, rateRange: [0.0085, 0.0195], minLevel: 1, baseMin: 450, baseMax: 6500, reqSub: null, isLimited: false, capSlots: null, category: 'program', access: 'open', entryFee: 140, recommendedPrincipal: 1500, payoutMode: 'stream' }),
  createTariff({ id: 'p_titan45', name: 'Titan 45', durationDays: 45, rate: 0.0118, rateRange: [0.0075, 0.0168], minLevel: 1, baseMin: 900, baseMax: 14000, reqSub: 'gold', isLimited: true, capSlots: 45, category: 'program', access: 'open', entryFee: 360, recommendedPrincipal: 3600, payoutMode: 'locked' }),
  createTariff({ id: 'p_zen60', name: 'Zenith 60', durationDays: 60, rate: 0.0108, rateRange: [0.007, 0.0152], minLevel: 1, baseMin: 1200, baseMax: 20000, reqSub: 'gold', isLimited: true, capSlots: 40, category: 'program', access: 'open', entryFee: 520, recommendedPrincipal: 5200, payoutMode: 'locked' }),
  createTariff({ id: 'p_founders90', name: 'Founders 90', durationDays: 90, rate: 0.0125, rateRange: [0.008, 0.0185], minLevel: 1, baseMin: 2000, baseMax: 26000, reqSub: 'elite', isLimited: true, capSlots: 24, category: 'program', access: 'open', entryFee: 900, recommendedPrincipal: 10000, payoutMode: 'locked' })
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

function fmtPercent(value: number | null | undefined, fractionDigits = 1) {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(fractionDigits)}%`;
}

function withinLevel(userLevel: number, minLevel: number) {
  return userLevel >= minLevel;
}

function tariffAccessible(tariff: Tariff, userLevel: number, activeSubId: string) {
  const levelOk = tariff.access === 'open' || withinLevel(userLevel, tariff.minLevel);
  const subOk = subMeets(tariff.reqSub, activeSubId);
  return levelOk && subOk;
}

function sortTariffs(a: Tariff, b: Tariff) {
  if (a.category !== b.category) {
    return a.category === 'plan' ? -1 : 1;
  }
  if (a.access !== b.access) {
    return a.access === 'open' ? 1 : -1;
  }
  if (a.minLevel !== b.minLevel) {
    return a.minLevel - b.minLevel;
  }
  return a.dailyRateTarget - b.dailyRateTarget;
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

function tariffRate(t: Tariff, optimism?: number) {
  if (typeof optimism === 'number' && Number.isFinite(optimism)) {
    const blend = clamp(optimism, 0, 1);
    return t.dailyRateMin + (t.dailyRateMax - t.dailyRateMin) * blend;
  }
  return t.dailyRateTarget;
}

function tariffRateMin(t: Tariff) {
  return t.dailyRateMin;
}

function tariffRateMax(t: Tariff) {
  return t.dailyRateMax;
}

function boosterCoverageMultiplier(value: number, coverageFrac: number) {
  return 1 + value * clamp(coverageFrac, 0, 1);
}

const SCENARIO_WORST: ScenarioProfile = {
  label: 'Кризисный',
  optimism: 0,
  acquisitionMultiplier: 0.45,
  expansionRate: 0.01,
  topUpGrowth: -0.35,
  churnProbability: 0.08,
  reinvestShare: 0.12,
  marketingCostPerInvestor: 38,
  rampCompression: 1.15,
  acquisitionFloor: 0.32,
  dailyAdBudgetGrowth: 0.015,
  seasonalityAmplitude: 0.12,
  momentumMidpoint: 65,
  momentumSlope: 0.07,
  retentionBoost: -0.18
};

const SCENARIO_BEST: ScenarioProfile = {
  label: 'Агрессивный рост',
  optimism: 1,
  acquisitionMultiplier: 1.6,
  expansionRate: 0.18,
  topUpGrowth: 0.85,
  churnProbability: 0.012,
  reinvestShare: 0.6,
  marketingCostPerInvestor: 14,
  rampCompression: 0.65,
  acquisitionFloor: 0.95,
  dailyAdBudgetGrowth: 0.12,
  seasonalityAmplitude: 0.38,
  momentumMidpoint: 32,
  momentumSlope: 0.16,
  retentionBoost: 0.28
};

const MMM_MAX_DAYS = 180;
const MMM_MAX_QUEUE = 8000;
const MMM_MAX_DAILY_PROCESSED = 3000;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function blendScenario(bias: number): ScenarioProfile {
  const t = clamp(bias, 0, 100) / 100;
  const profile: ScenarioProfile = {
    label: t < 0.33 ? 'Кризисный' : t > 0.66 ? 'Агрессивный рост' : 'Сбалансированный',
    optimism: t,
    acquisitionMultiplier: lerp(
      SCENARIO_WORST.acquisitionMultiplier,
      SCENARIO_BEST.acquisitionMultiplier,
      t
    ),
    expansionRate: lerp(SCENARIO_WORST.expansionRate, SCENARIO_BEST.expansionRate, t),
    topUpGrowth: lerp(SCENARIO_WORST.topUpGrowth, SCENARIO_BEST.topUpGrowth, t),
    churnProbability: lerp(SCENARIO_WORST.churnProbability, SCENARIO_BEST.churnProbability, t),
    reinvestShare: lerp(SCENARIO_WORST.reinvestShare, SCENARIO_BEST.reinvestShare, t),
    marketingCostPerInvestor: lerp(
      SCENARIO_WORST.marketingCostPerInvestor,
      SCENARIO_BEST.marketingCostPerInvestor,
      t
    ),
    rampCompression: lerp(SCENARIO_WORST.rampCompression, SCENARIO_BEST.rampCompression, t),
    acquisitionFloor: lerp(SCENARIO_WORST.acquisitionFloor, SCENARIO_BEST.acquisitionFloor, t),
    dailyAdBudgetGrowth: lerp(
      SCENARIO_WORST.dailyAdBudgetGrowth,
      SCENARIO_BEST.dailyAdBudgetGrowth,
      t
    ),
    seasonalityAmplitude: lerp(
      SCENARIO_WORST.seasonalityAmplitude,
      SCENARIO_BEST.seasonalityAmplitude,
      t
    ),
    momentumMidpoint: lerp(SCENARIO_WORST.momentumMidpoint, SCENARIO_BEST.momentumMidpoint, t),
    momentumSlope: lerp(SCENARIO_WORST.momentumSlope, SCENARIO_BEST.momentumSlope, t),
    retentionBoost: lerp(SCENARIO_WORST.retentionBoost, SCENARIO_BEST.retentionBoost, t)
  };
  return profile;
}

function formatHours(hours: number) {
  if (!Number.isFinite(hours)) return '—';
  if (hours <= 0) return '0 ч';
  if (hours < 1) return `${Math.round(hours * 60)} мин`;
  if (hours >= 48) return `${(hours / 24).toFixed(1)} дн.`;
  return `${hours.toFixed(1)} ч`;
}

function describePayback(hours: number | null, activeHours?: number) {
  if (hours == null || !Number.isFinite(hours) || hours === Infinity) return 'не окупается';
  const label = formatHours(hours);
  if (activeHours != null && activeHours > 0 && hours - activeHours > 1e-6) {
    return `${label} (дольше срока ${formatHours(activeHours)})`;
  }
  return label;
}

function logisticGrowth(day: number, midpoint: number, slope: number) {
  const x = day - midpoint;
  return 1 / (1 + Math.exp(-slope * x));
}

function seasonalMod(day: number, amplitude: number) {
  if (amplitude <= 0) return 1;
  const phase = (day / 30) * Math.PI * 2;
  return 1 + amplitude * Math.sin(phase);
}

function computeMomentum(day: number, horizon: number, profile: ScenarioProfile) {
  const logistic = logisticGrowth(day, profile.momentumMidpoint, profile.momentumSlope);
  const seasonal = seasonalMod(day, profile.seasonalityAmplitude);
  const ramp = Math.min(1, day / Math.max(30, horizon * 0.4));
  return Math.max(profile.acquisitionFloor, logistic * seasonal * ramp);
}

const DEFAULT_PRICING: PricingControls = {
  baseCapturePct: 65,
  whaleCapturePct: 90,
  investorRoiFloorPct: 20,
  minPrice: 0.5,
  maxPrice: 1_000_000
};

const DEFAULT_PROGRAM_CONTROLS: ProgramDesignControls = {
  relativePremiumPct: 20,
  absolutePremiumPct: 5,
  bufferMultiple: 1.2
};

const STORAGE_KEY = 'arb-plan-builder-v4';

type PersistedState = {
  tariffs?: Tariff[];
  boosters?: Booster[];
  pricing?: PricingControls;
  programDesign?: ProgramDesignControls;
};

function normalizeTariff(t: any): Tariff {
  const targetRate = Number(t?.dailyRateTarget ?? t?.dailyRate ?? t?.rate ?? 0.005);
  const minRateRaw =
    t?.dailyRateMin ?? t?.rateMin ?? t?.minRate ?? targetRate * (1 - DEFAULT_RATE_SPREAD);
  const maxRateRaw =
    t?.dailyRateMax ?? t?.rateMax ?? t?.maxRate ?? targetRate * (1 + DEFAULT_RATE_SPREAD);
  const minRate = Math.max(0, Number(minRateRaw));
  const maxRate = Math.max(minRate, Number(maxRateRaw));
  return {
    id: String(t?.id ?? uid('t')),
    name: String(t?.name ?? 'Tariff'),
    durationDays: Number(t?.durationDays ?? 7),
    dailyRateMin: minRate,
    dailyRateMax: maxRate,
    dailyRateTarget: Math.min(Math.max(targetRate, minRate), maxRate),
    minLevel: Number(t?.minLevel ?? 1),
    baseMin: Number(t?.baseMin ?? 50),
    baseMax: Number(t?.baseMax ?? 3000),
    reqSub: t?.reqSub ? String(t.reqSub) : null,
    isLimited: Boolean(t?.isLimited ?? false),
    capSlots:
      t?.capSlots === null || t?.capSlots === undefined || t?.capSlots === ''
        ? null
        : Number(t.capSlots),
    category: t?.category === 'program' ? 'program' : 'plan',
    access: t?.access === 'open' ? 'open' : 'level',
    entryFee: Number(t?.entryFee ?? 0),
    recommendedPrincipal:
      t?.recommendedPrincipal === null || t?.recommendedPrincipal === undefined || t?.recommendedPrincipal === ''
        ? null
        : Number(t.recommendedPrincipal),
    payoutMode: t?.payoutMode === 'locked' ? 'locked' : 'stream'
  };
}

function readPersistedState(): PersistedState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed ?? null;
  } catch {
    return null;
  }
}

function smartPriceBoostersDyn(
  boosterList: Booster[],
  tariffs: Tariff[],
  sub: Subscription,
  userLevel: number,
  portfolio: PortfolioItem[],
  pricing: PricingControls = DEFAULT_PRICING
) {
  const eligibleTs = tariffs.filter((t) => tariffAccessible(t, userLevel, sub.id));
  if (eligibleTs.length === 0) return boosterList;

  const sortedByMin = [...eligibleTs].sort((a, b) => a.baseMin - b.baseMin);
  const lowT = sortedByMin.slice(0, 3);

  const baseCapture = clamp(pricing.baseCapturePct / 100, 0, 1);
  const whaleCapture = clamp(pricing.whaleCapturePct / 100, 0, 1);
  const investorBonusShare = Math.max(0, pricing.investorRoiFloorPct / 100);
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
      const grossGain = amount * tariffRate(t) * t.durationDays * (eff * cov);
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
      const grossGain = t.baseMin * tariffRate(t) * t.durationDays * (eff * cov);
      sum += grossGain * (1 - sub.fee);
    }
    return sum;
  };

  return boosterList.map((b) => {
    if (b.scope !== 'account') return b;

    const baseNetRaw = baselineNetGain(b);
    const portNetRaw = portfolioNetGain(b);

    const baseNet = Math.max(0, baseNetRaw);
    const portNet = Math.max(0, portNetRaw);

    const baseCap = baseNet > 0 ? baseNet / (1 + investorBonusShare) : 0;
    const baseTarget = baseNet * baseCapture;
    let dynPrice = baseCap > 0 ? Math.min(baseTarget, baseCap) : baseTarget;

    const extraNet = Math.max(0, portNet - baseNet);
    if (extraNet > 0) {
      const extraCap = extraNet / (1 + investorBonusShare);
      dynPrice += extraCap * whaleCapture;
    }

    const roiCaps: number[] = [];
    if (baseNet > 0) {
      roiCaps.push(baseCap);
    }
    if (portNet > 0) {
      roiCaps.push(portNet / (1 + investorBonusShare));
    }

    if (roiCaps.length === 0) {
      dynPrice = 0;
    } else {
      const roiMax = Math.min(...roiCaps);
      const effectiveMax = Math.min(maxPrice, roiMax);
      dynPrice = Math.min(dynPrice, effectiveMax);
      const minBound = Math.min(minPrice, effectiveMax);
      dynPrice = Math.max(dynPrice, minBound);
    }

    if (!Number.isFinite(dynPrice) || dynPrice < 0) {
      dynPrice = 0;
    }

    return { ...b, price: parseFloat(dynPrice.toFixed(2)) };
  });
}

function buildProgramInsights(
  tariffs: Tariff[],
  userLevel: number,
  activeSubId: string,
  feeRate: number,
  controls: ProgramDesignControls
): Record<string, ProgramInsight> {
  const plans = tariffs.filter((t) => t.category === 'plan' && tariffAccessible(t, userLevel, activeSubId));
  const programs = tariffs.filter((t) => t.category === 'program');

  const planWithReturn = plans.map((t) => ({
    tariff: t,
    baseReturn: tariffRate(t) * t.durationDays * (1 - feeRate)
  }));

  const bestPlan = planWithReturn.reduce<{
    tariff: Tariff | null;
    baseReturn: number;
  }>(
    (best, current) =>
      current.baseReturn > best.baseReturn
        ? { tariff: current.tariff, baseReturn: current.baseReturn }
        : best,
    { tariff: null, baseReturn: 0 }
  );

  const competitorTariff = bestPlan.tariff;
  const competitorReturn = bestPlan.baseReturn;

  const relativeTarget = Math.max(0, controls.relativePremiumPct) / 100;
  const absoluteTarget = Math.max(0, controls.absolutePremiumPct) / 100;
  const bufferMultiple = Math.max(1, controls.bufferMultiple);

  const insights: Record<string, ProgramInsight> = {};

  for (const program of programs) {
    const baseReturn = tariffRate(program) * program.durationDays * (1 - feeRate);
    const requiredPremium = Math.max(competitorReturn * relativeTarget, absoluteTarget);
    const margin = baseReturn - competitorReturn - requiredPremium;

    const breakevenRaw =
      program.entryFee > 0 && baseReturn > 0 ? program.entryFee / baseReturn : null;
    const breakevenAmount =
      breakevenRaw != null && Number.isFinite(breakevenRaw) ? breakevenRaw : null;

    const anchorDeposit =
      breakevenAmount != null
        ? Math.max(program.baseMin, breakevenAmount * bufferMultiple)
        : Math.max(program.baseMin, program.recommendedPrincipal ?? program.baseMin);

    const recommendedPrincipal =
      program.entryFee > 0 && margin > 0
        ? Math.max(program.baseMin, (program.entryFee / margin) * bufferMultiple)
        : null;

    const targetDeposit = recommendedPrincipal ?? anchorDeposit;

    const premiumAtBaseMin =
      program.baseMin > 0
        ? baseReturn - program.entryFee / program.baseMin - competitorReturn
        : null;
    const premiumAtTarget =
      targetDeposit > 0
        ? baseReturn - program.entryFee / targetDeposit - competitorReturn
        : null;

    const advantageRatio =
      competitorReturn > 0 && premiumAtTarget != null
        ? premiumAtTarget / competitorReturn
        : null;

    const rawGap = baseReturn - competitorReturn - requiredPremium;
    const maxEntryFeeForTarget = rawGap > 0 ? rawGap * targetDeposit : 0;
    const entryFeeGap = maxEntryFeeForTarget - program.entryFee;
    const requirementMet = premiumAtTarget != null && premiumAtTarget >= requiredPremium;

    insights[program.id] = {
      tariff: program,
      baseReturn,
      competitor: competitorTariff ?? null,
      competitorReturn,
      requiredPremium,
      margin,
      breakevenAmount,
      recommendedPrincipal,
      premiumAtBaseMin,
      premiumAtTarget,
      advantageRatio,
      maxEntryFeeForTarget,
      entryFeeGap,
      targetDeposit,
      requirementMet
    };
  }

  return insights;
}

type ComputeOptions = {
  portfolio: PortfolioItem[];
  boosters: Booster[];
  accountBoosters: string[];
  tariffs: Tariff[];
  activeSubId: string;
  userLevel: number;
  programControls: ProgramDesignControls;
  optimism?: number;
};

function computePortfolioState({
  portfolio,
  boosters,
  accountBoosters,
  tariffs,
  activeSubId,
  userLevel,
  programControls,
  optimism
}: ComputeOptions): ComputedState {
  const activeSub = SUBSCRIPTIONS.find((s) => s.id === activeSubId) ?? SUBSCRIPTIONS[0];
  const feeRate = activeSub.fee;
  const chosenAcc = accountBoosters
    .map((id) => boosters.find((b) => b.id === id))
    .filter(Boolean) as Booster[];
  const boosterNetGain = new Map<string, number>();
  const programInsights = buildProgramInsights(tariffs, userLevel, activeSubId, feeRate, programControls);

  const rowsBase = portfolio
    .map((item) => {
      const t = tariffs.find((x) => x.id === item.tariffId);
      if (!t) return null;
      const programInsight = programInsights[t.id];
      const amount = Math.max(0, Number(item.amount) || 0);
      const hours = t.durationDays * 24;
      const rate = tariffRate(t, optimism);
      const applicable = chosenAcc.filter(
        (b) => !Array.isArray(b.blockedTariffs) || !b.blockedTariffs.includes(t.id)
      );

      let multiplier = 1;
      const notes: string[] = [];
      const boosterNetById: Record<string, number> = {};
      const duration = t.durationDays > 0 ? t.durationDays : 1;
      const programFee = t.entryFee ?? 0;
      const programFeePerDay = duration > 0 ? programFee / duration : programFee;
      for (const b of applicable) {
        const cov = Math.min(b.durationHours, hours) / hours;
        const mul = boosterCoverageMultiplier(b.effect.value, cov);
        multiplier *= mul;
        notes.push(`${b.name}: ×${mul.toFixed(3)} (cov ${(cov * 100).toFixed(0)}%)`);

        const gainGross = amount * rate * t.durationDays * (b.effect.value * cov);
        const gainNet = gainGross * (1 - feeRate);
        boosterNetGain.set(b.id, (boosterNetGain.get(b.id) || 0) + gainNet);
        boosterNetById[b.id] = (boosterNetById[b.id] || 0) + gainNet;
      }

      const dailyGross = amount * rate * multiplier;
      const feePerDay = dailyGross * feeRate;
      const gross = dailyGross * t.durationDays;
      const fee = feePerDay * t.durationDays;

      const dailyGrossBase = amount * rate;
      const grossBase = dailyGrossBase * t.durationDays;
      const feeBase = grossBase * feeRate;
      const netBase = grossBase - feeBase - programFee;
      const netBasePerDay = duration > 0 ? netBase / duration : netBase;

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
        netNoBoostPerDay: netBasePerDay,
        boosterNetById,
        programFee,
        programFeePerDay,
        recommendedPrincipal:
          programInsight?.recommendedPrincipal ?? t.recommendedPrincipal ?? null
      } as Omit<
        PortfolioRow,
        | 'accAlloc'
        | 'accPerDay'
        | 'subAlloc'
        | 'subPerDay'
        | 'netPerDayAfter'
        | 'netAfter'
        | 'netPerDayFinal'
        | 'netFinal'
        | 'netPerDayFinalMin'
        | 'netPerDayFinalMax'
        | 'netFinalMin'
        | 'netFinalMax'
        | 'dailyGrossMin'
        | 'dailyGrossMax'
      > & {
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
    const boosterNetById: Record<string, number> = r.boosterNetById || {};
    let accAlloc = 0;
    const boosterDetails: PortfolioRow['boosterDetails'] = {};
    const rateMin = tariffRateMin(r.t);
    const rateMax = tariffRateMax(r.t);
    for (const b of r.applicable) {
      const denom = denomByBooster.get(b.id) || 0;
      const share = denom ? (r.amount * r.t.durationDays) / denom : 0;
      const priceShare = (b.price || 0) * share;
      accAlloc += priceShare;

      const activeHours = Math.min(b.durationHours, r.t.durationDays * 24);
      const netGain = boosterNetById[b.id] ?? 0;
      const netPerHour = activeHours > 0 ? netGain / activeHours : 0;
      const paybackHours = netPerHour > 0 && priceShare > 0 ? priceShare / netPerHour : null;
      const coverage = r.t.durationDays > 0 ? Math.min(b.durationHours, r.t.durationDays * 24) / (r.t.durationDays * 24) : 0;
      boosterDetails[b.id] = {
        netGain,
        priceShare,
        paybackHours,
        coverage
      };
    }
    const duration = r.t.durationDays > 0 ? r.t.durationDays : 1;
    const accPerDay = duration > 0 ? accAlloc / duration : accAlloc;
    const programFee = r.programFee ?? 0;
    const programFeePerDay = r.programFeePerDay ?? (duration > 0 ? programFee / duration : programFee);

    const netPerDayBeforeSub = r.dailyGross - r.feePerDay - programFeePerDay;
    const netBeforeSub = r.gross - r.fee - programFee;
    const dailyGrossMin = r.amount * rateMin * r.multiplier;
    const dailyGrossMax = r.amount * rateMax * r.multiplier;
    const feePerDayMin = dailyGrossMin * feeRate;
    const feePerDayMax = dailyGrossMax * feeRate;
    const grossMin = dailyGrossMin * r.t.durationDays;
    const grossMax = dailyGrossMax * r.t.durationDays;
    const feeMin = feePerDayMin * r.t.durationDays;
    const feeMax = feePerDayMax * r.t.durationDays;

    const subShare = capDaysAll ? (r.amount * r.t.durationDays) / capDaysAll : 0;
    const subAlloc = subCost * subShare;
    const subPerDay = duration > 0 ? subAlloc / duration : subAlloc;

    const boosterLift = netBeforeSub - r.netNoBoost;
    const boosterLiftPerDay = netPerDayBeforeSub - r.netNoBoostPerDay;
    const isLocked = r.t.payoutMode === 'locked';
    const unlockedPerDayBeforeSub = isLocked ? 0 : netPerDayBeforeSub;
    const lockedPerDayBeforeSub = isLocked ? netPerDayBeforeSub : 0;
    const netPerDayFinal = unlockedPerDayBeforeSub - subPerDay;
    const netFinal = netBeforeSub - subAlloc;
    const netPerDayBeforeSubMin = dailyGrossMin - feePerDayMin - programFeePerDay;
    const netPerDayBeforeSubMax = dailyGrossMax - feePerDayMax - programFeePerDay;
    const netBeforeSubMin = grossMin - feeMin - programFee;
    const netBeforeSubMax = grossMax - feeMax - programFee;
    const netPerDayFinalMin = netPerDayBeforeSubMin - subPerDay;
    const netPerDayFinalMax = netPerDayBeforeSubMax - subPerDay;
    const netFinalMin = netBeforeSubMin - subAlloc;
    const netFinalMax = netBeforeSubMax - subAlloc;
    const lockedNet = isLocked ? netFinal : 0;

    const baseNetFactor = tariffRate(r.t, optimism) * r.t.durationDays * (1 - feeRate);
    const insight = programInsights[r.t.id];
    const fallbackBreakeven =
      programFee > 0 && baseNetFactor > 0 ? programFee / baseNetFactor : null;
    const breakevenAmount = insight?.breakevenAmount ?? fallbackBreakeven;
    const recommendedPrincipal =
      insight?.recommendedPrincipal ?? r.recommendedPrincipal ?? r.t.recommendedPrincipal ?? null;

    const { boosterNetById: _ignored, ...rest } = r;

    return {
      ...rest,
      accAlloc,
      accPerDay,
      subAlloc,
      subPerDay,
      programFee,
      programFeePerDay,
      breakevenAmount,
      recommendedPrincipal,
      netPerDayAfter: netPerDayBeforeSub,
      netAfter: netBeforeSub,
      netPerDayFinal,
      netFinal,
      netPerDayFinalMin,
      netPerDayFinalMax,
      netFinalMin,
      netFinalMax,
      lockedNet,
      lockedNetPerDay: lockedPerDayBeforeSub,
      boosterLift,
      boosterLiftPerDay,
      boosterDetails,
      dailyGrossMin,
      dailyGrossMax
    };
  });

  const investorNet = rows.reduce((s, r) => s + r.netFinal, 0);
  const investorNetPerDay = rows.reduce((s, r) => s + r.netPerDayFinal, 0);
  const investorNetMin = rows.reduce((s, r) => s + r.netFinalMin, 0);
  const investorNetMax = rows.reduce((s, r) => s + r.netFinalMax, 0);
  const investorNetPerDayMin = rows.reduce((s, r) => s + r.netPerDayFinalMin, 0);
  const investorNetPerDayMax = rows.reduce((s, r) => s + r.netPerDayFinalMax, 0);
  const investorNetBeforeSub = rows.reduce((s, r) => s + r.netAfter, 0);
  const investorNetPerDayBeforeSub = rows.reduce((s, r) => s + r.netPerDayAfter, 0);
  const feeTotal = rows.reduce((s, r) => s + r.fee, 0);
  const grossProfitTotal = rows.reduce((s, r) => s + r.gross, 0);
  const baselineNet = rows.reduce((s, r) => s + r.netNoBoost, 0);
  const baselineNetPerDay = rows.reduce((s, r) => s + r.netNoBoostPerDay, 0);
  const capital = rows.reduce((s, r) => s + r.amount, 0);
  const feePerDayTotal = rows.reduce((s, r) => s + r.feePerDay, 0);
  const accountCostPerDay = rows.reduce((s, r) => s + r.accPerDay, 0);
  const subCostPerDay = rows.reduce((s, r) => s + r.subPerDay, 0);
  const programFees = rows.reduce((s, r) => s + r.programFee, 0);
  const programFeesPerDay = rows.reduce((s, r) => s + r.programFeePerDay, 0);
  const lockedNetTotal = rows.reduce((s, r) => s + r.lockedNet, 0);
  const lockedNetPerDay = rows.reduce((s, r) => s + r.lockedNetPerDay, 0);
  const unlockedNetTotal = rows.reduce((s, r) => s + (r.netFinal - r.lockedNet), 0);
  const unlockedNetPerDay = rows.reduce(
    (s, r) => s + (r.t.payoutMode === 'locked' ? 0 : r.netPerDayFinal),
    0
  );
  const coveredCapital = rows.reduce((sum, r) => {
    const details = Object.values(r.boosterDetails || {});
    if (details.length === 0) return sum;
    const maxCoverage = details.reduce((acc, detail) => Math.max(acc, detail.coverage ?? 0), 0);
    return sum + r.amount * Math.max(0, Math.min(1, maxCoverage));
  }, 0);
  const coverageShare = capital > 0 ? Math.min(1, coveredCapital / capital) : 0;

  const appliedBoosters = chosenAcc.filter((b) => (denomByBooster.get(b.id) || 0) > 0);
  const accCostApplied = appliedBoosters.reduce((sum, b) => sum + (b.price || 0), 0);

  const projectRevenue = feeTotal + subCost + programFees;
  const projectRevenuePerDay = feePerDayTotal + subCostPerDay + programFeesPerDay;

  const liftNet = rows.reduce((s, r) => s + r.boosterLift, 0);
  const liftPerPlanDay = rows.reduce((s, r) => s + r.boosterLiftPerDay, 0);
  const boosterActiveHoursTotal = appliedBoosters.reduce((sum, b) => sum + b.durationHours, 0);
  const boosterNetBeforeCost = appliedBoosters.reduce(
    (sum, b) => sum + (boosterNetGain.get(b.id) || 0),
    0
  );
  const boosterNetPerActiveHourBeforeCost =
    boosterActiveHoursTotal > 0 ? boosterNetBeforeCost / boosterActiveHoursTotal : 0;
  const liftPerActiveHour =
    boosterActiveHoursTotal > 0 ? liftNet / boosterActiveHoursTotal : 0;
  const roi = accCostApplied > 0 ? liftNet / accCostApplied : 0;
  const paybackHours =
    boosterNetPerActiveHourBeforeCost > 0 ? accCostApplied / boosterNetPerActiveHourBeforeCost : null;

  const programSummary: ProgramSummary = (() => {
    const values = Object.values(programInsights);
    const relevant = values.filter(
      (insight) => insight.tariff.entryFee > 0 && tariffAccessible(insight.tariff, userLevel, activeSubId)
    );
    if (relevant.length === 0) {
      return { count: 0, avgPremium: null, flagged: 0 };
    }
    const avgPremium =
      relevant.reduce((sum, insight) => sum + Math.max(0, insight.premiumAtTarget ?? 0), 0) /
      relevant.length;
    const flagged = relevant.filter((insight) => !insight.requirementMet).length;
    return { count: relevant.length, avgPremium, flagged };
  })();

  const project30 = (subId: string, mode: 'no-reinvest' | 'auto-roll') => {
    const sub = SUBSCRIPTIONS.find((s) => s.id === subId)!;
    const feeRateLocal = sub.fee;
    const subCostLocal = sub.price;

    const base = rowsBase.map((r: any) => {
      const dailyGross = r.amount * tariffRate(r.t, optimism) * r.multiplier;
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
    let oneTimeProgramFee = 0;

    for (const r of base) {
      const projDays = mode === 'auto-roll' ? 30 : Math.min(30, r.t.durationDays);
      oneTimeProgramFee += r.programFee ?? 0;

      const netPerDayBefore = r.dailyGross - r.feePerDay;
      total += netPerDayBefore * projDays;
    }
    total -= oneTimeProgramFee;
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
      investorNetMin,
      investorNetMax,
      investorNetPerDayMin,
      investorNetPerDayMax,
      projectRevenue,
      baselineNet,
      baselineNetPerDay,
      capital,
      investorNetBeforeSub,
      investorNetPerDayBeforeSub,
      feePerDayTotal,
      accountCostPerDay,
      subCostPerDay,
      projectRevenuePerDay,
      programFees,
      programFeesPerDay,
      lockedNetTotal,
      lockedNetPerDay,
      unlockedNetTotal,
      unlockedNetPerDay
    },
    projection30,
    boosterSummary: {
      liftNet,
      liftPerPlanDay,
      liftPerActiveHour,
      activeHours: boosterActiveHoursTotal,
      netBeforeCost: boosterNetBeforeCost,
      netAfterCost: liftNet,
      netAfterCostPerHour: liftPerActiveHour,
      spend: accCostApplied,
      deposit: accCostApplied,
      roi,
      paybackHours,
      coverageShare
    },
    programInsights,
    programSummary
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

  const weekly = INIT_TARIFFS.find((t) => t.id === 't_weekly_a')!;
  const weeklyHours = weekly.durationDays * 24;
  const cov = Math.min(24, weeklyHours) / weeklyHours;
  const grossGainSmall = 100 * tariffRate(weekly) * weekly.durationDays * cov;
  const netGainSmall = grossGainSmall * (1 - elite.fee);
  const minBonusShare = DEFAULT_PRICING.investorRoiFloorPct / 100;
  const netAfterPrice = netGainSmall - pricedSmall;
  console.assert(
    pricedSmall <= netGainSmall / (1 + minBonusShare) + 1e-6,
    'price must honour guaranteed bonus cap'
  );
  console.assert(
    netAfterPrice >= pricedSmall * minBonusShare - 1e-6,
    'investor should retain guaranteed bonus share even at минимальном депозите'
  );

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

  const paybackShort = describePayback(12, 24);
  console.assert(paybackShort.includes('12') || paybackShort.includes('дн'), 'payback should render horizon');
  const paybackLong = describePayback(48, 24);
  console.assert(paybackLong.includes('дольше срока'), 'payback should note when horizon exceeds duration');
  const openNormalized = normalizeTariff({
    id: 'open',
    name: 'Open',
    durationDays: 5,
    dailyRateTarget: 0.01,
    dailyRateMin: 0.006,
    dailyRateMax: 0.014,
    minLevel: 10,
    baseMin: 100,
    baseMax: 500,
    reqSub: null,
    isLimited: false,
    capSlots: null,
    category: 'program',
    access: 'open'
  });
  console.assert(openNormalized.access === 'open' && openNormalized.category === 'program', 'normalizeTariff keeps flags');
  console.assert(tariffAccessible(openNormalized, 1, 'free'), 'open tariff ignores level');

  const programNormalized = normalizeTariff({
    id: 'prog',
    name: 'Program',
    durationDays: 10,
    dailyRateTarget: 0.01,
    dailyRateMin: 0.006,
    dailyRateMax: 0.014,
    baseMin: 200,
    baseMax: 2000,
    entryFee: 20,
    category: 'program',
    access: 'open'
  });
  const programState = computePortfolioState({
    portfolio: [{ id: 'p-test', tariffId: 'prog', amount: 300 }],
    boosters: [],
    accountBoosters: [],
    tariffs: [programNormalized],
    activeSubId: 'free',
    userLevel: 5,
    programControls: DEFAULT_PROGRAM_CONTROLS
  });
  console.assert(programState.rows[0].programFee === 20, 'program fee should be tracked on row');
  console.assert(programState.totals.programFees === 20, 'program fee should hit totals');
  console.assert(
    programState.rows[0].breakevenAmount != null && programState.rows[0].breakevenAmount > 0,
    'breakeven amount should be computed for program'
  );

  const designInsights = buildProgramInsights(
    INIT_TARIFFS,
    6,
    'free',
    SUBSCRIPTIONS[0].fee,
    DEFAULT_PROGRAM_CONTROLS
  );
  const premiumInsight = designInsights['p_premium28'];
  console.assert(premiumInsight != null, 'premium insight should be produced');
  if (premiumInsight) {
    console.assert(
      premiumInsight.recommendedPrincipal == null ||
        premiumInsight.recommendedPrincipal >= premiumInsight.tariff.baseMin,
      'recommended principal should not drop below base minimum'
    );
    console.assert(
      premiumInsight.maxEntryFeeForTarget != null,
      'entry fee ceiling should be available for premium insight'
    );
  }

  const lockedTariff = normalizeTariff({
    id: 'test_lock',
    name: 'Lock 10',
    durationDays: 10,
    dailyRateTarget: 0.01,
    dailyRateMin: 0.006,
    dailyRateMax: 0.014,
    minLevel: 1,
    baseMin: 100,
    baseMax: 1000,
    reqSub: null,
    isLimited: false,
    capSlots: null,
    category: 'plan',
    access: 'level',
    entryFee: 0,
    recommendedPrincipal: null,
    payoutMode: 'locked'
  });
  const lockedState = computePortfolioState({
    portfolio: [{ id: 'locked', tariffId: 'test_lock', amount: 500 }],
    boosters: [],
    accountBoosters: [],
    tariffs: [lockedTariff],
    activeSubId: 'free',
    userLevel: 5,
    programControls: DEFAULT_PROGRAM_CONTROLS
  });
  const lockedRow = lockedState.rows[0];
  console.assert(lockedRow.lockedNet > 0, 'locked plan should accumulate deferred payout');
  console.assert(
    Math.abs(lockedRow.lockedNetPerDay - lockedRow.netPerDayAfter) < 1e-6,
    'locked per-day accrual mirrors base net'
  );
  console.assert(lockedRow.netPerDayFinal <= 0, 'locked plan cashflow per day excludes accrual');

  const rangeState = computePortfolioState({
    portfolio: [{ id: 'rng', tariffId: 't_weekly_a', amount: 500 }],
    boosters: [],
    accountBoosters: [],
    tariffs: INIT_TARIFFS,
    activeSubId: 'free',
    userLevel: 5,
    programControls: DEFAULT_PROGRAM_CONTROLS
  });
  console.assert(
    rangeState.totals.investorNetMin <= rangeState.totals.investorNetMax + 1e-6,
    'min payout should not exceed max payout'
  );
  console.assert(
    rangeState.totals.investorNetPerDayMin <= rangeState.totals.investorNetPerDayMax + 1e-9,
    'min daily payout should not exceed max daily payout'
  );

  const crisisProfile = blendScenario(0);
  const growthProfile = blendScenario(100);
  console.assert(
    crisisProfile.acquisitionMultiplier < growthProfile.acquisitionMultiplier,
    'growth scenario should acquire faster'
  );
  const earlyMomentum = computeMomentum(5, 180, crisisProfile);
  const lateMomentum = computeMomentum(120, 180, growthProfile);
  console.assert(lateMomentum > earlyMomentum, 'momentum should accelerate in growth scenario');
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

    const grossGain = amount * tariffRate(tariff) * tariff.durationDays * (effect * coverage);
    const net = grossGain * (1 - sub.fee);
    if (net <= 0) continue;

    netGain += net;
    coverageDeposits += amount;
    affectedTariffs.add(tariff.id);
  }

  const netAfterCost = netGain - booster.price;
  const roi = booster.price > 0 ? (netAfterCost / booster.price) : null;
  const activeHours = booster.durationHours;
  const netPerActiveHour = activeHours > 0 ? netGain / activeHours : 0;
  const netAfterCostPerHour = activeHours > 0 ? netAfterCost / activeHours : 0;
  const paybackHours = netPerActiveHour > 0 ? booster.price / netPerActiveHour : null;
  const coverageShare = totalCapital > 0 ? coverageDeposits / totalCapital : 0;

  return {
    booster,
    netGain,
    netPerActiveHour,
    netAfterCostPerHour,
    netAfterCost,
    roi,
    paybackHours,
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
  const persisted = readPersistedState();
  const [tariffs, setTariffs] = useState<Tariff[]>(() =>
    persisted?.tariffs && Array.isArray(persisted.tariffs)
      ? persisted.tariffs.map(normalizeTariff)
      : INIT_TARIFFS
  );
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [boostersRaw, setBoostersRaw] = useState<Booster[]>(() =>
    (persisted?.boosters && Array.isArray(persisted.boosters) && persisted.boosters.length > 0
      ? persisted.boosters
      : BASE_BOOSTERS) as Booster[]
  );
  const [pricingControls, setPricingControls] = useState<PricingControls>(() =>
    persisted?.pricing ? { ...DEFAULT_PRICING, ...persisted.pricing } : DEFAULT_PRICING
  );
  const [programControls, setProgramControls] = useState<ProgramDesignControls>(() =>
    persisted?.programDesign
      ? { ...DEFAULT_PROGRAM_CONTROLS, ...persisted.programDesign }
      : DEFAULT_PROGRAM_CONTROLS
  );
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
      ],
      rampDays: 14,
      dailyTopUpPerInvestor: 0
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
      ],
      rampDays: 10,
      dailyTopUpPerInvestor: 25
    }
  ]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tariffCategoryFilter, setTariffCategoryFilter] = useState<'all' | 'plan' | 'program'>('all');
  const [tariffPayoutFilter, setTariffPayoutFilter] = useState<'all' | 'stream' | 'locked'>('all');
  const [tariffSearch, setTariffSearch] = useState('');

  const sortedTariffs = useMemo(() => [...tariffs].sort(sortTariffs), [tariffs]);
  const filteredTariffs = useMemo(() => {
    const query = tariffSearch.trim().toLowerCase();
    return sortedTariffs.filter((t) => {
      if (tariffCategoryFilter !== 'all' && t.category !== tariffCategoryFilter) return false;
      if (tariffPayoutFilter !== 'all' && t.payoutMode !== tariffPayoutFilter) return false;
      if (query) {
        const haystack = `${t.name} ${t.id}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [sortedTariffs, tariffCategoryFilter, tariffPayoutFilter, tariffSearch]);
  const eligibleTariffs = useMemo(
    () => filteredTariffs.filter((t) => tariffAccessible(t, userLevel, activeSubId)),
    [filteredTariffs, userLevel, activeSubId]
  );
  const availableAccountBoosters = boosters.filter(
    (b) =>
      b.scope === 'account' &&
      withinLevel(userLevel, b.minLevel) &&
      subMeets(b.reqSub, activeSubId)
  );
  const resetTariffFilters = () => {
    setTariffCategoryFilter('all');
    setTariffPayoutFilter('all');
    setTariffSearch('');
  };

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
        userLevel,
        programControls
      }),
    [portfolio, boosters, accountBoosters, tariffs, activeSubId, userLevel, programControls]
  );

  const rowMap = useMemo(() => {
    const map = new Map<string, PortfolioRow>();
    for (const row of computed.rows) {
      map.set(row.key, row);
    }
    return map;
  }, [computed.rows]);

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

  const addTariff = (tariffId: string, deposit?: number) => {
    const t = tariffs.find((x) => x.id === tariffId);
    if (!t) return;
    if (!tariffAccessible(t, userLevel, activeSubId)) {
      alert('Тариф недоступен при текущем уровне или подписке');
      return;
    }
    const used = tariffSlotsUsed.get(tariffId) || 0;
    if (t.isLimited && t.capSlots != null && used >= t.capSlots) {
      alert('Лимит слотов тарифа исчерпан');
      return;
    }
    const id = uid(tariffId);
    const base = Number.isFinite(deposit) ? Number(deposit) : t.baseMin;
    const amount = clamp(base, t.baseMin, t.baseMax);
    setPortfolio((prev) => [...prev, { id, tariffId, amount }]);
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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const payload: PersistedState = {
      tariffs,
      boosters: boostersRaw,
      pricing: pricingControls,
      programDesign: programControls
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [tariffs, boostersRaw, pricingControls, programControls]);

  return (
    <div className="grid" style={{ gap: 24 }}>
      <header className="card" style={{ display: 'grid', gap: 16 }}>
        <div className="flex-between">
          <div>
            <h1 style={{ margin: 0, fontSize: 28 }}>Arb Plan Builder v3.6 — canvas edition</h1>
            <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>
              Белый минималистичный дашборд • гибкие ROI-пороги бустеров с сохранением настроек • метрики окупаемости с учётом
              срока действия
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
          <div className="card">
            <h2 className="section-title">Премия платных программ</h2>
            <p className="section-subtitle">
              Задайте минимальную премию к бесплатным тарифам и запас по депозиту, чтобы автоматически рассчитывать рекомендуемые
              суммы и допустимый вход для программ.
            </p>
            <ProgramDesignEditor controls={programControls} setControls={setProgramControls} />
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
                      {insight && insight.paybackHours != null && (
                        <span>Payback {describePayback(insight.paybackHours, b.durationHours)}</span>
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
                      <th>Лифт/час</th>
                      <th>ROI</th>
                      <th>Окупаемость</th>
                      <th>Активные часы</th>
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
                        <td>{fmtMoney(insight.netAfterCostPerHour, currency)}</td>
                        <td>
                          {insight.roi != null
                            ? `${(insight.roi * 100).toFixed(1)}%`
                            : '—'}
                        </td>
                        <td>{describePayback(insight.paybackHours, insight.booster.durationHours)}</td>
                        <td>{formatHours(insight.booster.durationHours)}</td>
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
                <button className="ghost" type="button" onClick={() => resetTariffFilters()}>
                  Сбросить фильтры
                </button>
              </div>
              <TariffPicker
                categoryFilter={tariffCategoryFilter}
                setCategoryFilter={setTariffCategoryFilter}
                payoutFilter={tariffPayoutFilter}
                setPayoutFilter={setTariffPayoutFilter}
                search={tariffSearch}
                setSearch={setTariffSearch}
                eligibleTariffs={eligibleTariffs}
                totalFiltered={filteredTariffs.length}
                totalAll={sortedTariffs.length}
                currency={currency}
                activeSub={activeSub}
                onAdd={addTariff}
                tariffSlotsUsed={tariffSlotsUsed}
                insights={computed.programInsights}
              />

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
                    rowData={rowMap.get(item.id)}
                    insight={computed.programInsights[item.tariffId]}
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
                  <span>Бустеры (депозит, вернётся):</span>
                  <span>{fmtMoney(computed.totals.accountCost, currency)}</span>
                </div>
                <div className="flex-between">
                  <span>Инвестору без бустеров:</span>
                  <span>{fmtMoney(computed.totals.baselineNet, currency)}</span>
                </div>
                <div className="flex-between">
                  <span>Инвестору с бустерами (до подписки):</span>
                  <span>{fmtMoney(computed.totals.investorNetBeforeSub, currency)}</span>
                </div>
                <div className="flex-between">
                  <span>Инвестору (минимум):</span>
                  <span>{fmtMoney(computed.totals.investorNetMin, currency)}</span>
                </div>
                <div className="flex-between">
                  <span>Инвестору (максимум):</span>
                  <span>{fmtMoney(computed.totals.investorNetMax, currency)}</span>
                </div>
                <div className="flex-between">
                  <span>Поток/день (мин–макс):</span>
                  <span>
                    {fmtMoney(computed.totals.investorNetPerDayMin, currency)} –{' '}
                    {fmtMoney(computed.totals.investorNetPerDayMax, currency)}
                  </span>
                </div>
                <div className="flex-between">
                  <span>Лифт от бустеров (после оплаты):</span>
                  <span>{fmtMoney(computed.boosterSummary.liftNet, currency)}</span>
                </div>
                <div className="flex-between">
                  <span>Выплаты в заморозке:</span>
                  <span>{fmtMoney(computed.totals.lockedNetTotal, currency)}</span>
                </div>
                <div className="flex-between">
                  <span>Заморожено в день:</span>
                  <span>{fmtMoney(computed.totals.lockedNetPerDay, currency)}</span>
                </div>
                <div className="flex-between">
                  <span>Доступно в день (поток):</span>
                  <span>{fmtMoney(computed.totals.unlockedNetPerDay, currency)}</span>
                </div>
                <div className="flex-between">
                  <span>Доступно за срок (поток):</span>
                  <span>{fmtMoney(computed.totals.unlockedNetTotal, currency)}</span>
                </div>
                <div className="flex-between">
                  <span>Лифт в день (усреднено по тарифам):</span>
                  <span>{fmtMoney(computed.boosterSummary.liftPerPlanDay, currency)}</span>
                </div>
                <div className="flex-between">
                  <span>Лифт за активный час:</span>
                  <span>{fmtMoney(computed.boosterSummary.liftPerActiveHour, currency)}</span>
                </div>
                <div className="flex-between">
                  <span>Активные часы бустеров:</span>
                  <span>
                    {computed.boosterSummary.activeHours > 0
                      ? formatHours(computed.boosterSummary.activeHours)
                      : '—'}
                  </span>
                </div>
                <div className="flex-between">
                  <span>Покрытие бустерами:</span>
                  <span>{fmtPercent(computed.boosterSummary.coverageShare, 0)}</span>
                </div>
                <div className="flex-between">
                  <span>Депозит по бустерам:</span>
                  <span>{fmtMoney(computed.boosterSummary.deposit, currency)}</span>
                </div>
                <div className="flex-between">
                  <span>Бонус до депозита:</span>
                  <span>{fmtMoney(computed.boosterSummary.netBeforeCost, currency)}</span>
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
                    {computed.boosterSummary.spend > 0
                      ? describePayback(
                          computed.boosterSummary.paybackHours,
                          computed.boosterSummary.activeHours
                        )
                      : '—'}
                  </span>
                </div>
                <div className="flex-between">
                  <span>Подписка (30d):</span>
                  <span>{fmtMoney(computed.totals.subCost, currency)}</span>
                </div>
                <div className="flex-between">
                  <span>Платные программы:</span>
                  <span>
                    {computed.programSummary.count > 0
                      ? `${computed.programSummary.count} • ${fmtPercent(computed.programSummary.avgPremium, 1)}`
                      : '—'}
                  </span>
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
                  <span>Начисление в день (до подписки):</span>
                  <span>{fmtMoney(computed.totals.investorNetPerDayBeforeSub, currency)}</span>
                </div>
                <div className="flex-between">
                  <span>Доход проекта:</span>
                  <strong>{fmtMoney(computed.totals.projectRevenue, currency)}</strong>
                </div>
                <div className="flex-between">
                  <span>Доход проекта в день:</span>
                  <span>{fmtMoney(computed.totals.projectRevenuePerDay, currency)}</span>
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
            <p className="section-subtitle">
              Тарифы приносят выплаты ежедневно и требуют соблюдения уровня. Программы доступны для всех уровней, но
              включают входной взнос и могут переводить прибыль в замороженный баланс до конца срока — учитывайте это при
              подборе суммы.
            </p>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              {filteredTariffs.map((t, idx, arr) => {
                const used = tariffSlotsUsed.get(t.id) || 0;
                const left = t.isLimited && t.capSlots != null ? Math.max(0, t.capSlots - used) : null;
                const locked = !tariffAccessible(t, userLevel, activeSubId);
                const categoryChanged = idx === 0 || arr[idx - 1].category !== t.category;
                const rateMin = tariffRateMin(t);
                const rateMax = tariffRateMax(t);
                const rateTarget = tariffRate(t);
                const baseNetFactor = rateTarget * t.durationDays * (1 - activeSub.fee);
                const breakeven =
                  t.entryFee > 0 && baseNetFactor > 0 ? t.entryFee / baseNetFactor : null;
                const insight = computed.programInsights[t.id];
                const recommended = insight?.recommendedPrincipal ?? t.recommendedPrincipal ?? null;
                const premiumInfo = insight?.premiumAtTarget ?? null;
                const premiumTarget = insight?.requiredPremium ?? null;
                const premiumMet = insight?.requirementMet ?? false;
                const competitorName = insight?.competitor?.name ?? 'базовым тарифам';
                const entryFeeGap = insight?.entryFeeGap ?? null;
                return (
                  <React.Fragment key={t.id}>
                    {categoryChanged && (
                      <div
                        style={{
                          gridColumn: '1 / -1',
                          fontWeight: 600,
                          color: '#475569'
                        }}
                      >
                        {t.category === 'program'
                          ? 'Программы (без ограничения уровня)'
                          : 'Тарифы с требованиями'}
                      </div>
                    )}
                    <div
                      className={`tariff-card ${locked ? 'tariff-card--locked' : ''}`}
                    >
                      <div className="tariff-card-head">
                        <span className="tariff-icon" aria-hidden>
                          {t.category === 'program' ? '💎' : '📈'}
                        </span>
                        <div>
                          <div className="tariff-title">{t.name}</div>
                          <div className="section-subtitle">
                            {`${(rateMin * 100).toFixed(2)}–${(rateMax * 100).toFixed(2)}%/d`} • {t.durationDays}d
                          </div>
                        </div>
                      </div>
                      <div className="tariff-tags">
                        <span className="badge">{t.category === 'program' ? 'Программа' : 'Тариф'}</span>
                        {t.access === 'open' ? (
                          <span className="badge badge-soft">Без уровня</span>
                        ) : (
                          <span className="badge">Lv ≥ {t.minLevel}</span>
                        )}
                        {t.reqSub && <span className="badge">Req: {t.reqSub}</span>}
                        <span className={`badge ${t.payoutMode === 'locked' ? 'badge-warm' : 'badge-cool'}`}>
                          {t.payoutMode === 'locked' ? 'Выплата в конце' : 'Ежедневно'}
                        </span>
                        {t.isLimited && (
                          <span className="badge badge-warn">Слотов: {left}</span>
                        )}
                      </div>
                      <div className="tariff-meta">
                        <div>
                          <span className="section-subtitle">Диапазон</span>
                          <strong>{fmtMoney(t.baseMin, currency)} – {fmtMoney(t.baseMax, currency)}</strong>
                        </div>
                        {t.entryFee > 0 && (
                          <div>
                            <span className="section-subtitle">Входной взнос</span>
                            <strong>{fmtMoney(t.entryFee, currency)}</strong>
                          </div>
                        )}
                        {t.entryFee > 0 && (
                          <div>
                            <span className="section-subtitle">Безубыточность</span>
                            <strong>
                              {breakeven && Number.isFinite(breakeven)
                                ? fmtMoney(breakeven, currency)
                                : '—'}
                            </strong>
                          </div>
                        )}
                        {recommended && (
                          <div>
                            <span className="section-subtitle">Рекомендовано</span>
                            <strong>{fmtMoney(recommended, currency)}</strong>
                          </div>
                        )}
                      </div>
                      {t.entryFee > 0 && insight && (
                        <div
                          className="section-subtitle"
                          style={{ color: premiumMet ? '#166534' : '#b45309' }}
                        >
                          Премия vs {competitorName}: {fmtPercent(premiumInfo, 1)} (цель {fmtPercent(premiumTarget, 1)}).
                          {entryFeeGap != null && (
                            <> Δвход: {entryFeeGap >= 0 ? '+' : ''}{fmtMoney(entryFeeGap, currency)}</>
                          )}
                        </div>
                      )}
                      {t.payoutMode === 'locked' && (
                        <div className="section-subtitle" style={{ color: '#b45309' }}>
                          Прибыль копится и будет выплачена одним траншем по завершении срока.
                        </div>
                      )}
                      <button
                        className="tariff-cta"
                        onClick={() => addTariff(t.id)}
                        disabled={(left !== null && left === 0) || locked}
                      >
                        <span>{locked ? 'Недоступно' : 'Добавить в портфель'}</span>
                        <span aria-hidden>{locked ? '🔒' : '➕'}</span>
                      </button>
                    </div>
                  </React.Fragment>
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
          programControls={programControls}
        />
      )}

      <footer style={{ textAlign: 'center', fontSize: 12, color: '#64748b', paddingBottom: 24 }}>
        v3.6 • минималистичный белый интерфейс • гибкий ROI-контроль бустеров • тайминги окупаемости и сохранение настроек
      </footer>
    </div>
  );
}

type PlannerStatsProps = {
  computed: ComputedState;
  currency: string;
};

function PlannerStats({ computed, currency }: PlannerStatsProps) {
  const { totals, boosterSummary, programSummary } = computed;
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
      label: 'Чистая прибыль с бустерами (до подписки)',
      value: fmtMoney(totals.investorNetBeforeSub, currency),
      hint: `${fmtMoney(totals.investorNetPerDayBeforeSub, currency)} в день`
    },
    {
      label: 'Чистая прибыль с бустерами',
      value: fmtMoney(totals.investorNet, currency),
      hint: `${fmtMoney(totals.investorNetPerDay, currency)} в день`
    },
    {
      label: 'Чистая прибыль (диапазон)',
      value: `${fmtMoney(totals.investorNetMin, currency)} – ${fmtMoney(totals.investorNetMax, currency)}`,
      hint: 'Минимальный и максимальный сценарии с учётом диапазона доходности'
    },
    {
      label: 'Поток в день (диапазон)',
      value: `${fmtMoney(totals.investorNetPerDayMin, currency)} – ${fmtMoney(totals.investorNetPerDayMax, currency)}`,
      hint: 'Коридор по дневным выплатам после подписки'
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
      label: 'Покрытие бустерами',
      value: fmtPercent(boosterSummary.coverageShare, 0),
      hint:
        boosterSummary.coverageShare > 0
          ? `Активные часы: ${boosterSummary.activeHours > 0 ? formatHours(boosterSummary.activeHours) : '—'}`
          : 'Бустеры не выбраны'
    },
    {
      label: 'Входные взносы программ',
      value: fmtMoney(totals.programFees, currency),
      hint:
        totals.programFees > 0
          ? `${fmtMoney(totals.programFeesPerDay, currency)} в день (учёт во взносах)`
          : 'Нет платных программ в портфеле'
    },
    {
      label: 'Платные программы',
      value: programSummary.count > 0 ? `${programSummary.count} шт.` : '—',
      hint:
        programSummary.count > 0
          ? `Средняя премия ${fmtPercent(programSummary.avgPremium, 1)} • ${
              programSummary.flagged > 0
                ? `${programSummary.flagged} требует корректировки`
                : 'выполнено'
            }`
          : 'Нет активных программ'
    },
    {
      label: 'Доход проекта',
      value: fmtMoney(totals.projectRevenue, currency),
      hint: `${fmtMoney(totals.projectRevenuePerDay, currency)} в день`
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
  rowData?: PortfolioRow;
  insight?: ProgramInsight;
};

// Преобразуем число в строку, чтобы поле ввода корректно поддерживало редактирование
function formatAmountInput(value: number) {
  return Number.isFinite(value) ? `${value}` : '';
}

// Убираем дубли пресетов (точность до центов), чтобы не плодить одинаковые кнопки
function dedupePresets(items: { label: string; value: number }[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.label}-${Math.round(item.value * 100)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return Number.isFinite(item.value);
  });
}

function TariffRow({
  item,
  currency,
  removeItem,
  updateAmount,
  userLevel,
  activeSubId,
  tariffs,
  boosters,
  accountBoosters,
  rowData,
  insight
}: TariffRowProps) {
  const t = tariffs.find((x) => x.id === item.tariffId)!;
  const [amountInput, setAmountInput] = useState<string>(() => formatAmountInput(item.amount));
  const levelOk = t.access === 'open' || withinLevel(userLevel, t.minLevel);
  const subOk = !t.reqSub || subMeets(t.reqSub, activeSubId);
  const warnLevel = !levelOk;
  const warnSub = !subOk;
  const recommended = insight?.recommendedPrincipal ?? t.recommendedPrincipal ?? null;
  const premiumInfo = insight?.premiumAtTarget ?? null;
  const premiumTarget = insight?.requiredPremium ?? null;
  const premiumMet = insight?.requirementMet ?? false;
  const competitorName = insight?.competitor?.name ?? 'базовым тарифам';
  const maxEntryFee = insight?.maxEntryFeeForTarget ?? null;
  const entryFeeGap = insight?.entryFeeGap ?? null;
  const payoutLabel =
    t.payoutMode === 'locked' ? 'Выплата в конце срока' : 'Начисления ежедневно';
  const payoutBadgeStyle =
    t.payoutMode === 'locked'
      ? { background: '#fef3c7', color: '#92400e' }
      : { background: '#dcfce7', color: '#166534' };
  const rateMin = tariffRateMin(t);
  const rateMax = tariffRateMax(t);
  const rateTarget = tariffRate(t);
  const rateLabel = `${(rateMin * 100).toFixed(2)}–${(rateMax * 100).toFixed(2)}%/d`;

  useEffect(() => {
    setAmountInput(formatAmountInput(item.amount));
  }, [item.amount]);

  const commitAmount = (raw: number) => {
    const bounded = clamp(raw, t.baseMin, t.baseMax);
    setAmountInput(formatAmountInput(bounded));
    updateAmount(item.id, bounded);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setAmountInput(value);

    if (value.trim() === '') {
      return;
    }

    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      updateAmount(item.id, parsed);
    }
  };

  const handleInputBlur = () => {
    if (amountInput.trim() === '') {
      setAmountInput(formatAmountInput(item.amount));
      return;
    }

    const parsed = Number(amountInput);
    if (!Number.isFinite(parsed)) {
      setAmountInput(formatAmountInput(item.amount));
      return;
    }

    commitAmount(parsed);
  };

  const presetCandidates: { label: string; value: number }[] = [
    { label: 'Мин', value: t.baseMin },
    { label: '50/50', value: (t.baseMin + t.baseMax) / 2 },
    { label: 'Макс', value: t.baseMax }
  ];

  if (recommended) {
    presetCandidates.splice(1, 0, { label: 'Реком.', value: recommended });
  }

  const presetButtons = dedupePresets(presetCandidates).map(({ label, value }) => ({
    label,
    value: clamp(value, t.baseMin, t.baseMax)
  }));

  return (
    <div className="card">
      <div className="flex-between">
        <div>
          <div style={{ fontWeight: 600 }}>{t.name}</div>
          <div className="flex">
            <span className="badge">{t.category === 'program' ? 'Программа' : 'Тариф'}</span>
            {t.access === 'open' ? (
              <span className="badge" style={{ background: '#dcfce7', color: '#166534' }}>
                Без ограничения уровня
              </span>
            ) : (
              <span className="badge">Lv ≥ {t.minLevel}</span>
            )}
            {t.reqSub && <span className="badge">Req: {t.reqSub}</span>}
            <span className="badge">{t.durationDays}d</span>
            <span className="badge">{rateLabel}</span>
            <span className="badge" style={{ background: '#e2e8f0', color: '#1f2937' }}>
              База {(rateTarget * 100).toFixed(2)}%/d
            </span>
            <span className="badge">
              {fmtMoney(t.baseMin, currency)} – {fmtMoney(t.baseMax, currency)}
            </span>
            <span className="badge" style={payoutBadgeStyle}>
              {payoutLabel}
            </span>
            {t.entryFee > 0 && (
              <span className="badge" style={{ background: '#fee2e2', color: '#b91c1c' }}>
                Вход {fmtMoney(t.entryFee, currency)}
              </span>
            )}
            {recommended && (
              <span className="badge" style={{ background: '#e0f2fe', color: '#0369a1' }}>
                Реком. {fmtMoney(recommended, currency)}
              </span>
            )}
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

      {t.category === 'program' && insight && (
        <div className="section-subtitle" style={{ color: premiumMet ? '#166534' : '#b45309' }}>
          {premiumMet ? '✅' : '⚠️'} Премия к {competitorName}:{' '}
          {fmtPercent(premiumInfo, 1)} (цель {fmtPercent(premiumTarget, 1)}).
          {maxEntryFee != null && entryFeeGap != null && (
            <>
              {' '}Макс. вход: {fmtMoney(maxEntryFee, currency)} ({entryFeeGap >= 0 ? '+' : ''}
              {fmtMoney(entryFeeGap, currency)} к текущему).
            </>
          )}
        </div>
      )}

      <label className="tariff-row__input">
        <div className="section-subtitle">Сумма инвестиций</div>
        <input
          type="number"
          value={amountInput}
          min={0}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          placeholder={fmtMoney(t.baseMin, currency)}
        />
        <span className="field-hint">
          Лимиты: {fmtMoney(t.baseMin, currency)} – {fmtMoney(t.baseMax, currency)}
        </span>
      </label>

      {presetButtons.length > 0 && (
        <div className="tariff-row__presets">
          {presetButtons.map((preset) => (
            <button
              key={`${preset.label}-${preset.value}`}
              type="button"
              className="chip tariff-row__preset"
              onClick={() => commitAmount(preset.value)}
            >
              {preset.label}
              <span className="muted">{fmtMoney(preset.value, currency)}</span>
            </button>
          ))}
        </div>
      )}

      {t.category === 'program' && (
        <div className="section-subtitle" style={{ color: '#0f172a' }}>
          Программа списывает единоразовый входной взнос при добавлении.{' '}
          {recommended
            ? `Рекомендуемый депозит: ${fmtMoney(recommended, currency)}.`
            : 'Задайте комфортную сумму, чтобы окупить взнос.'}
        </div>
      )}
      {t.payoutMode === 'locked' && (
        <div className="section-subtitle" style={{ color: '#b45309' }}>
          Начисления копятся в замороженном балансе и переходят в основной счет по окончании {t.durationDays}
          {' '}дн.
        </div>
      )}

      <RowPreview
        currency={currency}
        rowData={rowData}
        boosters={boosters}
        accountBoosters={accountBoosters}
        insight={insight}
      />
    </div>
  );
}

type RowPreviewProps = {
  currency: string;
  rowData?: PortfolioRow;
  boosters: Booster[];
  accountBoosters: string[];
  insight?: ProgramInsight;
};

type TariffEditorProps = {
  tariffs: Tariff[];
  setTariffs: (tariffs: Tariff[]) => void;
};

type BoosterEditorProps = {
  boosters: Booster[];
  setBoosters: (boosters: Booster[]) => void;
};

type PricingEditorProps = {
  pricing: PricingControls;
  setPricing: (controls: PricingControls) => void;
};

type ProgramDesignEditorProps = {
  controls: ProgramDesignControls;
  setControls: (controls: ProgramDesignControls) => void;
};

type TariffPickerProps = {
  categoryFilter: 'all' | 'plan' | 'program';
  setCategoryFilter: (value: 'all' | 'plan' | 'program') => void;
  payoutFilter: 'all' | 'stream' | 'locked';
  setPayoutFilter: (value: 'all' | 'stream' | 'locked') => void;
  search: string;
  setSearch: (value: string) => void;
  eligibleTariffs: Tariff[];
  totalFiltered: number;
  totalAll: number;
  currency: string;
  activeSub: Subscription;
  onAdd: (tariffId: string, amount?: number) => void;
  tariffSlotsUsed: Map<string, number>;
  insights: Record<string, ProgramInsight>;
};

function RowPreview({ currency, rowData, boosters, accountBoosters, insight }: RowPreviewProps) {
  const chosenAcc = accountBoosters
    .map((id) => boosters.find((b) => b.id === id))
    .filter(Boolean) as Booster[];
  const applicableIds = new Set((rowData?.applicable ?? []).map((b) => b.id));
  const blocked = chosenAcc.filter((b) => !applicableIds.has(b.id));

  if (!rowData) {
    return (
      <div
        style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: 12,
          fontSize: 13
        }}
      >
        <span className="section-subtitle">Расчёт обновляется…</span>
      </div>
    );
  }

  const netBeforeBoosters = rowData?.netNoBoost ?? 0;
  const netWithBoosters = rowData?.netAfter ?? netBeforeBoosters;
  const netFinal = rowData?.netFinal ?? netWithBoosters;
  const netFinalMin = rowData?.netFinalMin ?? netFinal;
  const netFinalMax = rowData?.netFinalMax ?? netFinal;
  const payoutMode = rowData?.t?.payoutMode ?? 'stream';
  const netPerDayAccrual = rowData?.netPerDayAfter ?? (rowData?.netNoBoostPerDay ?? 0);
  const netPerDayFinal = rowData?.netPerDayFinal ?? netPerDayAccrual;
  const netPerDayFinalMin = rowData?.netPerDayFinalMin ?? netPerDayFinal;
  const netPerDayFinalMax = rowData?.netPerDayFinalMax ?? netPerDayFinal;
  const lockedNet = rowData?.lockedNet ?? 0;
  const lockedNetPerDay = rowData?.lockedNetPerDay ?? 0;
  const boosterLift = rowData?.boosterLift ?? 0;
  const boosterLiftPerDay = rowData?.boosterLiftPerDay ?? 0;
  const programFee = rowData?.programFee ?? 0;
  const programFeePerDay = rowData?.programFeePerDay ?? 0;
  const breakevenAmount = rowData?.breakevenAmount ?? null;
  const recommendedPrincipal = rowData?.recommendedPrincipal ?? null;
  const premiumInfo = insight?.premiumAtTarget ?? null;
  const premiumTarget = insight?.requiredPremium ?? null;
  const premiumMet = insight?.requirementMet ?? false;
  const competitorName = insight?.competitor?.name ?? 'базовым тарифам';

  const boosterNotes = rowData?.notes?.length ? rowData.notes.join(' • ') : '—';
  const details = rowData?.boosterDetails ?? {};
  const rateMin = tariffRateMin(rowData.t);
  const rateMax = tariffRateMax(rowData.t);
  const rateTarget = tariffRate(rowData.t);

  const warns = rowData?.applicable?.map((b) => {
    const detail = details[b.id];
    const deposit = detail?.priceShare ?? b.price;
    const netGain = detail?.netGain ?? 0;
    const roiPct = deposit > 0 ? netGain / deposit : null;
    return {
      id: b.id,
      name: b.name,
      netGain,
      deposit,
      roiPct,
      paybackHours: detail?.paybackHours ?? null,
      coverage: detail?.coverage ?? 0,
      durationHours: b.durationHours
    };
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
          Эффективная ставка • заметки: {boosterNotes}
        </div>
        <div className="flex" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <span>
            Инвестору без бустеров: <strong>{fmtMoney(netBeforeBoosters, currency)}</strong>
          </span>
          <span>
            Диапазон %/день: <strong>{(rateMin * 100).toFixed(2)}–{(rateMax * 100).toFixed(2)}%</strong>
            {` (база ${(rateTarget * 100).toFixed(2)}%)`}
          </span>
          <span>
            Прирост от бустеров: <strong>{fmtMoney(boosterLift, currency)}</strong>
          </span>
          <span>
            Инвестору (после бустеров): <strong>{fmtMoney(netWithBoosters, currency)}</strong>
          </span>
          <span>
            Начисление в день (без подписки): <strong>{fmtMoney(netPerDayAccrual, currency)}</strong>
          </span>
          <span>
            Денежный поток в день (после подписки): <strong>{fmtMoney(netPerDayFinal, currency)}</strong>
          </span>
          <span>
            Финал с подпиской: <strong>{fmtMoney(netFinal, currency)}</strong>
          </span>
          <span>
            Финал (мин–макс):{' '}
            <strong>
              {fmtMoney(netFinalMin, currency)} – {fmtMoney(netFinalMax, currency)}
            </strong>
          </span>
          <span>
            Поток/день (мин–макс):{' '}
            <strong>
              {fmtMoney(netPerDayFinalMin, currency)} – {fmtMoney(netPerDayFinalMax, currency)}
            </strong>
          </span>
          <span>
            Прирост/день: <strong>{fmtMoney(boosterLiftPerDay, currency)}</strong>
          </span>
          {payoutMode === 'locked' && (
            <>
              <span style={{ color: '#b45309' }}>
                В заморозке в день: <strong>{fmtMoney(lockedNetPerDay, currency)}</strong>
              </span>
              <span style={{ color: '#b45309' }}>
                Выплата в конце срока: <strong>{fmtMoney(lockedNet, currency)}</strong>
              </span>
            </>
          )}
          {programFee > 0 && (
            <span>
              Вход программы: <strong>{fmtMoney(programFee, currency)}</strong>
            </span>
          )}
          {programFeePerDay > 0 && (
            <span>
              Амортизация входа: <strong>{fmtMoney(programFeePerDay, currency)}</strong>/день
            </span>
          )}
          {breakevenAmount != null && Number.isFinite(breakevenAmount) && (
            <span>
              Безубыточность ≥ <strong>{fmtMoney(breakevenAmount, currency)}</strong>
            </span>
          )}
          {recommendedPrincipal && (
            <span>
              Рекомендация: <strong>{fmtMoney(recommendedPrincipal, currency)}</strong>
            </span>
          )}
          {insight && (
            <span>
              Премия vs {competitorName}:{' '}
              <strong>
                {fmtPercent(premiumInfo, 1)} (цель {fmtPercent(premiumTarget, 1)} •{' '}
                {premiumMet ? 'выполнено' : 'нужно улучшить'})
              </strong>
            </span>
          )}
        </div>
      </div>

      {blocked.length > 0 && (
        <div style={{ color: '#fca5a5' }}>
          🚫 На этот тариф не действуют: {blocked.map((b) => b.name).join(', ')}
        </div>
      )}

      {warns && warns.length > 0 && (
        <div style={{ color: '#64748b', display: 'grid', gap: 4 }}>
          {warns.map((w) => (
            <div key={w.id}>
              {w.netGain < 0 ? (
                <span style={{ color: '#fbbf24' }}>
                  ⚠️ {w.name}: снижение ≈ {fmtMoney(w.netGain, currency)} при депозите {fmtMoney(
                    w.deposit,
                    currency
                  )}. Окупаемость ≈ {describePayback(w.paybackHours, w.durationHours)}.
                </span>
              ) : (
                <span>
                  ✅ {w.name}: бонус ≈ {fmtMoney(w.netGain, currency)}
                  {w.roiPct != null ? ` • ROI ${(w.roiPct * 100).toFixed(1)}%` : ''} при депозите {fmtMoney(
                    w.deposit,
                    currency
                  )} • покрытие {Math.round((w.coverage ?? 0) * 100)}% • окупаемость ≈ {describePayback(
                    w.paybackHours,
                    w.durationHours
                  )}.
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


function TariffPicker({
  categoryFilter,
  setCategoryFilter,
  payoutFilter,
  setPayoutFilter,
  search,
  setSearch,
  eligibleTariffs,
  totalFiltered,
  totalAll,
  currency,
  activeSub,
  onAdd,
  tariffSlotsUsed,
  insights
}: TariffPickerProps) {
  const [selectedId, setSelectedId] = useState<string>('');
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);

  useEffect(() => {
    if (selectedId && !eligibleTariffs.some((t) => t.id === selectedId)) {
      setSelectedId('');
    }
  }, [eligibleTariffs, selectedId]);

  const selectedTariff = useMemo(
    () => eligibleTariffs.find((t) => t.id === selectedId) ?? null,
    [eligibleTariffs, selectedId]
  );
  const selectedInsight = selectedTariff ? insights[selectedTariff.id] : undefined;
  const selectedSlotsUsed = selectedTariff ? tariffSlotsUsed.get(selectedTariff.id) || 0 : 0;
  const selectedSlotsLeft =
    selectedTariff && selectedTariff.isLimited && selectedTariff.capSlots != null
      ? Math.max(0, selectedTariff.capSlots - selectedSlotsUsed)
      : null;

  useEffect(() => {
    if (!selectedTariff) {
      setSelectedAmount(null);
      return;
    }
    const anchor =
      selectedInsight?.targetDeposit ??
      selectedInsight?.recommendedPrincipal ??
      selectedInsight?.breakevenAmount ??
      selectedTariff.recommendedPrincipal ??
      selectedTariff.baseMin;
    const seed = Number.isFinite(anchor) ? (anchor as number) : selectedTariff.baseMin;
    setSelectedAmount(clamp(seed, selectedTariff.baseMin, selectedTariff.baseMax));
  }, [selectedTariff, selectedInsight]);

  const sanitizedAmount = selectedTariff
    ? clamp(selectedAmount ?? selectedTariff.baseMin, selectedTariff.baseMin, selectedTariff.baseMax)
    : null;

  const filters = (
    <div className="tariff-picker__filters">
      <div className="tariff-picker__chips">
        <span className="section-subtitle">Категория</span>
        {(
          [
            ['all', 'Все'],
            ['plan', 'Тарифы'],
            ['program', 'Программы']
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`chip ${categoryFilter === value ? 'chip--active' : ''}`}
            onClick={() => setCategoryFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="tariff-picker__chips">
        <span className="section-subtitle">Выплаты</span>
        {(
          [
            ['all', 'Любые'],
            ['stream', 'Ежедневно'],
            ['locked', 'В конце']
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`chip ${payoutFilter === value ? 'chip--active' : ''}`}
            onClick={() => setPayoutFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="tariff-picker__search">
        <input
          type="search"
          value={search}
          placeholder="Поиск по названию или id"
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="section-subtitle">
          Найдено {eligibleTariffs.length} из {totalFiltered} (всего {totalAll})
        </span>
      </div>
    </div>
  );

  const handleAdd = () => {
    if (!selectedTariff) return;
    onAdd(selectedTariff.id, sanitizedAmount ?? undefined);
    setSelectedId('');
    setSelectedAmount(null);
  };

  const optionLabel = (tariff: Tariff) => {
    const range = `${(tariffRateMin(tariff) * 100).toFixed(2)}–${(tariffRateMax(tariff) * 100).toFixed(2)}%/д`;
    const payout = tariff.payoutMode === 'locked' ? 'в конце' : 'ежедневно';
    return `${tariff.name} • ${range} • ${tariff.durationDays}д • ${payout}`;
  };

  const addDisabled =
    !selectedTariff ||
    (selectedSlotsLeft != null ? selectedSlotsLeft === 0 : false) ||
    sanitizedAmount == null ||
    !Number.isFinite(sanitizedAmount) ||
    sanitizedAmount <= 0;

  return (
    <div className="tariff-picker">
      {filters}
      <div className="tariff-picker__selector">
        <label className="field">
          <span className="field-label">Тариф / программа</span>
          <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
            <option value="">Выберите тариф…</option>
            {eligibleTariffs.map((tariff) => (
              <option key={tariff.id} value={tariff.id}>
                {optionLabel(tariff)}
              </option>
            ))}
          </select>
        </label>
        {selectedTariff && (
          <label className="field" style={{ flex: '1 1 260px', minWidth: 220 }}>
            <span className="field-label">Депозит при добавлении</span>
            <input
              type="number"
              min={selectedTariff.baseMin}
              max={selectedTariff.baseMax}
              step={Math.max(1, Math.round(selectedTariff.baseMin / 10) || 1)}
              value={selectedAmount ?? ''}
              inputMode="decimal"
              onChange={(e) => {
                const value = e.target.value;
                setSelectedAmount(value === '' ? null : Number(value));
              }}
            />
            <span className="field-hint">
              Допустимо {fmtMoney(selectedTariff.baseMin, currency)} – {fmtMoney(selectedTariff.baseMax, currency)}
            </span>
          </label>
        )}
        <div className="tariff-picker__selector-actions">
          <button className="primary" type="button" onClick={handleAdd} disabled={addDisabled}>
            Добавить тариф
          </button>
          {selectedTariff && (
            <span className="section-subtitle">
              {selectedSlotsLeft != null
                ? `Свободно слотов: ${selectedSlotsLeft}`
                : `Мин. депозит ${fmtMoney(selectedTariff.baseMin, currency)}`}
            </span>
          )}
        </div>
        {eligibleTariffs.length === 0 && (
          <div className="tariff-picker__empty">
            <p>По выбранным фильтрам сейчас нет доступных тарифов.</p>
            <p className="section-subtitle">
              Попробуйте изменить категорию, выплату или увеличить уровень/подписку.
            </p>
          </div>
        )}
      </div>
      {selectedTariff ? (
        <TariffQuickPreview
          tariff={selectedTariff}
          currency={currency}
          slotsUsed={selectedSlotsUsed}
          activeSub={activeSub}
          amount={sanitizedAmount}
          insight={selectedInsight}
        />
      ) : eligibleTariffs.length > 0 ? (
        <p className="section-subtitle">
          Выберите тариф в списке, чтобы увидеть рекомендации по депозиту и премии.
        </p>
      ) : null}
    </div>
  );
}

type TariffQuickPreviewProps = {
  tariff: Tariff;
  currency: string;
  slotsUsed: number;
  activeSub: Subscription;
  amount: number | null;
  insight?: ProgramInsight;
};

function TariffQuickPreview({
  tariff,
  currency,
  slotsUsed,
  activeSub,
  amount,
  insight
}: TariffQuickPreviewProps) {
  const rateMin = tariffRateMin(tariff);
  const rateMax = tariffRateMax(tariff);
  const rateTarget = tariff.dailyRateTarget;
  const rateRange = `${(rateMin * 100).toFixed(2)}–${(rateMax * 100).toFixed(2)}%/д`;
  const left = tariff.isLimited && tariff.capSlots != null ? Math.max(0, tariff.capSlots - slotsUsed) : null;
  const recommended = insight?.recommendedPrincipal ?? tariff.recommendedPrincipal ?? null;
  const premiumRequirement = insight?.requiredPremium ?? null;
  const entryFee = tariff.entryFee ?? 0;
  const payoutLabel = tariff.payoutMode === 'locked' ? 'Начисление в конце срока' : 'Начисление ежедневно';
  const competitor = insight?.competitor ?? null;
  const deposit = clamp(amount ?? recommended ?? tariff.baseMin, tariff.baseMin, tariff.baseMax);
  const feeRate = activeSub.fee;
  const duration = tariff.durationDays;
  const grossTarget = deposit * rateTarget * duration;
  const grossMin = deposit * rateMin * duration;
  const grossMax = deposit * rateMax * duration;
  const netTarget = grossTarget * (1 - feeRate) - entryFee;
  const netMin = grossMin * (1 - feeRate) - entryFee;
  const netMax = grossMax * (1 - feeRate) - entryFee;
  const dailyFlowTarget = tariff.payoutMode === 'stream' ? deposit * rateTarget * (1 - feeRate) : 0;
  const paybackDays =
    entryFee > 0 && dailyFlowTarget > 0 ? Math.ceil(entryFee / dailyFlowTarget) : null;
  const premiumAtAmount =
    insight && deposit > 0 ? insight.baseReturn - insight.competitorReturn - entryFee / deposit : null;
  const premiumDisplay =
    premiumAtAmount != null
      ? fmtPercent(premiumAtAmount, 1)
      : insight?.premiumAtTarget != null
      ? fmtPercent(insight.premiumAtTarget, 1)
      : '—';
  const belowRecommendation = recommended != null && deposit < recommended;

  return (
    <div className="tariff-preview">
      <div className="tariff-preview__header">
        <div>
          <h3>{tariff.name}</h3>
          <span className="muted">ID: {tariff.id}</span>
        </div>
        <div className="tariff-preview__badges">
          <span className="badge badge-cool">{tariff.category === 'program' ? 'Программа' : 'Тариф'}</span>
          <span className="badge badge-soft">{payoutLabel}</span>
          {tariff.access === 'open' ? (
            <span className="badge">Доступно всем уровням</span>
          ) : (
            <span className="badge">Lv ≥ {tariff.minLevel}</span>
          )}
          {tariff.reqSub && <span className="badge">Подписка: {tariff.reqSub}</span>}
          {entryFee > 0 && <span className="badge badge-warm">Вход: {fmtMoney(entryFee, currency)}</span>}
          {left != null && (
            <span className={`badge ${left === 0 ? 'badge-warn' : 'badge-cool'}`}>
              Свободно: {left}
            </span>
          )}
        </div>
      </div>
      <div className="tariff-preview__grid">
        <div>
          <span className="field-label">Диапазон доходности</span>
          <strong>{rateRange}</strong>
          <span className="muted">Цель {(rateTarget * 100).toFixed(2)}%/д</span>
        </div>
        <div>
          <span className="field-label">Срок программы</span>
          <strong>{duration} дней</strong>
          <span className="muted">
            Депозит: {fmtMoney(tariff.baseMin, currency)} – {fmtMoney(tariff.baseMax, currency)}
          </span>
        </div>
        <div>
          <span className="field-label">Выбранный депозит</span>
          <strong>{fmtMoney(deposit, currency)}</strong>
          {belowRecommendation && <span className="muted warn">Меньше рекомендации</span>}
        </div>
        <div>
          <span className="field-label">Рекомендация</span>
          <strong>{recommended ? fmtMoney(recommended, currency) : '—'}</strong>
          {premiumRequirement != null && (
            <span className="muted">Нужна премия ≥ {fmtPercent(premiumRequirement, 1)}</span>
          )}
        </div>
        <div>
          <span className="field-label">Чистая выплата за цикл</span>
          <strong>{fmtMoney(netTarget, currency)}</strong>
          <span className="muted">Мин–макс: {fmtMoney(netMin, currency)} – {fmtMoney(netMax, currency)}</span>
        </div>
        <div>
          <span className="field-label">Поток в день</span>
          <strong>{fmtMoney(dailyFlowTarget, currency)}</strong>
          <span className="muted">
            {tariff.payoutMode === 'locked' ? 'Капает в замороженный баланс' : 'После комиссии подписки'}
          </span>
        </div>
        <div>
          <span className="field-label">Премия к бесплатным</span>
          <strong>{premiumDisplay}</strong>
          {competitor && <span className="muted">Сравнение с {competitor.name}</span>}
        </div>
        <div>
          <span className="field-label">Входной взнос</span>
          <strong>{entryFee > 0 ? fmtMoney(entryFee, currency) : 'Нет'}</strong>
          <span className="muted">
            Безубыточность {insight?.breakevenAmount ? fmtMoney(insight.breakevenAmount, currency) : '—'}
            {paybackDays != null ? ` • ≈ ${paybackDays} дн.` : ''}
          </span>
        </div>
      </div>
    </div>
  );
}

function PricingEditor({ pricing, setPricing }: PricingEditorProps) {
  const [draft, setDraft] = useState<PricingControls>(pricing);

  useEffect(() => {
    setDraft(pricing);
  }, [pricing]);

  const update = (field: keyof PricingControls, value: number) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const save = () => {
    const normalized: PricingControls = {
      baseCapturePct: clamp(draft.baseCapturePct, 0, 100),
      whaleCapturePct: clamp(draft.whaleCapturePct, 0, 100),
      investorRoiFloorPct: Math.max(0, draft.investorRoiFloorPct),
      minPrice: Math.max(0, draft.minPrice),
      maxPrice: Math.max(Math.max(0, draft.minPrice), draft.maxPrice)
    };
    setPricing(normalized);
  };

  const baseCaptureShare = clamp(draft.baseCapturePct / 100, 0, 1);
  const whaleCaptureShare = clamp(draft.whaleCapturePct / 100, 0, 1);
  const roiFloorShare = Math.max(0, draft.investorRoiFloorPct / 100);
  const sampleWin = 100; // условная чистая выгода до учёта цены бустера
  const baseCapSample = roiFloorShare > 0 ? sampleWin / (1 + roiFloorShare) : sampleWin;
  const baseSuggested = Math.min(baseCapSample, sampleWin * baseCaptureShare);
  const guaranteedBonus = baseSuggested * roiFloorShare;
  const whaleExtra = sampleWin; // воображаем, что крупный портфель удваивает прирост
  const whaleCapSample = roiFloorShare > 0 ? (sampleWin + whaleExtra) / (1 + roiFloorShare) : sampleWin + whaleExtra;
  const whaleSuggested = Math.min(
    baseSuggested + (whaleExtra / (1 + roiFloorShare)) * whaleCaptureShare,
    whaleCapSample
  );

  return (
    <div className="pricing-editor">
      <div className="pricing-editor__grid">
        <label className="field">
          <span className="field-label">Доля выгоды на малых портфелях (%)</span>
          <input
            type="number"
            min={0}
            max={100}
            value={draft.baseCapturePct}
            onChange={(e) => update('baseCapturePct', Number(e.target.value))}
          />
          <span className="field-hint">Забираемая часть прироста при депозите около минимума тарифа.</span>
        </label>
        <label className="field">
          <span className="field-label">Доля выгоды у «китов» (%)</span>
          <input
            type="number"
            min={0}
            max={100}
            value={draft.whaleCapturePct}
            onChange={(e) => update('whaleCapturePct', Number(e.target.value))}
          />
          <span className="field-hint">Дополнительная доля прироста, если портфель покрывает крупные депозиты.</span>
        </label>
        <label className="field">
          <span className="field-label">Гарантированный бонус инвестору (%)</span>
          <input
            type="number"
            min={0}
            value={draft.investorRoiFloorPct}
            onChange={(e) => update('investorRoiFloorPct', Number(e.target.value))}
          />
          <span className="field-hint">Минимальная доходность от покупки бустера относительно его цены.</span>
        </label>
        <label className="field">
          <span className="field-label">Минимальная цена бустера</span>
          <input
            type="number"
            min={0}
            value={draft.minPrice}
            onChange={(e) => update('minPrice', Number(e.target.value))}
          />
        </label>
        <label className="field">
          <span className="field-label">Максимальная цена бустера</span>
          <input
            type="number"
            min={0}
            value={draft.maxPrice}
            onChange={(e) => update('maxPrice', Number(e.target.value))}
          />
        </label>
      </div>

      <div className="pricing-editor__insight">
        <p>
          При приросте {fmtMoney(sampleWin, 'USD')} (условный пример) базовая цена не превысит{' '}
          {fmtMoney(baseSuggested, 'USD')}. Даже на минимальном депозите инвестор заберёт как минимум{' '}
          {fmtMoney(guaranteedBonus, 'USD')} ({fmtPercent(roiFloorShare, 0)}) поверх возврата стоимости бустера.
        </p>
        <p className="section-subtitle">
          Если портфель приносит больше, алгоритм добавит до {fmtMoney(whaleSuggested, 'USD')} за счёт доли «китовой»
          выгоды, но всё равно оставит инвестору тот же гарантированный процент.
        </p>
      </div>

      <div className="flex" style={{ justifyContent: 'flex-end', gap: 8 }}>
        <button className="ghost" onClick={() => setDraft(pricing)}>
          Сброс
        </button>
        <button className="primary" onClick={save}>
          Сохранить
        </button>
      </div>
    </div>
  );
}

function ProgramDesignEditor({ controls, setControls }: ProgramDesignEditorProps) {
  const [draft, setDraft] = useState<ProgramDesignControls>(controls);

  useEffect(() => {
    setDraft(controls);
  }, [controls]);

  const update = <K extends keyof ProgramDesignControls>(field: K, value: ProgramDesignControls[K]) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const save = () => {
    setControls({
      relativePremiumPct: Math.max(0, draft.relativePremiumPct),
      absolutePremiumPct: Math.max(0, draft.absolutePremiumPct),
      bufferMultiple: Math.max(1, draft.bufferMultiple)
    });
  };

  return (
    <div className="grid settings-panel">
      <label className="field">
        <span className="field-label">Относительная премия к бесплатным тарифам (%)</span>
        <input
          type="number"
          value={draft.relativePremiumPct}
          min={0}
          onChange={(e) => update('relativePremiumPct', Number(e.target.value))}
        />
      </label>
      <label className="field">
        <span className="field-label">Минимальная абсолютная премия за цикл (%)</span>
        <input
          type="number"
          value={draft.absolutePremiumPct}
          min={0}
          onChange={(e) => update('absolutePremiumPct', Number(e.target.value))}
        />
      </label>
      <label className="field">
        <span className="field-label">Множитель запаса по депозиту</span>
        <input
          type="number"
          value={draft.bufferMultiple}
          min={1}
          step={0.1}
          onChange={(e) => update('bufferMultiple', Number(e.target.value))}
        />
      </label>
      <div className="flex" style={{ justifyContent: 'flex-end', gap: 8 }}>
        <button className="ghost" onClick={() => setDraft(controls)}>
          Сброс
        </button>
        <button className="primary" onClick={save}>
          Сохранить
        </button>
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
              [field]:
                field === 'capSlots'
                  ? val === null
                    ? null
                    : Number(val)
                : field === 'recommendedPrincipal'
                ? val === null
                  ? null
                  : Number(val)
                : [
                    'durationDays',
                    'minLevel',
                    'baseMin',
                    'baseMax',
                    'entryFee',
                    'dailyRateMin',
                    'dailyRateMax',
                    'dailyRateTarget'
                  ].includes(field as string)
                ? Number(val)
                : val
            }
          : t
      )
    );
  };

  const add = () => {
    const id = uid('t');
    const base = createTariff({
      id,
      name: 'New tariff',
      durationDays: 7,
      rate: 0.005,
      minLevel: 1,
      baseMin: 50,
      baseMax: 3000,
      reqSub: null,
      isLimited: false,
      capSlots: null,
      category: 'plan',
      access: 'level',
      entryFee: 0,
      recommendedPrincipal: null,
      payoutMode: 'stream'
    });
    setDrafts((prev) => [...prev, base]);
  };

  const remove = (id: string) => {
    setDrafts((prev) => prev.filter((t) => t.id !== id));
  };

  const save = () => setTariffs(drafts.map(normalizeTariff));

  return (
    <div className="grid tariff-editor" style={{ gap: 12 }}>
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
              <th>Тип</th>
              <th>Доступ</th>
              <th>Дней</th>
              <th>%/день min</th>
              <th>%/день max</th>
              <th>%/день база</th>
              <th>Выплаты</th>
              <th>Мин Lv</th>
              <th>Мин</th>
              <th>Макс</th>
              <th>Входной взнос</th>
              <th>Реком. депозит</th>
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
                <td style={{ width: 120 }}>
                  <select value={t.category} onChange={(e) => update(t.id, 'category', e.target.value)}>
                    <option value="plan">Тариф</option>
                    <option value="program">Программа</option>
                  </select>
                </td>
                <td style={{ width: 140 }}>
                  <select value={t.access} onChange={(e) => update(t.id, 'access', e.target.value)}>
                    <option value="level">По уровню</option>
                    <option value="open">Открыто</option>
                  </select>
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
                    value={t.dailyRateMin}
                    onChange={(e) => update(t.id, 'dailyRateMin', Number(e.target.value))}
                  />
                </td>
                <td style={{ width: 100 }}>
                  <input
                    type="number"
                    step="0.0005"
                    value={t.dailyRateMax}
                    onChange={(e) => update(t.id, 'dailyRateMax', Number(e.target.value))}
                  />
                </td>
                <td style={{ width: 100 }}>
                  <input
                    type="number"
                    step="0.0005"
                    value={t.dailyRateTarget}
                    onChange={(e) => update(t.id, 'dailyRateTarget', Number(e.target.value))}
                  />
                </td>
                <td style={{ width: 140 }}>
                  <select value={t.payoutMode} onChange={(e) => update(t.id, 'payoutMode', e.target.value)}>
                    <option value="stream">Ежедневно</option>
                    <option value="locked">Заморозка до конца</option>
                  </select>
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
                <td style={{ width: 110 }}>
                  <input
                    type="number"
                    value={t.entryFee}
                    onChange={(e) => update(t.id, 'entryFee', Number(e.target.value))}
                  />
                </td>
                <td style={{ width: 120 }}>
                  <input
                    type="number"
                    value={t.recommendedPrincipal ?? ''}
                    placeholder="—"
                    onChange={(e) =>
                      update(
                        t.id,
                        'recommendedPrincipal',
                        e.target.value === '' ? null : Number(e.target.value)
                      )
                    }
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
    <div className="grid tariff-editor" style={{ gap: 12 }}>
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
  programControls: ProgramDesignControls;
};

type MmmModel = {
  timeline: { day: number; reserve: number; inflow: number; outflow: number; momentum: number }[];
  collapseDay: number | null;
  reserveAfterFees: number;
  startReserve: number;
  projectTake: number;
  netProjectTake: number;
  dailyOutflowFirst: number;
  totalTopUps: number;
  totalDeposits: number;
  newInvestorDeposits: number;
  reinvestDeposits: number;
  marketingSpend: number;
  newInvestorsTotal: number;
  avgDailyNewInvestors: number;
  avgMomentum: number;
  peakReserve: number;
  scenario: ScenarioProfile;
  truncated: boolean;
  abortReason: 'queue' | 'processing' | 'horizon' | null;
};

function SimulationPanel({
  segments,
  setSegments,
  tariffs,
  boosters,
  currency,
  pricing,
  programControls
}: SimulationPanelProps) {
  const [scenarioBias, setScenarioBias] = useState(55);
  const deferredScenarioBias = useDeferredValue(scenarioBias);
  const scenarioProfile = useMemo(
    () => blendScenario(deferredScenarioBias),
    [deferredScenarioBias]
  );
  const scenarioPresets = [
    { label: 'Кризис', value: 15 },
    { label: 'Базовый', value: 55 },
    { label: 'Рост', value: 85 }
  ];

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
        portfolio: [],
        rampDays: 7,
        dailyTopUpPerInvestor: 0
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
        userLevel: segment.userLevel,
        programControls,
        optimism: scenarioProfile.optimism
      });
      const depositPerInvestor = segment.portfolio.reduce((sum, item) => sum + item.amount, 0);
      return {
        segment,
        sub,
        dynBoosters,
        availableBoosters,
        chosenBoosterIds,
        computed,
        depositPerInvestor,
        planRows: computed.rows
      };
    });
  }, [segments, tariffs, boosters, pricing, programControls, scenarioProfile.optimism]);

  const deferredSegments = useDeferredValue(segmentSummaries);

  const totals = useMemo(() => {
    let investorsTotal = 0;
    let depositTotal = 0;
    let investorNetTotal = 0;
    let investorNetPerDayTotal = 0;
    let investorNetMinTotal = 0;
    let investorNetMaxTotal = 0;
    let investorNetPerDayMinTotal = 0;
    let investorNetPerDayMaxTotal = 0;
    let investorNetPerDayBeforeSubTotal = 0;
    let projectRevenueTotal = 0;
    let projectRevenuePerDayTotal = 0;
    let boosterEscrowTotal = 0;
    let subscriptionRevenueTotal = 0;
    let grossTotal = 0;
    let feeTotal = 0;
    let boosterLiftTotal = 0;
    let boosterLiftPerPlanDayTotal = 0;
    let boosterLiftPerActiveHourTotal = 0;
    let boosterActiveHoursTotal = 0;
    let boosterNetBeforeCostTotal = 0;
    let programFeeTotal = 0;
    let programFeePerDayTotal = 0;
    let lockedNetTotal = 0;
    let lockedNetPerDayTotal = 0;
    let unlockedNetTotal = 0;
    let unlockedNetPerDayTotal = 0;
    let topUpPerDayTotal = 0;

    deferredSegments.forEach(({ segment, computed, depositPerInvestor }) => {
      investorsTotal += segment.investors;
      depositTotal += depositPerInvestor * segment.investors;
      investorNetTotal += computed.totals.investorNet * segment.investors;
      investorNetPerDayTotal += computed.totals.investorNetPerDay * segment.investors;
      investorNetMinTotal += computed.totals.investorNetMin * segment.investors;
      investorNetMaxTotal += computed.totals.investorNetMax * segment.investors;
      investorNetPerDayMinTotal += computed.totals.investorNetPerDayMin * segment.investors;
      investorNetPerDayMaxTotal += computed.totals.investorNetPerDayMax * segment.investors;
      investorNetPerDayBeforeSubTotal += computed.totals.investorNetPerDayBeforeSub * segment.investors;
      projectRevenueTotal += computed.totals.projectRevenue * segment.investors;
      projectRevenuePerDayTotal += computed.totals.projectRevenuePerDay * segment.investors;
      boosterEscrowTotal += computed.totals.accountCost * segment.investors;
      subscriptionRevenueTotal += computed.totals.subCost * segment.investors;
      grossTotal += computed.totals.grossProfitTotal * segment.investors;
      feeTotal += computed.totals.feeTotal * segment.investors;
      const multiplier = segment.investors;
      boosterLiftTotal += computed.boosterSummary.liftNet * multiplier;
      boosterLiftPerPlanDayTotal += computed.boosterSummary.liftPerPlanDay * multiplier;
      boosterLiftPerActiveHourTotal += computed.boosterSummary.liftPerActiveHour * multiplier;
      boosterActiveHoursTotal += computed.boosterSummary.activeHours * multiplier;
      boosterNetBeforeCostTotal += computed.boosterSummary.netBeforeCost * multiplier;
      programFeeTotal += computed.totals.programFees * multiplier;
      programFeePerDayTotal += computed.totals.programFeesPerDay * multiplier;
      lockedNetTotal += computed.totals.lockedNetTotal * multiplier;
      lockedNetPerDayTotal += computed.totals.lockedNetPerDay * multiplier;
      unlockedNetTotal += computed.totals.unlockedNetTotal * multiplier;
      unlockedNetPerDayTotal += computed.totals.unlockedNetPerDay * multiplier;
      topUpPerDayTotal += segment.dailyTopUpPerInvestor * multiplier;
    });

    return {
      investorsTotal,
      depositTotal,
      investorNetTotal,
      investorNetPerDayTotal,
      investorNetMinTotal,
      investorNetMaxTotal,
      investorNetPerDayMinTotal,
      investorNetPerDayMaxTotal,
      investorNetPerDayBeforeSubTotal,
      projectRevenueTotal,
      projectRevenuePerDayTotal,
      boosterEscrowTotal,
      subscriptionRevenueTotal,
      grossTotal,
      feeTotal,
      boosterLiftTotal,
      boosterLiftPerPlanDayTotal,
      boosterLiftPerActiveHourTotal,
      boosterActiveHoursTotal,
      boosterNetBeforeCostTotal,
      programFeeTotal,
      programFeePerDayTotal,
      lockedNetTotal,
      lockedNetPerDayTotal,
      unlockedNetTotal,
      unlockedNetPerDayTotal,
      topUpPerDayTotal
    };
  }, [deferredSegments]);

  const boosterRoiTotal = totals.boosterEscrowTotal > 0 ? totals.boosterLiftTotal / totals.boosterEscrowTotal : 0;
  const netPerActiveHourBeforeCostTotal = totals.boosterActiveHoursTotal > 0
    ? totals.boosterNetBeforeCostTotal / totals.boosterActiveHoursTotal
    : 0;
  const boosterPaybackTotal = netPerActiveHourBeforeCostTotal > 0
    ? totals.boosterEscrowTotal / netPerActiveHourBeforeCostTotal
    : null;

  const mmmModel = useMemo<MmmModel | null>(() => {
    if (deferredSegments.length === 0) return null;

    type PlanInstance = {
      segmentId: string;
      daysRemaining: number;
      principal: number;
      dailyPayout: number;
      maturityPayout: number;
    };

    const planQueue: PlanInstance[] = [];
    const segmentStates = deferredSegments.map(({ segment, computed, depositPerInvestor, planRows }) => {
      const baseRamp = Math.max(1, segment.rampDays || 1);
      const rampDays = Math.max(1, Math.round(baseRamp * scenarioProfile.rampCompression));
      const investorsPerDay = rampDays > 0 ? segment.investors / rampDays : segment.investors;
      return {
        segment,
        computed,
        depositPerInvestor,
        planRows,
        rampDays,
        investorsPerDay,
        onboarded: 0,
        activeInvestors: 0
      };
    });

    const stateMap = new Map(segmentStates.map((state) => [state.segment.id, state]));

    const schedulePlans = (state: typeof segmentStates[number], investorEquivalent: number) => {
      if (!Number.isFinite(investorEquivalent) || investorEquivalent <= 0) return;
      state.planRows.forEach((row) => {
        planQueue.push({
          segmentId: state.segment.id,
          daysRemaining: row.t.durationDays,
          principal: row.amount * investorEquivalent,
          dailyPayout:
            row.t.payoutMode === 'locked' ? 0 : row.netPerDayFinal * investorEquivalent,
          maturityPayout:
            row.t.payoutMode === 'locked' ? row.netFinal * investorEquivalent : 0
        });
      });
    };

    const onboardInvestors = (state: typeof segmentStates[number], investorCount: number) => {
      if (!Number.isFinite(investorCount) || investorCount <= 0) return 0;
      schedulePlans(state, investorCount);
      return state.depositPerInvestor * investorCount;
    };

    let maxDuration = 0;
    let maxRamp = 0;
    deferredSegments.forEach(({ segment, planRows }) => {
      const rampDays = Math.max(1, Math.round((segment.rampDays || 1) * scenarioProfile.rampCompression));
      maxRamp = Math.max(maxRamp, rampDays);
      planRows.forEach((row) => {
        maxDuration = Math.max(maxDuration, row.t.durationDays);
      });
    });

    const horizon = Math.min(
      MMM_MAX_DAYS,
      Math.max(60, Math.round(maxDuration + maxRamp + 120))
    );
    const timeline: MmmModel['timeline'] = [
      { day: 0, reserve: 0, inflow: 0, outflow: 0, momentum: 0 }
    ];
    let reserve = 0;
    let momentumSum = 0;
    let peakReserve = 0;
    let collapseDay: number | null = null;
    let dailyOutflowFirst = 0;
    let totalDeposits = 0;
    let totalTopUps = 0;
    let projectTake = 0;
    let marketingSpend = 0;
    let newInvestorDeposits = 0;
    let reinvestDeposits = 0;
    let newInvestorsTotal = 0;

    let aborted = false;
    let abortReason: 'queue' | 'processing' | null = null;
    for (let day = 1; day <= horizon; day++) {
      const momentum = computeMomentum(day, horizon, scenarioProfile);
      const marketingScale = 1 + scenarioProfile.dailyAdBudgetGrowth * Math.log1p(day);
      const churnModifier = Math.max(0, 1 - scenarioProfile.retentionBoost * momentum);
      const churnRate = Math.max(0, scenarioProfile.churnProbability * churnModifier);
      momentumSum += momentum;

      let dayProjectTake = 0;
      let dayOutflow = 0;
      let maturityOutflow = 0;
      let dayInflow = 0;
      let dayMarketing = 0;
      let processedToday = 0;

      segmentStates.forEach((state) => {
        const remaining = Math.max(0, state.segment.investors - state.onboarded);
        let newInvestors = 0;

        if (remaining > 0) {
          if (day <= state.rampDays) {
            const base = state.investorsPerDay * scenarioProfile.acquisitionMultiplier;
            const planned = Math.max(
              state.investorsPerDay * scenarioProfile.acquisitionFloor,
              base * momentum
            );
            newInvestors = day === state.rampDays ? remaining : Math.min(remaining, planned);
          } else {
            const catchUp = Math.min(
              remaining,
              state.investorsPerDay * Math.max(momentum, scenarioProfile.acquisitionFloor)
            );
            if (catchUp > 0) newInvestors += catchUp;
          }
        }

        const expansionBase = Math.max(state.activeInvestors, state.onboarded);
        if (expansionBase > 0 && scenarioProfile.expansionRate > 0) {
          newInvestors += expansionBase * scenarioProfile.expansionRate * momentum;
        }

        if (newInvestors > 0) {
          state.onboarded += newInvestors;
          state.activeInvestors += newInvestors;
          newInvestorsTotal += newInvestors;
          const marketing =
            newInvestors * scenarioProfile.marketingCostPerInvestor * marketingScale;
          if (marketing > 0) {
            dayMarketing += marketing;
          }
          const deposit = onboardInvestors(state, newInvestors);
          if (deposit > 0) {
            dayInflow += deposit;
            totalDeposits += deposit;
            newInvestorDeposits += deposit;
          }
        }

        const effectiveInvestors = Math.max(0, state.activeInvestors);
        if (effectiveInvestors > 0) {
          const topUpMultiplier = Math.max(0, 1 + scenarioProfile.topUpGrowth * momentum);
          const topUp = state.segment.dailyTopUpPerInvestor * effectiveInvestors * topUpMultiplier;
          if (topUp > 0) {
            dayInflow += topUp;
            totalTopUps += topUp;
          }

          const revenue = state.computed.totals.projectRevenuePerDay * effectiveInvestors;
          if (revenue > 0) {
            dayProjectTake += revenue;
          }
        }

        if (state.activeInvestors > 0 && churnRate > 0) {
          const churned = state.activeInvestors * churnRate;
          if (churned > 0) {
            state.activeInvestors = Math.max(0, state.activeInvestors - churned);
            const loss = churned * state.segment.dailyTopUpPerInvestor;
            if (loss > 0) {
              dayProjectTake -= loss;
            }
          }
        }
      });

      if (planQueue.length > MMM_MAX_QUEUE) {
        aborted = true;
        if (!abortReason) abortReason = 'queue';
      }

      if (aborted) {
        collapseDay = day;
        const provisionalOutflow = dayProjectTake + dayMarketing;
        timeline.push({
          day,
          reserve,
          inflow: dayInflow,
          outflow: provisionalOutflow,
          momentum
        });
        break;
      }

      reserve += dayInflow;

      if (dayProjectTake > 0) {
        reserve -= dayProjectTake;
        projectTake += dayProjectTake;
      }

      if (dayMarketing > 0) {
        reserve -= dayMarketing;
        marketingSpend += dayMarketing;
      }

      for (let i = 0; i < planQueue.length; ) {
        const plan = planQueue[i];
        if (plan.daysRemaining > 0) {
          if (plan.dailyPayout > 0) {
            dayOutflow += plan.dailyPayout;
          }
          plan.daysRemaining -= 1;
          if (plan.daysRemaining === 0) {
            const maturedTotal = plan.principal + plan.maturityPayout;
            maturityOutflow += maturedTotal;
            if (scenarioProfile.reinvestShare > 0 && maturedTotal > 0) {
              const reinvestAmount = maturedTotal * scenarioProfile.reinvestShare * momentum;
              const ownerState = stateMap.get(plan.segmentId);
              if (ownerState && reinvestAmount > 0 && ownerState.depositPerInvestor > 0) {
                const investorEquivalent = reinvestAmount / ownerState.depositPerInvestor;
                if (investorEquivalent > 0) {
                  schedulePlans(ownerState, investorEquivalent);
                  dayInflow += reinvestAmount;
                  totalDeposits += reinvestAmount;
                  reinvestDeposits += reinvestAmount;
                }
              }
            }
            planQueue.splice(i, 1);
            continue;
          }
        }
        processedToday += 1;
        if (processedToday > MMM_MAX_DAILY_PROCESSED) {
          aborted = true;
          if (!abortReason) abortReason = 'processing';
          break;
        }
        i += 1;
      }

      if (aborted) {
        collapseDay = day;
        const partialOutflow =
          dayOutflow + maturityOutflow + dayProjectTake + dayMarketing;
        timeline.push({
          day,
          reserve,
          inflow: dayInflow,
          outflow: partialOutflow,
          momentum
        });
        break;
      }

      reserve -= dayOutflow;
      reserve -= maturityOutflow;

      const totalDayCost = dayOutflow + maturityOutflow + dayProjectTake + dayMarketing;
      if (day === 1) {
        dailyOutflowFirst = totalDayCost;
      }

      peakReserve = Math.max(peakReserve, reserve);

      timeline.push({
        day,
        reserve,
        inflow: dayInflow,
        outflow: totalDayCost,
        momentum
      });

      if (reserve <= 0) {
        collapseDay = day;
        break;
      }
    }

    peakReserve = Math.max(peakReserve, reserve);
    if (collapseDay === null && timeline[timeline.length - 1].day < horizon) {
      timeline.push({
        day: horizon,
        reserve,
        inflow: 0,
        outflow: 0,
        momentum: computeMomentum(horizon, horizon, scenarioProfile)
      });
    }

    const reserveAfterFees = Math.max(0, reserve);
    const daysSimulated = timeline[timeline.length - 1]?.day ?? horizon;
    const avgDailyNewInvestors = daysSimulated > 0 ? newInvestorsTotal / daysSimulated : 0;
    const avgMomentum = daysSimulated > 0 ? momentumSum / daysSimulated : 0;

    const truncated = aborted || horizon >= MMM_MAX_DAYS;
    const finalReason = abortReason ?? (horizon >= MMM_MAX_DAYS ? 'horizon' : null);

    return {
      timeline,
      collapseDay,
      reserveAfterFees,
      startReserve: newInvestorDeposits,
      projectTake,
      netProjectTake: Math.max(0, projectTake - marketingSpend),
      dailyOutflowFirst,
      totalTopUps,
      totalDeposits,
      newInvestorDeposits,
      reinvestDeposits,
      marketingSpend,
      newInvestorsTotal,
      avgDailyNewInvestors,
      avgMomentum,
      peakReserve,
      scenario: scenarioProfile,
      truncated,
      abortReason: finalReason
    };
  }, [deferredSegments, scenarioProfile]);

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

      <div className="scenario-strip">
        <div>
          <h3 className="section-title" style={{ marginBottom: 4 }}>Сценарий рынка</h3>
          <p className="section-subtitle" style={{ maxWidth: 520 }}>
            Потяните ползунок от кризисного сценария к агрессивному росту, чтобы учесть динамику рекламы, расширение географии и повторные депозиты.
          </p>
        </div>
        <div className="scenario-slider">
          <span role="img" aria-label="worst">
            😰
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={scenarioBias}
            onChange={(e) => setScenarioBias(Number(e.target.value))}
          />
          <span role="img" aria-label="best">
            🚀
          </span>
        </div>
        <div className="scenario-presets">
          {scenarioPresets.map((preset) => (
            <button
              key={preset.value}
              type="button"
              className={`chip ${scenarioBias === preset.value ? 'chip--active' : ''}`}
              onClick={() => setScenarioBias(preset.value)}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="scenario-meta">
          <div>
            <span className="section-subtitle">Текущий сценарий</span>
            <strong>{scenarioProfile.label}</strong>
          </div>
          <div>
            <span className="section-subtitle">Оптимизм</span>
            <strong>{Math.round(scenarioProfile.optimism * 100)}%</strong>
          </div>
          <div>
            <span className="section-subtitle">Маркетинг / инвестор</span>
            <strong>{fmtMoney(scenarioProfile.marketingCostPerInvestor, currency)}</strong>
          </div>
          <div>
            <span className="section-subtitle">Повторный депозит, % выплат</span>
            <strong>{Math.round(scenarioProfile.reinvestShare * 100)}%</strong>
          </div>
          <div>
            <span className="section-subtitle">Базовый приток</span>
            <strong>≥ {Math.round(scenarioProfile.acquisitionFloor * 100)}% плана</strong>
          </div>
          <div>
            <span className="section-subtitle">Сезонность спроса</span>
            <strong>{Math.round(scenarioProfile.seasonalityAmplitude * 100)}% ампл.</strong>
          </div>
          <div>
            <span className="section-subtitle">Ретеншн</span>
            <strong>
              {scenarioProfile.retentionBoost >= 0 ? '+' : ''}
              {Math.round(scenarioProfile.retentionBoost * 100)}%
            </strong>
          </div>
        </div>
      </div>

      <div className="sim-summary">
        <div className="sim-summary-card accent">
          <h4>Сценарий</h4>
          <p>{scenarioProfile.label}</p>
          <span className="muted">Оптимизм {Math.round(scenarioProfile.optimism * 100)}%</span>
        </div>
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
          <h4>Депозит по бустерам</h4>
          <p>{fmtMoney(totals.boosterEscrowTotal, currency)}</p>
          <span className="muted">сумма к возврату инвесторам</span>
        </div>
        <div className="sim-summary-card">
          <h4>Выручка от подписок</h4>
          <p>{fmtMoney(totals.subscriptionRevenueTotal, currency)}</p>
        </div>
        <div className="sim-summary-card">
          <h4>Входные взносы программ</h4>
          <p>{fmtMoney(totals.programFeeTotal, currency)}</p>
        </div>
        <div className="sim-summary-card">
          <h4>Выплаты в заморозке</h4>
          <p>{fmtMoney(totals.lockedNetTotal, currency)}</p>
        </div>
        <div className="sim-summary-card">
          <h4>Заморожено в день</h4>
          <p>{fmtMoney(totals.lockedNetPerDayTotal, currency)}</p>
        </div>
        <div className="sim-summary-card">
          <h4>Поток/день (доступно)</h4>
          <p>{fmtMoney(totals.unlockedNetPerDayTotal, currency)}</p>
        </div>
        <div className="sim-summary-card">
          <h4>Чистая прибыль (мин–макс)</h4>
          <p>
            {fmtMoney(totals.investorNetMinTotal, currency)} – {fmtMoney(totals.investorNetMaxTotal, currency)}
          </p>
          <span className="muted">с учётом диапазона доходности</span>
        </div>
        <div className="sim-summary-card">
          <h4>Поток/день (мин–макс)</h4>
          <p>
            {fmtMoney(totals.investorNetPerDayMinTotal, currency)} – {fmtMoney(totals.investorNetPerDayMaxTotal, currency)}
          </p>
        </div>
        <div className="sim-summary-card">
          <h4>Пополнения/день</h4>
          <p>{fmtMoney(totals.topUpPerDayTotal, currency)}</p>
        </div>
        <div className="sim-summary-card">
          <h4>Лифт от бустеров</h4>
          <p>{fmtMoney(totals.boosterLiftTotal, currency)}</p>
        </div>
        <div className="sim-summary-card">
          <h4>Лифт в день</h4>
          <p>{fmtMoney(totals.boosterLiftPerPlanDayTotal, currency)}</p>
        </div>
        <div className="sim-summary-card">
          <h4>Лифт / активный час</h4>
          <p>{fmtMoney(totals.boosterLiftPerActiveHourTotal, currency)}</p>
        </div>
        <div className="sim-summary-card">
          <h4>Активные часы</h4>
          <p>{totals.boosterActiveHoursTotal > 0 ? formatHours(totals.boosterActiveHoursTotal) : '—'}</p>
        </div>
        <div className="sim-summary-card">
          <h4>Бонус до цены</h4>
          <p>{fmtMoney(totals.boosterNetBeforeCostTotal, currency)}</p>
        </div>
        <div className="sim-summary-card">
          <h4>ROI бустеров</h4>
          <p>
            {totals.boosterEscrowTotal > 0
              ? `${(boosterRoiTotal * 100).toFixed(1)}%`
              : '—'}
          </p>
        </div>
        <div className="sim-summary-card">
          <h4>Окупаемость бустеров</h4>
          <p>
            {totals.boosterEscrowTotal > 0
              ? describePayback(boosterPaybackTotal, totals.boosterActiveHoursTotal)
              : '—'}
          </p>
        </div>
        <div className="sim-summary-card">
          <h4>Маркетинг (30d)</h4>
          <p>{mmmModel ? fmtMoney(mmmModel.marketingSpend, currency) : '—'}</p>
        </div>
        <div className="sim-summary-card">
          <h4>Повторные депозиты</h4>
          <p>{mmmModel ? fmtMoney(mmmModel.reinvestDeposits, currency) : '—'}</p>
        </div>
        <div className="sim-summary-card">
          <h4>Новые инвесторы/день</h4>
          <p>{mmmModel ? mmmModel.avgDailyNewInvestors.toFixed(1) : '—'}</p>
        </div>
        <div className="sim-summary-card">
          <h4>Средний импульс спроса</h4>
          <p>{mmmModel ? `${mmmModel.avgMomentum.toFixed(2)}×` : '—'}</p>
        </div>
        <div className="sim-summary-card">
          <h4>Доход проекта (после маркетинга)</h4>
          <p>{mmmModel ? fmtMoney(mmmModel.netProjectTake, currency) : '—'}</p>
        </div>
        <div className="sim-summary-card">
          <h4>MMM выживаемость</h4>
          <p>
            {mmmModel
              ? mmmModel.collapseDay != null
                ? `${mmmModel.collapseDay} дн.`
                : '30+ дн.'
              : '—'}
          </p>
          {mmmModel && mmmModel.truncated && (
            <span className="muted">Расчёт остановлен защитой модели</span>
          )}
        </div>
        <div className="sim-summary-card">
          <h4>Резерв после комиссий</h4>
          <p>{mmmModel ? fmtMoney(mmmModel.reserveAfterFees, currency) : '—'}</p>
        </div>
        <div className="sim-summary-card">
          <h4>Пиковый резерв</h4>
          <p>{mmmModel ? fmtMoney(mmmModel.peakReserve, currency) : '—'}</p>
        </div>
      </div>

      {mmmModel && mmmModel.timeline.length > 1 && (
        <MmmChart model={mmmModel} currency={currency} />
      )}

      <div className="grid" style={{ gap: 16 }}>
        {deferredSegments.map(({ segment, sub, availableBoosters, chosenBoosterIds, computed, depositPerInvestor }) => {
          const eligibleTariffs = [...tariffs]
            .filter((t) => tariffAccessible(t, segment.userLevel, segment.subscriptionId))
            .sort(sortTariffs);
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

              <div className="flex" style={{ gap: 12, flexWrap: 'wrap' }}>
                <label style={{ minWidth: 160 }}>
                  <div className="section-subtitle">Дней набора</div>
                  <input
                    type="number"
                    value={segment.rampDays}
                    min={1}
                    onChange={(e) => updateSegment(segment.id, 'rampDays', Math.max(1, Number(e.target.value)))}
                  />
                </label>
                <label style={{ minWidth: 200 }}>
                  <div className="section-subtitle">Пополнение / инвестор в день</div>
                  <input
                    type="number"
                    value={segment.dailyTopUpPerInvestor}
                    onChange={(e) =>
                      updateSegment(segment.id, 'dailyTopUpPerInvestor', Math.max(0, Number(e.target.value)))
                    }
                  />
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
                    {eligibleTariffs.map((t) => {
                      const rateLabel = `${(tariffRateMin(t) * 100).toFixed(2)}–${(tariffRateMax(t) * 100).toFixed(2)}%/d`;
                      return (
                        <option key={t.id} value={t.id}>
                          {t.category === 'program' ? '[Программа] ' : ''}
                          {t.name} — {rateLabel}
                        </option>
                      );
                    })}
                  </select>
                </div>
                {segment.portfolio.length === 0 && <span className="section-subtitle">Пока пусто.</span>}
                <div className="grid" style={{ gap: 12 }}>
                  {segment.portfolio.map((item) => {
                    const t = tariffs.find((x) => x.id === item.tariffId);
                    if (!t) return null;
                    const rateLabel = `${(tariffRateMin(t) * 100).toFixed(2)}–${(tariffRateMax(t) * 100).toFixed(2)}%/d`;
                    return (
                      <div key={item.id} className="card">
                        <div className="flex-between">
                          <div>
                            <div style={{ fontWeight: 600 }}>{t.name}</div>
                            <div className="section-subtitle">
                              {rateLabel} • {t.durationDays}d • {fmtMoney(t.baseMin, currency)}–{fmtMoney(t.baseMax, currency)}
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
                      <td>Пополнение / день</td>
                      <td>{fmtMoney(segment.dailyTopUpPerInvestor, currency)}</td>
                      <td>{fmtMoney(segment.dailyTopUpPerInvestor * segment.investors, currency)}</td>
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
                      <td>Депозит по бустерам</td>
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
                      <td>{fmtMoney(computed.boosterSummary.liftPerPlanDay, currency)}</td>
                      <td>{fmtMoney(computed.boosterSummary.liftPerPlanDay * segment.investors, currency)}</td>
                    </tr>
                    <tr>
                      <td>Лифт / активный час</td>
                      <td>{fmtMoney(computed.boosterSummary.liftPerActiveHour, currency)}</td>
                      <td>{fmtMoney(computed.boosterSummary.liftPerActiveHour * segment.investors, currency)}</td>
                    </tr>
                    <tr>
                      <td>Активные часы бустеров</td>
                      <td>
                        {computed.boosterSummary.activeHours > 0
                          ? formatHours(computed.boosterSummary.activeHours)
                          : '—'}
                      </td>
                      <td>
                        {computed.boosterSummary.activeHours > 0
                          ? formatHours(computed.boosterSummary.activeHours * segment.investors)
                          : '—'}
                      </td>
                    </tr>
                    <tr>
                      <td>Бонус до депозита</td>
                      <td>{fmtMoney(computed.boosterSummary.netBeforeCost, currency)}</td>
                      <td>{fmtMoney(computed.boosterSummary.netBeforeCost * segment.investors, currency)}</td>
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
                        {computed.boosterSummary.spend > 0
                          ? describePayback(
                              computed.boosterSummary.paybackHours,
                              computed.boosterSummary.activeHours
                            )
                          : '—'}
                      </td>
                      <td>
                        {computed.boosterSummary.spend > 0
                          ? describePayback(
                              computed.boosterSummary.paybackHours,
                              computed.boosterSummary.activeHours
                            )
                          : '—'}
                      </td>
                    </tr>
                    <tr>
                      <td>Входные взносы программ</td>
                      <td>{fmtMoney(computed.totals.programFees, currency)}</td>
                      <td>{fmtMoney(computed.totals.programFees * segment.investors, currency)}</td>
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
                      <td>Заморожено к выплате</td>
                      <td>{fmtMoney(computed.totals.lockedNetTotal, currency)}</td>
                      <td>{fmtMoney(computed.totals.lockedNetTotal * segment.investors, currency)}</td>
                    </tr>
                    <tr>
                      <td>Поток за срок</td>
                      <td>{fmtMoney(computed.totals.unlockedNetTotal, currency)}</td>
                      <td>{fmtMoney(computed.totals.unlockedNetTotal * segment.investors, currency)}</td>
                    </tr>
                    <tr>
                      <td>Поток/день (после подписки)</td>
                      <td>{fmtMoney(computed.totals.unlockedNetPerDay, currency)}</td>
                      <td>{fmtMoney(computed.totals.unlockedNetPerDay * segment.investors, currency)}</td>
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

type MmmChartProps = {
  model: MmmModel;
  currency: string;
};

function MmmChart({ model, currency }: MmmChartProps) {
  const {
    timeline,
    collapseDay,
    reserveAfterFees,
    startReserve,
    projectTake,
    netProjectTake,
    marketingSpend,
    reinvestDeposits,
    newInvestorDeposits,
    newInvestorsTotal,
    scenario,
    dailyOutflowFirst,
    totalTopUps,
    peakReserve,
    avgMomentum
  } = model;
  if (!timeline || timeline.length < 2) return null;

  const width = 640;
  const height = 200;
  const maxReserve = Math.max(
    reserveAfterFees,
    ...timeline.map((pt) => (Number.isFinite(pt.reserve) ? pt.reserve : 0))
  );
  const maxMomentum = Math.max(0.2, ...timeline.map((pt) => pt.momentum || 0));
  const lastDay = timeline[timeline.length - 1].day || 1;
  const points = timeline.map((pt, idx) => {
    const x = (idx / Math.max(1, timeline.length - 1)) * width;
    const value = Math.max(0, pt.reserve);
    const y = height - (maxReserve > 0 ? (value / maxReserve) * height : 0);
    return { x, y, reserve: pt.reserve, day: pt.day };
  });
  const path = points.map((pt, idx) => `${idx === 0 ? 'M' : 'L'}${pt.x},${pt.y}`).join(' ');
  const area = `${path} L${width},${height} L0,${height} Z`;
  const momentumPath = timeline
    .map((pt, idx) => {
      const x = (idx / Math.max(1, timeline.length - 1)) * width;
      const val = Math.max(0, pt.momentum || 0);
      const y = height - (maxMomentum > 0 ? (val / maxMomentum) * height : 0);
      return `${idx === 0 ? 'M' : 'L'}${x},${y}`;
    })
    .join(' ');
  const collapseLabel = collapseDay != null
    ? `Резерв иссякнет через ≈ ${collapseDay} дн.`
    : 'Резерва хватает на горизонте модели';
  const guardNote = model.truncated
    ? model.abortReason === 'queue'
      ? ' • расчёт остановлен: очередь выплат стала слишком большой'
      : model.abortReason === 'processing'
        ? ' • расчёт остановлен: ограничение на количество выплат в день'
        : ' • достигнут предел горизонта моделирования'
    : '';

  return (
    <div className="card" style={{ display: 'grid', gap: 16 }}>
      <div className="flex-between">
        <div>
          <h3 className="section-title">MMM прогноз выживаемости</h3>
          <p className="section-subtitle">
            Сценарий: {scenario.label} • оптимизм {Math.round(scenario.optimism * 100)}% • повторные вклады {Math.round(scenario.reinvestShare * 100)}%{guardNote}.
          </p>
        </div>
        <span className="section-subtitle">{collapseLabel}</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 220 }}>
        <path d={area} fill="rgba(37, 99, 235, 0.12)" />
        <path d={path} stroke="#2563eb" strokeWidth={3} fill="none" />
        {momentumPath && (
          <path
            d={momentumPath}
            stroke="#0ea5e9"
            strokeWidth={2}
            fill="none"
            strokeDasharray="8 6"
          />
        )}
        {collapseDay != null && (
          <line
            x1={(collapseDay / lastDay) * width}
            x2={(collapseDay / lastDay) * width}
            y1={0}
            y2={height}
            stroke="#f97316"
            strokeDasharray="6 4"
          />
        )}
      </svg>
      <div className="section-subtitle" style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <span style={{ color: '#2563eb' }}>— резерв</span>
        <span style={{ color: '#0ea5e9' }}>⋯ импульс спроса</span>
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <div className="sim-summary-card">
          <h4>Стартовый резерв</h4>
          <p>{fmtMoney(startReserve, currency)}</p>
        </div>
        <div className="sim-summary-card">
          <h4>После комиссий</h4>
          <p>{fmtMoney(reserveAfterFees, currency)}</p>
        </div>
        <div className="sim-summary-card">
          <h4>Комиссии проекта</h4>
          <p>{fmtMoney(projectTake, currency)}</p>
        </div>
        <div className="sim-summary-card">
          <h4>Чистый доход проекта</h4>
          <p>{fmtMoney(netProjectTake, currency)}</p>
        </div>
        <div className="sim-summary-card">
          <h4>Маркетинг</h4>
          <p>{fmtMoney(marketingSpend, currency)}</p>
        </div>
        <div className="sim-summary-card">
          <h4>Пополнения</h4>
          <p>{fmtMoney(totalTopUps, currency)}</p>
        </div>
        <div className="sim-summary-card">
          <h4>Новые депозиты</h4>
          <p>{fmtMoney(newInvestorDeposits, currency)}</p>
        </div>
        <div className="sim-summary-card">
          <h4>Повторные депозиты</h4>
          <p>{fmtMoney(reinvestDeposits, currency)}</p>
        </div>
        <div className="sim-summary-card">
          <h4>Платёж в 1-й день</h4>
          <p>{fmtMoney(dailyOutflowFirst, currency)}</p>
        </div>
        <div className="sim-summary-card">
          <h4>Горизонт модели</h4>
          <p>{lastDay} дн.</p>
        </div>
        <div className="sim-summary-card">
          <h4>Новых инвесторов</h4>
          <p>{newInvestorsTotal.toFixed(0)}</p>
        </div>
        <div className="sim-summary-card">
          <h4>Пиковый резерв</h4>
          <p>{fmtMoney(peakReserve, currency)}</p>
        </div>
        <div className="sim-summary-card">
          <h4>Импульс спроса</h4>
          <p>{`${avgMomentum.toFixed(2)}×`}</p>
        </div>
      </div>
    </div>
  );
}
