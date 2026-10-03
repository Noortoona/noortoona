module.exports = ({ config }) => {
  const merchantId = process.env.EXPO_PUBLIC_APPLE_MERCHANT_ID || "";
  const ios = { ...(config.ios || {}) };
  if (merchantId) {
    ios.entitlements = {
      ...(ios.entitlements || {}),
      "com.apple.developer.in-app-payments": [merchantId],
    };
  }
  return { ...config, ios };
};
