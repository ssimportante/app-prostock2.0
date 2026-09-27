'use client';

import { setDoc, addDoc, updateDoc, deleteDoc, collection, doc } from 'firebase/firestore';

// These functions mirror the original non-blocking update helpers.
// They fire-and-forget the API call, logging errors but not blocking the UI.

export function setDocumentNonBlocking(docRef: any, data: any, options?: any) {
  setDoc(docRef, data, options).catch((error: any) => {
    console.error('setDoc error:', error);
  });
}

export function addDocumentNonBlocking(colRef: any, data: any) {
  return addDoc(colRef, data).catch((error: any) => {
    console.error('addDoc error:', error);
  });
}

export function updateDocumentNonBlocking(docRef: any, data: any) {
  updateDoc(docRef, data).catch((error: any) => {
    console.error('updateDoc error:', error);
  });
}

export function deleteDocumentNonBlocking(docRef: any) {
  deleteDoc(docRef).catch((error: any) => {
    console.error('deleteDoc error:', error);
  });
}
