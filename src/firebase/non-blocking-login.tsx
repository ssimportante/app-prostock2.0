'use client';

import { signInWithEmailAndPassword, createUserWithEmailAndPassword, getAuth } from 'firebase/auth';

export function initiateAnonymousSignIn(_auth: any): void {
  // No-op: anonymous auth not supported in local mode
}

export function initiateEmailSignUp(auth: any, email: string, password: string): void {
  createUserWithEmailAndPassword(auth, email, password).catch((e: any) => console.error(e));
}

export function initiateEmailSignIn(auth: any, email: string, password: string): void {
  signInWithEmailAndPassword(auth, email, password).catch((e: any) => console.error(e));
}
