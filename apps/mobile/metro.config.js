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

const defaultResolveRequest = config.resolver.resolveRequest;

// Workspace fallback: if Metro cannot find a bare import, resolve it from the
// hoisted root. The returned object MUST include `type: 'sourceFile'` or Metro
// throws `Error: invalid type` in ModuleResolver._getFileResolvedModule.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  try {
    if (defaultResolveRequest) {
      return defaultResolveRequest(context, moduleName, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
  } catch (err) {
    const isBare =
      typeof moduleName === "string" &&
      !moduleName.startsWith(".") &&
      !moduleName.startsWith("/") &&
      /^[a-zA-Z@]/.test(moduleName);
    if (isBare) {
      try {
        const filePath = require.resolve(moduleName, {
          paths: [projectRoot, workspaceRoot],
        });
        return { type: "sourceFile", filePath };
      } catch (_) {}
    }
    throw err;
  }
};

module.exports = withNativeWind(config, { input: "./src/global.css" });
