// Firestore shim — replaces firebase/firestore with API-backed equivalents.
// Webpack alias maps 'firebase/firestore' → this module.

import { FakeTimestamp, convertTimestamps } from './fake-timestamp';

// --- Types (exported for components that import them) ---
export type Firestore = { _type: 'firestore' };
export type CollectionReference = any;
export type DocumentReference = any;
export type Query<T = any> = any;
export type DocumentData = Record<string, any>;
export type QuerySnapshot<T = any> = any;
export type DocumentSnapshot<T = any> = any;
export type FirestoreError = Error;
export type SetOptions = { merge?: boolean };

// --- Reference builders (synchronous, just create metadata objects) ---
export function collection(_firestore: Firestore, path: string): CollectionReference {
  return {
    type: 'collection',
    path,
    id: path,
    _path: { segments: [path], canonicalString: () => path, toString: () => path },
  };
}

export function doc(_firestore: Firestore, path: string, id?: string): DocumentReference {
  // doc(collectionRef) — auto-generate a new document ID (Firebase form)
  if (typeof _firestore === 'object' && _firestore?.type === 'collection' && path === undefined) {
    const newId = crypto.randomUUID();
    const colPath = _firestore.path;
    return {
      type: 'document',
      path: `${colPath}/${newId}`,
      id: newId,
      _path: { segments: [colPath, newId] },
    };
  }

  if (id !== undefined) {
    return {
      type: 'document',
      path: `${path}/${id}`,
      id,
      _path: { segments: [path, id] },
    };
  }
  // doc(firestore, 'items/abc123') form
  const segments = path.split('/');
  return {
    type: 'document',
    path,
    id: segments[segments.length - 1],
    _path: { segments },
  };
}

// --- Query constraint builders ---
export function where(field: string, op: string, value: any) {
  return { type: 'where', field, op, value };
}

export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc') {
  return { type: 'orderBy', field, direction };
}

export function limit(n: number) {
  return { type: 'limit', limit: n };
}

export function documentId() {
  return '__id__';
}

export function query(ref: CollectionReference, ...constraints: any[]): Query {
  const path = ref.path || ref._path?.canonicalString?.() || '';
  return {
    ...ref,
    type: 'query',
    _query: {
      path: {
        canonicalString: () => path,
        toString: () => path,
      },
    },
    _constraints: constraints,
  };
}

// --- Extract path and constraints from a ref or query (used by hooks) ---
export function getCollectionPath(ref: any): string {
  if (ref.type === 'collection') return ref.path;
  if (ref.type === 'query') return ref._query.path.canonicalString();
  if (ref.type === 'document') return ref.path.split('/')[0];
  return ref.path || '';
}

export function getConstraints(ref: any): any[] {
  return ref._constraints || [];
}

// --- Async operations (call the API) ---
export async function getDoc(docRef: DocumentReference): Promise<DocumentSnapshot> {
  const [collection, id] = docRef.path.split('/');
  const res = await fetch(`/api/db/${collection}/${id}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to get ${docRef.path}`);
  }
  const json = await res.json();
  const data = convertTimestamps(json.data);
  return {
    exists: () => !!data,
    id,
    data: () => data,
    ref: docRef,
  };
}

export async function getDocs(queryOrRef: Query | CollectionReference): Promise<QuerySnapshot> {
  const collectionName = getCollectionPath(queryOrRef);
  const constraints = getConstraints(queryOrRef);

  const params = new URLSearchParams();
  if (constraints.length > 0) {
    const whereConstraints = constraints.filter((c: any) => c.type === 'where');
    if (whereConstraints.length > 0) {
      params.set('where', JSON.stringify(whereConstraints.map((c: any) => ({ field: c.field, op: c.op, value: c.value }))));
    }
    const orderByConstraint = constraints.find((c: any) => c.type === 'orderBy');
    if (orderByConstraint) {
      params.set('orderBy', orderByConstraint.field);
      params.set('orderDir', orderByConstraint.direction);
    }
    const limitConstraint = constraints.find((c: any) => c.type === 'limit');
    if (limitConstraint) {
      params.set('limit', String(limitConstraint.limit));
    }
  }

  const url = `/api/db/${collectionName}${params.toString() ? `?${params}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to list ${collectionName}`);
  }
  const json = await res.json();
  const docs = (json.data || []).map((d: any) => ({
    id: d.id,
    data: () => convertTimestamps(d),
    ref: { type: 'document', path: `${collectionName}/${d.id}`, id: d.id },
  }));
  return {
    docs,
    empty: docs.length === 0,
    size: docs.length,
    forEach: (cb: (doc: any) => void) => docs.forEach(cb),
  };
}

export async function addDoc(colRef: CollectionReference, data: any): Promise<DocumentReference> {
  const collectionName = colRef.path;
  const res = await fetch(`/api/db/${collectionName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to create in ${collectionName}`);
  }
  const json = await res.json();
  const id = json.data.id;
  return { type: 'document', path: `${collectionName}/${id}`, id, _path: { segments: [collectionName, id] } };
}

export async function setDoc(docRef: DocumentReference, data: any, _options?: SetOptions): Promise<void> {
  const [collection, id] = docRef.path.split('/');
  const res = await fetch(`/api/db/${collection}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to set ${docRef.path}`);
  }
}

export async function updateDoc(docRef: DocumentReference, data: any): Promise<void> {
  const [collection, id] = docRef.path.split('/');
  const res = await fetch(`/api/db/${collection}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to update ${docRef.path}`);
  }
}

export async function deleteDoc(docRef: DocumentReference): Promise<void> {
  const [collection, id] = docRef.path.split('/');
  const res = await fetch(`/api/db/${collection}/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to delete ${docRef.path}`);
  }
}

// --- Batch ---
export function writeBatch(_firestore: Firestore) {
  const operations: any[] = [];
  return {
    set(docRef: DocumentReference, data: any, _options?: SetOptions) {
      operations.push({ type: 'set', collection: docRef.path.split('/')[0], id: docRef.path.split('/')[1], data });
    },
    update(docRef: DocumentReference, data: any) {
      operations.push({ type: 'update', collection: docRef.path.split('/')[0], id: docRef.path.split('/')[1], data });
    },
    delete(docRef: DocumentReference) {
      operations.push({ type: 'delete', collection: docRef.path.split('/')[0], id: docRef.path.split('/')[1] });
    },
    async commit() {
      if (operations.length === 0) return;
      const res = await fetch('/api/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operations }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Batch commit failed');
      }
      operations.length = 0;
    },
  };
}

// --- Timestamp ---
export const Timestamp = FakeTimestamp;

// Re-export for convenience
export { FakeTimestamp };
