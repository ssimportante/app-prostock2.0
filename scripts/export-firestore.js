/**
 * ProStock Firestore Export Script
 * 
 * Reads all Firestore collections using firebase-admin and exports to JSON + CSV.
 * Run inside the web container:
 *   docker compose -f docker-compose.base44.yml exec -T web node scripts/export-firestore.js
 * 
 * Output: migration/exports/<collection>.json and .csv (for flat collections)
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Collections to export
const COLLECTIONS = [
  'items',
  'categories',
  'subcategories',
  'stations',
  'taxes',
  'users',
  'sales',
  'wasteEvents',
  'stockReceipts',
  'staff',
  'settings',
];

// Collections that also get CSV export (flat structure)
const CSV_COLLECTIONS = ['categories', 'subcategories', 'stations', 'taxes', 'users', 'staff'];

// Output directory
const OUTPUT_DIR = path.join(__dirname, '..', 'migration', 'exports');

// Firebase config (public, from the app's config file)
const firebaseConfig = require('/app/firebase-applet-config.json');

/**
 * Convert Firestore data types to plain JSON-serializable values.
 * - Timestamp → ISO string
 * - DocumentReference → path string
 * - GeoPoint → { latitude, longitude }
 * - Arrays → recursively convert
 * - Objects → recursively convert
 */
function serializeValue(value) {
  if (value === null || value === undefined) {
    return value;
  }

  // Firestore Timestamp
  if (value && typeof value.toDate === 'function') {
    return { __type: 'timestamp', value: value.toDate().toISOString() };
  }

  // Firestore DocumentReference
  if (value && value.path && typeof value.path === 'string' && value._key) {
    return { __type: 'reference', value: value.path };
  }

  // Firestore GeoPoint
  if (value && typeof value.latitude === 'number' && typeof value.longitude === 'number' && value.constructor && value.constructor.name === 'GeoPoint') {
    return { __type: 'geopoint', value: { latitude: value.latitude, longitude: value.longitude } };
  }

  // Array
  if (Array.isArray(value)) {
    return value.map(serializeValue);
  }

  // Object (but not special Firestore types already handled)
  if (typeof value === 'object' && value.constructor === Object) {
    const result = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = serializeValue(val);
    }
    return result;
  }

  // Primitives (string, number, boolean)
  return value;
}

/**
 * Convert a flat object to CSV row.
 * Nested arrays/objects are serialized as JSON strings.
 */
function objectToCsvRow(obj, headers) {
  return headers.map(header => {
    const value = obj[header];
    if (value === null || value === undefined) {
      return '';
    }
    if (Array.isArray(value) || typeof value === 'object') {
      // Serialize complex values as JSON
      const serialized = serializeValue(value);
      const jsonStr = JSON.stringify(serialized);
      // Escape quotes and wrap in quotes
      return `"${jsonStr.replace(/"/g, '""')}"`;
    }
    // Escape quotes in string values
    const strValue = String(value);
    if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
      return `"${strValue.replace(/"/g, '""')}"`;
    }
    return strValue;
  }).join(',');
}

/**
 * Get all headers from a collection of documents.
 */
function getCsvHeaders(documents) {
  const headerSet = new Set();
  for (const doc of documents) {
    for (const [key] of Object.entries(doc)) {
      headerSet.add(key);
    }
  }
  return Array.from(headerSet).sort();
}

async function exportCollection(db, collectionName) {
  console.log(`Exporting collection: ${collectionName}`);
  
  const snapshot = await db.collection(collectionName).get();
  const documents = [];
  
  snapshot.forEach(doc => {
    const data = doc.data();
    const serialized = serializeValue(data);
    documents.push({ id: doc.id, ...serialized });
  });
  
  console.log(`  → ${documents.length} documents`);
  
  // Write JSON
  const jsonPath = path.join(OUTPUT_DIR, `${collectionName}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(documents, null, 2));
  console.log(`  → JSON written: ${jsonPath}`);
  
  // Write CSV for flat collections
  if (CSV_COLLECTIONS.includes(collectionName) && documents.length > 0) {
    const headers = getCsvHeaders(documents);
    const csvLines = [headers.join(',')];
    for (const doc of documents) {
      csvLines.push(objectToCsvRow(doc, headers));
    }
    const csvPath = path.join(OUTPUT_DIR, `${collectionName}.csv`);
    fs.writeFileSync(csvPath, csvLines.join('\n'));
    console.log(`  → CSV written: ${csvPath}`);
  }
  
  return { collection: collectionName, count: documents.length };
}

async function main() {
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountKey) {
    console.error('ERROR: FIREBASE_SERVICE_ACCOUNT_KEY environment variable not set.');
    process.exit(1);
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(serviceAccountKey);
  } catch (e) {
    console.error('ERROR: Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY as JSON.');
    process.exit(1);
  }

  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: firebaseConfig.projectId,
    });
  }

  const db = admin.firestore();

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`Output directory: ${OUTPUT_DIR}\n`);

  const results = [];
  for (const collectionName of COLLECTIONS) {
    try {
      const result = await exportCollection(db, collectionName);
      results.push(result);
    } catch (error) {
      console.error(`  → ERROR exporting ${collectionName}:`, error.message);
      results.push({ collection: collectionName, count: -1, error: error.message });
    }
  }

  console.log('\n=== Export Summary ===');
  let totalDocs = 0;
  for (const result of results) {
    if (result.count >= 0) {
      console.log(`  ${result.collection}: ${result.count} documents`);
      totalDocs += result.count;
    } else {
      console.log(`  ${result.collection}: FAILED (${result.error})`);
    }
  }
  console.log(`\nTotal documents exported: ${totalDocs}`);

  const summaryPath = path.join(OUTPUT_DIR, '_summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify({
    exportDate: new Date().toISOString(),
    collections: results,
    totalDocuments: totalDocs,
  }, null, 2));
  console.log(`\nSummary written: ${summaryPath}`);

  await admin.app().delete();
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
