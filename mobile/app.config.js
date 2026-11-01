module.exports = ({ config }) => {
  const profile = process.env.EAS_BUILD_PROFILE;
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (["preview", "simulator", "testflight"].includes(profile) && !apiUrl) {
    throw new Error("Set EXPO_PUBLIC_API_URL to the staging backend before building a trial app.");
  }
  if (apiUrl) {
    const url = new URL(apiUrl);
    if (["preview", "simulator", "testflight"].includes(profile) && ["halainvites.com", "www.halainvites.com", "noortoona.com", "www.noortoona.com", "noortoona.netlify.app", "main--noortoona.netlify.app", "noortoona.vercel.app"].includes(url.hostname)) {
      throw new Error("Trial builds must use an isolated staging backend, not a production domain.");
    }
    if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname) && !profile)) {
      throw new Error("EXPO_PUBLIC_API_URL must use HTTPS (localhost HTTP is for local development only).");
    }
    if (url.username || url.password || url.search || url.hash || !["", "/"].includes(url.pathname)) {
      throw new Error("EXPO_PUBLIC_API_URL must be an origin without credentials, path, query or fragment.");
    }
  }
  const merchantId = process.env.EXPO_PUBLIC_APPLE_MERCHANT_ID || "";
  const ios = { ...(config.ios || {}) };
  if (merchantId && process.env.EXPO_PUBLIC_PAYMENTS_ENABLED === "true") {
    ios.entitlements = {
      ...(ios.entitlements || {}),
      "com.apple.developer.in-app-payments": [merchantId],
    };
  }
  return { ...config, ios };
};
