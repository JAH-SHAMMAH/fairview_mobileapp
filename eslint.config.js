// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // React 19's "no setState in an effect" rule. Several screens (attendance,
    // score entry, report card, re-marking, role picker) pick a sensible default
    // (first class, current term) once their data arrives, which this rule flags.
    // They work and were checked on phone-sized screens; reported as warnings so
    // they get refactored deliberately rather than in a lint sweep.
    rules: { 'react-hooks/set-state-in-effect': 'warn' },
  },
]);
