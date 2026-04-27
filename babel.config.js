module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Drizzle Expo SQLite migrations — turns `import sql from './x.sql'`
      // into `const sql = "<file contents>"` at build time. Required because
      // `metro.config.js` adds `.sql` to sourceExts; without this transform
      // Babel tries to parse the SQL as JavaScript and throws.
      ['inline-import', { extensions: ['.sql'] }],
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './src',
            '@app': './app',
            '@assets': './assets',
          },
        },
      ],
      'react-native-worklets/plugin',
    ],
  };
};
