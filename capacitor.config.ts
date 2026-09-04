import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.sosnova.sheduler',
  appName: 'Sheduler',
  webDir: 'dist',
  bundledWebRuntime: false,
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
  cordova: {
    preferences: {
      KeepRunning: 'true',
    },
  },
}

export default config
