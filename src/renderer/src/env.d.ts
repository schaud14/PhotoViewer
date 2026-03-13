import { ElectronAPI } from '../../preload/index'

declare global {
  interface Window {
    api: ElectronAPI
  }
}

declare module '*.png' {
  const content: string
  export default content
}
