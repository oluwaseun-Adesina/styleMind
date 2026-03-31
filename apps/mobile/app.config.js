const appJson = require('./app.json');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');

if (fs.existsSync(envPath)) {
  const envLines = fs.readFileSync(envPath, 'utf8').split('\n');

  for (const line of envLines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const value = trimmedLine.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

const stripGoogleSuffix = (clientId) =>
  clientId?.replace(/\.apps\.googleusercontent\.com$/, '');

const googleSchemes = [
  process.env.EXPO_PUBLIC_ANDROID_CLIENT_ID,
  process.env.EXPO_PUBLIC_IOS_CLIENT_ID,
]
  .map(stripGoogleSuffix)
  .filter(Boolean)
  .map((clientId) => `com.googleusercontent.apps.${clientId}`);

const existingSchemes = Array.isArray(appJson.expo.scheme)
  ? appJson.expo.scheme
  : [appJson.expo.scheme].filter(Boolean);

module.exports = () => ({
  ...appJson.expo,
  scheme: Array.from(new Set([...existingSchemes, ...googleSchemes])),
});
