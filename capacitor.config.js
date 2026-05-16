/** @type {import('@capacitor/cli').CapacitorConfig} */
const config = {
  appId: 'com.babytime.app',
  appName: '宝贝时光',
  webDir: 'dist',
  server: {
    androidScheme: 'http'
  },
  android: {
    buildOptions: {
      signingType: 'apksigner'
    }
  }
};

module.exports = config;
