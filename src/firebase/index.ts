'use client';

// Re-exports from the shim modules. Components import from '@/firebase' and
// get the same API surface, now backed by local API routes instead of Firebase.

export { FirebaseClientProvider } from './client-provider';
export { FirebaseProvider, useFirebase, useAuth, useFirestore, useFirebaseApp, useUser, useMemoFirebase, FirebaseContext } from './provider';
export { useCollection } from './firestore/use-collection';
export { useDoc } from './firestore/use-doc';
export { setDocumentNonBlocking, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from './non-blocking-updates';
export { initiateAnonymousSignIn, initiateEmailSignUp, initiateEmailSignIn } from './non-blocking-login';
export { FirestorePermissionError } from './errors';
export { errorEmitter } from './error-emitter';
