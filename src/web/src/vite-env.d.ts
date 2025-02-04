/// <reference types="vite/client" />

/**
 * Extended environment variables interface for Vite
 * Provides type-safe access to custom environment variables
 * @version ^4.0.0
 */
interface ImportMetaEnv {
  /** Base API URL for backend services */
  readonly VITE_API_URL: string;
  
  /** WebSocket URL for real-time communications */
  readonly VITE_WS_URL: string;
  
  /** Current environment mode */
  readonly VITE_ENV: 'development' | 'production';
  
  /** Application title */
  readonly VITE_APP_TITLE: string;
}

/**
 * Augments the ImportMeta interface to include env
 */
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * Type definition for static image imports
 * Ensures type safety when importing and using image assets
 */
interface StaticImageImport {
  /** Source URL of the image */
  src: string;
  
  /** Width of the image in pixels */
  width: number;
  
  /** Height of the image in pixels */
  height: number;
  
  /** Alternative text for accessibility */
  alt: string;
}

// Type assertions for module declarations
declare module '*.svg' {
  const content: StaticImageImport;
  export default content;
}

declare module '*.png' {
  const content: StaticImageImport;
  export default content;
}

declare module '*.jpg' {
  const content: StaticImageImport;
  export default content;
}

declare module '*.jpeg' {
  const content: StaticImageImport;
  export default content;
}

declare module '*.gif' {
  const content: StaticImageImport;
  export default content;
}

declare module '*.webp' {
  const content: StaticImageImport;
  export default content;
}