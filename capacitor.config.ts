import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.sosnova.scheduler',
  appName: 'Каникулы',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
}

export default config
