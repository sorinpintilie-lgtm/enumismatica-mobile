const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Add the shared directory to watchFolders
config.watchFolders = [
  path.resolve(__dirname, '..', 'shared'),
  path.resolve(__dirname, '..', 'data'),
  path.resolve(__dirname, '..', 'node_modules'),
];

// Explicitly map packages that are hoisted to parent node_modules
const parentNodeModules = path.resolve(__dirname, '..', 'node_modules');
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'base64-js': path.join(parentNodeModules, 'base64-js'),
  'ieee754': path.join(parentNodeModules, 'ieee754'),
  'invariant': path.join(parentNodeModules, 'invariant'),
  'whatwg-url-without-unicode': path.join(parentNodeModules, 'whatwg-url-without-unicode'),
  'buffer': path.join(parentNodeModules, 'buffer'),
  'react-native-gesture-handler': path.join(parentNodeModules, 'react-native-gesture-handler'),
};

module.exports = config;