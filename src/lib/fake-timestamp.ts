// FakeTimestamp mimics Firebase Firestore Timestamp so existing component code
// that calls .toDate() on date fields continues to work after the migration
// from Firebase to PostgreSQL/Prisma.

export class FakeTimestamp {
  seconds: number;
  nanoseconds: number;

  constructor(secondsOrDate: number | Date, nanoseconds?: number) {
    if (typeof secondsOrDate === 'number') {
      this.seconds = secondsOrDate;
      this.nanoseconds = nanoseconds ?? 0;
    } else {
      const ms = secondsOrDate.getTime();
      this.seconds = Math.floor(ms / 1000);
      this.nanoseconds = (ms % 1000) * 1e6;
    }
  }

  toDate(): Date {
    return new Date(this.seconds * 1000 + this.nanoseconds / 1e6);
  }

  toMillis(): number {
    return this.seconds * 1000 + this.nanoseconds / 1e6;
  }

  toString(): string {
    return this.toDate().toISOString();
  }

  toJSON(): string {
    return this.toDate().toISOString();
  }

  valueOf(): number {
    return this.toMillis();
  }

  static now(): FakeTimestamp {
    return new FakeTimestamp(new Date());
  }

  static fromDate(date: Date): FakeTimestamp {
    return new FakeTimestamp(date);
  }

  static fromMillis(ms: number): FakeTimestamp {
    return new FakeTimestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6);
  }

  // Detect and convert __timestamp objects from API responses
  static fromObject(obj: any): FakeTimestamp | null {
    if (obj && typeof obj === 'object' && obj.__timestamp) {
      return new FakeTimestamp(obj.seconds, obj.nanoseconds || 0);
    }
    return null;
  }
}

// Deep-convert all __timestamp objects in a data structure to FakeTimestamp instances
export function convertTimestamps(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(convertTimestamps);
  if (typeof obj === 'object') {
    const ts = FakeTimestamp.fromObject(obj);
    if (ts) return ts;
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = convertTimestamps(value);
    }
    return result;
  }
  return obj;
}
