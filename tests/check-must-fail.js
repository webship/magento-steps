#!/usr/bin/env node
'use strict';

// Proves that the assertions of this pack fail when what they state is false.
//
// It runs the scenarios tagged @must-fail (tests/features/90-assertions-must-fail.feature)
// against the test site and passes only when EVERY one of them fails, at its
// last step, with a friendly message that carries a hint. A scenario that
// passes, or that fails earlier (a broken set-up), fails this check.
//
// Usage: node tests/check-must-fail.js   (npm run test:must-fail)

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const REPORT = path.join(ROOT, 'tests', 'reports', 'must_fail_report.json');

const run = spawnSync(process.execPath, [
  path.join(ROOT, 'node_modules', '@cucumber', 'cucumber', 'bin', 'cucumber.js'),
  '--config', 'cucumber.js',
  '--tags', '@must-fail',
  '--format', 'json:' + REPORT,
], { cwd: ROOT, env: { WEBSHIP_ASSERT_BUDGET: '8000', ...process.env, CUCUMBER_TAGS: '@must-fail', WEBSHIP_REPORT_DISABLE: '1' }, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

if (!fs.existsSync(REPORT)) {
  console.error(run.stdout || '');
  console.error(run.stderr || '');
  console.error('The run wrote no report.');
  process.exit(1);
}

const features = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
const problems = [];
let count = 0;

for (const feature of features) {
  for (const scenario of feature.elements || []) {
    if (scenario.type && scenario.type !== 'scenario') continue;
    count += 1;
    const steps = (scenario.steps || []).filter((step) => !step.hidden);
    const failed = steps.findIndex((step) => step.result && step.result.status === 'failed');
    const last = steps[steps.length - 1];
    if (failed === -1) {
      problems.push(`${scenario.name}: every step passed, so "${last.keyword}${last.name}" cannot fail.`);
      continue;
    }
    if (failed !== steps.length - 1) {
      problems.push(`${scenario.name}: failed at "${steps[failed].keyword}${steps[failed].name}", before the assertion under test.\n      ${String(steps[failed].result.error_message || '').split('\n')[0]}`);
      continue;
    }
    const message = String(last.result.error_message || '');
    const first = message.split('\n')[0];
    if (!/Hint:/.test(message)) {
      problems.push(`${scenario.name}: failed without a hint: ${first}`);
      continue;
    }
    if (/Timeout \d+ms exceeded|locator\.|function timed out/i.test(first)) {
      problems.push(`${scenario.name}: failed with a raw timeout instead of a friendly message: ${first}`);
      continue;
    }
    console.log(`  fails as it must  ${scenario.name}\n                    ${first}`);
  }
}

console.log(`\n${count} scenarios that must fail, ${count - problems.length} failed with a helpful message.`);
if (!count) problems.push('No @must-fail scenario was run.');
if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  for (const problem of problems) console.error('  ' + problem);
  process.exit(1);
}
