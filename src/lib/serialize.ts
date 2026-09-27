// Serialization helpers to convert between Prisma Date objects and FakeTimestamp

export function serializeForClient(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Date) {
    return { __timestamp: true, seconds: Math.floor(obj.getTime() / 1000), nanoseconds: (obj.getTime() % 1000) * 1e6 };
  }
  if (Array.isArray(obj)) return obj.map(serializeForClient);
  if (typeof obj === 'object') {
    // Don't serialize Prisma Decimal or special objects
    if (obj.toJSON && typeof obj.toJSON === 'function' && !(obj instanceof Date)) {
      return serializeForClient(obj.toJSON());
    }
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = serializeForClient(value);
    }
    return result;
  }
  return obj;
}

export function deserializeFromClient(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(deserializeFromClient);
  if (typeof obj === 'object') {
    if (obj.__timestamp) {
      return new Date(obj.seconds * 1000 + (obj.nanoseconds || 0) / 1e6);
    }
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = deserializeFromClient(value);
    }
    return result;
  }
  return obj;
}
