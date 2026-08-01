// Root Metro config so `expo start` works even when launched from the
// monorepo root. It points Metro at the mobile app and forces module resolution
// (react, react-native, expo-*, etc.) to resolve from the hoisted node_modules,
// so nothing can fail with "Unable to resolve 'react'".
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

// Bulletproof fallback: if Metro's default lookup can't find a bare module,
// resolve it from the mobile app / hoisted workspace node_modules via Node.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  try {
    return context.resolveRequest(context, moduleName, platform);
  } catch (err) {
    const isBare =
      typeof moduleName === 'string' &&
      !moduleName.startsWith('.') &&
      !moduleName.startsWith('/') &&
      /^[a-zA-Z@]/.test(moduleName);
    if (isBare) {
      try {
        const abs = require.resolve(moduleName, { paths: [projectRoot, workspaceRoot] });
        return { filePath: abs };
      } catch (_) {}
    }
    throw err;
  }
};

module.exports = withNativeWind(config, {
  input: path.resolve(projectRoot, 'src/global.css'),
  configPath: path.resolve(projectRoot, 'tailwind.config.js'),
});
