export type ProviderPhase = 'submitting' | 'queued' | 'running' | 'retrieving';

export interface ProviderJob<T> {
  readonly modelId: string;
  readonly input: unknown;
  readonly parse: (value: unknown) => T;
}

export type ProviderReadJob<T> = Pick<ProviderJob<T>, 'modelId' | 'parse'>;

export interface ProviderRunOptions {
  readonly signal?: AbortSignal;
  readonly onPhase?: (phase: ProviderPhase) => void;
  readonly onSubmitted?: (requestId: string) => void;
}

export interface ProviderResult<T> {
  readonly data: T;
  readonly requestId: string;
}

/** Model adapters own IDs, inputs and output schemas; the provider owns transport. */
export interface ProviderClient {
  run<T>(
    job: ProviderJob<T>,
    options?: ProviderRunOptions,
  ): Promise<ProviderResult<T>>;
  /** Resume an existing queued job without submitting or billing a new one. */
  resume<T>(
    job: ProviderReadJob<T>,
    requestId: string,
    options?: ProviderRunOptions,
  ): Promise<ProviderResult<T>>;
}
