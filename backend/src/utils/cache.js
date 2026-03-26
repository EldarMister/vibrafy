export class ExpiringCache {
  constructor(ttlMs) {
    this.ttlMs = ttlMs;
    this.storage = new Map();
  }

  get(key) {
    const entry = this.storage.get(key);

    if (!entry) {
      return null;
    }

    if (entry.expiresAt < Date.now()) {
      this.storage.delete(key);
      return null;
    }

    return entry.value;
  }

  set(key, value) {
    this.storage.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }
}

