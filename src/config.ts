export type ProviderId = 'fal';

export interface AppConfig {
  readonly mode: 'development' | 'production' | 'debug';
  readonly debug: boolean;
  readonly provider: ProviderId;
}

interface PublicEnvironment {
  readonly mode: string;
  readonly provider: string | undefined;
}

/** Only public, non-secret build settings may enter this configuration. */
export function readConfig(environment: PublicEnvironment): AppConfig {
  if (
    environment.mode !== 'development' &&
    environment.mode !== 'production' &&
    environment.mode !== 'debug'
  ) {
    throw new Error('Unsupported application mode');
  }

  const provider = environment.provider ?? 'fal';
  if (provider !== 'fal') {
    throw new Error('Unsupported provider');
  }

  return {
    mode: environment.mode,
    debug: environment.mode !== 'production',
    provider,
  };
}
