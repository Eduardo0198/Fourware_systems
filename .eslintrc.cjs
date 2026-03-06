module.exports = {
  env: { browser: true, es2022: true },
  extends: ['airbnb-base'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {
    'no-alert': 'off',
  },
};
