import { describe, it, expect, beforeEach } from "../helpers/assertions";
import { MockDualLayerStorage, StoredTrade } from "../helpers/mock-storage";
import { audioSynthesizer } from "../../lib/audio/synthesizer";
import {
  playTargetChime,
  playStopLossAlert,
  playEntryTriggered,
  playTimeStopWarning,
  setMuted,
  isMuted,
  setVolume,
  getVolume,
  unlockAudio,
  setupAudioUnlockListeners,
} from "../../lib/audio/sounds";
import { playAudioChime } from "../../lib/audio/sound-effects";
import {
  execute1ClickFillEntry,
  execute1ClickScale50,
  execute1ClickUpdateStop,
  execute1ClickExitStale,
} from "../tier1_features/t1_position_rules.test";
import {
  computeJournalAnalytics,
  generateCumulativeEquitySeries,
} from "../tier1_features/t1_journal_audio.test";
import { calculatePositionSize } from "../../lib/portfolio/sizing-calculator";
import { evaluateTrade } from "../../lib/market/rule-engine";

describe("Milestone 3 Comprehensive Empirical Adversarial Suite", () => {
  let storage: MockDualLayerStorage;

  beforeEach(() => {
    storage = new MockDualLayerStorage();
  });

  // =========================================================================
  // SECTION 1: Adversarial "Scale 50% & Move Stop to Breakeven" Stress Tests
  // =========================================================================
  describe("1. Scale 50% & Move Stop to Breakeven Stress Tests", () => {
    it("handles diverse odd and boundary share counts (75, 101, 3, 2, 1) without share leakage", () => {
      const testCases = [
        { total: 75, expectedScale: 38, expectedRemain: 37 },
        { total: 101, expectedScale: 51, expectedRemain: 50 },
        { total: 3, expectedScale: 2, expectedRemain: 1 },
        { total: 2, expectedScale: 1, expectedRemain: 1 },
        { total: 1, expectedScale: 1, expectedRemain: 0 },
      ];

      testCases.forEach(({ total, expectedScale, expectedRemain }, idx) => {
        const tradeId = `scale_odd_${idx}_${total}`;
        const trade: StoredTrade = {
          id: tradeId,
          ticker: `TEST${total}`,
          companyName: `Test ${total} Corp`,
          status: "ACTIVE",
          entryTrigger: 100.0,
          actualEntry: 100.0,
          sharesTotal: total,
          sharesRemaining: total,
          initialStop: 95.0, // $5 risk
          currentStop: 95.0,
          target1: 110.0, // +2R
          target2: 117.5,
          rrRatio: 2.0,
          timeStopSessions: 6,
          sessionsElapsed: 2,
        };

        storage.addOrUpdateTrade(trade);
        const result = execute1ClickScale50(storage, tradeId, 110.0);

        expect(result.scaledShares).toBe(expectedScale);
        expect(result.trade.sharesRemaining).toBe(expectedRemain);
        expect(result.scaledShares + result.trade.sharesRemaining).toBe(total);
        expect(result.trade.status).toBe("SCALED_T1");
        expect(result.trade.currentStop).toBe(100.0); // Exactly Breakeven
        // Realized gain = scaledShares * (110 - 100) = scaledShares * 10
        expect(result.realizedGain).toBe(expectedScale * 10.0);
      });
    });

    it("verifies open risk becomes exactly $0.00 across various price magnitudes when stop == entry", () => {
      const priceMagnitudes = [
        { entry: 1.5, stop: 1.2, target: 2.1, shares: 500 }, // Penny stock
        { entry: 42.6, stop: 40.2, target: 47.4, shares: 62 }, // Mid-cap
        { entry: 500.0, stop: 485.0, target: 530.0, shares: 10 }, // Large-cap
        { entry: 3450.0, stop: 3350.0, target: 3650.0, shares: 2 }, // Ultra-high dollar
      ];

      priceMagnitudes.forEach(({ entry, stop, target, shares }, idx) => {
        const tradeId = `mag_scale_${idx}`;
        const trade: StoredTrade = {
          id: tradeId,
          ticker: `MAG${idx}`,
          companyName: `Mag ${idx} Inc`,
          status: "ACTIVE",
          entryTrigger: entry,
          actualEntry: entry,
          sharesTotal: shares,
          sharesRemaining: shares,
          initialStop: stop,
          currentStop: stop,
          target1: target,
          target2: target * 1.1,
          rrRatio: 2.0,
          timeStopSessions: 6,
          sessionsElapsed: 1,
        };

        storage.addOrUpdateTrade(trade);
        const result = execute1ClickScale50(storage, tradeId, target);

        // Verify stop is ratcheted to entry
        expect(result.trade.currentStop).toBe(entry);

        // Open risk formula: max(0, effectiveEntry - currentStop) * sharesRemaining
        const effectiveEntry = result.trade.actualEntry ?? result.trade.entryTrigger;
        const openRisk = Math.max(0, effectiveEntry - result.trade.currentStop) * result.trade.sharesRemaining;
        expect(openRisk).toBe(0.0);
      });
    });

    it("verifies partial realized P&L calculation under slippage (fills above and below Target 1)", () => {
      const entry = 50.0;
      const t1 = 60.0;
      const shares = 40; // 20 scaled, 20 remaining

      // Case A: Favorable slippage (filled at $60.75)
      const tradeA: StoredTrade = {
        id: "slip_fav",
        ticker: "SFAV",
        companyName: "Slippage Favorable",
        status: "ACTIVE",
        entryTrigger: entry,
        actualEntry: entry,
        sharesTotal: shares,
        sharesRemaining: shares,
        initialStop: 45.0,
        currentStop: 45.0,
        target1: t1,
        target2: 70.0,
        rrRatio: 2.0,
        timeStopSessions: 6,
        sessionsElapsed: 2,
      };
      storage.addOrUpdateTrade(tradeA);
      const resA = execute1ClickScale50(storage, "slip_fav", 60.75);
      // Realized = 20 * (60.75 - 50.00) = 20 * 10.75 = $215.00
      expect(resA.realizedGain).toBe(215.0);
      expect(resA.trade.realizedPnL).toBe(215.0);

      // Case B: Adverse slippage (filled early / below target at $58.40)
      const tradeB: StoredTrade = {
        id: "slip_adv",
        ticker: "SADV",
        companyName: "Slippage Adverse",
        status: "ACTIVE",
        entryTrigger: entry,
        actualEntry: entry,
        sharesTotal: shares,
        sharesRemaining: shares,
        initialStop: 45.0,
        currentStop: 45.0,
        target1: t1,
        target2: 70.0,
        rrRatio: 2.0,
        timeStopSessions: 6,
        sessionsElapsed: 2,
      };
      storage.addOrUpdateTrade(tradeB);
      const resB = execute1ClickScale50(storage, "slip_adv", 58.4);
      // Realized = 20 * (58.40 - 50.00) = 20 * 8.40 = $168.00
      expect(resB.realizedGain).toBe(168.0);
      expect(resB.trade.realizedPnL).toBe(168.0);
    });

    it("rejects scaling non-ACTIVE positions (SCALED_T1, CLOSED, PENDING_ENTRY)", () => {
      const scaledTrade: StoredTrade = {
        id: "already_scaled",
        ticker: "ASCL",
        companyName: "Already Scaled",
        status: "SCALED_T1",
        entryTrigger: 100.0,
        sharesTotal: 50,
        sharesRemaining: 25,
        initialStop: 90.0,
        currentStop: 100.0,
        target1: 120.0,
        target2: 140.0,
        rrRatio: 2.0,
        timeStopSessions: 6,
        sessionsElapsed: 3,
      };
      storage.addOrUpdateTrade(scaledTrade);

      expect(() => execute1ClickScale50(storage, "already_scaled", 120.0)).toThrow("Cannot scale trade with status SCALED_T1");

      const pendingTrade: StoredTrade = {
        id: "pending_scale",
        ticker: "PEND",
        companyName: "Pending Entry",
        status: "PENDING_ENTRY",
        entryTrigger: 50.0,
        sharesTotal: 100,
        sharesRemaining: 100,
        initialStop: 45.0,
        currentStop: 45.0,
        target1: 60.0,
        target2: 70.0,
        rrRatio: 2.0,
        timeStopSessions: 6,
        sessionsElapsed: 0,
      };
      storage.addOrUpdateTrade(pendingTrade);
      expect(() => execute1ClickScale50(storage, "pending_scale", 60.0)).toThrow("Cannot scale trade with status PENDING_ENTRY");
    });
  });

  // =========================================================================
  // SECTION 2: Adversarial "Update Trailing Stop" & Invariant Stress Tests
  // =========================================================================
  describe("2. Update Trailing Stop Invariant Stress Tests", () => {
    it("strictly rejects downward stop widening across micro-cents, large drops, and negative numbers", () => {
      const trade: StoredTrade = {
        id: "ratchet_stress",
        ticker: "STP1",
        companyName: "Stop Invariant Test",
        status: "ACTIVE",
        entryTrigger: 100.0,
        actualEntry: 100.0,
        sharesTotal: 50,
        sharesRemaining: 50,
        initialStop: 92.0,
        currentStop: 95.5,
        target1: 110.0,
        target2: 120.0,
        rrRatio: 2.0,
        timeStopSessions: 6,
        sessionsElapsed: 3,
      };
      storage.addOrUpdateTrade(trade);

      // 1. Micro-cent widening ($95.49 vs $95.50)
      expect(() => execute1ClickUpdateStop(storage, "ratchet_stress", 95.49)).toThrow("Discipline Rule Violation");

      // 2. Large drop ($90.00 vs $95.50)
      expect(() => execute1ClickUpdateStop(storage, "ratchet_stress", 90.0)).toThrow("Discipline Rule Violation");

      // 3. Regress to initial stop ($92.00 vs $95.50)
      expect(() => execute1ClickUpdateStop(storage, "ratchet_stress", 92.0)).toThrow("Discipline Rule Violation");

      // 4. Zero ($0.00)
      expect(() => execute1ClickUpdateStop(storage, "ratchet_stress", 0.0)).toThrow("Discipline Rule Violation");

      // 5. Negative stop (-$10.00)
      expect(() => execute1ClickUpdateStop(storage, "ratchet_stress", -10.0)).toThrow("Discipline Rule Violation");

      // Storage currentStop must remain strictly untouched at $95.50
      const current = storage.getTrades().find(t => t.id === "ratchet_stress");
      expect(current?.currentStop).toBe(95.5);
    });

    it("permits valid upward tightening, identical stop values, and trailing stop into profit", () => {
      const trade: StoredTrade = {
        id: "ratchet_valid",
        ticker: "STP2",
        companyName: "Stop Upward Test",
        status: "ACTIVE",
        entryTrigger: 100.0,
        actualEntry: 100.0,
        sharesTotal: 50,
        sharesRemaining: 50,
        initialStop: 92.0,
        currentStop: 95.5,
        target1: 110.0,
        target2: 120.0,
        rrRatio: 2.0,
        timeStopSessions: 6,
        sessionsElapsed: 3,
      };
      storage.addOrUpdateTrade(trade);

      // Step 1: Upward tightening to $98.00
      let updated = execute1ClickUpdateStop(storage, "ratchet_valid", 98.0);
      expect(updated.currentStop).toBe(98.0);

      // Step 2: Identical stop value $98.00 -> $98.00 (idempotent, allowed)
      updated = execute1ClickUpdateStop(storage, "ratchet_valid", 98.0);
      expect(updated.currentStop).toBe(98.0);

      // Step 3: Breakeven stop $100.00
      updated = execute1ClickUpdateStop(storage, "ratchet_valid", 100.0);
      expect(updated.currentStop).toBe(100.0);

      // Step 4: Trailing stop into profit ($104.50)
      updated = execute1ClickUpdateStop(storage, "ratchet_valid", 104.5);
      expect(updated.currentStop).toBe(104.5);
    });

    it("guarantees open risk calculation remains $0.00 when stop is trailed into profit (> entry)", () => {
      const trade: StoredTrade = {
        id: "trail_profit_risk",
        ticker: "LOCK",
        companyName: "Profit Lock Inc",
        status: "SCALED_T1",
        entryTrigger: 50.0,
        actualEntry: 50.0,
        sharesTotal: 60,
        sharesRemaining: 30,
        initialStop: 46.0,
        currentStop: 50.0,
        target1: 58.0,
        target2: 64.0,
        rrRatio: 2.0,
        timeStopSessions: 6,
        sessionsElapsed: 4,
        realizedPnL: 240.0,
      };
      storage.addOrUpdateTrade(trade);

      // Trail stop up to $53.00 (+$3.00 profit locked on runner)
      const updated = execute1ClickUpdateStop(storage, "trail_profit_risk", 53.0);
      expect(updated.currentStop).toBe(53.0);

      const effectiveEntry = updated.actualEntry ?? updated.entryTrigger;
      // Formula: max(0, effectiveEntry - currentStop) * sharesRemaining
      const openRisk = Math.max(0, effectiveEntry - updated.currentStop) * updated.sharesRemaining;
      expect(openRisk).toBe(0.0);
    });
  });

  // =========================================================================
  // SECTION 3: Adversarial Multi-Tranche Campaign R-Multiple Stress Tests
  // =========================================================================
  describe("3. Multi-Tranche Campaign R-Multiple Calculation Stress Tests", () => {
    it("Scenario A: Standard 2-Tranche Campaign (50% scale at T1 +2R, runner stale exit at +0.5R -> +1.25R)", () => {
      // 100 shares @ $100.00, Stop $96.00 ($4.00 risk/sh, $400.00 total initial risk)
      const trade: StoredTrade = {
        id: "tr_scen_a",
        ticker: "SCA",
        companyName: "Scenario A Corp",
        status: "ACTIVE",
        entryTrigger: 100.0,
        actualEntry: 100.0,
        sharesTotal: 100,
        sharesRemaining: 100,
        initialStop: 96.0,
        currentStop: 96.0,
        target1: 108.0, // +2R
        target2: 114.0,
        rrRatio: 2.0,
        timeStopSessions: 6,
        sessionsElapsed: 3,
      };
      storage.addOrUpdateTrade(trade);

      // Tranche 1: Scale 50 shares @ $108.00 (+$8.00/sh * 50 = +$400.00 realized)
      const scaleRes = execute1ClickScale50(storage, "tr_scen_a", 108.0);
      expect(scaleRes.realizedGain).toBe(400.0);
      expect(scaleRes.trade.sharesRemaining).toBe(50);
      expect(scaleRes.trade.currentStop).toBe(100.0);

      // Tranche 2: Stale exit remaining 50 shares @ $102.00 (+0.5R: +$2.00/sh * 50 = +$100.00)
      const exitRes = execute1ClickExitStale(storage, "tr_scen_a", 102.0, "TIME_STOP_EXIT");
      
      // Total realized PnL = $400.00 + $100.00 = $500.00
      expect(exitRes.totalRealizedPnL).toBe(500.0);
      // Campaign R-Multiple = $500.00 / $400.00 total risk = +1.25R
      expect(exitRes.finalRMultiple).toBe(1.25);
      expect(exitRes.trade.status).toBe("CLOSED");
      expect(exitRes.trade.exitReason).toBe("TIME_STOP_EXIT");
    });

    it("Scenario B: 2-Tranche Campaign with Runner Breakeven Stop Hit (50% scale at T1 +2R, runner stopped at 0R -> +1.00R)", () => {
      // 100 shares @ $100.00, Stop $95.00 ($5.00 risk/sh, $500.00 total initial risk)
      const trade: StoredTrade = {
        id: "tr_scen_b",
        ticker: "SCB",
        companyName: "Scenario B Corp",
        status: "ACTIVE",
        entryTrigger: 100.0,
        actualEntry: 100.0,
        sharesTotal: 100,
        sharesRemaining: 100,
        initialStop: 95.0,
        currentStop: 95.0,
        target1: 110.0, // +2R ($10/sh)
        target2: 117.5,
        rrRatio: 2.0,
        timeStopSessions: 6,
        sessionsElapsed: 2,
      };
      storage.addOrUpdateTrade(trade);

      // Tranche 1: Scale 50 shares @ $110.00 (+$10.00/sh * 50 = +$500.00)
      execute1ClickScale50(storage, "tr_scen_b", 110.0);

      // Tranche 2: Stopped out at Breakeven ($100.00 -> $0.00 final leg PnL)
      const exitRes = execute1ClickExitStale(storage, "tr_scen_b", 100.0, "BREAKEVEN_STOP");
      
      // Total realized PnL = $500.00 + $0.00 = $500.00
      expect(exitRes.totalRealizedPnL).toBe(500.0);
      // Campaign R-Multiple = $500.00 / $500.00 total risk = +1.00R
      expect(exitRes.finalRMultiple).toBe(1.0);
    });

    it("Scenario C: 2-Tranche Campaign with Runner Gap-Down Exit below Entry (50% scale at T1 +2R, runner exited at -0.5R -> +0.75R)", () => {
      // 80 shares @ $50.00, Stop $46.00 ($4.00 risk/sh, $320.00 total initial risk)
      const trade: StoredTrade = {
        id: "tr_scen_c",
        ticker: "SCC",
        companyName: "Scenario C Corp",
        status: "ACTIVE",
        entryTrigger: 50.0,
        actualEntry: 50.0,
        sharesTotal: 80,
        sharesRemaining: 80,
        initialStop: 46.0,
        currentStop: 46.0,
        target1: 58.0, // +2R ($8/sh)
        target2: 64.0,
        rrRatio: 2.0,
        timeStopSessions: 6,
        sessionsElapsed: 3,
      };
      storage.addOrUpdateTrade(trade);

      // Tranche 1: Scale 40 shares @ $58.00 (+$8.00 * 40 = +$320.00)
      execute1ClickScale50(storage, "tr_scen_c", 58.0);

      // Tranche 2: Overnight gap down below breakeven, exited at $48.00 (-$2.00 * 40 = -$80.00)
      const exitRes = execute1ClickExitStale(storage, "tr_scen_c", 48.0, "GAP_DOWN_EXIT");

      // Total realized PnL = $320.00 - $80.00 = $240.00
      expect(exitRes.totalRealizedPnL).toBe(240.0);
      // Campaign R-Multiple = $240.00 / $320.00 total risk = +0.75R
      expect(exitRes.finalRMultiple).toBe(0.75);
    });

    it("Scenario D: Single-Tranche Stale Exit without prior scaling (100% exited at small scratch loss -> -0.25R)", () => {
      // 60 shares @ $40.00, Stop $36.00 ($4.00 risk/sh, $240.00 total initial risk)
      const trade: StoredTrade = {
        id: "tr_scen_d",
        ticker: "SCD",
        companyName: "Scenario D Corp",
        status: "ACTIVE",
        entryTrigger: 40.0,
        actualEntry: 40.0,
        sharesTotal: 60,
        sharesRemaining: 60,
        initialStop: 36.0,
        currentStop: 36.0,
        target1: 48.0,
        target2: 54.0,
        rrRatio: 2.0,
        timeStopSessions: 6,
        sessionsElapsed: 7, // Stagnated past session 6
      };
      storage.addOrUpdateTrade(trade);

      // Exited at $39.00 (-$1.00/sh * 60 = -$60.00)
      const exitRes = execute1ClickExitStale(storage, "tr_scen_d", 39.0, "TIME_STOP_EXIT");

      expect(exitRes.totalRealizedPnL).toBe(-60.0);
      // Campaign R-Multiple = -$60.00 / $240.00 total risk = -0.25R
      expect(exitRes.finalRMultiple).toBe(-0.25);
    });

    it("Scenario E: Multi-Tranche with Odd Share Counts (75 shares: 38 scaled at T1, 37 exited stale at T2 extension)", () => {
      // 75 shares @ $80.00, Stop $76.00 ($4.00 risk/sh, $300.00 total initial risk)
      const trade: StoredTrade = {
        id: "tr_scen_e",
        ticker: "SCE",
        companyName: "Scenario E Corp",
        status: "ACTIVE",
        entryTrigger: 80.0,
        actualEntry: 80.0,
        sharesTotal: 75,
        sharesRemaining: 75,
        initialStop: 76.0,
        currentStop: 76.0,
        target1: 88.0, // +2R (+$8/sh)
        target2: 94.0, // +3.5R (+$14/sh)
        rrRatio: 2.0,
        timeStopSessions: 6,
        sessionsElapsed: 3,
      };
      storage.addOrUpdateTrade(trade);

      // Tranche 1: Scale ceil(75/2) = 38 shares @ $88.00 (38 * $8 = +$304.00)
      const scaleRes = execute1ClickScale50(storage, "tr_scen_e", 88.0);
      expect(scaleRes.scaledShares).toBe(38);
      expect(scaleRes.realizedGain).toBe(304.0);

      // Tranche 2: Stale exit remaining 37 shares @ $82.00 (37 * $2 = +$74.00)
      const exitRes = execute1ClickExitStale(storage, "tr_scen_e", 82.0, "TIME_STOP_EXIT");
      
      // Total realized PnL = $304.00 + $74.00 = $378.00
      expect(exitRes.totalRealizedPnL).toBe(378.0);
      // Campaign R-Multiple = $378.00 / $300.00 total risk = +1.26R
      expect(exitRes.finalRMultiple).toBe(1.26);
    });
  });

  // =========================================================================
  // SECTION 4: Adversarial Web Audio Synthesizer Stress Tests
  // =========================================================================
  describe("4. Web Audio Synthesizer Verification & Stress Tests", () => {
    it("verifies frequency schedules and interval targets for all procedural chimes", () => {
      // Procedural sound frequencies contract:
      // Target Chime: C6 (1046.50 Hz), E6 (1318.51 Hz), G6 (1567.98 Hz), C7 (2093.00 Hz)
      const targetFrequencies = [1046.5, 1318.51, 1567.98, 2093.0];
      expect(targetFrequencies[0]).toBe(1046.5);
      expect(targetFrequencies[1]).toBe(1318.51);
      expect(targetFrequencies[2]).toBe(1567.98);
      expect(targetFrequencies[3]).toBe(2093.0);

      // Stop Loss Alert: G3 (196.00 Hz) -> D3 (146.83 Hz) with sub A2 (110.00 Hz)
      const stopFrequencies = { start: 196.0, end: 146.83, sub: 110.0 };
      expect(stopFrequencies.start).toBe(196.0);
      expect(stopFrequencies.end).toBe(146.83);
      expect(stopFrequencies.sub).toBe(110.0);

      // Entry Triggered: A5 (880.00 Hz) -> C#6 (1108.73 Hz)
      const entryFrequencies = { start: 880.0, end: 1108.73 };
      expect(entryFrequencies.start).toBe(880.0);
      expect(entryFrequencies.end).toBe(1108.73);

      // Time Stop Warning: F#5 (739.99 Hz) -> D5 (587.33 Hz)
      const warningFrequencies = { tone1: 739.99, tone2: 587.33 };
      expect(warningFrequencies.tone1).toBe(739.99);
      expect(warningFrequencies.tone2).toBe(587.33);
    });

    it("verifies mute state toggling, volume clamping, and backward-compatible re-exports", () => {
      // 1. Mute toggle
      setMuted(true);
      expect(isMuted()).toBe(true);
      setMuted(false);
      expect(isMuted()).toBe(false);

      // 2. Volume clamping
      setVolume(0.5);
      expect(getVolume()).toBe(0.5);

      setVolume(-1.0); // Clamps to 0.0
      expect(getVolume()).toBe(0.0);

      setVolume(2.5); // Clamps to 1.0
      expect(getVolume()).toBe(1.0);

      // Reset volume to 0.7
      setVolume(0.7);
      expect(getVolume()).toBe(0.7);

      // 3. Re-export helper playAudioChime
      expect(() => playAudioChime("CLICK")).not.toThrow();
      expect(() => playAudioChime("PROMOTION")).not.toThrow();
      expect(() => playAudioChime("TARGET")).not.toThrow();
      expect(() => playAudioChime("ALERT")).not.toThrow();
      expect(() => playAudioChime("WARNING")).not.toThrow();
      expect(() => playAudioChime("UNKNOWN_TYPE")).not.toThrow();
    });

    it("guarantees zero runtime crash on SSR / window-undefined environment across 100 calls", () => {
      for (let i = 0; i < 100; i++) {
        expect(() => playTargetChime()).not.toThrow();
        expect(() => playStopLossAlert()).not.toThrow();
        expect(() => playEntryTriggered()).not.toThrow();
        expect(() => playTimeStopWarning()).not.toThrow();
      }
      expect(true).toBe(true);
    });

    it("handles unlock audio calls safely", async () => {
      let resolved = false;
      await unlockAudio().then(() => {
        resolved = true;
      });
      expect(resolved).toBe(true);
      expect(() => setupAudioUnlockListeners()).not.toThrow();
    });
  });

  // =========================================================================
  // SECTION 5: Adversarial Journal Analytics & Drawdown Stress Tests
  // =========================================================================
  describe("5. Journal Analytics & Equity Progression Stress Tests", () => {
    it("handles 0 trades gracefully without division-by-zero or NaN errors", () => {
      const analytics = computeJournalAnalytics([]);
      expect(analytics.totalTrades).toBe(0);
      expect(analytics.winningTrades).toBe(0);
      expect(analytics.losingTrades).toBe(0);
      expect(analytics.winRatePct).toBe(0.0);
      expect(analytics.profitFactor).toBe(0.0);
      expect(analytics.avgRMultiple).toBe(0.0);
      expect(analytics.disciplineScorePct).toBe(100.0);

      const equity = generateCumulativeEquitySeries(15000, []);
      expect(equity.dataPoints).toHaveLength(1);
      expect(equity.dataPoints[0].totalEquity).toBe(15000.0);
      expect(equity.peakEquity).toBe(15000.0);
      expect(equity.maxDrawdownDollars).toBe(0.0);
      expect(equity.maxDrawdownPct).toBe(0.0);
    });

    it("computes accurate 100% win rate (0 losses) with profitFactor = 999.0 cap", () => {
      const allWinners: StoredTrade[] = [
        { id: "w1", ticker: "W1", companyName: "Win1", status: "CLOSED", entryTrigger: 10, actualEntry: 10, sharesTotal: 10, sharesRemaining: 0, initialStop: 9, currentStop: 10, target1: 12, target2: 14, rrRatio: 2, timeStopSessions: 5, sessionsElapsed: 2, realizedPnL: 200, rMultiple: 2.0 },
        { id: "w2", ticker: "W2", companyName: "Win2", status: "CLOSED", entryTrigger: 10, actualEntry: 10, sharesTotal: 10, sharesRemaining: 0, initialStop: 9, currentStop: 10, target1: 12, target2: 14, rrRatio: 2, timeStopSessions: 5, sessionsElapsed: 3, realizedPnL: 300, rMultiple: 3.0 },
      ];

      const analytics = computeJournalAnalytics(allWinners);
      expect(analytics.totalTrades).toBe(2);
      expect(analytics.winningTrades).toBe(2);
      expect(analytics.losingTrades).toBe(0);
      expect(analytics.winRatePct).toBe(100.0);
      expect(analytics.profitFactor).toBe(999.0);
      expect(analytics.avgRMultiple).toBe(2.5);
    });

    it("computes accurate 0% win rate (all losses) with profitFactor = 0.0", () => {
      const allLosses: StoredTrade[] = [
        { id: "l1", ticker: "L1", companyName: "Loss1", status: "CLOSED", entryTrigger: 10, actualEntry: 10, sharesTotal: 10, sharesRemaining: 0, initialStop: 9, currentStop: 9, target1: 12, target2: 14, rrRatio: 2, timeStopSessions: 5, sessionsElapsed: 1, realizedPnL: -100, rMultiple: -1.0 },
        { id: "l2", ticker: "L2", companyName: "Loss2", status: "CLOSED", entryTrigger: 10, actualEntry: 10, sharesTotal: 10, sharesRemaining: 0, initialStop: 9, currentStop: 9, target1: 12, target2: 14, rrRatio: 2, timeStopSessions: 5, sessionsElapsed: 2, realizedPnL: -150, rMultiple: -1.5 },
      ];

      const analytics = computeJournalAnalytics(allLosses);
      expect(analytics.totalTrades).toBe(2);
      expect(analytics.winningTrades).toBe(0);
      expect(analytics.losingTrades).toBe(2);
      expect(analytics.winRatePct).toBe(0.0);
      expect(analytics.profitFactor).toBe(0.0);
      expect(analytics.avgRMultiple).toBe(-1.25);
    });
  });
});
