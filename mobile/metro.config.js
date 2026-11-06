// La app vive dentro del monorepo pero NO es parte del workspace de pnpm
// (tiene su propio npm y package-lock). Metro tiene que quedarse dentro de
// mobile/: si sube a la raíz, encuentra el node_modules de pnpm del web y
// mezcla versiones de React.
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.watchFolders = [__dirname];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
