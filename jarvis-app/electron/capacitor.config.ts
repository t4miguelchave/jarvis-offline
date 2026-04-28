import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.miguelmac.jarvis',
  appName: 'Jarvis',
  webDir: 'www',
  plugins: {
    Camera: {
      // Android permissions handled via AndroidManifest
    },
  },
};

export default config;
