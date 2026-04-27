// Learn more https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Allow Drizzle migration .sql files to be bundled by Metro.
config.resolver.sourceExts.push('sql');

module.exports = config;
