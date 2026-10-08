export type ProviderPhase = 'submitting' | 'queued' | 'running' | 'retrieving';

export interface ProviderJob<T> {
  readonly modelId: string;
  readonly input: unknown;
  readonly parse: (value: unknown) => T;
}

export interface ProviderRunOptions {
  readonly signal?: AbortSignal;
  readonly onPhase?: (phase: ProviderPhase) => void;
}

/** Model adapters own IDs, inputs and output schemas; the provider owns transport. */
export interface ProviderClient {
  run<T>(job: ProviderJob<T>, options?: ProviderRunOptions): Promise<T>;
}
