// Simplified error class — no longer needs Firebase security rule simulation.
export class FirestorePermissionError extends Error {
  public readonly request: any;

  constructor(context: { path: string; operation: string; requestResourceData?: any }) {
    super(`Permission error: ${context.operation} on ${context.path}`);
    this.name = 'FirestorePermissionError';
    this.request = {
      path: context.path,
      operation: context.operation,
      data: context.requestResourceData,
    };
  }
}
