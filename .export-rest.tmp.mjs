import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';

const config = JSON.parse(fs.readFileSync('/app/firebase-applet-config.json', 'utf8'));
const COLLECTIONS = ['employees', 'sales', 'stockReceipts', 'wasteEvents', 'taxes', 'users', 'roles_admin'];

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

const app = initializeApp(config);
const auth = getAuth(app);
await signInWithEmailAndPassword(auth, process.env.FIREBASE_MIGRATION_EMAIL, process.env.FIREBASE_MIGRATION_PASSWORD);
const db = getFirestore(app, config.firestoreDatabaseId || '(default)');
console.log('uid:', auth.currentUser.uid, 'email:', auth.currentUser.email, 'verified:', auth.currentUser.emailVerified);

const myUser = await getDoc(doc(db, 'users', auth.currentUser.uid));
console.log('own users doc exists:', myUser.exists(), myUser.exists() ? JSON.stringify(serialize(myUser.data())) : '');

fs.mkdirSync('/tmp/export', { recursive: true });
for (const name of COLLECTIONS) {
  try {
    const snap = await getDocs(collection(db, name));
    const rows = snap.docs.map((d) => ({ id: d.id, ...serialize(d.data()) }));
    fs.writeFileSync(`/tmp/export/${name}.json`, JSON.stringify(rows, null, 1));
    console.log(`${name}: ${rows.length} docs`);
  } catch (e) {
    console.log(`${name}: FAILED ${e.code}`);
  }
}
try {
  const posSnap = await getDoc(doc(db, 'settings', 'pos'));
  if (posSnap.exists()) {
    fs.writeFileSync('/tmp/export/settings_pos.json', JSON.stringify(serialize(posSnap.data()), null, 1));
    console.log('settings/pos:', JSON.stringify(serialize(posSnap.data())));
  } else {
    console.log('settings/pos: missing doc');
  }
} catch (e) {
  console.log('settings/pos: FAILED', e.code);
}
