// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      subdomain: 'auth' | 'login' | 'admin';
    }
    // interface PageData {}
    // interface PageState {}
    interface Platform {
      env: {
        AUTH_API_URL: string;
      };
      context: {
        waitUntil(promise: Promise<unknown>): void;
      };
      caches: CacheStorage & { default: Cache };
    }
  }
}

export {};
