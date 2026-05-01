// Loaded by jest BEFORE test/setup code (see jest.config.js setupFiles).
// Mirrors what `expo` and `expo lint` do automatically — populates
// process.env from .env so any test that reads env (EXPO_PUBLIC_*,
// future opt-in test creds, etc.) sees the same values the app does.
require('dotenv').config();
