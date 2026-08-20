# Workspace Rules: Continuous Build Verification & CI Stability

## Rule: Mandatory Automated Build Verification
After EVERY code change, bug fix, or feature addition in this repository:
1. **Never commit or push untested code**:
   Always execute 
pm run build to verify:
   - Zero TypeScript compilation errors (	sc --noEmit).
   - Zero syntax, import, or undefined variable errors.
   - Successful Next.js page generation and API route bundling.
2. **Cloudflare Cache & Build Hygiene**:
   - Always purge .next/cache before building to prevent Turbopack RocksDB .sst index table corruption.
   - Ensure the production build uses the stable Webpack target (
ext build --webpack).
3. **Subagent Delegation**:
   - The uild_verifier subagent is designated to validate full pipeline integrity after code edits.
