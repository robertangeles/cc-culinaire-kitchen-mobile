// Loaded by jest BEFORE test/setup code (see jest.config.js setupFiles).
// Mirrors what `expo` and `expo lint` do automatically — populates
// process.env from .env so contract tests (and any future test that
// reads env) can pick up CONTRACT_TEST_EMAIL, CONTRACT_TEST_PASSWORD,
// EXPO_PUBLIC_*, etc.
require('dotenv').config();
