import type { ProviderPhase } from '../provider/ProviderClient';
import { normalizeProviderFailure } from '../provider/ProviderError';
import type { CharacterGeneration } from './CharacterImageGenerator';
import type {
  ViewGeneration,
  ViewGenerationMetadata,
  ViewImageGenerator,
} from './ViewImageGenerator';
import {
  blocksAcceptance,
  inspectViewImage,
  type ViewQualityReason,
} from './viewQuality';
import { type GeneratedViewId, VIEW_IDS } from './viewPrompts';

export type ViewStatus =
  | 'empty'
  | 'waiting'
  | 'generating'
  | 'paused'
  | 'ready'
  | 'failed';
export type ViewReview = 'pending' | 'accepted' | 'flagged';

export interface ViewEntry {
  readonly status: ViewStatus;
  readonly phase: ProviderPhase | null;
  readonly result: ViewGeneration | null;
  readonly pendingMetadata: ViewGenerationMetadata | null;
  readonly review: ViewReview;
  readonly qualityReasons: readonly ViewQualityReason[];
  readonly error: string | null;
}

export interface ViewSetState {
  readonly reference: CharacterGeneration | null;
  readonly views: Readonly<Record<GeneratedViewId, ViewEntry>>;
  readonly batchRunning: boolean;
}

function emptyEntry(): ViewEntry {
  return {
    status: 'empty',
    phase: null,
    result: null,
    pendingMetadata: null,
    review: 'pending',
    qualityReasons: [],
    error: null,
  };
}

export function emptyViewSet(): ViewSetState {
  return {
    reference: null,
    views: {
      frontLeft45: emptyEntry(),
      left90: emptyEntry(),
      frontRight45: emptyEntry(),
      right90: emptyEntry(),
      back180: emptyEntry(),
    },
    batchRunning: false,
  };
}

export function viewSetReady(state: ViewSetState): boolean {
  return (
    !!state.reference &&
    VIEW_IDS.every((view) => {
      const entry = state.views[view];
      return (
        entry.status === 'ready' &&
        !!entry.result &&
        entry.review === 'accepted' &&
        !blocksAcceptance(entry.qualityReasons)
      );
    })
  );
}

/** M5 owns only view requests; the M4 canonical image stays immutable. */
export class ViewSetSession {
  private value: ViewSetState = emptyViewSet();
  private readonly controllers = new Map<GeneratedViewId, AbortController>();
  private revision = 0;

  constructor(
    private readonly generator: ViewImageGenerator,
    private readonly changed: (state: ViewSetState) => void = () => {},
  ) {}

  get state(): ViewSetState {
    return this.value;
  }

  private set(state: ViewSetState): void {
    this.value = state;
    this.changed(state);
  }

  private update(view: GeneratedViewId, patch: Partial<ViewEntry>): void {
    this.set({
      ...this.value,
      views: {
        ...this.value.views,
        [view]: { ...this.value.views[view], ...patch },
      },
    });
  }

  start(reference: CharacterGeneration): void {
    if (
      this.value.reference?.metadata.providerRequestId ===
      reference.metadata.providerRequestId
    )
      return;
    this.pause();
    this.set({ ...emptyViewSet(), reference });
  }

  restore(state: ViewSetState): void {
    this.pause();
    this.set({
      ...state,
      batchRunning: false,
      views: Object.fromEntries(
        VIEW_IDS.map((view) => {
          const entry = state.views[view];
          return [
            view,
            entry.status === 'generating' || entry.status === 'waiting'
              ? {
                  ...entry,
                  status: entry.pendingMetadata ? 'paused' : 'empty',
                  phase: null,
                }
              : entry,
          ];
        }),
      ) as unknown as ViewSetState['views'],
    });
  }

  clear(): void {
    this.pause();
    this.set(emptyViewSet());
  }

  pause(): void {
    ++this.revision;
    for (const controller of this.controllers.values())
      controller.abort('pause');
    this.controllers.clear();
    for (const view of VIEW_IDS) {
      const entry = this.value.views[view];
      if (entry.status === 'generating' || entry.status === 'waiting')
        this.update(view, {
          status: entry.pendingMetadata ? 'paused' : 'empty',
          phase: null,
        });
    }
    if (this.value.batchRunning)
      this.set({ ...this.value, batchRunning: false });
  }

  async generateMissing(): Promise<void> {
    if (
      !this.value.reference ||
      this.value.batchRunning ||
      this.controllers.size > 0
    )
      return;
    const views = VIEW_IDS.filter((view) => {
      const entry = this.value.views[view];
      return (
        (entry.status === 'empty' || entry.status === 'failed') &&
        !entry.pendingMetadata
      );
    });
    if (views.length === 0) return;
    const revision = ++this.revision;
    for (const view of views)
      this.update(view, { status: 'waiting', error: null });
    this.set({ ...this.value, batchRunning: true });
    let next = 0;
    const worker = async () => {
      while (revision === this.revision && next < views.length) {
        const view = views[next++];
        if (view) await this.generateView(view, revision);
      }
    };
    await Promise.all([worker(), worker()]);
    if (revision === this.revision)
      this.set({ ...this.value, batchRunning: false });
  }

  async retry(view: GeneratedViewId): Promise<void> {
    if (
      !VIEW_IDS.includes(view) ||
      !this.value.reference ||
      this.value.batchRunning ||
      this.controllers.size > 0 ||
      this.value.views[view].pendingMetadata
    )
      return;
    const revision = ++this.revision;
    this.set({ ...this.value, batchRunning: true });
    await this.generateView(view, revision);
    if (revision === this.revision)
      this.set({ ...this.value, batchRunning: false });
  }

  private async generateView(
    view: GeneratedViewId,
    revision: number,
  ): Promise<void> {
    const reference = this.value.reference;
    if (!reference || revision !== this.revision) return;
    const controller = new AbortController();
    this.controllers.set(view, controller);
    this.update(view, {
      status: 'generating',
      phase: 'submitting',
      error: null,
      review: 'pending',
    });
    try {
      const result = await this.generator.generate(reference, view, {
        signal: controller.signal,
        onPhase: (phase) => {
          if (revision === this.revision) this.update(view, { phase });
        },
        onSubmitted: (requestId) => {
          if (revision === this.revision)
            this.update(view, {
              pendingMetadata: this.generator.metadataFor(
                reference,
                view,
                requestId,
              ),
            });
        },
      });
      if (revision === this.revision && !controller.signal.aborted)
        this.finish(view, result);
    } catch (error) {
      if (revision === this.revision) {
        const pending = this.value.views[view].pendingMetadata;
        this.update(view, {
          status: pending ? 'paused' : 'failed',
          phase: null,
          error: normalizeProviderFailure(error, controller.signal).message,
        });
      }
    } finally {
      if (this.controllers.get(view) === controller)
        this.controllers.delete(view);
    }
  }

  private finish(view: GeneratedViewId, result: ViewGeneration): void {
    this.update(view, {
      status: 'ready',
      phase: null,
      result,
      pendingMetadata: null,
      review: 'pending',
      qualityReasons: inspectViewImage(result.image),
      error: null,
    });
  }

  async resumePending(): Promise<void> {
    if (
      !this.value.reference ||
      this.value.batchRunning ||
      this.controllers.size > 0
    )
      return;
    const pending = VIEW_IDS.filter(
      (view) => !!this.value.views[view].pendingMetadata,
    );
    if (pending.length === 0) return;
    const revision = ++this.revision;
    this.set({ ...this.value, batchRunning: true });
    let next = 0;
    const worker = async () => {
      while (revision === this.revision && next < pending.length) {
        const view = pending[next++];
        if (view) await this.resumeView(view, revision);
      }
    };
    await Promise.all([worker(), worker()]);
    if (revision === this.revision)
      this.set({ ...this.value, batchRunning: false });
  }

  private async resumeView(
    view: GeneratedViewId,
    revision: number,
  ): Promise<void> {
    const metadata = this.value.views[view].pendingMetadata;
    if (!metadata || revision !== this.revision) return;
    const controller = new AbortController();
    this.controllers.set(view, controller);
    this.update(view, { status: 'generating', phase: 'queued', error: null });
    try {
      const image = await this.generator.recover(
        metadata,
        controller.signal,
        (phase) => {
          if (revision === this.revision) this.update(view, { phase });
        },
      );
      if (revision === this.revision && !controller.signal.aborted)
        this.finish(view, { image, metadata });
    } catch (error) {
      if (revision === this.revision)
        this.update(view, {
          status: 'paused',
          phase: null,
          error: normalizeProviderFailure(error, controller.signal).message,
        });
    } finally {
      if (this.controllers.get(view) === controller)
        this.controllers.delete(view);
    }
  }

  reportDimensions(view: GeneratedViewId, width: number, height: number): void {
    const entry = this.value.views[view];
    if (!entry.result) return;
    const qualityReasons = inspectViewImage(entry.result.image, {
      width,
      height,
    });
    this.update(view, {
      qualityReasons,
      review: blocksAcceptance(qualityReasons) ? 'pending' : entry.review,
    });
  }

  reportUnavailable(view: GeneratedViewId): void {
    const entry = this.value.views[view];
    if (!entry.result) return;
    this.update(view, {
      qualityReasons: ['image_unavailable'],
      review: 'pending',
    });
  }

  review(view: GeneratedViewId, decision: 'accepted' | 'flagged'): void {
    const entry = this.value.views[view];
    if (!entry.result || entry.status !== 'ready') return;
    if (decision === 'accepted' && blocksAcceptance(entry.qualityReasons))
      return;
    this.update(view, { review: decision });
  }

  /** Explicitly discard a known request before allowing another paid submit. */
  forgetPending(view: GeneratedViewId): void {
    const entry = this.value.views[view];
    if (!entry.pendingMetadata || entry.status === 'generating') return;
    this.update(view, {
      pendingMetadata: null,
      status: entry.result ? 'ready' : 'failed',
      error: entry.result
        ? null
        : 'Existing request forgotten. Generate this view again if needed.',
    });
  }
}
