#!/usr/bin/env node
// Senior Broker — Autonomous E2E Test Runner & Harness
// Standalone CLI Runner compatible with pure TypeScript/ESM and Cloudflare edge patterns

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  resetRegistry,
  runAllRegisteredSuites,
  RunSummary,
  SuiteResult,
} from "./helpers/assertions";

// ANSI styling codes
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  gray: "\x1b[90m",
};

interface FileTestResult {
  filePath: string;
  relativePath: string;
  tier: string;
  summary: RunSummary;
  importError?: Error;
}

function findTestFiles(dir: string): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const dirent of list) {
    const fullPath = path.join(dir, dirent.name);
    if (dirent.isDirectory()) {
      if (dirent.name !== "helpers" && dirent.name !== "node_modules") {
        results = results.concat(findTestFiles(fullPath));
      }
    } else if (dirent.isFile() && dirent.name.endsWith(".test.ts")) {
      results.push(fullPath);
    }
  }
  return results;
}

function determineTier(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  if (normalized.includes("tier1_features")) return "Tier 1: Feature Coverage (32 Features)";
  if (normalized.includes("tier2_boundaries")) return "Tier 2: Boundary Value Analysis";
  if (normalized.includes("tier3_pairwise")) return "Tier 3: Pairwise Combinatorial Integration";
  if (normalized.includes("tier4_real_world")) return "Tier 4: Real-World Workload Scenarios";
  if (normalized.includes("unit")) return "Unit Tests";
  if (normalized.includes("e2e")) return "E2E Integration";
  return "General Test Suites";
}

function printHeader(): void {
  console.log(`\n${c.bold}${c.cyan}======================================================================${c.reset}`);
  console.log(`${c.bold}${c.white}   SENIOR BROKER — SWING TRADING COACH & INVESTOR EDUCATION INFRA   ${c.reset}`);
  console.log(`${c.dim}   Automated Test Runner & Multi-Tier Verification Harness${c.reset}`);
  console.log(`${c.bold}${c.cyan}======================================================================${c.reset}\n`);
}

function printSuiteResults(suite: SuiteResult, indent: string = "  "): void {
  const statusIcon = suite.failed > 0 ? `${c.red}✗${c.reset}` : `${c.green}✓${c.reset}`;
  console.log(`${indent}${statusIcon} ${c.bold}${suite.name}${c.reset} ${c.dim}(${suite.passed} passed, ${suite.failed} failed, ${suite.durationMs}ms)${c.reset}`);

  for (const test of suite.results) {
    if (test.status === "passed") {
      console.log(`${indent}  ${c.green}✓${c.reset} ${c.dim}${test.name}${c.reset} ${c.gray}(${test.durationMs}ms)${c.reset}`);
    } else if (test.status === "failed") {
      console.log(`${indent}  ${c.red}✗ ${test.name}${c.reset} ${c.red}(FAILED - ${test.durationMs}ms)${c.reset}`);
      if (test.error) {
        const msg = test.error.message || String(test.error);
        console.log(`${indent}    ${c.red}Error: ${msg}${c.reset}`);
        if (test.error.stack) {
          const stackLines = test.error.stack.split("\n").slice(1, 4).join(`\n${indent}    `);
          console.log(`${indent}    ${c.dim}${stackLines}${c.reset}`);
        }
      }
    } else {
      console.log(`${indent}  ${c.yellow}○ ${test.name} (skipped)${c.reset}`);
    }
  }

  for (const child of suite.suites) {
    printSuiteResults(child, indent + "  ");
  }
}

async function runAllTests(): Promise<void> {
  const testsRoot = path.resolve(__dirname);
  const testFiles = findTestFiles(testsRoot);

  printHeader();

  const filterArg = process.argv.slice(2).find(
    arg => !arg.startsWith("-") && !arg.endsWith("runner.ts") && !arg.endsWith("runner.js")
  );
  const matchedFiles = filterArg
    ? testFiles.filter(f => f.toLowerCase().includes(filterArg.toLowerCase()))
    : testFiles;

  console.log(`${c.dim}Discovered ${testFiles.length} total test file(s). Running ${matchedFiles.length} matched file(s)...${c.reset}\n`);

  if (matchedFiles.length === 0) {
    console.log(`${c.yellow}No test files found to run in: ${testsRoot}${c.reset}`);
    console.log(`${c.dim}Ensure test files match the pattern '*.test.ts' under src/tests/${c.reset}\n`);
    process.exit(0);
  }

  const resultsByTier: Record<string, FileTestResult[]> = {};
  const overallStart = Date.now();
  let totalTests = 0;
  let totalPassed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;
  const allFailures: { file: string; testName: string; suiteName: string; error: any }[] = [];

  for (const filePath of matchedFiles) {
    const relPath = path.relative(path.resolve(__dirname, "../.."), filePath).replace(/\\/g, "/");
    const tier = determineTier(filePath);

    if (!resultsByTier[tier]) {
      resultsByTier[tier] = [];
    }

    resetRegistry();

    try {
      // Dynamic import with cache busting for reliable standalone execution
      const fileUrl = pathToFileURL(filePath).href + `?t=${Date.now()}`;
      await import(fileUrl);

      const summary = await runAllRegisteredSuites();
      const fileRes: FileTestResult = {
        filePath,
        relativePath: relPath,
        tier,
        summary,
      };

      resultsByTier[tier].push(fileRes);
      totalTests += summary.total;
      totalPassed += summary.passed;
      totalFailed += summary.failed;
      totalSkipped += summary.skipped;

      for (const fail of summary.failures) {
        allFailures.push({
          file: relPath,
          testName: fail.testName,
          suiteName: fail.suiteName,
          error: fail.error,
        });
      }
    } catch (err: any) {
      console.error(`${c.red}Failed to load test file: ${relPath}${c.reset}`, err);
      const emptySummary: RunSummary = {
        total: 1,
        passed: 0,
        failed: 1,
        skipped: 0,
        durationMs: 0,
        suites: [],
        failures: [
          {
            testName: "File Import / Initialization",
            suiteName: relPath,
            error: err,
          },
        ],
      };

      resultsByTier[tier].push({
        filePath,
        relativePath: relPath,
        tier,
        summary: emptySummary,
        importError: err,
      });

      totalTests += 1;
      totalFailed += 1;
      allFailures.push({
        file: relPath,
        testName: "File Import / Initialization",
        suiteName: relPath,
        error: err,
      });
    }
  }

  // Render tiered report
  for (const [tierName, tierResults] of Object.entries(resultsByTier)) {
    const tierPassed = tierResults.reduce((acc, r) => acc + r.summary.passed, 0);
    const tierFailed = tierResults.reduce((acc, r) => acc + r.summary.failed, 0);
    const tierTotal = tierResults.reduce((acc, r) => acc + r.summary.total, 0);
    const tierDuration = tierResults.reduce((acc, r) => acc + r.summary.durationMs, 0);

    const tierBadge =
      tierFailed === 0
        ? `${c.bgGreen}${c.bold} PASS ${c.reset}`
        : `${c.bgRed}${c.bold} FAIL ${c.reset}`;

    console.log(`\n${tierBadge} ${c.bold}${c.cyan}${tierName}${c.reset} ${c.dim}(${tierPassed}/${tierTotal} passed in ${tierDuration}ms)${c.reset}`);
    console.log(`${c.dim}----------------------------------------------------------------------${c.reset}`);

    for (const fileRes of tierResults) {
      const fileStatus = fileRes.summary.failed === 0 ? `${c.green}●${c.reset}` : `${c.red}●${c.reset}`;
      console.log(`\n ${fileStatus} ${c.bold}${fileRes.relativePath}${c.reset} ${c.dim}(${fileRes.summary.passed} passed, ${fileRes.summary.failed} failed)${c.reset}`);

      for (const suite of fileRes.summary.suites) {
        printSuiteResults(suite, "   ");
      }
    }
  }

  const totalDuration = Date.now() - overallStart;

  // Print Summary Table
  console.log(`\n${c.bold}${c.cyan}======================================================================${c.reset}`);
  console.log(`${c.bold}                      TEST EXECUTION SUMMARY                          ${c.reset}`);
  console.log(`${c.bold}${c.cyan}======================================================================${c.reset}`);
  console.log(`  ${c.bold}Total Test Files :${c.reset} ${matchedFiles.length}`);
  console.log(`  ${c.bold}Total Assertions :${c.reset} ${totalTests}`);
  console.log(`  ${c.bold}Passed           :${c.reset} ${c.green}${totalPassed} passed${c.reset}`);
  console.log(`  ${c.bold}Failed           :${c.reset} ${totalFailed > 0 ? `${c.red}${totalFailed} failed` : `${c.dim}0 failed${c.reset}`}`);
  console.log(`  ${c.bold}Skipped          :${c.reset} ${totalSkipped > 0 ? `${c.yellow}${totalSkipped} skipped` : `${c.dim}0 skipped${c.reset}`}`);
  console.log(`  ${c.bold}Execution Time   :${c.reset} ${(totalDuration / 1000).toFixed(2)}s`);
  console.log(`${c.bold}${c.cyan}======================================================================${c.reset}\n`);

  if (allFailures.length > 0) {
    console.log(`${c.bold}${c.red}DETAILED FAILURES (${allFailures.length}):${c.reset}`);
    for (let i = 0; i < allFailures.length; i++) {
      const f = allFailures[i];
      console.log(`\n${c.red}${i + 1}) [${f.file}] ${f.suiteName} > ${f.testName}${c.reset}`);
      console.log(`   ${c.white}${f.error.message || f.error}${c.reset}`);
      if (f.error.stack) {
        console.log(`   ${c.dim}${f.error.stack.split("\n").slice(1, 4).join("\n   ")}${c.reset}`);
      }
    }
    console.log(`\n${c.bgRed}${c.bold} TEST RUN FAILED ${c.reset} (${totalFailed} failures)\n`);
    process.exit(1);
  } else {
    console.log(`${c.bgGreen}${c.bold} ALL TESTS PASSED ${c.reset} (100% success rate)\n`);
    process.exit(0);
  }
}

// Direct execution
runAllTests().catch(err => {
  console.error(`${c.red}Fatal runner error:${c.reset}`, err);
  process.exit(1);
});
