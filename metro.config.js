const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

const config = getDefaultConfig(__dirname);

// Add the shared directory to watchFolders
config.watchFolders = [
  path.resolve(__dirname, '..', 'shared'),
  path.resolve(__dirname, '..', 'data'),
  path.resolve(__dirname, '..', 'node_modules'),
].filter((folder) => fs.existsSync(folder));

// Explicitly map all node_modules to parent directory for workspace support
const parentNodeModules = path.resolve(__dirname, '..', 'node_modules');
config.resolver.nodeModulesPaths = [
  parentNodeModules,
  path.resolve(__dirname, 'node_modules')
];

// Explicitly map packages that are hoisted to parent node_modules
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'base64-js': path.join(parentNodeModules, 'base64-js'),
  'ieee754': path.join(parentNodeModules, 'ieee754'),
  'invariant': path.join(parentNodeModules, 'invariant'),
  'whatwg-url-without-unicode': path.join(parentNodeModules, 'whatwg-url-without-unicode'),
  'buffer': path.join(parentNodeModules, 'buffer'),
  'react-native-gesture-handler': path.join(parentNodeModules, 'react-native-gesture-handler'),
  '@react-native-async-storage/async-storage': path.join(parentNodeModules, '@react-native-async-storage', 'async-storage'),
  '@react-native-picker/picker': path.join(parentNodeModules, '@react-native-picker', 'picker'),
};

module.exports = config;