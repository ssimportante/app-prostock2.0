import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, setDoc, query, limit } from 'firebase/firestore';

const config = JSON.parse(fs.readFileSync('/app/firebase-applet-config.json', 'utf8'));

const app = initializeApp(config);
const auth = getAuth(app);
await signInWithEmailAndPassword(auth, process.env.FIREBASE_MIGRATION_EMAIL, process.env.FIREBASE_MIGRATION_PASSWORD);
const uid = auth.currentUser.uid;
console.log('uid:', uid, 'verified:', auth.currentUser.emailVerified);
const token = await auth.currentUser.getIdTokenResult();
console.log('email in token:', token.claims.email);

const db = getFirestore(app, config.firestoreDatabaseId || '(default)');

try {
  await setDoc(doc(db, 'roles_admin', uid), {}, { merge: true });
  console.log('roles_admin marker ensured');
} catch (e) {
  console.log('roles_admin write failed:', e.code);
}

function serialize(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value.toDate === 'function') return { __type: 'timestamp', iso: value.toDate().toISOString() };
  if (typeof value.seconds === 'number' && typeof value.nanoseconds === 'number') {
    return { __type: 'timestamp', iso: new Date(value.seconds * 1000).toISOString() };
  }
  const out = {};
  for (const [k, v] of Object.entries(value)) out[k] = serialize(v);
  return out;
}

try {
  const full = await getDocs(collection(db, 'employees'));
  const rows = full.docs.map((d) => ({ id: d.id, ...serialize(d.data()) }));
  fs.writeFileSync('/tmp/export/employees.json', JSON.stringify(rows, null, 1));
  console.log('employees total:', rows.length);
} catch (e) {
  console.log('employees FAILED:', e.code);
}
