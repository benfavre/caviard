// Upload only the reviewed universal package. Never rebuild or submit for review.
// Apple docs: https://help.apple.com/itc/transporteruserguide/en.lproj/static.html
// JWT: https://developer.apple.com/documentation/appstoreconnectapi/generating-tokens-for-api-requests
import { createHash, createPrivateKey, sign } from 'node:crypto';
import { readFileSync, existsSync, appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const mode = process.argv[2] || 'inspect';
if (!['inspect', 'verify', 'upload'].includes(mode)) throw new Error('Expected inspect, verify or upload');
const root = resolve(process.argv[3] || 'source-mas-package');
const expectedHash = '0a71ef96960ed0d0efbd96a43f0e60fbe4d1fa776edadb3e7b314c0eea157771';
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
const xcode = spawnSync('xcode-select', ['-p'], { encoding: 'utf8' }).stdout?.trim();
const transporter = [
  '/usr/local/itms/bin/iTMSTransporter',
  '/Applications/Transporter.app/Contents/itms/bin/iTMSTransporter',
  xcode && `${xcode}/../SharedFrameworks/ContentDeliveryServices.framework/Versions/A/itms/bin/iTMSTransporter`,
  xcode && `${xcode}/Applications/Application Loader.app/Contents/itms/bin/iTMSTransporter`,
].find(p => p && existsSync(p));
if (!transporter) throw new Error('Apple Transporter is not installed');
if (mode === 'inspect') {
  const result = spawnSync(transporter, ['-version'], { stdio: 'inherit' });
  process.exit(result.status ?? 1);
}
const keyId = process.env.MAS_ASC_KEY_ID;
const pem = process.env.MAS_ASC_PRIVATE_KEY;
if (!/^[A-Z0-9]{10}$/.test(keyId || '') || !pem) throw new Error('Missing upload API credentials');
const key = createPrivateKey(pem);
if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1') throw new Error('Expected Apple P-256 key');
const now = Math.floor(Date.now() / 1000);
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const unsigned = `${encode({ alg: 'ES256', kid: keyId, typ: 'JWT' })}.${encode({ sub: 'user', iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' })}`;
const token = `${unsigned}.${sign('sha256', Buffer.from(unsigned), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
if (process.env.GITHUB_ACTIONS === 'true') console.log(`::add-mask::${token}`);
// Remove the private key from the child environment; Transporter only needs JWT.
const childEnv = { ...process.env };
delete childEnv.MAS_ASC_PRIVATE_KEY;
const result = spawnSync(transporter, ['-m', mode, '-assetFile', pkg, '-jwt', token, '-v', 'informational'], {
  env: childEnv, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 18 * 60 * 1000,
});
// Do not persist raw logs or credentials in artifacts.
for (const output of [result.stdout, result.stderr]) if (output) process.stdout.write(output.replaceAll(token, '[REDACTED]').replaceAll(pem, '[REDACTED]'));
if (result.error) throw new Error(`Transporter failed (${result.error.code || 'process error'})`);
if (result.status !== 0) process.exit(result.status ?? 1);
const summary = `${mode === 'upload' ? 'Upload' : 'Validation'} completed for package ${actualHash}. Apple processing and App Review are separate steps.\n`;
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
