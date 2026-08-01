// Root Metro config so `expo start` works even when launched from the
// monorepo root (e.g. `npx expo start` in the project root). It points Metro at
// the mobile app, so module resolution (react, react-native, etc.) is correct
// for every screen — not just one file.
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = path.resolve(__dirname, 'apps/mobile');
const workspaceRoot = __dirname;

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;

module.exports = withNativeWind(config, {
  // Absolute paths: Metro is launched from the repo root, so relative paths
  // would resolve against the wrong directory.
  input: path.resolve(projectRoot, 'src/global.css'),
  configPath: path.resolve(projectRoot, 'tailwind.config.js'),
});
