import type { ProviderPhase } from '../provider/ProviderClient';
import { normalizeProviderFailure } from '../provider/ProviderError';
import type { ViewSetState } from '../generation/ViewSetSession';
import { viewSetReady } from '../generation/ViewSetSession';
import { downloadOriginalGlb } from './downloadOriginalGlb';
import { OriginalAssetStore } from './OriginalAssetStore';
import type {
  ReconstructionMetadata,
  ReconstructionProvider,
  ReconstructionResult,
} from './ReconstructionProvider';
import {
  ReconstructionRecordStore,
  type ReconstructionRecord,
} from './ReconstructionRecordStore';
import {
  DEFAULT_RECONSTRUCTION_MODEL_ID,
  type ReconstructionModelId,
} from './ReconstructionModels';

export type ReconstructionStatus =
  | 'idle'
  | 'submitting'
  | 'processing'
  | 'downloading'
  | 'discarding'
  | 'ready'
  | 'paused'
  | 'asset_error';

export interface ReconstructionState {
  readonly status: ReconstructionStatus;
  readonly phase: ProviderPhase | null;
  readonly pending: ReconstructionMetadata | null;
  readonly result: ReconstructionResult | null;
  readonly blob: Blob | null;
  readonly savedLocally: boolean;
  readonly accepted: boolean;
  readonly yawDegrees: number;
  readonly error: string | null;
  readonly selectedModelId: ReconstructionModelId;
  readonly history: readonly ReconstructionResult[];
}

function empty(): ReconstructionState {
  return {
    status: 'idle',
    phase: null,
    pending: null,
    result: null,
    blob: null,
    savedLocally: false,
    accepted: false,
    yawDegrees: 0,
    error: null,
    selectedModelId: DEFAULT_RECONSTRUCTION_MODEL_ID,
    history: [],
  };
}

/** One paid reconstruction at a time. Known IDs always resume with GET only. */
export class ReconstructionSession {
  private value = empty();
  private controller: AbortController | null = null;
  private revision = 0;

  constructor(
    private readonly provider: ReconstructionProvider,
    private readonly records: Pick<
      ReconstructionRecordStore,
      'read' | 'write' | 'clear'
    > = new ReconstructionRecordStore(),
    private readonly assets: Pick<
      OriginalAssetStore,
      'read' | 'save' | 'remove' | 'clear'
    > = new OriginalAssetStore(),
    private readonly changed: (state: ReconstructionState) => void = () => {},
    private readonly download: typeof downloadOriginalGlb = downloadOriginalGlb,
  ) {}

  get state(): ReconstructionState {
    return this.value;
  }

  private update(patch: Partial<ReconstructionState>): void {
    this.value = { ...this.value, ...patch };
    const saved = this.records.write({
      pending: this.value.pending,
      result: this.value.result,
      accepted: this.value.accepted,
      yawDegrees: this.value.yawDegrees,
      selectedModelId: this.value.selectedModelId,
      history: this.value.history,
    });
    if (!saved && this.value.pending)
      this.value = {
        ...this.value,
        error:
          'This browser could not save the reconstruction request ID. A refresh may lose recovery.',
      };
    this.changed(this.value);
  }

  async restore(): Promise<void> {
    if (this.controller) return;
    const record = this.records.read();
    if (!record) return;
    this.update({
      ...record,
      selectedModelId:
        record.selectedModelId ??
        ((record.pending?.modelId ??
          DEFAULT_RECONSTRUCTION_MODEL_ID) as ReconstructionModelId),
      history: record.history ?? (record.result ? [record.result] : []),
      status: record.pending
        ? 'paused'
        : record.result
          ? 'downloading'
          : 'idle',
    });
    const saved = record.result
      ? await this.assets.read(record.result.metadata.providerRequestId)
      : null;
    if (
      saved &&
      saved.result.metadata.providerRequestId ===
        record.result?.metadata.providerRequestId
    ) {
      this.update({
        blob: saved.blob,
        savedLocally: true,
        status: record.pending ? 'paused' : 'ready',
      });
    } else if (record.result && !record.pending) {
      await this.retryDownload();
    }
  }

  selectModel(modelId: ReconstructionModelId): void {
    if (
      this.controller ||
      this.value.pending ||
      this.value.status === 'discarding'
    )
      return;
    this.update({ selectedModelId: modelId });
  }

  async create(views: ViewSetState): Promise<void> {
    if (
      this.controller ||
      this.value.pending ||
      this.value.status === 'discarding' ||
      !viewSetReady(views)
    )
      return;
    const controller = new AbortController();
    this.controller = controller;
    const revision = ++this.revision;
    const modelId = this.value.selectedModelId;
    this.update({
      status: 'submitting',
      phase: 'submitting',
      error: null,
      accepted: false,
      yawDegrees: 0,
    });
    try {
      const result = await this.provider.createReconstruction(views, {
        modelId,
        signal: controller.signal,
        onPhase: (phase) => {
          if (revision === this.revision)
            this.update({ status: 'processing', phase });
        },
        onSubmitted: (requestId) => {
          if (revision === this.revision)
            this.update({
              pending: this.provider.metadataFor(views, requestId, modelId),
              status: 'processing',
              phase: 'queued',
            });
        },
      });
      if (revision === this.revision && !controller.signal.aborted)
        await this.complete(result, controller, revision);
    } catch (error) {
      if (revision === this.revision)
        this.update({
          status: this.value.pending ? 'paused' : 'idle',
          phase: null,
          error: normalizeProviderFailure(error, controller.signal).message,
        });
    } finally {
      if (this.controller === controller) this.controller = null;
    }
  }

  async resume(): Promise<void> {
    const metadata = this.value.pending;
    if (!metadata || this.controller) return;
    const controller = new AbortController();
    this.controller = controller;
    const revision = ++this.revision;
    this.update({ status: 'processing', phase: 'queued', error: null });
    try {
      const result = await this.provider.getStatus(
        metadata,
        controller.signal,
        (phase) => {
          if (revision === this.revision) this.update({ phase });
        },
      );
      if (revision === this.revision && !controller.signal.aborted)
        await this.complete(result, controller, revision);
    } catch (error) {
      if (revision === this.revision)
        this.update({
          status: 'paused',
          phase: null,
          error: normalizeProviderFailure(error, controller.signal).message,
        });
    } finally {
      if (this.controller === controller) this.controller = null;
    }
  }

  private async complete(
    result: ReconstructionResult,
    controller: AbortController,
    revision: number,
  ): Promise<void> {
    const history = [
      ...this.value.history.filter(
        (item) =>
          item.metadata.providerRequestId !== result.metadata.providerRequestId,
      ),
      result,
    ].slice(-50);
    this.update({
      pending: null,
      result,
      history,
      blob: null,
      savedLocally: false,
      status: 'downloading',
      phase: null,
      error: null,
      accepted: false,
    });
    await this.fetchAsset(result, controller, revision);
  }

  private async fetchAsset(
    result: ReconstructionResult,
    controller: AbortController,
    revision: number,
  ): Promise<void> {
    try {
      const blob = await this.download(result.asset, controller.signal);
      if (revision !== this.revision || controller.signal.aborted) return;
      this.update({ blob, status: 'ready', error: null });
      try {
        await this.assets.save({ result, blob });
        if (revision === this.revision) this.update({ savedLocally: true });
      } catch {
        if (revision === this.revision)
          this.update({
            error:
              'GLB is available in this tab but could not be saved locally. Download it now to preserve the original.',
          });
      }
    } catch (error) {
      if (revision === this.revision && !controller.signal.aborted)
        this.update({
          status: 'asset_error',
          error:
            error instanceof TypeError
              ? 'Could not download the GLB from this browser. Check connection and cross-origin access.'
              : error instanceof Error
                ? error.message
                : 'Could not download the GLB. Retry the download without another model request.',
        });
    }
  }

  async retryDownload(): Promise<void> {
    const result = this.value.result;
    if (!result || this.controller) return;
    const controller = new AbortController();
    this.controller = controller;
    const revision = ++this.revision;
    this.update({ status: 'downloading', error: null });
    try {
      await this.fetchAsset(result, controller, revision);
    } finally {
      if (this.controller === controller) this.controller = null;
    }
  }

  async showHistory(requestId: string): Promise<void> {
    if (
      this.controller ||
      this.value.pending ||
      this.value.status === 'discarding'
    )
      return;
    const result = this.value.history.find(
      (item) => item.metadata.providerRequestId === requestId,
    );
    if (!result) return;
    const revision = ++this.revision;
    const saved = await this.assets.read(requestId);
    if (revision !== this.revision) return;
    this.update({
      result,
      blob:
        saved?.result.metadata.providerRequestId === requestId
          ? saved.blob
          : null,
      savedLocally: saved?.result.metadata.providerRequestId === requestId,
      status: saved ? 'ready' : 'asset_error',
      accepted: false,
      yawDegrees: 0,
      error: saved
        ? null
        : 'Saved GLB unavailable. Retry the download without another model request.',
    });
  }

  /** Delete only the selected local result. Approved source views and other results survive. */
  async discardCurrent(): Promise<void> {
    const result = this.value.result;
    if (
      !result ||
      this.controller ||
      this.value.pending ||
      this.value.status === 'discarding'
    )
      return;
    const priorStatus = this.value.status;
    const revision = ++this.revision;
    const requestId = result.metadata.providerRequestId;
    this.update({ status: 'discarding', error: null });
    try {
      if (this.value.savedLocally) await this.assets.remove(requestId);
      if (revision !== this.revision) return;
      const history = this.value.history.filter(
        (item) => item.metadata.providerRequestId !== requestId,
      );
      this.update({
        status: 'idle',
        phase: null,
        result: null,
        blob: null,
        savedLocally: false,
        accepted: false,
        yawDegrees: 0,
        error: null,
        history,
      });
      if (history.length === 0) this.records.clear();
    } catch {
      if (revision === this.revision)
        this.update({
          status: priorStatus,
          error: 'Could not delete this GLB from browser storage. Try again.',
        });
    }
  }

  pause(): void {
    ++this.revision;
    this.controller?.abort('pause');
    this.controller = null;
    if (
      this.value.status === 'submitting' ||
      this.value.status === 'processing'
    )
      this.update({
        status: this.value.pending ? 'paused' : 'idle',
        phase: null,
      });
    else if (this.value.status === 'downloading')
      this.update({
        status: 'asset_error',
        error:
          'Download paused. Retry the GLB download without another model request.',
      });
  }

  cancel(): void {
    ++this.revision;
    this.controller?.abort('cancel');
    this.controller = null;
    this.update({
      status: this.value.pending ? 'paused' : 'idle',
      phase: null,
      error: this.value.pending
        ? 'Remote cancellation is best effort. Resume this request before paying for another.'
        : null,
    });
  }

  forgetPending(): void {
    if (this.controller || !this.value.pending) return;
    this.update({
      pending: null,
      status: 'idle',
      error:
        'Request reference forgotten. A new reconstruction may incur another charge.',
    });
  }

  accept(): void {
    if (this.value.status === 'ready' && this.value.blob)
      this.update({ accepted: true });
  }

  setYaw(degrees: number): void {
    if (Number.isFinite(degrees))
      this.update({
        yawDegrees: Math.max(-180, Math.min(180, degrees)),
        accepted: false,
      });
  }

  async clear(): Promise<void> {
    this.pause();
    this.value = empty();
    this.records.clear();
    this.changed(this.value);
    await this.assets.clear();
  }

  record(): ReconstructionRecord {
    return {
      pending: this.value.pending,
      result: this.value.result,
      accepted: this.value.accepted,
      yawDegrees: this.value.yawDegrees,
      selectedModelId: this.value.selectedModelId,
      history: this.value.history,
    };
  }
}
