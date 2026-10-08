import type { CharacterConfig } from '../src/types';
export const root: string;
export function readSiteConfig(mode?: string): {
  characters: CharacterConfig[];
  defaultId: string;
  modelBase: string;
  assetLayout: { prefix: string; nested: boolean };
  env: Record<string, string | undefined>;
};
