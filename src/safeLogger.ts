export type SafeLogEvent = 'app_boot' | 'app_boot_failed' | 'flow_transition';

export interface SafeLogMetrics {
  readonly durationMs?: number;
  readonly count?: number;
}

export interface SafeLogRecord {
  readonly event: SafeLogEvent;
  readonly durationMs?: number;
  readonly count?: number;
}

type LogSink = (record: SafeLogRecord) => void;

const events: ReadonlySet<string> = new Set([
  'app_boot',
  'app_boot_failed',
  'flow_transition',
]);

/** Emits only fixed event names and finite numeric metrics; never accepts raw errors or text. */
export function createSafeLogger(debug: boolean, sink: LogSink = console.info) {
  return (event: SafeLogEvent, metrics: SafeLogMetrics = {}): void => {
    if (!debug || !events.has(event)) return;

    const record: {
      event: SafeLogEvent;
      durationMs?: number;
      count?: number;
    } = { event };
    if (
      typeof metrics.durationMs === 'number' &&
      Number.isFinite(metrics.durationMs)
    ) {
      record.durationMs = metrics.durationMs;
    }
    if (typeof metrics.count === 'number' && Number.isFinite(metrics.count)) {
      record.count = metrics.count;
    }
    sink(record);
  };
}
