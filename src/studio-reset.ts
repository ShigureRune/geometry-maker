import {STUDIO_AUTOSAVE_KEY} from './studio-autosave';

/** The studio's own persisted draft and UI preferences.
 * Never clear the entire localStorage origin: unrelated projects may live there. */
export const STUDIO_RESET_KEYS=[
  STUDIO_AUTOSAVE_KEY,
  'geometry-ui-theme',
  'geometry-studio-sidebar-width',
  'geometry-studio-command-favorites',
  'geometry-studio-command-recents',
  'geometry-studio-seed-vault-v1',
] as const;

/** Used only after explicit confirmation. Reload before rendering a new draft.
 * A pagehide autosave handler must be disabled before invoking this helper. */
export function clearStudioPreferences(storage:Pick<Storage,'removeItem'>):void{
  for(const key of STUDIO_RESET_KEYS)storage.removeItem(key);
}
