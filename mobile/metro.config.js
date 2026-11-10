const {getDefaultConfig}=require('expo/metro-config');
const path=require('node:path');
const config=getDefaultConfig(__dirname);
config.watchFolders=[path.resolve(__dirname,'../shared')];
if(!config.resolver.sourceExts.includes('mjs'))config.resolver.sourceExts.push('mjs');
module.exports=config;
