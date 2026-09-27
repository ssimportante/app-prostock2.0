// Firebase Auth shim — replaces firebase/auth with cookie-based session auth.
// Webpack alias maps 'firebase/auth' → this module.

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  phoneNumber: string | null;
  providerData: any[];
  tenantId: string | null;
}

export type Auth = { _type: 'auth' };

// Session state management (client-side)
let currentUser: User | null = null;
const authListeners: Array<(user: User | null) => void> = [];
let sessionCheckPromise: Promise<void> | null = null;

async function fetchSession(): Promise<void> {
  try {
    const res = await fetch('/api/auth/session');
    const json = await res.json();
    if (json.user) {
      currentUser = {
        uid: json.user.id,
        email: json.user.email,
        displayName: json.user.name,
        photoURL: json.user.photoURL,
        emailVerified: true,
        phoneNumber: null,
        providerData: [],
        tenantId: null,
      };
    } else {
      currentUser = null;
    }
  } catch {
    currentUser = null;
  }
  authListeners.forEach((cb) => cb(currentUser));
}

export function getAuth(): Auth {
  // Trigger session check if not already done
  if (!sessionCheckPromise) {
    sessionCheckPromise = fetchSession();
  }
  return { _type: 'auth' };
}

export function onAuthStateChanged(
  _auth: Auth,
  callback: (user: User | null) => void,
  errorCallback?: (error: Error) => void
): () => void {
  authListeners.push(callback);

  // If we haven't checked session yet, do it now
  if (!sessionCheckPromise) {
    sessionCheckPromise = fetchSession();
  }

  // Call the callback once the session check completes
  sessionCheckPromise.then(() => callback(currentUser));

  // Return unsubscribe function
  return () => {
    const idx = authListeners.indexOf(callback);
    if (idx > -1) authListeners.splice(idx, 1);
  };
}

export async function signInWithEmailAndPassword(
  _auth: Auth,
  email: string,
  password: string
): Promise<{ user: User }> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw { code: json.error?.includes('credential') ? 'auth/invalid-credential' : 'auth/unknown', message: json.error };
  }
  currentUser = {
    uid: json.user.id,
    email: json.user.email,
    displayName: json.user.name,
    photoURL: json.user.photoURL,
    emailVerified: true,
    phoneNumber: null,
    providerData: [],
    tenantId: null,
  };
  authListeners.forEach((cb) => cb(currentUser));
  return { user: currentUser };
}

export async function createUserWithEmailAndPassword(
  _auth: Auth,
  email: string,
  password: string
): Promise<{ user: User }> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw { code: json.error?.includes('already') ? 'auth/email-already-in-use' : 'auth/unknown', message: json.error };
  }
  currentUser = {
    uid: json.user.id,
    email: json.user.email,
    displayName: json.user.name,
    photoURL: json.user.photoURL,
    emailVerified: true,
    phoneNumber: null,
    providerData: [],
    tenantId: null,
  };
  authListeners.forEach((cb) => cb(currentUser));
  return { user: currentUser };
}

export async function signOut(_auth: Auth): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' });
  currentUser = null;
  authListeners.forEach((cb) => cb(null));
}

export async function updatePassword(user: User, newPassword: string): Promise<void> {
  const res = await fetch('/api/auth/update-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword: '', newPassword }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || 'Failed to update password');
  }
}

export async function updateProfile(user: User, profile: { displayName?: string; photoURL?: string }): Promise<void> {
  const res = await fetch('/api/auth/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: profile.displayName, photoURL: profile.photoURL }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || 'Failed to update profile');
  }
  if (profile.displayName !== undefined) currentUser = { ...currentUser!, displayName: profile.displayName };
  if (profile.photoURL !== undefined) currentUser = { ...currentUser!, photoURL: profile.photoURL };
  authListeners.forEach((cb) => cb(currentUser));
}

export const EmailAuthProvider = {
  credential: (email: string, password: string) => ({ email, password, _type: 'credential' }),
};

export async function reauthenticateWithCredential(_user: User, _credential: any): Promise<void> {
  // No-op in local auth — revalidation happens on password change
}
