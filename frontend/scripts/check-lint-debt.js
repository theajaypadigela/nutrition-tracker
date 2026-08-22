#!/usr/bin/env node
/**
 * Inline-suppression ratchet.
 *
 * `eslint-disable` comments are invisible to `npm run lint` — the rule reports
 * clean precisely where it was switched off. This turns those suppressions into
 * a tracked number that can only go down, and prints every site so the debt is
 * reviewable. See docs/lint-debt.md for why each one is currently there.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const BASELINE_PATH = path.join(ROOT, 'lint-debt-baseline.json');
const SCAN_ROOTS = ['src', '__tests__'];
const EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx']);
const DISABLE_COMMENT =
  /eslint-disable(?:-next-line|-line)?\s+([^*\n]+)/g;

function* walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      yield* walk(full);
    } else if (EXTENSIONS.has(path.extname(entry.name))) {
      yield full;
    }
  }
}

const sites = new Map();
for (const scanRoot of SCAN_ROOTS) {
  const absolute = path.join(ROOT, scanRoot);
  if (!fs.existsSync(absolute)) continue;
  for (const file of walk(absolute)) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, index) => {
      for (const match of line.matchAll(DISABLE_COMMENT)) {
        for (const rule of match[1].split(',')) {
          const name = rule.trim().replace(/\s*--.*$/, '');
          if (!name) continue;
          if (!sites.has(name)) sites.set(name, []);
          sites.get(name).push(
            `${path.relative(ROOT, file)}:${index + 1}`,
          );
        }
      }
    });
  }
}

const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')).suppressions;
const rules = [...new Set([...sites.keys(), ...Object.keys(baseline)])].sort();
const failures = [];

for (const rule of rules) {
  const found = sites.get(rule) ?? [];
  const allowed = baseline[rule];

  if (allowed === undefined) {
    failures.push(
      `${rule}: ${found.length} new suppression(s) with no baseline — fix them, ` +
        `or record them in ${path.basename(BASELINE_PATH)} with a note in docs/lint-debt.md`,
    );
  } else if (found.length > allowed) {
    failures.push(
      `${rule}: ${found.length} suppressions, baseline is ${allowed} — this number may not grow`,
    );
  } else if (found.length < allowed) {
    failures.push(
      `${rule}: down to ${found.length} from a baseline of ${allowed} — ` +
        `lower the baseline to ${found.length} to lock the improvement in`,
    );
  }

  console.log(`${rule}: ${found.length}/${allowed ?? '-'}`);
  for (const site of found) console.log(`  ${site}`);
}

if (failures.length > 0) {
  console.error('\nLint debt gate failed:');
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}

console.log('\nLint debt gate passed.');
