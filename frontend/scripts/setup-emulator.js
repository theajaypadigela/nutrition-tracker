#!/usr/bin/env node

const { spawn, spawnSync } = require('child_process');
const { resolveAndroidEnv } = require('./android-env');

const BOOT_TIMEOUT_MS = 120000;
const POLL_INTERVAL_MS = 2000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function runAdb(adbPath, env, args) {
  return spawnSync(adbPath, args, { encoding: 'utf8', env });
}

function getOnlineDevices(adbPath, env) {
  const result = runAdb(adbPath, env, ['devices', '-l']);
  const stdout = (result.stdout || '').trim();
  const lines = stdout.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  return lines
    .slice(1)
    .map(line => line.split(/\s+/))
    .filter(parts => parts.length >= 2)
    .map(parts => ({ serial: parts[0], state: parts[1] }));
}

function listAvds(emulatorPath, env) {
  const result = spawnSync(emulatorPath, ['-list-avds'], { encoding: 'utf8', env });
  return (result.stdout || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
}

async function waitForBootCompleted(adbPath, env, serial) {
  const deadline = Date.now() + BOOT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const result = runAdb(adbPath, env, ['-s', serial, 'shell', 'getprop', 'sys.boot_completed']);
    if ((result.stdout || '').trim() === '1') {
      return true;
    }
    await sleep(POLL_INTERVAL_MS);
  }
  return false;
}

async function waitForNewDevice(adbPath, env, existingSerials) {
  const deadline = Date.now() + BOOT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const devices = getOnlineDevices(adbPath, env);
    const fresh = devices.find(d => !existingSerials.has(d.serial) && d.serial.startsWith('emulator-'));
    if (fresh) {
      return fresh.serial;
    }
    await sleep(POLL_INTERVAL_MS);
  }
  return null;
}

async function ensureEmulatorRunning() {
  const { env, adbPath, emulatorPath, androidHome } = resolveAndroidEnv();

  if (!androidHome) {
    console.warn('[setup-emulator] ANDROID_HOME not found; skipping auto-launch.');
    return;
  }

  const existing = getOnlineDevices(adbPath, env);
  if (existing.some(d => d.state === 'device')) {
    console.log('[setup-emulator] A device/emulator is already online. Skipping auto-launch.');
    return;
  }

  const avds = listAvds(emulatorPath, env);
  if (avds.length === 0) {
    console.warn('[setup-emulator] No AVDs found (`emulator -list-avds` returned nothing). Skipping auto-launch.');
    return;
  }

  const avdName = process.env.ANDROID_AVD_NAME && avds.includes(process.env.ANDROID_AVD_NAME)
    ? process.env.ANDROID_AVD_NAME
    : avds[0];

  console.log(`[setup-emulator] No device online. Launching AVD "${avdName}"...`);

  const existingSerials = new Set(existing.map(d => d.serial));
  const child = spawn(emulatorPath, ['-avd', avdName], {
    env,
    detached: true,
    stdio: 'ignore',
  });
  child.unref();

  const serial = await waitForNewDevice(adbPath, env, existingSerials);
  if (!serial) {
    console.warn('[setup-emulator] Timed out waiting for the emulator to appear in `adb devices`.');
    return;
  }

  console.log(`[setup-emulator] Emulator "${serial}" detected. Waiting for boot to complete...`);
  const booted = await waitForBootCompleted(adbPath, env, serial);
  if (booted) {
    console.log(`[setup-emulator] Emulator "${serial}" is ready.`);
  } else {
    console.warn(`[setup-emulator] Timed out waiting for "${serial}" to finish booting; continuing anyway.`);
  }
}

if (require.main === module) {
  ensureEmulatorRunning().catch(error => {
    console.warn(`[setup-emulator] Skipped: ${error.message}`);
  });
}

module.exports = { ensureEmulatorRunning };
