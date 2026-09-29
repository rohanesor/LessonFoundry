import type {
  Reporter,
  TestCase,
  TestResult,
  FullResult,
} from "@playwright/test/reporter";
// Authentication failures can contain credential-entry call logs. Do not print them.
export default class RedactedReporter implements Reporter {
  onTestEnd(test: TestCase, result: TestResult) {
    console.log(`[${result.status.toUpperCase()}] ${test.title}`);
    if (result.status === "failed" || result.status === "timedOut")
      console.log(
        "Failure details redacted. Investigate privately; do not share credential-entry artifacts.",
      );
  }
  onError() {
    console.log("Staging browser setup error (details redacted).");
  }
  onEnd(result: FullResult) {
    console.log(`Staging browser result: ${result.status}`);
  }
}
