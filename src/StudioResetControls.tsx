type Props={
  mode:'2d'|'3d';
  disabled:boolean;
  onResetAll:()=>void;
  onReset2D:()=>void;
  onReset3D:()=>void;
  onResetGalaxy:()=>void;
  onResetParticle:()=>void;
  onResetVoid:()=>void;
};

/** Every reset is explicit and confirmed by the parent before changing data. */
export function StudioResetControls({
  mode,disabled,onResetAll,onReset2D,onReset3D,onResetGalaxy,onResetParticle,onResetVoid,
}:Props){
  return <section className="control-section three-controls" data-testid="studio-reset-controls"
      aria-labelledby="studio-reset-heading">
    <h3 id="studio-reset-heading">設定の初期化</h3>
    <p className="help">いじりすぎた時に設定を初期状態へ戻せます。操作前に確認画面が出ます。</p>
    <div className="three-kind-presets">
      {mode==='2d'?
        <button type="button" disabled={disabled} onClick={onReset2D}>2D設定を初期化</button>:
        <>
          <button type="button" disabled={disabled} onClick={onReset3D}>3D設定を初期化</button>
          <button type="button" disabled={disabled} onClick={onResetGalaxy}>GALAXY設定を初期化</button>
          <button type="button" disabled={disabled} onClick={onResetParticle}>PARTICLE設定を初期化</button>
          <button type="button" disabled={disabled} onClick={onResetVoid}>VOID設定を初期化</button>
        </>}
    </div>
    <button type="button" className="generate-button" disabled={disabled} onClick={onResetAll}
      aria-label="すべての設定を初期化">↺ すべて初期化</button>
    <p className="help">「すべて初期化」は2D・3D・シード・配色・画面表示・この端末の自動保存データを消して、最初の状態で開き直します。ダウンロード済みの設定ファイルは削除しません。</p>
  </section>;
}
