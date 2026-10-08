/// <reference types="vite/client" />

/** Character settings from characters/<id>/character.json, injected at build time. */
declare const __CHARACTER__: import('./types').CharacterConfig;
/** Public model storage prefix, e.g. https://models.example.com/models/. */
declare const __MODEL_BASE_URL__: string;
