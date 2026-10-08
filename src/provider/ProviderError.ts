export type ProviderErrorCode =
  | 'missing_key'
  | 'authentication'
  | 'permission'
  | 'quota'
  | 'rate_limit'
  | 'invalid_request'
  | 'not_found'
  | 'provider_unavailable'
  | 'downstream_unavailable'
  | 'provider_protocol'
  | 'network_or_cors'
  | 'invalid_response'
  | 'cancelled';

const messages: Record<ProviderErrorCode, string> = {
  missing_key: 'Enter a fal API key first.',
  authentication: 'fal rejected this API key. Check or replace it.',
  permission: 'This key cannot access the requested fal resource.',
  quota: 'fal reports insufficient balance or quota. Check your fal account.',
  rate_limit: 'fal is rate limiting requests. Wait, then try again.',
  invalid_request: 'fal rejected the request. Check its input and try again.',
  not_found: 'The requested fal endpoint is unavailable.',
  provider_unavailable: 'fal is unavailable. Try again later.',
  downstream_unavailable:
    'A service used by fal could not complete this job. Keep its request ID and check billing before starting another generation.',
  provider_protocol:
    'fal rejected a queue operation. This integration may need an update.',
  network_or_cors:
    'Could not reach fal from this browser. Check the connection and browser cross-origin access.',
  invalid_response: 'fal returned an unexpected response. Try again later.',
  cancelled: 'Request stopped. A queued job may still run or be billed by fal.',
};

export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly status: number | undefined;
  readonly retryable: boolean | undefined;

  constructor(code: ProviderErrorCode, status?: number, retryable?: boolean) {
    super(messages[code]);
    this.name = 'ProviderError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

export function errorFromStatus(
  status: number,
  providerCode?: string,
  retryable?: boolean,
): ProviderError {
  if (status === 401) return new ProviderError('authentication', status);
  if (
    status === 402 ||
    providerCode === 'insufficient_balance' ||
    providerCode === 'quota_exceeded'
  ) {
    return new ProviderError('quota', status);
  }
  if (status === 403) return new ProviderError('permission', status);
  if (status === 429) return new ProviderError('rate_limit', status);
  if (status === 404) return new ProviderError('not_found', status);
  if (status === 405) return new ProviderError('provider_protocol', status);
  if (status === 400 || status === 422)
    return new ProviderError('invalid_request', status);
  if (providerCode === 'downstream_service_unavailable')
    return new ProviderError('downstream_unavailable', status, retryable);
  return new ProviderError('provider_unavailable', status, retryable);
}

export function normalizeProviderFailure(
  error: unknown,
  signal?: AbortSignal,
): ProviderError {
  if (error instanceof ProviderError) return error;
  if (
    signal?.aborted ||
    (error instanceof DOMException && error.name === 'AbortError')
  ) {
    return new ProviderError('cancelled');
  }
  // Never propagate raw browser/provider errors: they may contain request data.
  return new ProviderError('network_or_cors');
}
