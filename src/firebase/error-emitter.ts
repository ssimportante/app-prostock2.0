// Simple event emitter for error propagation.
type Handler = (error: Error) => void;

class SimpleEmitter {
  private handlers: Handler[] = [];

  on(event: string, handler: Handler) {
    if (event === 'permission-error') {
      this.handlers.push(handler);
    }
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  off(event: string, handler: Handler) {
    if (event === 'permission-error') {
      this.handlers = this.handlers.filter((h) => h !== handler);
    }
  }

  emit(event: string, error: Error) {
    if (event === 'permission-error') {
      this.handlers.forEach((h) => h(error));
    }
  }
}

export const errorEmitter = new SimpleEmitter();
