/** @type {import('@capacitor/cli').CapacitorConfig} */
const config = {
  appId: 'com.babytime.app',
  appName: '宝贝时光',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  android: {
    buildOptions: {
      signingType: 'apksigner'
    }
  }
};

export default config;
