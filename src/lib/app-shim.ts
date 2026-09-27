// Firebase App shim — replaces firebase/app with no-op stubs.
// Webpack alias maps 'firebase/app' → this module.

export type FirebaseApp = { _type: 'app' };

export function initializeApp(_config?: any): FirebaseApp {
  return { _type: 'app' };
}

export function getApps(): FirebaseApp[] {
  return [{ _type: 'app' }];
}

export function getApp(): FirebaseApp {
  return { _type: 'app' };
}
