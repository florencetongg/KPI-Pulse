const { isStrongPassword } = require('../utils/passwordValidation');

describe('reset-password strength check (UT-10 to UT-11)', () => {
  test('UT-10: accepts strong password FirstName123@', () => {
    expect(isStrongPassword('FirstName123@')).toBe(true);
  });

  test('UT-11: rejects weak password abc', () => {
    expect(isStrongPassword('abc')).toBe(false);
  });
});
