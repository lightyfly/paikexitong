export function getAppId() {
  return String(import.meta.env.VITE_APP_ID || 'default')
}
