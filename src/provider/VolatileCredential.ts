/** A page-lifetime credential. No serialization, storage, or global registration. */
export class VolatileCredential {
  #value: string | null = null;

  get ready(): boolean {
    return this.#value !== null;
  }

  set(raw: string): void {
    const value = raw.trim();
    // fal keys are ASCII tokens. Reject hidden/non-ASCII characters before
    // building an Authorization header, where fetch could fail before network.
    if (!value || !/^[\x21-\x7e]+$/.test(value)) {
      throw new Error('Enter a valid fal API key.');
    }
    this.#value = value;
  }

  clear(): void {
    this.#value = null;
  }

  /** Keep the raw value inside the transport call site. */
  withValue<T>(use: (value: string) => T): T {
    if (this.#value === null) throw new Error('Enter a fal API key first.');
    return use(this.#value);
  }
}
