import type { Group } from 'three';
import type { AvatarControlState } from './AvatarControlState';

/** Every prepared avatar must implement this boundary; its internal mesh topology is private. */
export interface AvatarRigAdapter {
  readonly root: Group;
  readonly manifest: {
    readonly kind: string;
    readonly forwardAxis: '+Z';
    readonly upAxis: '+Y';
    readonly units: string;
    readonly nodes: readonly string[];
    readonly morphNames: readonly string[];
  };
  apply(state: Readonly<AvatarControlState>): void;
  dispose(): void;
}
