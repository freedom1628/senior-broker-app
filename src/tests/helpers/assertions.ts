// Lightweight, zero-dependency TypeScript assertion and test runner library
// Designed for pure ESM execution in Node.js and Cloudflare Workers runtime environments

export interface TestResult {
  name: string;
  fullName: string;
  status: "passed" | "failed" | "skipped";
  durationMs: number;
  error?: Error | { message: string; stack?: string };
}

export interface SuiteResult {
  name: string;
  fullName: string;
  results: TestResult[];
  suites: SuiteResult[];
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
}

export interface RunSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  suites: SuiteResult[];
  failures: { testName: string; suiteName: string; error: Error | { message: string; stack?: string } }[];
}

export type HookFn = () => void | Promise<void>;
export type TestFn = () => void | Promise<void>;

export class TestCase {
  constructor(
    public name: string,
    public fn?: TestFn,
    public skipped: boolean = false,
    public only: boolean = false
  ) {}
}

export class TestSuite {
  public tests: TestCase[] = [];
  public suites: TestSuite[] = [];
  public beforeAllHooks: HookFn[] = [];
  public afterAllHooks: HookFn[] = [];
  public beforeEachHooks: HookFn[] = [];
  public afterEachHooks: HookFn[] = [];

  constructor(public name: string, public parent?: TestSuite) {}

  get fullName(): string {
    return this.parent && this.parent.name ? `${this.parent.fullName} > ${this.name}` : this.name;
  }
}

// Global test registry
let rootSuites: TestSuite[] = [];
let currentSuite: TestSuite | null = null;

export function resetRegistry(): void {
  rootSuites = [];
  currentSuite = null;
}

export function describe(name: string, fn: () => void): void {
  const parent = currentSuite;
  const suite = new TestSuite(name, parent || undefined);

  if (parent) {
    parent.suites.push(suite);
  } else {
    rootSuites.push(suite);
  }

  currentSuite = suite;
  try {
    fn();
  } finally {
    currentSuite = parent;
  }
}

export function it(name: string, fn?: TestFn): void {
  const suite = getOrCreateActiveSuite();
  const testCase = new TestCase(name, fn, !fn);
  suite.tests.push(testCase);
}

// Aliases and modifiers
export const test = it;

it.skip = function (name: string, _fn?: TestFn): void {
  const suite = getOrCreateActiveSuite();
  suite.tests.push(new TestCase(name, undefined, true));
};
test.skip = it.skip;

it.only = function (name: string, fn?: TestFn): void {
  const suite = getOrCreateActiveSuite();
  suite.tests.push(new TestCase(name, fn, false, true));
};
test.only = it.only;

export function beforeEach(fn: HookFn): void {
  getOrCreateActiveSuite().beforeEachHooks.push(fn);
}

export function afterEach(fn: HookFn): void {
  getOrCreateActiveSuite().afterEachHooks.push(fn);
}

export function beforeAll(fn: HookFn): void {
  getOrCreateActiveSuite().beforeAllHooks.push(fn);
}

export function afterAll(fn: HookFn): void {
  getOrCreateActiveSuite().afterAllHooks.push(fn);
}

function getOrCreateActiveSuite(): TestSuite {
  if (!currentSuite) {
    const anonymousSuite = new TestSuite("Default Suite");
    rootSuites.push(anonymousSuite);
    currentSuite = anonymousSuite;
  }
  return currentSuite;
}

// Deep equality helper
export function deepEqual(a: any, b: any, visited = new WeakSet()): boolean {
  if (Object.is(a, b)) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") {
    return false;
  }

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  if (a instanceof RegExp && b instanceof RegExp) {
    return a.toString() === b.toString();
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i], visited)) return false;
    }
    return true;
  }

  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (a instanceof Set && b instanceof Set) {
    if (a.size !== b.size) return false;
    for (const item of a) {
      let found = false;
      for (const other of b) {
        if (deepEqual(item, other, visited)) {
          found = true;
          break;
        }
      }
      if (!found) return false;
    }
    return true;
  }

  if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size) return false;
    for (const [key, val] of a) {
      if (!b.has(key) || !deepEqual(val, b.get(key), visited)) return false;
    }
    return true;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!deepEqual(a[key], b[key], visited)) return false;
  }

  return true;
}

// Partial match helper for toMatchObject
export function matchObject(actual: any, expected: any, visited = new WeakSet()): boolean {
  if (Object.is(actual, expected)) return true;
  if (expected === null || typeof expected !== "object") {
    return Object.is(actual, expected);
  }
  if (actual === null || typeof actual !== "object") {
    return false;
  }

  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) return false;
    if (actual.length < expected.length) return false;
    for (let i = 0; i < expected.length; i++) {
      if (!matchObject(actual[i], expected[i], visited)) return false;
    }
    return true;
  }

  for (const key of Object.keys(expected)) {
    if (!(key in actual)) return false;
    if (!matchObject(actual[key], expected[key], visited)) return false;
  }
  return true;
}

function formatValue(v: any): string {
  if (v === undefined) return "undefined";
  if (v === null) return "null";
  if (typeof v === "function") return `[Function: ${v.name || "anonymous"}]`;
  if (typeof v === "symbol") return v.toString();
  if (v instanceof Error) return `${v.name}: ${v.message}`;
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

export class AssertionError extends Error {
  public actual?: any;
  public expected?: any;
  public showDiff: boolean;

  constructor(message: string, actual?: any, expected?: any) {
    super(message);
    this.name = "AssertionError";
    this.actual = actual;
    this.expected = expected;
    this.showDiff = actual !== undefined && expected !== undefined;
  }
}

export class Matchers {
  constructor(private actual: any, private isNot: boolean = false) {}

  get not(): Matchers {
    return new Matchers(this.actual, !this.isNot);
  }

  private assert(condition: boolean, failureMsg: () => string, expected?: any): void {
    const passed = this.isNot ? !condition : condition;
    if (!passed) {
      const msg = failureMsg();
      throw new AssertionError(msg, this.actual, expected);
    }
  }

  toBe(expected: any): void {
    this.assert(
      Object.is(this.actual, expected),
      () =>
        `Expected ${this.isNot ? "NOT " : ""}to be ${formatValue(expected)}, but received ${formatValue(
          this.actual
        )}`,
      expected
    );
  }

  toEqual(expected: any): void {
    this.assert(
      deepEqual(this.actual, expected),
      () =>
        `Expected ${this.isNot ? "NOT " : ""}to equal:\n${formatValue(expected)}\nReceived:\n${formatValue(
          this.actual
        )}`,
      expected
    );
  }

  toBeCloseTo(expected: number, numDigits: number = 2): void {
    if (typeof this.actual !== "number" || typeof expected !== "number") {
      throw new AssertionError(
        `toBeCloseTo requires numbers. Received actual: ${formatValue(this.actual)}, expected: ${formatValue(expected)}`
      );
    }
    const tolerance = Math.pow(10, -numDigits) / 2;
    const diff = Math.abs(this.actual - expected);
    this.assert(
      diff < tolerance,
      () =>
        `Expected ${this.actual} ${this.isNot ? "NOT " : ""}to be close to ${expected} (within ${tolerance}, diff: ${diff})`,
      expected
    );
  }

  toBeGreaterThan(expected: number): void {
    this.assert(
      this.actual > expected,
      () => `Expected ${this.actual} ${this.isNot ? "NOT " : ""}to be greater than ${expected}`,
      expected
    );
  }

  toBeLessThan(expected: number): void {
    this.assert(
      this.actual < expected,
      () => `Expected ${this.actual} ${this.isNot ? "NOT " : ""}to be less than ${expected}`,
      expected
    );
  }

  toBeGreaterThanOrEqual(expected: number): void {
    this.assert(
      this.actual >= expected,
      () => `Expected ${this.actual} ${this.isNot ? "NOT " : ""}to be greater than or equal to ${expected}`,
      expected
    );
  }

  toBeLessThanOrEqual(expected: number): void {
    this.assert(
      this.actual <= expected,
      () => `Expected ${this.actual} ${this.isNot ? "NOT " : ""}to be less than or equal to ${expected}`,
      expected
    );
  }

  toBeNull(): void {
    this.assert(
      this.actual === null,
      () => `Expected ${this.isNot ? "NOT " : ""}null, received ${formatValue(this.actual)}`,
      null
    );
  }

  toBeUndefined(): void {
    this.assert(
      this.actual === undefined,
      () => `Expected ${this.isNot ? "NOT " : ""}undefined, received ${formatValue(this.actual)}`,
      undefined
    );
  }

  toBeDefined(): void {
    this.assert(
      this.actual !== undefined,
      () => `Expected ${this.isNot ? "NOT " : ""}defined, received undefined`,
      undefined
    );
  }

  toBeTruthy(): void {
    this.assert(
      Boolean(this.actual),
      () => `Expected ${formatValue(this.actual)} ${this.isNot ? "NOT " : ""}to be truthy`,
      true
    );
  }

  toBeFalsy(): void {
    this.assert(
      !this.actual,
      () => `Expected ${formatValue(this.actual)} ${this.isNot ? "NOT " : ""}to be falsy`,
      false
    );
  }

  toContain(expected: any): void {
    let contains = false;
    if (typeof this.actual === "string") {
      contains = this.actual.includes(String(expected));
    } else if (Array.isArray(this.actual)) {
      contains = this.actual.some(item => deepEqual(item, expected) || item === expected);
    } else if (this.actual instanceof Set || this.actual instanceof Map) {
      contains = this.actual.has(expected);
    } else if (this.actual && typeof this.actual === "object") {
      contains = expected in this.actual;
    }

    this.assert(
      contains,
      () => `Expected ${formatValue(this.actual)} ${this.isNot ? "NOT " : ""}to contain ${formatValue(expected)}`,
      expected
    );
  }

  toHaveLength(expected: number): void {
    const len =
      this.actual && typeof this.actual.length === "number"
        ? this.actual.length
        : this.actual && typeof this.actual.size === "number"
        ? this.actual.size
        : undefined;

    this.assert(
      len === expected,
      () =>
        `Expected length ${expected}, but got ${len === undefined ? "undefined" : len} on ${formatValue(
          this.actual
        )}`,
      expected
    );
  }

  toMatchObject(expected: any): void {
    this.assert(
      matchObject(this.actual, expected),
      () =>
        `Expected ${this.isNot ? "NOT " : ""}to match object:\n${formatValue(expected)}\nReceived:\n${formatValue(
          this.actual
        )}`,
      expected
    );
  }

  toThrow(expectedError?: string | RegExp | Error | { new (...args: any[]): Error }): void {
    if (typeof this.actual !== "function") {
      throw new AssertionError(`toThrow requires a function target. Received: ${typeof this.actual}`);
    }

    let didThrow = false;
    let thrownError: any = null;

    try {
      this.actual();
    } catch (err) {
      didThrow = true;
      thrownError = err;
    }

    if (!this.isNot) {
      if (!didThrow) {
        throw new AssertionError("Expected function to throw an error, but it did not throw.");
      }
      if (expectedError !== undefined) {
        if (typeof expectedError === "string") {
          const errMsg = thrownError instanceof Error ? thrownError.message : String(thrownError);
          if (!errMsg.includes(expectedError)) {
            throw new AssertionError(
              `Expected thrown error message to contain "${expectedError}", but got: "${errMsg}"`
            );
          }
        } else if (expectedError instanceof RegExp) {
          const errMsg = thrownError instanceof Error ? thrownError.message : String(thrownError);
          if (!expectedError.test(errMsg)) {
            throw new AssertionError(
              `Expected thrown error message to match regex ${expectedError}, but got: "${errMsg}"`
            );
          }
        } else if (typeof expectedError === "function") {
          if (!(thrownError instanceof expectedError)) {
            throw new AssertionError(
              `Expected thrown error to be instance of ${(expectedError as any).name || "Error"}, but got: ${
                thrownError?.constructor?.name || typeof thrownError
              }`
            );
          }
        }
      }
    } else {
      if (didThrow) {
        throw new AssertionError(
          `Expected function NOT to throw, but it threw: ${thrownError?.message || thrownError}`
        );
      }
    }
  }

  async rejects(expectedError?: string | RegExp | Error | { new (...args: any[]): Error }): Promise<void> {
    let didReject = false;
    let rejectionReason: any = null;

    try {
      if (typeof this.actual === "function") {
        await this.actual();
      } else {
        await this.actual;
      }
    } catch (err) {
      didReject = true;
      rejectionReason = err;
    }

    if (!this.isNot) {
      if (!didReject) {
        throw new AssertionError("Expected promise to reject, but it resolved successfully.");
      }
      if (expectedError !== undefined) {
        if (typeof expectedError === "string") {
          const msg = rejectionReason instanceof Error ? rejectionReason.message : String(rejectionReason);
          if (!msg.includes(expectedError)) {
            throw new AssertionError(`Expected rejection message to contain "${expectedError}", but got: "${msg}"`);
          }
        } else if (expectedError instanceof RegExp) {
          const msg = rejectionReason instanceof Error ? rejectionReason.message : String(rejectionReason);
          if (!expectedError.test(msg)) {
            throw new AssertionError(`Expected rejection message to match regex ${expectedError}, but got: "${msg}"`);
          }
        }
      }
    } else {
      if (didReject) {
        throw new AssertionError(
          `Expected promise NOT to reject, but it rejected with: ${rejectionReason?.message || rejectionReason}`
        );
      }
    }
  }

  async resolves(): Promise<any> {
    try {
      const res = typeof this.actual === "function" ? await this.actual() : await this.actual;
      return res;
    } catch (err) {
      throw new AssertionError(`Expected promise to resolve, but it rejected with: ${err}`);
    }
  }
}

export function expect(actual: any): Matchers {
  return new Matchers(actual);
}

// Test Runner Execution Core
export async function runSuite(suite: TestSuite, parentHooks: { before: HookFn[]; after: HookFn[] } = { before: [], after: [] }): Promise<SuiteResult> {
  const startTime = Date.now();
  const results: TestResult[] = [];
  const nestedSuiteResults: SuiteResult[] = [];

  const cumulativeBeforeEach = [...parentHooks.before, ...suite.beforeEachHooks];
  const cumulativeAfterEach = [...suite.afterEachHooks, ...parentHooks.after];

  // Execute beforeAll
  for (const hook of suite.beforeAllHooks) {
    await hook();
  }

  // Check if any test has .only
  const hasOnly = suite.tests.some(t => t.only);

  for (const testCase of suite.tests) {
    const fullName = suite.fullName ? `${suite.fullName} > ${testCase.name}` : testCase.name;

    if (testCase.skipped || (hasOnly && !testCase.only)) {
      results.push({
        name: testCase.name,
        fullName,
        status: "skipped",
        durationMs: 0,
      });
      continue;
    }

    const testStart = Date.now();
    try {
      // Run beforeEach hooks
      for (const hook of cumulativeBeforeEach) {
        await hook();
      }

      // Run test body
      if (testCase.fn) {
        await testCase.fn();
      }

      // Run afterEach hooks
      for (const hook of cumulativeAfterEach) {
        await hook();
      }

      results.push({
        name: testCase.name,
        fullName,
        status: "passed",
        durationMs: Date.now() - testStart,
      });
    } catch (err: any) {
      // Still try to run afterEach hooks even on failure
      for (const hook of cumulativeAfterEach) {
        try {
          await hook();
        } catch {
          // ignore teardown error if main test failed
        }
      }

      results.push({
        name: testCase.name,
        fullName,
        status: "failed",
        durationMs: Date.now() - testStart,
        error: err instanceof Error ? err : new Error(String(err)),
      });
    }
  }

  // Run nested suites
  for (const nested of suite.suites) {
    const nestedRes = await runSuite(nested, {
      before: cumulativeBeforeEach,
      after: cumulativeAfterEach,
    });
    nestedSuiteResults.push(nestedRes);
  }

  // Execute afterAll
  for (const hook of suite.afterAllHooks) {
    try {
      await hook();
    } catch (err) {
      console.error(`Error in afterAll hook of suite "${suite.name}":`, err);
    }
  }

  const passed = results.filter(r => r.status === "passed").length + nestedSuiteResults.reduce((acc, s) => acc + s.passed, 0);
  const failed = results.filter(r => r.status === "failed").length + nestedSuiteResults.reduce((acc, s) => acc + s.failed, 0);
  const skipped = results.filter(r => r.status === "skipped").length + nestedSuiteResults.reduce((acc, s) => acc + s.skipped, 0);

  return {
    name: suite.name,
    fullName: suite.fullName,
    results,
    suites: nestedSuiteResults,
    passed,
    failed,
    skipped,
    durationMs: Date.now() - startTime,
  };
}

export async function runAllRegisteredSuites(): Promise<RunSummary> {
  const startTime = Date.now();
  const suiteResults: SuiteResult[] = [];
  const failures: { testName: string; suiteName: string; error: Error | { message: string; stack?: string } }[] = [];

  for (const root of rootSuites) {
    const res = await runSuite(root);
    suiteResults.push(res);
  }

  function collectFailures(s: SuiteResult) {
    for (const r of s.results) {
      if (r.status === "failed" && r.error) {
        failures.push({
          testName: r.name,
          suiteName: s.fullName,
          error: r.error,
        });
      }
    }
    for (const nested of s.suites) {
      collectFailures(nested);
    }
  }

  suiteResults.forEach(collectFailures);

  const totalPassed = suiteResults.reduce((acc, s) => acc + s.passed, 0);
  const totalFailed = suiteResults.reduce((acc, s) => acc + s.failed, 0);
  const totalSkipped = suiteResults.reduce((acc, s) => acc + s.skipped, 0);

  return {
    total: totalPassed + totalFailed + totalSkipped,
    passed: totalPassed,
    failed: totalFailed,
    skipped: totalSkipped,
    durationMs: Date.now() - startTime,
    suites: suiteResults,
    failures,
  };
}
