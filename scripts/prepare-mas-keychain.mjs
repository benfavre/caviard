import { randomBytes } from 'node:crypto';
import { writeFile, appendFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// electron-builder 26.15.3 passes the certificate password to
// set-key-partition-list instead of its randomly generated keychain password.
// Import explicitly on the ephemeral macOS runner, then use CSC_KEYCHAIN.
if (process.platform !== 'darwin' || !process.env.RUNNER_TEMP || !process.env.GITHUB_ENV)
  throw new Error('This script requires the ephemeral GitHub macOS runner');
const run = (args) => {
  const result = spawnSync('/usr/bin/security', args, { encoding: 'utf8' });
  // Do not include arguments or raw errors: they may contain passwords.
  if (result.status !== 0) throw new Error(`Keychain operation failed: ${args[0]}`);
  return result.stdout;
};
const keychain = path.join(process.env.RUNNER_TEMP, 'inklura-mas.keychain-db');
const password = randomBytes(32).toString('hex');
console.log(`::add-mask::${password}`);
const previous = [...run(['list-keychains', '-d', 'user']).matchAll(/"([^"]+)"/g)].map(m => m[1]);
run(['create-keychain', '-p', password, keychain]);
try {
  run(['set-keychain-settings', '-lut', '21600', keychain]);
  run(['unlock-keychain', '-p', password, keychain]);
  for (const kind of ['MAS_CSC', 'MAS_INSTALLER']) {
    if (!process.env[kind + '_LINK'] || !process.env[kind + '_KEY_PASSWORD'])
      throw new Error(`Missing ${kind} signing secret`);
    const file = path.join(process.env.RUNNER_TEMP, `${kind}.p12`);
    try {
      await writeFile(file, Buffer.from(process.env[kind + '_LINK'], 'base64'), { mode: 0o600 });
      run(['import', file, '-k', keychain, '-T', '/usr/bin/codesign', '-T', '/usr/bin/productbuild', '-P', process.env[kind + '_KEY_PASSWORD']]);
    } finally { await unlink(file).catch(() => {}); }
  }
  run(['set-key-partition-list', '-S', 'apple-tool:,apple:', '-s', '-k', password, keychain]);
  run(['list-keychains', '-d', 'user', '-s', keychain, ...previous]);
  await appendFile(process.env.GITHUB_ENV, `CSC_KEYCHAIN=${keychain}\n`);
  console.log('Dedicated MAS signing keychain prepared');
} catch (error) {
  run(['delete-keychain', keychain]);
  throw error;
}
