// Firebase Storage shim — replaces firebase/storage with local file serving.
// Webpack alias maps 'firebase/storage' → this module.

export type Storage = { _type: 'storage' };
export type StorageReference = { _path: string; name: string };

export function getStorage(): Storage {
  return { _type: 'storage' };
}

export function ref(_storage: Storage, path: string): StorageReference {
  // Extract filename from path (may contain folders)
  const parts = path.split('/');
  const name = parts[parts.length - 1];
  return { _path: path, name };
}

export async function uploadString(
  storageRef: StorageReference,
  data: string,
  _format?: string
): Promise<{ ref: StorageReference }> {
  const res = await fetch('/api/upload', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data, filename: storageRef.name }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || 'Upload failed');
  }
  const json = await res.json();
  // Update the ref's path to the actual URL
  storageRef._path = json.url;
  return { ref: storageRef };
}

export async function getDownloadURL(storageRef: StorageReference): Promise<string> {
  // If the ref already has a full URL (set after upload), return it
  if (storageRef._path.startsWith('/api/files/')) {
    return storageRef._path;
  }
  // Otherwise, construct the URL from the filename
  const filename = storageRef.name;
  return `/api/files/${filename}`;
}

export async function deleteObject(storageRef: StorageReference): Promise<void> {
  const path = storageRef._path;
  // Extract filename from path or URL
  let filename = path;
  if (path.startsWith('/api/files/')) {
    filename = path.replace('/api/files/', '');
  } else {
    filename = path.split('/').pop() || path;
  }
  await fetch(`/api/files/${filename}`, { method: 'DELETE' });
}
