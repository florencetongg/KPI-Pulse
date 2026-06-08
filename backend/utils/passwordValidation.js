const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

function isStrongPassword(password) {
  return PASSWORD_REGEX.test(password);
}

module.exports = {
  PASSWORD_REGEX,
  isStrongPassword,
};
