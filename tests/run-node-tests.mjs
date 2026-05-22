import assert from 'node:assert/strict';
import {
  validateEmail,
  validatePhoneOptional,
  validatePersonName,
  validateRequiredText,
  validatePassword,
  validateDisplayName,
} from '../js/modules/validation.js';

assert.equal(validateEmail('user@example.com'), true);
assert.equal(validateEmail('bad'), false);
assert.equal(validatePhoneOptional(''), true);
assert.equal(validatePhoneOptional('+7 (900) 000-00-00'), true);
assert.equal(validatePhoneOptional('12'), false);
assert.equal(validatePersonName('Иван'), true);
assert.equal(validateRequiredText('hello', 10), true);
assert.equal(validatePassword('Abc12345'), true);
assert.equal(validatePassword('short1'), false);
assert.equal(validateDisplayName('Иван'), true);
assert.equal(validateDisplayName('A'), false);
assert.equal(validateDisplayName('Иван2'), false);
assert.equal(validateDisplayName('Иван-Пётр'), false);

process.stdout.write('run-node-tests: all passed\n');
