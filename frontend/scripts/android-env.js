#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');

function firstExisting(candidates) {
  return candidates.find(candidate => candidate && fs.existsSync(candidate));
}

function resolveAndroidHome() {
  return firstExisting([
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    path.join(os.homedir(), 'Library', 'Android', 'sdk'),
  ]);
}

function resolveJavaHome() {
  return firstExisting([
    process.env.JAVA_HOME,
    '/Applications/Android Studio.app/Contents/jbr/Contents/Home',
    '/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home',
    '/opt/homebrew/opt/openjdk@17',
  ]);
}

// npm scripts (and any other non-interactive shell) don't source ~/.zshrc, so
// ANDROID_HOME/JAVA_HOME/adb/emulator can be missing even though an interactive
// terminal has them. Resolve sane fallbacks here so `npm run android` works
// regardless of the shell that invoked it.
function resolveAndroidEnv() {
  const androidHome = resolveAndroidHome();
  const javaHome = resolveJavaHome();

  const pathParts = [];
  if (androidHome) {
    pathParts.push(path.join(androidHome, 'emulator'));
    pathParts.push(path.join(androidHome, 'platform-tools'));
    pathParts.push(path.join(androidHome, 'cmdline-tools', 'latest', 'bin'));
  }
  if (javaHome) {
    pathParts.push(path.join(javaHome, 'bin'));
  }
  pathParts.push(process.env.PATH || '');

  const env = {
    ...process.env,
    PATH: pathParts.filter(Boolean).join(path.delimiter),
  };

  if (androidHome) {
    env.ANDROID_HOME = androidHome;
    env.ANDROID_SDK_ROOT = androidHome;
  }
  if (javaHome) {
    env.JAVA_HOME = javaHome;
  }

  const adbPath = androidHome
    ? path.join(androidHome, 'platform-tools', 'adb')
    : 'adb';
  const emulatorPath = androidHome
    ? path.join(androidHome, 'emulator', 'emulator')
    : 'emulator';

  return { env, androidHome, javaHome, adbPath, emulatorPath };
}

module.exports = { resolveAndroidEnv };
