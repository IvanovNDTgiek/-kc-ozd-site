import crypto from 'crypto';

var SCRYPT_OPTS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

/**
 * @param {string} plain
 * @returns {{ salt: string; hash: string }}
 */
export function hashPassword(plain) {
  var salt = crypto.randomBytes(16);
  var hash = crypto.scryptSync(String(plain), salt, 64, SCRYPT_OPTS);
  return { salt: salt.toString('hex'), hash: hash.toString('hex') };
}

/**
 * @param {string} plain
 * @param {string} saltHex
 * @param {string} hashHex
 * @returns {boolean}
 */
export function verifyPassword(plain, saltHex, hashHex) {
  try {
    var salt = Buffer.from(saltHex, 'hex');
    var expected = Buffer.from(hashHex, 'hex');
    if (salt.length !== 16 || expected.length !== 64) {
      return false;
    }
    var actual = crypto.scryptSync(String(plain), salt, 64, SCRYPT_OPTS);
    return crypto.timingSafeEqual(actual, expected);
  } catch (e) {
    return false;
  }
}
