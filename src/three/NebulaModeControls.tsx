import {HelpInfo} from '../HelpInfo';
import {ThreeRange} from './ThreeControls';
import {
  NEBULA_PRESET_IDS,NEBULA_PRESETS,nebulaDefaults,nebulaWithPreset,
  type NebulaSettings,type NebulaPreset,
} from './nebula-settings';

export function NebulaModeControls({value,onChange}:{
  value?:NebulaSettings;onChange:(value:NebulaSettings)=>void;
}){
  const nebula=value??nebulaDefaults;
  const edit=(patch:Partial<NebulaSettings>)=>onChange({...nebula,...patch,preset:'custom'});
  return <section className="control-section three-controls" aria-labelledby="nebula-mode-heading" data-testid="nebula-mode-controls">
    <h3 id="nebula-mode-heading">NEBULA MODE · 星雲空間</h3>
    <label className="three-checkbox">
      <input type="checkbox" aria-label="NEBULA MODEを有効化" checked={nebula.enabled}
        onChange={event=>onChange({...nebula,enabled:event.target.checked})}/>
      空間に星雲を追加する
    </label>
    <p className="help">通常の図形・VOID・GALAXY・PARTICLE・2D×3Dハイブリッドと同時に使える3D空間に配置した、カメラを動かすと視差が変わる立体的な星雲です。</p>
    <label htmlFor="nebula-preset">星雲プリセット</label>
    <select id="nebula-preset" aria-label="星雲プリセット" value={nebula.preset}
      onChange={event=>{
        const next=event.target.value as NebulaPreset;
        if(next!=='custom')onChange(nebulaWithPreset(nebula,next));
      }}>
      {NEBULA_PRESET_IDS.map(id=><option key={id} value={id}>{NEBULA_PRESETS[id].label}</option>)}
      <option value="custom">カスタム</option>
    </select>
    <HelpInfo>プリセットを選ぶと星雲がONになり、色・形・アニメーション速度をまとめて設定します。個別調整すると「カスタム」になります。シードや他のモード設定は変えません。</HelpInfo>
    {nebula.enabled&&<>
      <div className="three-kind-grid" role="group" aria-label="星雲の3色">
        {(['colorA','colorB','colorC'] as const).map((field,i)=>
          <label key={field} htmlFor={'nebula-'+field}>色{i+1}
            <input id={'nebula-'+field} type="color" aria-label={'星雲の色'+(i+1)}
              value={nebula[field]} onChange={event=>edit({[field]:event.target.value})}/>
          </label>)}
      </div>
      <ThreeRange id="nebula-density" label="星雲の濃さ" value={nebula.density}
        min={0} max={100} step={5} unit="%" onChange={density=>edit({density})}/>
      <ThreeRange id="nebula-opacity" label="雲の不透明度" value={nebula.opacity}
        min={0} max={100} step={5} unit="%" onChange={opacity=>edit({opacity})}/>
      <ThreeRange id="nebula-brightness" label="星雲の明るさ" value={nebula.brightness}
        min={0} max={200} step={5} unit="%" onChange={brightness=>edit({brightness})}/>
      <ThreeRange id="nebula-glow" label="星雲の発光" value={nebula.glow}
        min={0} max={200} step={5} unit="%" onChange={glow=>edit({glow})}/>
      <ThreeRange id="nebula-scale" label="星雲の広がり" value={nebula.scale}
        min={.2} max={5} step={.1} onChange={scale=>edit({scale})}/>
      <ThreeRange id="nebula-noise" label="ガスのまだら模様" value={nebula.noise}
        min={0} max={100} step={5} unit="%" onChange={noise=>edit({noise})}/>
      <ThreeRange id="nebula-swirl" label="渦の強さ" value={nebula.swirl}
        min={0} max={100} step={5} unit="%" onChange={swirl=>edit({swirl})}/>
      <ThreeRange id="nebula-thickness" label="雲の層の厚み" value={nebula.thickness}
        min={0} max={100} step={5} unit="%" onChange={thickness=>edit({thickness})}/>
      <label className="three-checkbox">
        <input type="checkbox" aria-label="星雲をアニメーションさせる" checked={nebula.animation}
          onChange={event=>edit({animation:event.target.checked})}/>
        星雲をゆっくり流す
      </label>
      {nebula.animation&&<ThreeRange id="nebula-drift" label="星雲の流れる速度"
        value={nebula.driftSpeed} min={0} max={5} step={.05}
        onChange={driftSpeed=>edit({driftSpeed})}/>}
      <p className="help">数千個の淡いガス粒子を3D空間に分散し、GPUでまとめて描きます。カメラを回転・移動すると雲の重なりや奥行きが変化します。軽量品質では粒子数を減らし、PNG・動画にも反映します。</p>
    </>}
  </section>;
}
