#!/usr/bin/env node
/**
 * Dependency audit gate.
 *
 * Fails when `npm audit` reports a finding at or above MINIMUM_SEVERITY that is
 * not accepted in audit-allowlist.json, and also fails when an allowlist entry
 * is no longer reported — so accepted findings cannot quietly become permanent.
 */
'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const SEVERITY_ORDER = ['info', 'low', 'moderate', 'high', 'critical'];
const MINIMUM_SEVERITY = 'moderate';
const ALLOWLIST_PATH = path.join(__dirname, '..', 'audit-allowlist.json');

const atOrAbove = (severity, floor) =>
  SEVERITY_ORDER.indexOf(severity) >= SEVERITY_ORDER.indexOf(floor);

function runAudit() {
  // `npm audit` exits non-zero whenever it finds anything, so the exit code is
  // not the signal here — the parsed report is.
  try {
    return JSON.parse(
      execFileSync('npm', ['audit', '--json'], {
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
      }),
    );
  } catch (error) {
    if (!error.stdout) throw error;
    return JSON.parse(error.stdout);
  }
}

function readAllowlist() {
  if (!fs.existsSync(ALLOWLIST_PATH)) return [];
  const parsed = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8'));
  return parsed.accepted ?? [];
}

const report = runAudit();
const allowlist = readAllowlist();
const allowedNames = new Set(allowlist.map(entry => entry.package));

const findings = Object.entries(report.vulnerabilities ?? {})
  .map(([name, finding]) => ({ name, severity: finding.severity }))
  .filter(finding => atOrAbove(finding.severity, MINIMUM_SEVERITY));

const unaccepted = findings.filter(finding => !allowedNames.has(finding.name));
const reportedNames = new Set(findings.map(finding => finding.name));
const stale = allowlist.filter(entry => !reportedNames.has(entry.package));

const totals = report.metadata?.vulnerabilities ?? {};
console.log(
  `npm audit: ${SEVERITY_ORDER.map(s => `${totals[s] ?? 0} ${s}`).join(', ')}`,
);

for (const finding of unaccepted) {
  console.error(`unaccepted ${finding.severity} finding: ${finding.name}`);
}
for (const entry of stale) {
  console.error(
    `stale allowlist entry: ${entry.package} is no longer reported — remove it`,
  );
}

if (unaccepted.length > 0 || stale.length > 0) {
  console.error(
    `\nGate failed. Fix the advisory, or accept it in ${path.basename(
      ALLOWLIST_PATH,
    )} with a reason and a review date.`,
  );
  process.exit(1);
}

console.log(
  `Audit gate passed (threshold: ${MINIMUM_SEVERITY}+, ${allowlist.length} accepted).`,
);
