// Upload only the reviewed universal package. Never rebuild or submit for review.
// Apple docs: https://help.apple.com/itc/transporteruserguide/en.lproj/static.html
// JWT: https://developer.apple.com/documentation/appstoreconnectapi/generating-tokens-for-api-requests
import { createHash, createPrivateKey } from 'node:crypto';
import { readFileSync, appendFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const mode = process.argv[2] || 'inspect';
if (!['inspect', 'verify', 'upload'].includes(mode)) throw new Error('Expected inspect, verify or upload');
const root = resolve(process.argv[3] || 'source-mas-package');
const expectedHash = '2955e874fe75fcb27ba37f56ec886eccfe16e979db85ff9d9eea28d9d470e023';
const filename = 'Inklura-PDF-1.4.0-mac-app-store-universal.pkg';
const pkg = resolve(root, 'mas-universal', filename);
const report = JSON.parse(readFileSync(resolve(root, 'verification.json'), 'utf8'));
if (report.team !== '8V54BYQURB' || report.signature_and_sandbox_checks !== 'passed'
  || JSON.stringify([...report.architectures].sort()) !== JSON.stringify(['arm64', 'x86_64'])
  || report.packages?.length !== 1 || report.packages[0].file !== filename
  || report.packages[0].sha256 !== expectedHash) throw new Error('Unexpected MAS verification report');
const actualHash = createHash('sha256').update(readFileSync(pkg)).digest('hex');
if (actualHash !== expectedHash) throw new Error('Package differs from the reviewed bytes');
console.log(`Verified universal package SHA-256: ${actualHash}`);
if (process.platform !== 'darwin') {
  if (mode !== 'inspect') throw new Error('Apple upload requires the macOS runner');
  console.log('Local byte verification only; macOS signature/tools checks not run.');
  process.exit(0);
}
const signature = spawnSync('pkgutil', ['--check-signature', pkg], { encoding: 'utf8' });
if (signature.status !== 0 || !signature.stdout.includes('8V54BYQURB')
  || !signature.stdout.includes('3rd Party Mac Developer Installer:')) throw new Error('Unexpected installer signature');
console.log(signature.stdout);
const tool = spawnSync('xcrun', ['--find', 'altool'], { encoding: 'utf8' });
if (tool.status !== 0) throw new Error('Xcode altool is not installed');
console.log(`Xcode delivery tool: ${tool.stdout.trim()}`);
if (mode === 'inspect') process.exit(0);
const keyId = process.env.MAS_ASC_KEY_ID;
const pem = process.env.MAS_ASC_PRIVATE_KEY;
if (!/^[A-Z0-9]{10,20}$/.test(keyId || '') || !pem) throw new Error('Missing upload API credentials');
const key = createPrivateKey(pem);
if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1') throw new Error('Expected Apple P-256 key');
// Individual keys use sub=user, not the team's issuer. Xcode's CLI still
// requires the issuer argument; its individual-key mode ignores that placeholder.
// This is also the current fastlane AltoolTransporterExecutor convention.
const privateDir = mkdtempSync(resolve(tmpdir(), 'inklura-asc-'));
const privateFile = resolve(privateDir, `ApiKey_${keyId}.p8`);
const childEnv = { ...process.env };
delete childEnv.MAS_ASC_PRIVATE_KEY;
let result;
try {
  writeFileSync(privateFile, pem, { mode: 0o600 });
  result = spawnSync('xcrun', ['altool', mode === 'upload' ? '--upload-package' : '--validate-app', pkg,
    '--api-key', keyId, '--api-issuer', keyId, '--api-key-subject', 'user',
    '--p8-file-path', privateFile, '--output-format', 'json'], {
    env: childEnv, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 18 * 60 * 1000,
  });
} finally {
  rmSync(privateDir, { recursive: true, force: true });
}
// Never persist raw logs, PEM material or bearer tokens in artifacts.
const keyBody = pem.split('\n').filter(line => !line.startsWith('-----')).join('').trim();
for (const output of [result.stdout, result.stderr]) if (output) {
  process.stdout.write(output.replaceAll(pem, '[REDACTED]').replaceAll(keyBody, '[REDACTED]')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED-JWT]'));
}
if (result.error) throw new Error(`Xcode delivery failed (${result.error.code || 'process error'})`);
if (result.status !== 0) process.exit(result.status ?? 1);
const summary = `${mode === 'upload' ? 'Upload' : 'Validation'} completed for package ${actualHash}. Apple processing and App Review are separate steps.\n`;
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
