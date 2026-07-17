#!/usr/bin/env node

const path = require('path');
const { spawnSync } = require('child_process');
const { resolveAndroidEnv } = require('./android-env');
const { ensureEmulatorRunning } = require('./setup-emulator');

function runAdbReverse(env) {
  spawnSync(process.execPath, [path.join(__dirname, 'setup-adb-reverse.js')], {
    stdio: 'inherit',
    env,
  });
}

async function main() {
  const { env, javaHome } = resolveAndroidEnv();

  if (!javaHome) {
    console.warn('[run-android] Could not locate a Java runtime (checked JAVA_HOME, Android Studio\'s bundled JBR, and Homebrew openjdk@17). The Gradle build may fail.');
  }

  await ensureEmulatorRunning();
  runAdbReverse(env);

  const reactNativeBin = path.join(__dirname, '..', 'node_modules', '.bin', 'react-native');
  const result = spawnSync(reactNativeBin, ['run-android'], {
    stdio: 'inherit',
    env,
  });

  runAdbReverse(env);

  process.exit(result.status ?? 1);
}

main();
