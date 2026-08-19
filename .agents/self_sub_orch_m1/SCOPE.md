# Scope: Milestone 1 (M1: Core Domain & Dual-Layer Persistence)

## Architecture
- **Domain Logic**:
  - Portfolio sizing calculator (`src/lib/portfolio/sizing-calculator.ts`)
  - Market / Trade Rule Engine (`src/lib/market/rule-engine.ts`)
- **Persistence & Storage**:
  - Dual-Layer Persistence Layer (LocalStorage + IndexedDB + Universal Prisma Memory/D1 fallback in `src/lib/storage/local-store.ts` and `src/lib/prisma.ts`)
  - Snapshot Backup/Restore Engine (`src/lib/storage/backup-service.ts`)
- **Unit & Adversarial Tests**:
  - `src/tests/unit/sizing-calculator.test.ts`
  - `src/tests/unit/rule-engine.test.ts`
  - `src/tests/unit/storage.test.ts`
  - `src/tests/unit/backup-service.test.ts`
  - `src/tests/adversarial/m1_gen2_deep_adversarial.test.ts`

## Feature Inventory Mapping
| # | Feature | Description | File Target | Status |
|---|---------|-------------|-------------|--------|
| 6 | Auto Position Sizer | 1% risk ($150 on $15k), max share calculation, cash buffer | `src/lib/portfolio/sizing-calculator.ts` | DONE |
| 16 | Trade Rule Engine | T1 50% scale, T2 runner, hard stop invalidation, time stop | `src/lib/market/rule-engine.ts` | DONE |
| 17 | Trailing Stop & Breakeven | Move stop to entry upon T1 fill | `src/lib/market/rule-engine.ts` | DONE |
| 18 | Sleeve Risk Limiter | Max 3 open positions, 3.0% sleeve risk cap | `src/lib/market/rule-engine.ts` | DONE |
| 19 | Sector Concentration Limiter | Max 2 positions per sector | `src/lib/market/rule-engine.ts` | DONE |
| 30 | Dual-Layer Persistence Engine | LocalStorage + IndexedDB + universal schema sync | `src/lib/storage/local-store.ts` | DONE |
| 31 | 1-Click JSON Backup & Restore | Export/Import snapshot JSON with schema validation | `src/lib/storage/backup-service.ts` | DONE |

## Interface Contracts
- Sizing Calculator: `calculatePositionSize(input: SizingInput): SizingResult`
- Rule Engine:
  - `evaluateTradeRules(trade: Trade, quote: MarketQuote, sessionsElapsed?: number): TradeRuleEvaluation`
  - `validateProposedTrade(proposed: ProposedTrade, portfolioState: PortfolioState): PortfolioValidationResult`
- Storage:
  - `LocalStoreService.getTrades()`, `saveTrade()`, `getPortfolio()`, `subscribe()`
- Backup:
  - `generateBackupSnapshot(store)`
  - `validateBackupSnapshot(jsonString)`
  - `restoreBackupSnapshot(jsonString, mode, store)`

## Milestone Result: PASS
- All features delivered, fully unit-tested, reviewed, adversarially stressed, and forensically audited.
