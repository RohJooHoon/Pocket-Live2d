import type { CharacterConfig } from '../src/types';
export function createUploadPlan(root: string, characters: CharacterConfig[], layout?: { prefix: string; nested: boolean }): Array<{
  file: string;
  key: string;
  contentType: string;
}>;
