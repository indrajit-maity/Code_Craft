import { generateKeyPairSync } from 'node:crypto';
import { chmodSync, copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

const ENV_PATH = '../.env';
const force = process.argv.includes('--force');

if (!existsSync(ENV_PATH)) {
  if (existsSync('.env.example')) copyFileSync('.env.example', ENV_PATH);
  else writeFileSync(ENV_PATH, '');
}

let content = readFileSync(ENV_PATH, 'utf8');

const hasValue = (name: string) => new RegExp(`^${name}=.+$`, 'm').test(content);

if (!force && (hasValue('JWT_PRIVATE_KEY_B64') || hasValue('JWT_PUBLIC_KEY_B64'))) {
  console.log('Keys already exist in .env, nothing changed.');
  console.log('To replace them run: npm run keys -- --force  (this invalidates all issued access tokens)');
  process.exit(0);
}

const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 3072,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const b64 = (s: string) => Buffer.from(s).toString('base64');

function setVar(name: string, value: string) {
  const re = new RegExp(`^${name}=.*$`, 'm');
  content = re.test(content)
    ? content.replace(re, () => `${name}=${value}`)
    : content.replace(/\n*$/, '\n') + `${name}=${value}\n`;
}

setVar('JWT_PRIVATE_KEY_B64', b64(privateKey));
setVar('JWT_PUBLIC_KEY_B64', b64(publicKey));

writeFileSync(ENV_PATH, content);
chmodSync(ENV_PATH, 0o600);

console.log(force ? 'Keys replaced in .env' : 'Keys written to .env');