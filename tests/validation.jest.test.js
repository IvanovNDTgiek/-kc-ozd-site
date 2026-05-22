import { describe, test, expect } from '@jest/globals';
import { validateEmail, validatePhoneOptional, validatePersonName, validateRequiredText, validatePassword, validateDisplayName } from '../js/modules/validation.js';

describe('validation', () => {
  test('validateEmail accepts common form', () => {
    expect(validateEmail('user@example.com')).toBe(true);
  });
  test('validateEmail rejects invalid', () => {
    expect(validateEmail('not-an-email')).toBe(false);
    expect(validateEmail('')).toBe(false);
  });
  test('validatePhoneOptional', () => {
    expect(validatePhoneOptional('')).toBe(true);
    expect(validatePhoneOptional('+79001234567')).toBe(true);
    expect(validatePhoneOptional('12')).toBe(false);
  });
  test('validatePersonName', () => {
    expect(validatePersonName('Иван')).toBe(true);
    expect(validatePersonName('   ')).toBe(false);
  });
  test('validateRequiredText', () => {
    expect(validateRequiredText('ok', 10)).toBe(true);
    expect(validateRequiredText('', 10)).toBe(false);
  });
  test('validatePassword', () => {
    expect(validatePassword('Password1')).toBe(true);
    expect(validatePassword('nodigits')).toBe(false);
    expect(validatePassword('12345678')).toBe(false);
  });
  test('validateDisplayName', () => {
    expect(validateDisplayName('Мария')).toBe(true);
    expect(validateDisplayName('Ivan')).toBe(true);
    expect(validateDisplayName('x')).toBe(false);
    expect(validateDisplayName('Иван1')).toBe(false);
    expect(validateDisplayName('Иван Петр')).toBe(false);
  });
});
