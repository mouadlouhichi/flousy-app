const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.disableHierarchicalLookup = true;

// Bulletproof fallback: force bare modules (react, etc.) to resolve from the
// hoisted workspace node_modules.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  try {
    return context.resolveRequest(context, moduleName, platform);
  } catch (err) {
    const isBare =
      typeof moduleName === "string" &&
      !moduleName.startsWith(".") &&
      !moduleName.startsWith("/") &&
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

module.exports = withNativeWind(config, { input: "./src/global.css" });
