import {describe,expect,it} from 'vitest';
import {STUDIO_AUTOSAVE_KEY} from './studio-autosave';
import {clearStudioPreferences,STUDIO_RESET_KEYS} from './studio-reset';

describe('studio reset safety',()=>{
  it('only clears the owned draft and UI keys',()=>{
    expect(STUDIO_RESET_KEYS).toEqual([
      STUDIO_AUTOSAVE_KEY,'geometry-ui-theme','geometry-studio-sidebar-width',
      'geometry-studio-command-favorites','geometry-studio-command-recents',
      'geometry-studio-seed-vault-v1',
    ]);
    const values=new Map<string,string>([
      [STUDIO_AUTOSAVE_KEY,'draft'],
      ['geometry-ui-theme','light'],
      ['geometry-studio-sidebar-width','480'],
      ['geometry-studio-command-favorites','["seed"]'],
      ['geometry-studio-command-recents','["open-background"]'],
      ['geometry-studio-seed-vault-v1','{"version":1,"history":[],"cursor":-1,"bookmarks":[]}'],
      ['unrelated-project','must survive'],
    ]);
    clearStudioPreferences({removeItem:key=>{values.delete(key);}});
    expect(values).toEqual(new Map([['unrelated-project','must survive']]));
  });
  it('does not silently swallow storage permission errors',()=>{
    expect(()=>clearStudioPreferences({
      removeItem:()=>{throw new Error('SecurityError');},
    })).toThrow('SecurityError');
  });
});
