import type { ProviderPhase } from '../provider/ProviderClient';
import { normalizeProviderFailure } from '../provider/ProviderError';
import type {
  CharacterGeneration,
  CharacterImageGenerator,
  GenerationMetadata,
  SourcePhoto,
} from './CharacterImageGenerator';

export type GenerationStep =
  | 'camera'
  | 'photoReview'
  | 'generating'
  | 'characterReview';

export interface CanonicalSessionState {
  readonly step: GenerationStep;
  readonly source: SourcePhoto | null;
  readonly result: CharacterGeneration | null;
  readonly phase: ProviderPhase | null;
  readonly error: string | null;
  readonly requestId: string | null;
}

/** Holds M4 work independently of DOM, camera and provider transport. */
export class CanonicalSession {
  private stateValue: CanonicalSessionState = {
    step: 'camera',
    source: null,
    result: null,
    phase: null,
    error: null,
    requestId: null,
  };
  private controller: AbortController | null = null;
  private revision = 0;

  constructor(
    private readonly generator: CharacterImageGenerator,
    private readonly changed: (state: CanonicalSessionState) => void = () => {},
  ) {}

  get state(): CanonicalSessionState {
    return this.stateValue;
  }

  private set(patch: Partial<CanonicalSessionState>): void {
    this.stateValue = { ...this.stateValue, ...patch };
    this.changed(this.stateValue);
  }

  review(source: SourcePhoto): void {
    this.cancel();
    this.set({
      step: 'photoReview',
      source,
      result: null,
      phase: null,
      error: null,
      requestId: null,
    });
  }

  /** Restore a completed character from tab-scoped M5 state without a new POST. */
  restore(
    result: CharacterGeneration,
    source: SourcePhoto | null = null,
  ): void {
    this.cancel('pause');
    this.set({
      step: 'characterReview',
      source,
      result,
      phase: null,
      error: null,
      requestId: null,
    });
  }

  backToPhoto(): void {
    this.cancel();
    if (this.stateValue.source)
      this.set({ step: 'photoReview', phase: null, error: null });
  }

  retake(): void {
    this.cancel();
    this.set({
      step: 'camera',
      source: null,
      result: null,
      phase: null,
      error: null,
      requestId: null,
    });
  }

  cancel(reason?: 'pagehide' | 'pause'): void {
    ++this.revision;
    this.controller?.abort(reason);
    this.controller = null;
    if (this.stateValue.step === 'generating')
      this.set({
        step: this.stateValue.result
          ? 'characterReview'
          : this.stateValue.source
            ? 'photoReview'
            : 'camera',
        phase: null,
        error: null,
        requestId: reason ? this.stateValue.requestId : null,
      });
  }

  /** Resume polling a submitted job without another generation request. */
  async recover(
    requestId: string,
    source: SourcePhoto | null,
    metadata: GenerationMetadata,
  ): Promise<void> {
    if (this.controller) return;
    const controller = new AbortController();
    this.controller = controller;
    const revision = ++this.revision;
    this.set({
      step: 'generating',
      source,
      result: null,
      phase: 'queued',
      requestId,
      error: null,
    });
    try {
      const image = await this.generator.recover(requestId, controller.signal, {
        modelId: metadata.modelId,
        onPhase: (phase) => {
          if (revision === this.revision) this.set({ phase });
        },
      });
      if (revision === this.revision && !controller.signal.aborted)
        this.set({
          step: 'characterReview',
          result: { image, metadata },
          phase: null,
          requestId: null,
          error: null,
        });
    } catch (failure) {
      if (revision === this.revision)
        this.set({
          step: source ? 'photoReview' : 'camera',
          phase: null,
          error: normalizeProviderFailure(failure, controller.signal).message,
        });
    } finally {
      if (this.controller === controller) this.controller = null;
    }
  }

  async generate(): Promise<void> {
    const source = this.stateValue.source;
    if (
      !source ||
      this.controller ||
      !['photoReview', 'characterReview'].includes(this.stateValue.step)
    )
      return;
    const controller = new AbortController();
    this.controller = controller;
    const revision = ++this.revision;
    this.set({
      step: 'generating',
      phase: 'submitting',
      requestId: null,
      error: null,
    });
    try {
      const result = await this.generator.generate(source, {
        signal: controller.signal,
        onPhase: (phase) => {
          if (revision === this.revision) this.set({ phase });
        },
        onSubmitted: (requestId) => {
          if (revision === this.revision) this.set({ requestId });
        },
      });
      if (revision === this.revision && !controller.signal.aborted)
        this.set({
          step: 'characterReview',
          result,
          phase: null,
          requestId: null,
          error: null,
        });
    } catch (error) {
      if (revision === this.revision)
        this.set({
          step: this.stateValue.result ? 'characterReview' : 'photoReview',
          phase: null,
          error: normalizeProviderFailure(error, controller.signal).message,
        });
    } finally {
      if (this.controller === controller) this.controller = null;
    }
  }
}
