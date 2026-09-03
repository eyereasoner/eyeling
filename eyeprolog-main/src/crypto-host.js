// Host adapters for library(crypto).
//
// The public compatibility surface lives in src/lib/crypto.pl.  Keep the
// runtime-specific cryptographic operations here so the Prolog module remains
// source-compatible with Scryer's library while Node's audited crypto backend
// performs the sensitive primitives.

import { isNode } from './platform.js';
import {
  ATOM, COMPOUND, NUMBER, VAR, atom, compound, copyResolved, deref,
  listFromItems, numberTerm, properListItems, unify,
} from './term.js';
import { PrologError } from './errors.js';

let nodeCrypto = null;
if (isNode) nodeCrypto = await import('node:crypto');

const HASH_ALGORITHMS = new Map([
  ['ripemd160', 'ripemd160'],
  ['sha256', 'sha256'],
  ['sha384', 'sha384'],
  ['sha512', 'sha512'],
  ['sha512_256', 'sha512-256'],
  ['sha3_224', 'sha3-224'],
  ['sha3_256', 'sha3-256'],
  ['sha3_384', 'sha3-384'],
  ['sha3_512', 'sha3-512'],
  ['blake2s256', 'blake2s256'],
  ['blake2b512', 'blake2b512'],
]);
const HMAC_ALGORITHMS = new Set(['sha256', 'sha384', 'sha512']);
const HKDF_ALGORITHMS = new Set(['sha256', 'sha384', 'sha512']);
const ED25519_PRIVATE_PREFIX = hexBuffer('302e020100300506032b657004220420');
const ED25519_PUBLIC_PREFIX = hexBuffer('302a300506032b6570032100');
const X25519_PRIVATE_PREFIX = hexBuffer('302e020100300506032b656e04220420');
const X25519_PUBLIC_PREFIX = hexBuffer('302a300506032b656e032100');
const SECP256K1_P = 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2fn;
const SECP256K1_N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
const SECP256K1_GX = 0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n;
const SECP256K1_GY = 0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n;

function hexBuffer(text) {
  if (typeof Buffer === 'undefined') return null;
  return Buffer.from(text, 'hex');
}

function requireCrypto() {
  if (!isNode || nodeCrypto == null || typeof Buffer === 'undefined') {
    throw new PrologError('resource_error(crypto)');
  }
  return nodeCrypto;
}

function listItems(term, env) {
  const value = deref(term, env);
  if (value.type === VAR) throw new PrologError('instantiation_error');
  const items = properListItems(value, env);
  if (items == null) throw new PrologError('type_error(list)', copyResolved(value, env));
  return items;
}

function characterListText(term, env, { octets = false, allowIntegers = false } = {}) {
  const items = listItems(term, env);
  let text = '';
  for (const itemTerm of items) {
    const item = deref(itemTerm, env);
    if (item.type === VAR) throw new PrologError('instantiation_error');
    if (allowIntegers && item.type === NUMBER && /^\d+$/.test(item.name)) {
      const code = Number(item.name);
      if (!Number.isInteger(code) || code < 0 || code > 255) {
        throw new PrologError('type_error(byte)', copyResolved(item, env));
      }
      text += String.fromCodePoint(code);
      continue;
    }
    if (item.type !== ATOM || Array.from(item.name).length !== 1) {
      throw new PrologError('type_error(character)', copyResolved(item, env));
    }
    const code = item.name.codePointAt(0);
    if (octets && code > 255) throw new PrologError('domain_error(octet_character)', copyResolved(item, env));
    text += item.name;
  }
  return text;
}

function bytesFromList(term, env, expectedLength = null) {
  const items = listItems(term, env);
  const bytes = [];
  for (const itemTerm of items) {
    const item = deref(itemTerm, env);
    if (item.type === VAR) throw new PrologError('instantiation_error');
    if (item.type !== NUMBER || !/^\d+$/.test(item.name)) {
      throw new PrologError('type_error(integer)', copyResolved(item, env));
    }
    const value = Number(item.name);
    if (!Number.isInteger(value) || value < 0 || value > 255) {
      throw new PrologError('type_error(byte)', copyResolved(item, env));
    }
    bytes.push(value);
  }
  if (expectedLength != null && bytes.length !== expectedLength) {
    throw new PrologError('domain_error(byte_length)', copyResolved(term, env));
  }
  return typeof Buffer === 'undefined' ? Uint8Array.from(bytes) : Buffer.from(bytes);
}

function byteChars(term, env, expectedLength = null) {
  const text = characterListText(term, env, { octets: true });
  const bytes = Buffer.from(Array.from(text, (ch) => ch.codePointAt(0)));
  if (expectedLength != null && bytes.length !== expectedLength) {
    throw new PrologError('domain_error(byte_length)', copyResolved(term, env));
  }
  return bytes;
}

function charsTerm(text) {
  return listFromItems(Array.from(String(text), atom));
}

function byteCharsTerm(bytes) {
  return listFromItems(Array.from(bytes, (value) => atom(String.fromCodePoint(value))));
}

function byteListTerm(bytes) {
  return listFromItems(Array.from(bytes, (value) => numberTerm(value)));
}

function optionsList(term, env) {
  const options = listItems(term, env).map((item) => deref(item, env));
  if (options.some((option) => option.type === VAR)) throw new PrologError('instantiation_error');
  return options;
}

function findOption(options, name) {
  return options.find((option) => option.type === COMPOUND && option.name === name && option.arity === 1) ?? null;
}

function atomOption(options, name, env, fallback, allowed, next = null, bindVariableToDefault = false) {
  const option = findOption(options, name);
  if (option == null) return fallback;
  const value = deref(option.args[0], env);
  if (value.type === VAR) {
    if (!bindVariableToDefault) throw new PrologError('instantiation_error');
    if (next != null && !unify(option.args[0], atom(fallback), next)) return null;
    return fallback;
  }
  if (value.type !== ATOM) throw new PrologError('type_error(atom)', copyResolved(value, env));
  if (allowed != null && !allowed.has(value.name)) {
    throw new PrologError(`domain_error(${name})`, copyResolved(value, env));
  }
  return value.name;
}

function integerTermValue(term, env) {
  const value = deref(term, env);
  if (value.type === VAR) throw new PrologError('instantiation_error');
  if (value.type !== NUMBER || !/^-?\d+$/.test(value.name)) {
    throw new PrologError('type_error(integer)', copyResolved(value, env));
  }
  return BigInt(value.name);
}

function smallInteger(term, env, { min = null, max = null } = {}) {
  const value = integerTermValue(term, env);
  if (min != null && value < BigInt(min)) throw new PrologError('domain_error(not_less_than_zero)', copyResolved(term, env));
  if (max != null && value > BigInt(max)) throw new PrologError('representation_error(max_integer)', copyResolved(term, env));
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new PrologError('representation_error(max_integer)', copyResolved(term, env));
  return number;
}

function encodingBytes(term, env, encoding) {
  if (encoding === 'octet') {
    const text = characterListText(term, env, { octets: true, allowIntegers: true });
    return Buffer.from(Array.from(text, (ch) => ch.codePointAt(0)));
  }
  const text = characterListText(term, env);
  return Buffer.from(text, 'utf8');
}

function flexibleBytes(term, env) {
  const items = listItems(term, env);
  if (items.every((itemTerm) => {
    const item = deref(itemTerm, env);
    return item.type === NUMBER && /^\d+$/.test(item.name) && Number(item.name) >= 0 && Number(item.name) <= 255;
  })) return bytesFromList(term, env);
  return Buffer.from(characterListText(term, env), 'utf8');
}

function hexText(bytes) {
  return Array.from(bytes, (value) => Number(value).toString(16).padStart(2, '0')).join('');
}

function decodeHex(term, env) {
  const text = characterListText(term, env);
  if (text.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(text)) {
    throw new PrologError('domain_error(hex_encoding)', copyResolved(term, env));
  }
  const values = [];
  for (let index = 0; index < text.length; index += 2) values.push(Number.parseInt(text.slice(index, index + 2), 16));
  return typeof Buffer === 'undefined' ? Uint8Array.from(values) : Buffer.from(values);
}

function bindResult(target, value, env) {
  const next = env.clone();
  return unify(target, value, next) ? next : null;
}

function* hexBytesBuiltin({ goal, env }) {
  const hex = deref(goal.args[0], env);
  if (hex.type !== VAR) {
    const bytes = decodeHex(goal.args[0], env);
    const next = bindResult(goal.args[1], byteListTerm(bytes), env);
    if (next) yield next;
    return;
  }
  const bytes = bytesFromList(goal.args[1], env);
  const next = bindResult(goal.args[0], charsTerm(hexText(bytes)), env);
  if (next) yield next;
}

function* randomBytesBuiltin({ goal, env }) {
  const length = smallInteger(goal.args[0], env, { min: 0, max: 0x7fffffff });
  let bytes;
  if (isNode && nodeCrypto != null) bytes = nodeCrypto.randomBytes(length);
  else if (globalThis.crypto?.getRandomValues != null) {
    bytes = new Uint8Array(length);
    // Web Crypto limits one getRandomValues() request to 65536 bytes.
    for (let offset = 0; offset < bytes.length; offset += 65536) {
      globalThis.crypto.getRandomValues(bytes.subarray(offset, Math.min(bytes.length, offset + 65536)));
    }
  } else {
    throw new PrologError('resource_error(crypto)');
  }
  const next = bindResult(goal.args[1], byteListTerm(bytes), env);
  if (next) yield next;
}

function* dataHashBuiltin({ goal, env }) {
  const crypto = requireCrypto();
  const options = optionsList(goal.args[2], env);
  const next = env.clone();
  const algorithm = atomOption(options, 'algorithm', env, 'sha256', new Set(HASH_ALGORITHMS.keys()), next, true);
  if (algorithm == null) return;
  const encoding = atomOption(options, 'encoding', env, 'utf8', new Set(['utf8', 'octet']));
  const data = encodingBytes(goal.args[0], env, encoding);
  const hmac = findOption(options, 'hmac');
  let digest;
  if (hmac != null) {
    if (!HMAC_ALGORITHMS.has(algorithm)) {
      throw new PrologError('domain_error(hmac_algorithm)', atom(algorithm));
    }
    const key = bytesFromList(hmac.args[0], env);
    digest = crypto.createHmac(HASH_ALGORITHMS.get(algorithm), key).update(data).digest();
    const hashValue = deref(goal.args[1], env);
    if (hashValue.type !== VAR) {
      const expected = decodeHex(goal.args[1], env);
      if (expected.length !== digest.length || !crypto.timingSafeEqual(expected, digest)) return;
      yield next;
      return;
    }
  } else {
    digest = crypto.createHash(HASH_ALGORITHMS.get(algorithm)).update(data).digest();
  }
  if (unify(goal.args[1], charsTerm(hexText(digest)), next)) yield next;
}

function* hkdfBuiltin({ goal, env }) {
  const crypto = requireCrypto();
  const options = optionsList(goal.args[3], env);
  const next = env.clone();
  const algorithm = atomOption(options, 'algorithm', env, 'sha256', HKDF_ALGORITHMS, next, true);
  if (algorithm == null) return;
  const encoding = atomOption(options, 'encoding', env, 'utf8', new Set(['utf8', 'octet']));
  const length = smallInteger(goal.args[1], env, { min: 0, max: 0x7fffffff });
  const data = encodingBytes(goal.args[0], env, encoding);
  const saltOption = findOption(options, 'salt');
  const salt = saltOption == null ? Buffer.alloc(0) : bytesFromList(saltOption.args[0], env);
  const infoOption = findOption(options, 'info');
  const info = infoOption == null ? Buffer.alloc(0) : flexibleBytes(infoOption.args[0], env);
  let derived;
  try { derived = Buffer.from(crypto.hkdfSync(HASH_ALGORITHMS.get(algorithm), data, salt, info, length)); }
  catch { throw new PrologError('resource_error(crypto)'); }
  if (unify(goal.args[2], byteListTerm(derived), next)) yield next;
}

function passwordBytes(term, env) {
  return flexibleBytes(term, env);
}

function base64NoPadding(bytes) {
  return Buffer.from(bytes).toString('base64').replace(/=+$/u, '');
}

function decodeBase64NoPadding(text) {
  if (!/^[A-Za-z0-9+/]*$/u.test(text)) return null;
  try { return Buffer.from(text, 'base64'); } catch { return null; }
}

function passwordHashString(password, salt, iterations, crypto) {
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha512');
  return `$pbkdf2-sha512$t=${iterations}$${base64NoPadding(salt)}$${base64NoPadding(hash)}`;
}

function* passwordHash2Builtin({ goal, env }) {
  const crypto = requireCrypto();
  const password = passwordBytes(goal.args[0], env);
  const hashValue = deref(goal.args[1], env);
  if (hashValue.type === VAR) {
    const salt = crypto.randomBytes(16);
    const output = passwordHashString(password, salt, 2 ** 17, crypto);
    const next = bindResult(goal.args[1], charsTerm(output), env);
    if (next) yield next;
    return;
  }
  const encoded = characterListText(goal.args[1], env);
  const match = /^\$pbkdf2-sha512\$t=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/u.exec(encoded);
  if (!match) return;
  const iterations = Number(match[1]);
  if (!Number.isSafeInteger(iterations) || iterations <= 0) return;
  const salt = decodeBase64NoPadding(match[2]);
  const expected = decodeBase64NoPadding(match[3]);
  if (salt == null || expected == null) return;
  const actual = crypto.pbkdf2Sync(password, salt, iterations, expected.length, 'sha512');
  if (actual.length === expected.length && crypto.timingSafeEqual(actual, expected)) yield env;
}

function* passwordHash3Builtin({ goal, env }) {
  const crypto = requireCrypto();
  const password = passwordBytes(goal.args[0], env);
  const options = optionsList(goal.args[2], env);
  const algorithmOption = findOption(options, 'algorithm');
  if (algorithmOption != null) {
    const algorithm = deref(algorithmOption.args[0], env);
    if (algorithm.type === VAR) {
      // Scryer's option/3 call unifies this variable with its only supported algorithm.
    } else if (algorithm.type !== ATOM || algorithm.name !== 'pbkdf2-sha512') {
      throw new PrologError('domain_error(password_hash_algorithm)', copyResolved(algorithm, env));
    }
  }
  const costOption = findOption(options, 'cost');
  const cost = costOption == null ? 17 : smallInteger(costOption.args[0], env, { min: 0, max: 30 });
  const iterations = 2 ** cost;
  const saltOption = findOption(options, 'salt');
  const salt = saltOption == null ? crypto.randomBytes(16) : bytesFromList(saltOption.args[0], env);
  const output = passwordHashString(password, salt, iterations, crypto);
  const next = env.clone();
  if (algorithmOption != null && deref(algorithmOption.args[0], env).type === VAR &&
      !unify(algorithmOption.args[0], atom('pbkdf2-sha512'), next)) return;
  if (unify(goal.args[1], charsTerm(output), next)) yield next;
}

function chachaInputs(goal, env, options, decrypt = false) {
  const algorithm = deref(goal.args[1], env);
  if (algorithm.type === VAR) throw new PrologError('instantiation_error');
  if (algorithm.type !== ATOM) throw new PrologError('type_error(atom)', copyResolved(algorithm, env));
  if (algorithm.name !== 'chacha20-poly1305') {
    throw new PrologError('domain_error(chacha20-poly1305)', copyResolved(algorithm, env));
  }
  const key = bytesFromList(goal.args[2], env, 32);
  const iv = bytesFromList(goal.args[3], env, 12);
  const encoding = atomOption(options, 'encoding', env, 'utf8', new Set(['utf8', 'octet']));
  const aadOption = findOption(options, 'aad');
  const aad = aadOption == null ? Buffer.alloc(0) : encodingBytes(aadOption.args[0], env, encoding);
  const tagOption = findOption(options, 'tag');
  let tag = null;
  if (decrypt) {
    if (tagOption == null) tag = Buffer.alloc(0);
    else tag = bytesFromList(tagOption.args[0], env);
    if (tag.length !== 16) throw new PrologError('domain_error(authentication_tag)');
  } else if (tagOption != null && deref(tagOption.args[0], env).type !== VAR) {
    bytesFromList(tagOption.args[0], env, 16);
  }
  return { key, iv, encoding, aad, tagOption, tag };
}

function* encryptBuiltin({ goal, env }) {
  const crypto = requireCrypto();
  const options = optionsList(goal.args[5], env);
  const { key, iv, encoding, aad, tagOption } = chachaInputs(goal, env, options, false);
  const plain = encodingBytes(goal.args[0], env, encoding);
  let cipher, ciphertext, tag;
  try {
    cipher = crypto.createCipheriv('chacha20-poly1305', key, iv, { authTagLength: 16 });
    if (aad.length) cipher.setAAD(aad, { plaintextLength: plain.length });
    ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
    tag = cipher.getAuthTag();
  } catch { throw new PrologError('resource_error(crypto)'); }
  const next = env.clone();
  if (tagOption != null && !unify(tagOption.args[0], byteListTerm(tag), next)) return;
  if (unify(goal.args[4], byteCharsTerm(ciphertext), next)) yield next;
}

function* decryptBuiltin({ goal, env }) {
  const crypto = requireCrypto();
  const options = optionsList(goal.args[5], env);
  const { key, iv, encoding, aad, tag } = chachaInputs(goal, env, options, true);
  const ciphertext = byteChars(goal.args[0], env);
  let plain;
  try {
    const decipher = crypto.createDecipheriv('chacha20-poly1305', key, iv, { authTagLength: 16 });
    if (aad.length) decipher.setAAD(aad, { plaintextLength: ciphertext.length });
    decipher.setAuthTag(tag);
    plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch { return; }
  let result;
  if (encoding === 'octet') result = byteCharsTerm(plain);
  else {
    let text;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(plain); }
    catch { throw new PrologError('representation_error(character_code)'); }
    result = charsTerm(text);
  }
  const next = bindResult(goal.args[4], result, env);
  if (next) yield next;
}

function ed25519PrivateKey(seed) {
  const crypto = requireCrypto();
  return crypto.createPrivateKey({ key: Buffer.concat([ED25519_PRIVATE_PREFIX, seed]), format: 'der', type: 'pkcs8' });
}

function ed25519PublicFromSeed(seed) {
  const crypto = requireCrypto();
  const der = crypto.createPublicKey(ed25519PrivateKey(seed)).export({ format: 'der', type: 'spki' });
  return Buffer.from(der).subarray(-32);
}

function ed25519Pair(seed) {
  const publicKey = ed25519PublicFromSeed(seed);
  return Buffer.concat([
    Buffer.from([0x30, 81, 2, 1, 1, 0x30, 5, 6, 3, 43, 101, 112, 4, 34, 4, 32]),
    seed,
    Buffer.from([0x81, 33, 0]),
    publicKey,
  ]);
}

function* edSeedPairBuiltin({ goal, env }) {
  requireCrypto();
  const seed = bytesFromList(goal.args[0], env, 32);
  const next = bindResult(goal.args[1], byteCharsTerm(ed25519Pair(seed)), env);
  if (next) yield next;
}

function* edNewPairBuiltin({ goal, env }) {
  const crypto = requireCrypto();
  const next = bindResult(goal.args[0], byteCharsTerm(ed25519Pair(crypto.randomBytes(32))), env);
  if (next) yield next;
}

function* edPublicBuiltin({ goal, env }) {
  const pair = byteChars(goal.args[0], env);
  if (pair.length < 32) throw new PrologError('domain_error(ed25519_keypair)', copyResolved(goal.args[0], env));
  const next = bindResult(goal.args[1], byteCharsTerm(pair.subarray(pair.length - 32)), env);
  if (next) yield next;
}

function dataEncodingOption(options, env) {
  return atomOption(options, 'encoding', env, 'utf8', new Set(['utf8', 'octet']));
}

function* edSignBuiltin({ goal, env }) {
  const crypto = requireCrypto();
  const pair = byteChars(goal.args[0], env);
  if (pair.length < 48) throw new PrologError('domain_error(ed25519_keypair)', copyResolved(goal.args[0], env));
  const seed = pair.subarray(16, 48);
  const options = optionsList(goal.args[3], env);
  const data = encodingBytes(goal.args[1], env, dataEncodingOption(options, env));
  let signature;
  try { signature = crypto.sign(null, data, ed25519PrivateKey(seed)); }
  catch { throw new PrologError('resource_error(crypto)'); }
  const next = bindResult(goal.args[2], charsTerm(hexText(signature)), env);
  if (next) yield next;
}

function* edVerifyBuiltin({ goal, env }) {
  const crypto = requireCrypto();
  const publicKey = byteChars(goal.args[0], env, 32);
  const options = optionsList(goal.args[3], env);
  const data = encodingBytes(goal.args[1], env, dataEncodingOption(options, env));
  const signature = decodeHex(goal.args[2], env);
  if (signature.length !== 64) return;
  let ok;
  try {
    const key = crypto.createPublicKey({ key: Buffer.concat([ED25519_PUBLIC_PREFIX, publicKey]), format: 'der', type: 'spki' });
    ok = crypto.verify(null, data, key, signature);
  } catch { throw new PrologError('resource_error(crypto)'); }
  if (ok) yield env;
}

function* curve25519GeneratorBuiltin({ goal, env }) {
  const bytes = new Uint8Array(32); bytes[0] = 9;
  const next = bindResult(goal.args[0], byteCharsTerm(bytes), env);
  if (next) yield next;
}

function scalar25519Bytes(term, env) {
  const value = deref(term, env);
  if (value.type === NUMBER && /^\d+$/.test(value.name)) {
    let scalar = BigInt(value.name);
    if (scalar < 0n || scalar >= (1n << 256n)) throw new PrologError('domain_error(curve25519_scalar)', copyResolved(value, env));
    const bytes = Buffer.alloc(32);
    for (let index = 0; index < 32; index++) {
      bytes[index] = Number(scalar & 255n);
      scalar >>= 8n;
    }
    return bytes;
  }
  return bytesFromList(term, env, 32);
}

function* curve25519MultBuiltin({ goal, env }) {
  const crypto = requireCrypto();
  const scalar = scalar25519Bytes(goal.args[0], env);
  const point = byteChars(goal.args[1], env, 32);
  let result;
  try {
    const privateKey = crypto.createPrivateKey({ key: Buffer.concat([X25519_PRIVATE_PREFIX, scalar]), format: 'der', type: 'pkcs8' });
    const publicKey = crypto.createPublicKey({ key: Buffer.concat([X25519_PUBLIC_PREFIX, point]), format: 'der', type: 'spki' });
    result = crypto.diffieHellman({ privateKey, publicKey });
  } catch { return; }
  const next = bindResult(goal.args[2], byteCharsTerm(result), env);
  if (next) yield next;
}

function mod(value, modulus) {
  const result = value % modulus;
  return result >= 0n ? result : result + modulus;
}

function modPow(base, exponent, modulus) {
  let result = 1n, factor = mod(base, modulus), power = exponent;
  while (power > 0n) {
    if (power & 1n) result = mod(result * factor, modulus);
    factor = mod(factor * factor, modulus);
    power >>= 1n;
  }
  return result;
}

function modInverse(value, modulus) {
  const normalized = mod(value, modulus);
  if (normalized === 0n) throw new Error('inverse of zero');
  return modPow(normalized, modulus - 2n, modulus);
}

function secpAdd(left, right) {
  if (left == null) return right;
  if (right == null) return left;
  const [x1, y1] = left, [x2, y2] = right;
  if (x1 === x2 && mod(y1 + y2, SECP256K1_P) === 0n) return null;
  let slope;
  if (x1 === x2 && y1 === y2) {
    slope = mod((3n * x1 * x1) * modInverse(2n * y1, SECP256K1_P), SECP256K1_P);
  } else {
    slope = mod((y2 - y1) * modInverse(x2 - x1, SECP256K1_P), SECP256K1_P);
  }
  const x3 = mod(slope * slope - x1 - x2, SECP256K1_P);
  const y3 = mod(slope * (x1 - x3) - y1, SECP256K1_P);
  return [x3, y3];
}

function secpMultiply(scalar, point) {
  let n = mod(scalar, SECP256K1_N), addend = point, result = null;
  while (n > 0n) {
    if (n & 1n) result = secpAdd(result, addend);
    addend = secpAdd(addend, addend);
    n >>= 1n;
  }
  return result;
}

function pointTerm(term, env) {
  const value = deref(term, env);
  if (value.type !== COMPOUND || value.name !== 'point' || value.arity !== 2) {
    throw new PrologError('type_error(point)', copyResolved(value, env));
  }
  return [integerTermValue(value.args[0], env), integerTermValue(value.args[1], env)];
}

function secpCurveName(term, env) {
  const value = deref(term, env);
  if (value.type !== COMPOUND || value.name !== 'curve' || value.arity !== 8) {
    throw new PrologError('type_error(curve)', copyResolved(value, env));
  }
  const name = deref(value.args[0], env);
  if (name.type !== ATOM || name.name !== 'secp256k1') {
    throw new PrologError('domain_error(elliptic_curve)', copyResolved(value, env));
  }
}

function* curveScalarMultBuiltin({ goal, env }) {
  secpCurveName(goal.args[0], env);
  const scalar = integerTermValue(goal.args[1], env);
  if (scalar <= 0n) throw new PrologError('domain_error(not_less_than_one)', copyResolved(goal.args[1], env));
  const point = pointTerm(goal.args[2], env);
  const [x, y] = point;
  if (x < 0n || x >= SECP256K1_P || y < 0n || y >= SECP256K1_P ||
      mod(y * y - (x * x * x + 7n), SECP256K1_P) !== 0n) {
    throw new PrologError('domain_error(point_on_curve)', copyResolved(goal.args[2], env));
  }
  const result = secpMultiply(scalar, point);
  if (result == null) throw new PrologError('domain_error(point_at_infinity)');
  const next = bindResult(goal.args[3], compound('point', [numberTerm(result[0]), numberTerm(result[1])]), env);
  if (next) yield next;
}

export const cryptoHostBuiltins = {
  register(registry) {
    registry.add('eyeprolog__hex_bytes', 2, hexBytesBuiltin, { deterministic: true, eyePrologLibrary: true });
    registry.add('eyeprolog__crypto_n_random_bytes', 2, randomBytesBuiltin, { deterministic: true, eyePrologLibrary: true });
    registry.add('eyeprolog__crypto_data_hash', 3, dataHashBuiltin, { deterministic: true, eyePrologLibrary: true });
    registry.add('eyeprolog__crypto_data_hkdf', 4, hkdfBuiltin, { deterministic: true, eyePrologLibrary: true });
    registry.add('eyeprolog__crypto_password_hash', 2, passwordHash2Builtin, { deterministic: true, eyePrologLibrary: true });
    registry.add('eyeprolog__crypto_password_hash', 3, passwordHash3Builtin, { deterministic: true, eyePrologLibrary: true });
    registry.add('eyeprolog__crypto_data_encrypt', 6, encryptBuiltin, { deterministic: true, eyePrologLibrary: true });
    registry.add('eyeprolog__crypto_data_decrypt', 6, decryptBuiltin, { deterministic: true, eyePrologLibrary: true });
    registry.add('eyeprolog__ed25519_seed_keypair', 2, edSeedPairBuiltin, { deterministic: true, eyePrologLibrary: true });
    registry.add('eyeprolog__ed25519_new_keypair', 1, edNewPairBuiltin, { deterministic: true, eyePrologLibrary: true });
    registry.add('eyeprolog__ed25519_keypair_public_key', 2, edPublicBuiltin, { deterministic: true, eyePrologLibrary: true });
    registry.add('eyeprolog__ed25519_sign', 4, edSignBuiltin, { deterministic: true, eyePrologLibrary: true });
    registry.add('eyeprolog__ed25519_verify', 4, edVerifyBuiltin, { deterministic: true, eyePrologLibrary: true });
    registry.add('eyeprolog__curve25519_generator', 1, curve25519GeneratorBuiltin, { deterministic: true, eyePrologLibrary: true });
    registry.add('eyeprolog__curve25519_scalar_mult', 3, curve25519MultBuiltin, { deterministic: true, eyePrologLibrary: true });
    registry.add('eyeprolog__crypto_curve_scalar_mult', 4, curveScalarMultBuiltin, { deterministic: true, eyePrologLibrary: true });
  },
};
