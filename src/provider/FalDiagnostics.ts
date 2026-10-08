import type { ProviderErrorCode } from './ProviderError';

export type FalOperation =
  | 'pricing_check'
  | 'queue_submit'
  | 'queue_status'
  | 'queue_result'
  | 'queue_cancel';

export type FalDiagnosticStep =
  | 'check_clicked'
  | 'request_preflight_failed'
  | 'fetch_start'
  | 'response_received'
  | 'request_complete'
  | 'request_failed'
  | 'response_validated'
  | 'queue_state';

export type FalQueueState = 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED';

export type BrowserFailure =
  | 'aborted'
  | 'invalid_header'
  | 'invalid_receiver'
  | 'failed_to_fetch'
  | 'load_failed'
  | 'network_error'
  | 'other_type_error'
  | 'unknown';

/** Fixed, safe metadata only. Never add headers, input, response bodies, raw errors or keys. */
export interface FalDiagnostic {
  readonly at: string;
  readonly operation: FalOperation;
  readonly step: FalDiagnosticStep;
  readonly requestNumber?: number;
  readonly method?: 'GET' | 'POST' | 'PUT';
  readonly status?: number;
  readonly durationMs?: number;
  readonly errorCode?: ProviderErrorCode;
  readonly browserFailure?: BrowserFailure;
  readonly online?: boolean;
  readonly secureContext?: boolean;
  readonly queueState?: FalQueueState;
  readonly queuePosition?: number;
}

export type FalDiagnosticSink = (event: FalDiagnostic) => void;

/** Classifies native fetch failures without exposing Error.message. */
export function classifyBrowserFailure(error: unknown): BrowserFailure {
  if (error instanceof DOMException && error.name === 'AbortError')
    return 'aborted';
  if (!(error instanceof TypeError)) return 'unknown';
  const message = error.message.toLowerCase();
  if (message.includes('illegal invocation')) return 'invalid_receiver';
  if (/header|byte string|invalid character/.test(message))
    return 'invalid_header';
  if (message.includes('failed to fetch')) return 'failed_to_fetch';
  if (message.includes('load failed')) return 'load_failed';
  if (message.includes('networkerror')) return 'network_error';
  return 'other_type_error';
}

export function browserEnvironment(): {
  online?: boolean;
  secureContext?: boolean;
} {
  return {
    ...(typeof navigator !== 'undefined' ? { online: navigator.onLine } : {}),
    ...(typeof isSecureContext === 'boolean'
      ? { secureContext: isSecureContext }
      : {}),
  };
}
