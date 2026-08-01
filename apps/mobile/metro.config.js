const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");
const fs = require("fs");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.disableHierarchicalLookup = true;

// Force a single, always-resolvable copy of react (monorepo-safe).
const reactTarget = [
  path.resolve(projectRoot, "node_modules", "react"),
  path.resolve(workspaceRoot, "node_modules", "react"),
].find((p) => fs.existsSync(p));
if (reactTarget) {
  config.resolver.extraNodeModules = {
    ...(config.resolver.extraNodeModules || {}),
    react: reactTarget,
  };
}

module.exports = withNativeWind(config, { input: "./src/global.css" });
