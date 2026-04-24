#!/usr/bin/env node

const { spawnSync } = require('child_process');

const REQUIRED_REVERSE_PORTS = ['5000', '8081'];

function runAdb(args, options = {}) {
  const result = spawnSync('adb', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const stdout = (result.stdout || '').trim();
  const stderr = (result.stderr || '').trim();

  if (result.status !== 0 && !options.allowFailure) {
    const details = stderr || stdout || 'unknown adb error';
    throw new Error(`adb ${args.join(' ')} failed: ${details}`);
  }

  return {
    status: result.status,
    stdout,
    stderr,
  };
}

function getOnlineDevices() {
  const { stdout } = runAdb(['devices', '-l']);
  const lines = stdout
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  return lines
    .slice(1)
    .map(line => line.split(/\s+/))
    .filter(parts => parts.length >= 2 && parts[1] === 'device')
    .map(parts => parts[0]);
}

function ensureReverse(serial, port) {
  // Remove stale or invalid mappings before applying the canonical tcp:port tcp:port map.
  runAdb(['-s', serial, 'reverse', '--remove', `tcp:${port}`], {
    allowFailure: true,
  });

  runAdb(['-s', serial, 'reverse', `tcp:${port}`, `tcp:${port}`]);
}

function main() {
  let devices;
  try {
    devices = getOnlineDevices();
  } catch (error) {
    console.warn(`[adb-reverse] Skipped: ${error.message}`);
    process.exit(0);
  }

  if (devices.length === 0) {
    console.log('[adb-reverse] No online Android devices found. Skipping reverse setup.');
    process.exit(0);
  }

  console.log(`[adb-reverse] Configuring reverse for ${devices.length} device(s)...`);

  for (const serial of devices) {
    try {
      for (const port of REQUIRED_REVERSE_PORTS) {
        ensureReverse(serial, port);
      }

      const listResult = runAdb(['-s', serial, 'reverse', '--list'], {
        allowFailure: true,
      });

      const listOutput = listResult.stdout || 'no reverse mappings returned';
      console.log(`[adb-reverse] ${serial} ready. Mappings:\n${listOutput}`);
    } catch (error) {
      console.warn(`[adb-reverse] ${serial} failed: ${error.message}`);
    }
  }
}

main();
