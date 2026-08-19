## 2026-08-19T21:37:21Z
You are the Forensic Auditor for Milestone 3 (Position Manager, Tactical Actions, Journal & Audio).
Your working directory: C:\Users\freed\.gemini\antigravity\scratch\senior-broker-app\.agents\teamwork_preview_auditor_m3_1
Project root: C:\Users\freed\.gemini\antigravity\scratch\senior-broker-app

MANDATORY DOCUMENTS TO READ:
- Original Request: C:\Users\freed\.gemini\antigravity\scratch\senior-broker-app\.agents\ORIGINAL_REQUEST.md
- Project Plan: C:\Users\freed\.gemini\antigravity\scratch\senior-broker-app\PROJECT.md
- Scope Document: C:\Users\freed\.gemini\antigravity\scratch\senior-broker-app\.agents\self_sub_orch_m3\SCOPE.md
- Worker Handoff: C:\Users\freed\.gemini\antigravity\scratch\senior-broker-app\.agents\teamwork_preview_worker_m3_1\handoff.md

TASK:
Perform a comprehensive forensic integrity audit of all Milestone 3 files:
- `src/lib/audio/*`
- `src/components/dashboard/PriceLadder.tsx`
- `src/components/positions/*`
- `src/components/coach/TacticalBriefingPanel.tsx` & `src/components/coach/CoachActionCard.tsx`
- `src/components/journal/*`
- `src/app/api/trades/*`
- `src/tests/*`

AUDIT CHECKS:
1. Static code analysis: check for hardcoded test fixtures masquerading as live calculation, dummy mocks returning static strings, short-circuit logic that bypasses calculations.
2. Web Audio synthesis authenticity: verify genuine procedural AudioContext, OscillatorNode, GainNode sound generation (no fake silent functions, no static audio file cheating).
3. Recharts P&L curve authenticity: verify genuine ResponsiveContainer, AreaChart, XAxis, YAxis, Tooltip rendering genuine dynamic data.
4. Tactical actions authenticity: verify genuine state mutations, stop ratcheting checks, odd-share rounding, and calculation of realized P&L.
5. Pre-trade guardrail checks authenticity: verify actual sleeve checks (max 3 positions, 3% risk, 2/sector) with true enforcement.
6. Test authenticity: verify tests in `src/tests/` genuinely test the system with real assertions, not trivial `expect(true).toBe(true)` or bypassed logic.

Produce a detailed forensic audit report and state your explicit verdict (CLEAN or INTEGRITY VIOLATION) in `C:\Users\freed\.gemini\antigravity\scratch\senior-broker-app\.agents\teamwork_preview_auditor_m3_1\handoff.md`.
Send a completion message back when done.
