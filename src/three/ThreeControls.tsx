import {HelpInfo} from '../HelpInfo';
import type {ThreeSettings} from './settings';
import {visibilityDefaults,type ThreeVisibilitySettings} from './visibility';
import {entranceDefaults,threeEntranceStyle,type ThreeEntranceSettings} from './entrance';
import {THREE_KINDS,THREE_CLASSIC_KINDS,THREE_NEW_KINDS,THREE_SPACING_DEFAULT,type ThreeKind} from './model';
import {CELESTIAL_KINDS, CELESTIAL_LABELS, celestialDefaults} from './celestial';
import {particleDefaults} from './particle';
import {VOID_WEB_VERSION} from './void-settings';
import {VOID_PARTICLE_DEFAULT,VOID_PARTICLE_HIGH_LIMIT,VOID_PARTICLE_LOW_LIMIT} from './void-particle';
import {GALAXY_PALETTES,GALAXY_TYPES,GALAXY_TYPE_LABELS,galaxyDefaults,type GalaxyPalette,type GalaxyType} from './galaxy';
import {GALAXY_PRESETS,galaxyWithPreset,type GalaxyPreset} from './galaxy-presets';

export const THREE_KIND_LABELS: Record<ThreeKind,string> = {
  sphere:'球体',cube:'立方体',torus:'トーラス',
  icosahedron:'正二十面体',dodecahedron:'正十二面体',
  octahedron:'正八面体',tetrahedron:'正四面体',
  cylinder:'円柱',cone:'円すい',capsule:'カプセル',
  prism:'三角柱',pyramid:'四角すい','torus-knot':'トーラスノット',
};

type Props = {settings: ThreeSettings; onChange: (settings: ThreeSettings) => void};
export function ThreeRange({id, label, value, min, max, step = .05, unit = '', onChange}: {
  id: string; label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (n: number) => void;
}) {
  return <div className="three-range">
    <label htmlFor={id}>{label}</label><output htmlFor={id}>{value.toFixed(step < 1 ? 2 : 0)}{unit}</output>
    <input id={id} type="range" min={min} max={max} step={step} value={value} aria-valuetext={`${value}${unit}`} onChange={event => onChange(Number(event.target.value))}/>
  </div>;
}
export function ThreeShapeControls({settings, onChange}: Props) {
  const celestial = settings.celestial ?? celestialDefaults;
  const particle = settings.particle ?? particleDefaults;
  const galaxy=settings.galaxy??galaxyDefaults;
  const cosmicWeb=!!settings.voidMode?.enabled&&settings.voidMode.version===VOID_WEB_VERSION;
  const legacyVoid=!!settings.voidMode?.enabled&&!cosmicWeb;
  return <section className="control-section three-controls">
    <div className="studio-setting-label studio-setting-heading"><h3>3D図形</h3>
      <HelpInfo>13種類の立体から生成します。図形の種類だけ変えても位置・シード・密度は維持されます。</HelpInfo>
    </div>
    <ThreeRange id="three-spacing" label="図形の間隔" value={settings.spacingPercent??THREE_SPACING_DEFAULT}
      min={50} max={200} step={5} unit="%" onChange={spacingPercent=>onChange({...settings,spacingPercent})}/>
    <HelpInfo>{settings.voidMode?.enabled
      ? 'VOIDでは100%が従来の間隔です。空洞・フィラメント・図形の位置を一緒に広げたり縮めたりします。図形の大きさや接続は変わりません。'
      : '100%が標準（以前の約1.5倍の距離）。約65〜70%で以前に近い間隔です。図形の大きさ自体は変えず、配置を広げます。カメラは向きを保って距離に合わせて調整します。'}</HelpInfo>
    <fieldset className="three-kind-fieldset"><legend>図形の種類（${(settings.enabledKinds??THREE_KINDS).length}/13）</legend>
      <div className="three-kind-presets">
        <button type="button" onClick={()=>onChange({...settings,enabledKinds:[...THREE_KINDS]})}>全種類</button>
        <button type="button" onClick={()=>onChange({...settings,enabledKinds:[...THREE_CLASSIC_KINDS]})}>従来の7種類</button>
        <button type="button" onClick={()=>onChange({...settings,enabledKinds:[...THREE_NEW_KINDS]})}>新しい6種類</button>
      </div>
      <div className="three-kind-grid" role="group" aria-label="生成する3D図形">
        {THREE_KINDS.map(kind=><label key={kind} className="three-kind-check">
          <input type="checkbox" checked={(settings.enabledKinds??THREE_KINDS).includes(kind)} aria-label={`${THREE_KIND_LABELS[kind]}を生成`}
            onChange={event=>{
              const enabled=settings.enabledKinds??THREE_KINDS;
              onChange({...settings,enabledKinds:event.target.checked?
                THREE_KINDS.filter(k=>k===kind||enabled.includes(k)):enabled.filter(k=>k!==kind)});
            }}/>
          <span>{THREE_KIND_LABELS[kind]}</span>
        </label>)}
      </div>
      {(settings.enabledKinds??THREE_KINDS).length===0&&<p className="help" role="status">すべてOFFです。1種類以上選ぶと図形が表示されます。</p>}
    </fieldset>
    <fieldset className="three-kind-fieldset">
      <legend>星や惑星（6種類）</legend>
      <label className="three-checkbox"><input type="checkbox" aria-label="3D天体を表示" checked={celestial.enabled}
        onChange={event => onChange({...settings, celestial: {...celestial, enabled: event.target.checked}})}/>
        3D空間に天体を追加
      </label>
      <div className="three-kind-presets">
        <button type="button" onClick={() => onChange({...settings, enabledKinds: [],
          celestial: {...celestial, enabled: true, kinds: [...CELESTIAL_KINDS]}})}>天体のみ表示</button>
        <button type="button" onClick={() => onChange({...settings, enabledKinds: [...THREE_KINDS],
          celestial: {...celestial, enabled: true, kinds: [...CELESTIAL_KINDS]}})}>図形＋天体</button>
      </div>
      <div className="three-kind-grid" role="group" aria-label="生成する天体">
        {CELESTIAL_KINDS.map(kind => <label key={kind} className="three-kind-check">
          <input type="checkbox" checked={celestial.kinds.includes(kind)} aria-label={CELESTIAL_LABELS[kind] + 'を生成'}
            onChange={event => onChange({...settings, celestial: {...celestial, enabled: true,
              kinds: event.target.checked ? CELESTIAL_KINDS.filter(k => k === kind || celestial.kinds.includes(k)) :
                celestial.kinds.filter(k => k !== kind)}})}/>
          <span>{CELESTIAL_LABELS[kind]}</span>
        </label>)}
      </div>
      <HelpInfo>5種類の主要天体はほぼ同じ直径、衛星は惑星の約1/4です。ブラックホールには軽量な疑似重力レンズ、中性子星には高速回転する2方向のビームを付けます。天体は既存の13種類と独立して表示されます。</HelpInfo>
    </fieldset>
    <fieldset className="three-kind-fieldset" data-testid="particle-mode-controls">
      <legend>PARTICLE MODE · 渦巻き集合</legend>
      <label className="three-checkbox">
        <input type="checkbox" aria-label="PARTICLE MODEを有効化" checked={particle.enabled}
          disabled={legacyVoid}
          onChange={event=>onChange({...settings,particle:{...particle,enabled:event.target.checked},
             galaxy:{...galaxy,enabled:false}})}/>
        {cosmicWeb?'コズミックウェブを粒子で描く':'立体を粒子で描く'}
      </label>
      {legacyVoid&&<p className="help">旧VOIDプロトタイプは従来の立体描画専用です。大規模コズミックウェブに切り替えるとPARTICLE MODEを使えます。</p>}
      {cosmicWeb&&<p className="help">コズミックウェブとPARTICLE MODEを同時に使用できます。結節点とフィラメントを一括GPU描画し、元の配線の表示も維持します。GPUで密集したウェブを描画します。粒子数の上限は「3D描画品質」で決まります。高品質は最大500,000粒子、軽量は最大80,000粒子。自動では端末に応じて軽量／高品質を選択し、スマホでも高品質を手動選択すると高密度表示を試せます（動作が重い場合は軽量へ戻してください）。通常3Dの粒子数とは別設定です。</p>}
      {particle.enabled&&<>
        {cosmicWeb?<ThreeRange id="particle-count" label="コズミックウェブ粒子数" value={settings.voidMode?.particleCount??VOID_PARTICLE_DEFAULT}
          min={1000} max={VOID_PARTICLE_HIGH_LIMIT} step={1000} unit="個"
          onChange={particleCount=>onChange({...settings,voidMode:{...settings.voidMode!,particleCount}})}/>:
          <ThreeRange id="particle-count" label="粒子数" value={particle.count} min={500} max={12000} step={500} unit="個"
            onChange={count=>onChange({...settings,particle:{...particle,count}})}/>}
        {cosmicWeb&&<p className="help">初期値{VOID_PARTICLE_DEFAULT.toLocaleString('ja-JP')}粒子。軽量品質は最大{VOID_PARTICLE_LOW_LIMIT.toLocaleString('ja-JP')}、高品質は最大{VOID_PARTICLE_HIGH_LIMIT.toLocaleString('ja-JP')}粒子です。「自動」は端末に応じて品質を決定します。設定した粒子数は保存されます。</p>}
        <ThreeRange id="particle-duration" label="集合にかかる時間" value={particle.duration} min={.5} max={15} step={.1} unit="秒"
          onChange={duration=>onChange({...settings,particle:{...particle,duration}})}/>
        <ThreeRange id="particle-swirl" label="渦の強さ" value={particle.swirl} min={0} max={3} step={.1}
          onChange={swirl=>onChange({...settings,particle:{...particle,swirl}})}/>
        <ThreeRange id="particle-spread" label="最初の広がり" value={particle.spread*100} min={50} max={300} step={10} unit="%"
          onChange={spread=>onChange({...settings,particle:{...particle,spread:spread/100}})}/>
        <ThreeRange id="particle-height" label="最初の高さ" value={particle.height*100} min={50} max={300} step={10} unit="%"
          onChange={height=>onChange({...settings,particle:{...particle,height:height/100}})}/>
        <label className="three-checkbox"><input type="checkbox" aria-label="シード変更時に粒子を再集合" checked={particle.seedTransition}
          onChange={event=>onChange({...settings,particle:{...particle,seedTransition:event.target.checked}})}/> シード変更時に渦巻いて再集合</label>
        {particle.seedTransition&&<ThreeRange id="particle-seed-duration" label="シード切替の時間" value={particle.seedDuration} min={.5} max={15} step={.1} unit="秒"
          onChange={seedDuration=>onChange({...settings,particle:{...particle,seedDuration}})}/>}
        <label className="three-checkbox"><input type="checkbox" aria-label="粒子の揺らぎ" checked={particle.jitter}
          onChange={event=>onChange({...settings,particle:{...particle,jitter:event.target.checked}})}/> 粒子を小さく揺らす</label>
        <HelpInfo>{cosmicWeb?'コズミックウェブでは結節点と実際のフィラメントに粒子を配置し、GPUで渦巻き集合を再生します。元の多数の立体メッシュの代わりに粒子を1回の描画命令で描画するため軽量です。粒子は高品質最大50万個・軽量最大8万個。粒子数は既存の3D描画品質の選択に従います。シード変更で新しいウェブへ再集合します。通常のPARTICLE MODEの表面サンプリングとシード変形は変更しません。':'図形の表面に渦を描きながら粒子が集合します。方向はシードで決まり、完成後は立体に沿って浮遊・回転します。軽量描画では粒子を最大1600個に抑えます。ランダム・手入力・自動待機のシード変更時は、今見えている粒子から新しい図形へ渦巻いて移動します。再生と動画・PNG・JSON保存には既存の3D機能を使います。'}</HelpInfo>
      </>}
    </fieldset>
    <fieldset className="three-kind-fieldset" data-testid="galaxy-mode-controls">
      <legend>GALAXY MODE · 巨大銀河</legend>
      <label className="three-checkbox">
        <input type="checkbox" aria-label="GALAXY MODEを有効化" checked={galaxy.enabled}
          disabled={!!settings.voidMode?.enabled}
          onChange={event=>onChange({...settings,galaxy:{...galaxy,enabled:event.target.checked},
            particle:{...particle,enabled:false}})}/>
        巨大銀河を生成する
      </label>
      {settings.voidMode?.enabled&&<p className="help">VOIDモードをOFFにすると銀河を生成できます。</p>}
      {galaxy.enabled&&<>
        <label htmlFor="galaxy-type">銀河タイプ</label>
        <select id="galaxy-type" aria-label="銀河タイプ" value={galaxy.galaxyType}
          onChange={event=>{
            const galaxyType=event.target.value as GalaxyType;
            onChange({...settings,galaxy:{...galaxy,galaxyType,
              barred:galaxyType==='barred_spiral'}});
          }}>
          {GALAXY_TYPES.map(type=><option key={type} value={type}>{GALAXY_TYPE_LABELS[type]}</option>)}
        </select>
        <label htmlFor="galaxy-preset">銀河プリセット</label>
        <select id="galaxy-preset" aria-label="銀河プリセット" value=""
          onChange={event=>{
            if(event.target.value)
              onChange({...settings,galaxy:galaxyWithPreset(galaxy,event.target.value as GalaxyPreset)});
          }}>
          <option value="">プリセットを選ぶ</option>
          {(Object.entries(GALAXY_PRESETS) as [GalaxyPreset,typeof GALAXY_PRESETS[GalaxyPreset]][]).map(([id,preset])=>
            <option key={id} value={id}>{preset.label}</option>)}
        </select>
        <label className="three-checkbox">
          <input type="checkbox" aria-label="銀河に暗い宇宙背景を使う" checked={galaxy.darkBackground}
            onChange={event=>onChange({...settings,galaxy:{...galaxy,darkBackground:event.target.checked}})}/>
          暗い宇宙背景を使う（推奨）
        </label>
        <div className="three-kind-presets">
          <button type="button" onClick={()=>onChange({...settings,galaxy:{...galaxy,
            galaxyType:'grand_design',arms:2,twist:1.5,armWidth:1.25,coreGlow:75,dust:35,darkBackground:true,
            inclination:23,barred:false,count:Math.max(galaxy.count,18000)}})}>
            観測写真風（2本腕）に整える
          </button>
        </div>
        <ThreeRange id="galaxy-count" label="星の数" value={galaxy.count} min={1000} max={30000} step={500} unit="個"
          onChange={count=>onChange({...settings,galaxy:{...galaxy,count}})}/>
        {['grand_design','barred_spiral','flocculent','interacting'].includes(galaxy.galaxyType)&&<>
        <ThreeRange id="galaxy-arms" label="螺旋腕の数" value={galaxy.arms} min={2} max={8} step={1} unit="本"
          onChange={arms=>onChange({...settings,galaxy:{...galaxy,arms}})}/>
        <ThreeRange id="galaxy-twist" label="渦の巻き込み" value={galaxy.twist} min={.4} max={4} step={.1}
          onChange={twist=>onChange({...settings,galaxy:{...galaxy,twist}})}/>
        <ThreeRange id="galaxy-arm-width" label="腕の太さ・広がり" value={galaxy.armWidth} min={.5} max={2.5} step={.05}
          onChange={armWidth=>onChange({...settings,galaxy:{...galaxy,armWidth}})}/>
        </>}
        {galaxy.galaxyType==='ring'&&<>
          <ThreeRange id="galaxy-ring-radius" label="リング半径" value={galaxy.ringRadius} min={.35} max={.90} step={.01}
            onChange={ringRadius=>onChange({...settings,galaxy:{...galaxy,ringRadius}})}/>
          <ThreeRange id="galaxy-ring-width" label="リングの太さ" value={galaxy.ringWidth} min={.04} max={.30} step={.01}
            onChange={ringWidth=>onChange({...settings,galaxy:{...galaxy,ringWidth}})}/>
        </>}
        {galaxy.galaxyType==='elliptical'&&
          <ThreeRange id="galaxy-ellipticity" label="楕円率" value={galaxy.ellipticity} min={.05} max={.85} step={.01}
            onChange={ellipticity=>onChange({...settings,galaxy:{...galaxy,ellipticity}})}/>}
        {galaxy.galaxyType==='flocculent'&&<>
          <ThreeRange id="galaxy-clumpiness" label="星団のまとまり" value={galaxy.clumpiness} min={0} max={1} step={.05}
            onChange={clumpiness=>onChange({...settings,galaxy:{...galaxy,clumpiness}})}/>
          <ThreeRange id="galaxy-branchiness" label="小腕の枝分かれ" value={galaxy.branchiness} min={0} max={1} step={.05}
            onChange={branchiness=>onChange({...settings,galaxy:{...galaxy,branchiness}})}/>
        </>}
        {galaxy.galaxyType==='irregular'&&
          <ThreeRange id="galaxy-irregularity" label="不規則さ" value={galaxy.irregularity} min={0} max={1} step={.05}
            onChange={irregularity=>onChange({...settings,galaxy:{...galaxy,irregularity}})}/>}
        {galaxy.galaxyType==='interacting'&&<>
          <ThreeRange id="galaxy-companion-distance" label="伴銀河の距離" value={galaxy.companionDistance}
            min={.5} max={1.3} step={.05}
            onChange={companionDistance=>onChange({...settings,galaxy:{...galaxy,companionDistance}})}/>
          <ThreeRange id="galaxy-companion-size" label="伴銀河のサイズ" value={galaxy.companionSize}
            min={.25} max={.7} step={.05}
            onChange={companionSize=>onChange({...settings,galaxy:{...galaxy,companionSize}})}/>
          <ThreeRange id="galaxy-tidal" label={galaxy.tidalDynamicsEnabled?'潮汐力・引きはがし':'潮汐の尾'} value={galaxy.tidalStrength} min={0} max={1} step={.05}
            onChange={tidalStrength=>onChange({...settings,galaxy:{...galaxy,tidalStrength}})}/>
        </>}
        <ThreeRange id="galaxy-radius" label="銀河の広がり" value={galaxy.radius} min={3} max={10} step={.5}
          onChange={radius=>onChange({...settings,galaxy:{...galaxy,radius}})}/>
        <ThreeRange id="galaxy-inclination" label="円盤の傾き" value={galaxy.inclination} min={0} max={75} step={1} unit="°"
          onChange={inclination=>onChange({...settings,galaxy:{...galaxy,inclination}})}/>
        {galaxy.galaxyType==='grand_design'&&
        <label className="three-checkbox"><input type="checkbox" aria-label="棒状渦巻銀河にする"
          checked={galaxy.barred} onChange={event=>onChange({...settings,galaxy:{...galaxy,barred:event.target.checked}})}/>
          中心を棒状にする
        </label>}
        <ThreeRange id="galaxy-core" label="中心核の発光" value={galaxy.coreGlow} min={0} max={200} step={5} unit="%"
          onChange={coreGlow=>onChange({...settings,galaxy:{...galaxy,coreGlow}})}/>
        <ThreeRange id="galaxy-dust" label="星間ダスト" value={galaxy.dust} min={0} max={60} step={5} unit="%"
          onChange={dust=>onChange({...settings,galaxy:{...galaxy,dust}})}/>
        <ThreeRange id="galaxy-spin" label="銀河の回転速度" value={galaxy.rotationSpeed} min={0} max={2} step={.1}
          onChange={rotationSpeed=>onChange({...settings,galaxy:{...galaxy,rotationSpeed}})}/>
        <label className="three-checkbox"><input id="galaxy-gravity-enabled"
          type="checkbox" aria-label="銀河の重力シミュレーションを有効化"
          checked={galaxy.gravityEnabled}
          onChange={event=>onChange({...settings,galaxy:{
            ...galaxy,gravityEnabled:event.target.checked}})}/>
          <strong>重力シミュレーション（試作）</strong>
        </label>
        {galaxy.gravityEnabled&&<>
          <ThreeRange id="galaxy-gravity-strength" label="重力の強さ"
            value={galaxy.gravityStrength} min={.1} max={2.5} step={.1}
            onChange={gravityStrength=>onChange({...settings,galaxy:{
              ...galaxy,gravityStrength}})}/>
          <ThreeRange id="galaxy-gravity-halo" label="暗黒物質ハローの強さ"
            value={galaxy.gravityHalo} min={0} max={2} step={.1}
            onChange={gravityHalo=>onChange({...settings,galaxy:{
              ...galaxy,gravityHalo}})}/>
          <label className="three-checkbox">
            <input id="galaxy-self-gravity" type="checkbox"
              aria-label="Barnes-Hut法で星同士の自己重力を計算"
              checked={galaxy.selfGravityEnabled}
              onChange={event=>onChange({...settings,galaxy:{
                ...galaxy,selfGravityEnabled:event.target.checked}})}/>
            <strong>星同士の重力（Barnes–Hut）</strong>
          </label>
          {galaxy.selfGravityEnabled&&<>
            <ThreeRange id="galaxy-self-gravity-strength" label="恒星の自己重力"
              value={galaxy.selfGravityStrength} min={0} max={2} step={.1}
              onChange={selfGravityStrength=>onChange({...settings,galaxy:{
                ...galaxy,selfGravityStrength}})}/>
            <ThreeRange id="galaxy-self-gravity-samples" label="重力源に使う星の数"
              value={galaxy.selfGravitySamples} min={256} max={2048} step={256}
              unit="個" onChange={selfGravitySamples=>onChange({...settings,galaxy:{
                ...galaxy,selfGravitySamples}})}/>
            <HelpInfo>星の分布から四分木を構築し、離れた星団の重力をまとめて計算します。画面上の全星が星同士の重力を受けますが、負荷を抑えるため重力源は最大2,048個を代表サンプリングし、モバイル相当の低画質では最大384個に制限します。加速度の再計算も間引くため、完全N体計算ではなく近似シミュレーションです。既存の中心核・暗黒物質ハロー・潮汐尾はそのまま維持されます。</HelpInfo>
          </>}
          {galaxy.galaxyType==='interacting'&&<>
            <label className="three-checkbox"><input id="galaxy-moving-cores"
              type="checkbox" aria-label="銀河核同士を重力で動かす"
              checked={galaxy.movingCoresEnabled}
              onChange={event=>onChange({...settings,galaxy:{
                ...galaxy,movingCoresEnabled:event.target.checked}})}/>
              銀河核同士の重力・衝突・合体
            </label>
            {galaxy.movingCoresEnabled&&<>
              <ThreeRange id="galaxy-core-approach" label="銀河核の接近速度"
                min={0} max={2} step={.05} value={galaxy.coreApproachSpeed}
                onChange={coreApproachSpeed=>onChange({...settings,galaxy:{
                  ...galaxy,coreApproachSpeed}})}/>
              <ThreeRange id="galaxy-core-impact" label="衝突のずれ（接近角度）"
                min={0} max={1} step={.05} value={galaxy.coreImpactParameter}
                onChange={coreImpactParameter=>onChange({...settings,galaxy:{
                  ...galaxy,coreImpactParameter}})}/>
              <ThreeRange id="galaxy-core-merge" label="銀河核の合体距離"
                min={.05} max={.4} step={.01} value={galaxy.coreMergeDistance}
                onChange={coreMergeDistance=>onChange({...settings,galaxy:{
                  ...galaxy,coreMergeDistance}})}/>
              <ThreeRange id="galaxy-core-friction" label="軌道減衰（力学的摩擦）"
                min={0} max={2} step={.1} value={galaxy.coreFriction}
                onChange={coreFriction=>onChange({...settings,galaxy:{
                  ...galaxy,coreFriction}})}/>
              <label className="three-checkbox">
                <input id="galaxy-tidal-dynamics" type="checkbox"
                  aria-label="重力で潮汐尾と星の引きはがしを生成"
                  checked={galaxy.tidalDynamicsEnabled}
                  onChange={event=>onChange({...settings,galaxy:{
                    ...galaxy,tidalDynamicsEnabled:event.target.checked}})}/>
                <strong>潮汐尾・星の引きはがし（重力計算）</strong>
              </label>
              {galaxy.tidalDynamicsEnabled&&
                <HelpInfo>最初から描かれていた飾りの尾を使わず、両銀河の回転円盤から星を始動。移動する銀河核の速度を星に引き継ぎ、互いの重力の差で星が引きはがされ、橋や長い尾を作ります。「潮汐力・引きはがし」は0なら潮汐変形なし、通常値の0.65が物理近似に相当し、1で演出を少し強調します。コアの合体後も離れた星は飛行を続けます。完全N体計算ではありません。</HelpInfo>}
              <HelpInfo>銀河核はまず互いに近づき、回り込んで離れ、重力で再び接近します。2回以上の近接通過を実際に完了し、軌道減衰で次第に小さい軌道になったあとで合体します。「軌道減衰」が0なら自動合体せず、すれ違いを続けます。接近速度やずれを調整して軌道を変えられます。星・ガス・中心の光も動きます。質量と運動量を保存する軽量な2体＋粒子近似で、完全なN体銀河衝突ではありません。</HelpInfo>
            </>}
          </>}
          <HelpInfo>星とガスが中心バルジと暗黒物質ハローの重力場を受け、時間とともに軌道が変化します。相互作用銀河では2つの重力源を使用します。完全N体計算ではなく、各星の相互重力は省いた軽量な近似です。再生・停止や重力パラメーターで動きが変わり、OFFにすると元の銀河表示に戻ります。</HelpInfo>
        </>}
        <label htmlFor="galaxy-palette">銀河の色テーマ</label>
        <select id="galaxy-palette" value={galaxy.palette}
          onChange={event=>onChange({...settings,galaxy:{...galaxy,palette:event.target.value as GalaxyPalette}})}>
          {GALAXY_PALETTES.map(name=><option key={name} value={name}>{({
            violet:'紫・青の銀河',blue:'青白い銀河',rose:'ローズ星雲',gold:'黄金銀河',
          } as Record<GalaxyPalette,string>)[name]}</option>)}
        </select>
        <label className="three-checkbox"><input type="checkbox" aria-label="銀河のシード変更アニメーション"
          checked={galaxy.seedTransition} onChange={event=>onChange({...settings,galaxy:{...galaxy,seedTransition:event.target.checked}})}/>
          シード変更で別の銀河へ変形
        </label>
        {galaxy.seedTransition&&<ThreeRange id="galaxy-transition" label="銀河切替時間" value={galaxy.transitionSeconds}
          min={.5} max={15} step={.5} unit="秒"
          onChange={transitionSeconds=>onChange({...settings,galaxy:{...galaxy,transitionSeconds}})}/>}
        <HelpInfo>7種類の銀河タイプで、星の3D配置と光るガスの形の両方を切り替えます。リング、楕円、フロキュレント、不規則、相互作用の専用設定とプリセットを用意しました。星と光るガスの2層を描き、暗い宇宙背景と組み合わせて銀河の濃淡を再現します。ハッブルの銀河写真を参考に、暖色の中心核・淡い星の円盤・広い螺旋腕・青い星団・ピンクの星形成域・暗いダスト筋を再現します。棒状銀河や円盤の傾きも選択できます。シードで恒星の分布が変わり、再生・停止・PNG・動画保存に対応。高品質は最大30,000個、軽量設定は最大3,600個。大きな銀河はカメラを引いて見ることができます。VOIDやPARTICLE MODEとは排他的です。</HelpInfo>
      </>}
    </fieldset>
    <label htmlFor="three-quality">3D描画品質</label>
    <select id="three-quality" value={settings.quality} onChange={event => onChange({...settings, quality: event.target.value as ThreeSettings['quality']})}>
      <option value="auto">自動（スマホは軽量）</option><option value="low">軽量</option><option value="high">高品質</option>
    </select>
    <HelpInfo>軽量設定では解像度・曲面の分割数を抑え、影とブルームを省略します。図形の配置と色は維持します。</HelpInfo>
  </section>;
}
export function ThreeMaterialControls({settings, onChange}: Props) {
  return <section className="control-section three-controls">
    <div className="studio-setting-label studio-setting-heading"><h3>質感と光</h3>
      <HelpInfo>上の発光強度を共用します。高品質では主役を中心にブルームを適用し、軽量ではマテリアルの自己発光で表現します。</HelpInfo>
    </div>
    <label htmlFor="three-material">マテリアル</label>
    <select id="three-material" value={settings.material} onChange={event => onChange({...settings, material: event.target.value as ThreeSettings['material']})}>
      <option value="theme">テーマに合わせる</option><option value="matte">マット</option><option value="metal">メタル</option><option value="glass">ガラス</option><option value="wireframe">ワイヤーフレーム</option>
    </select>
    <ThreeRange id="three-roughness" label="表面の粗さ" value={settings.roughness} min={0} max={1} onChange={roughness => onChange({...settings, roughness})}/>
    <ThreeRange id="three-metalness" label="金属感" value={settings.metalness} min={0} max={1} onChange={metalness => onChange({...settings, metalness})}/>
    <ThreeRange id="three-light" label="ライトの強さ" value={settings.lightIntensity} min={.1} max={3} step={.1} unit="倍" onChange={lightIntensity => onChange({...settings, lightIntensity})}/>
  </section>;
}
export function ThreeAnimationControls({settings, onChange, seed, onReplay}: Props&{seed:string;onReplay:()=>void}) {
  const entrance=settings.entrance??entranceDefaults;
  return <section className="control-section three-controls">
    <div className="studio-setting-label studio-setting-heading"><h3>図形の動き</h3>
      <HelpInfo>再生成すると同じ構図の初期姿勢へ戻ります。色・密度・マテリアルの変更では再生時刻をリセットしません。非表示タブでは休止します。</HelpInfo>
    </div>
    <label className="three-checkbox"><input type="checkbox" aria-label="3Dアニメーションを有効化" checked={settings.animation} onChange={event => onChange({...settings, animation: event.target.checked})}/> 図形を動かす</label>
    <div className="play-buttons"><button type="button" onClick={() => onChange({...settings, animation: !settings.animation})}>{settings.animation ? '3Dを一時停止' : '3Dを再生'}</button></div>
    <ThreeRange id="three-speed" label="動く速さ" value={settings.speed} min={.25} max={4} step={.25} unit="倍" onChange={speed => onChange({...settings, speed})}/>
    <ThreeRange id="three-float" label="浮かぶ大きさ" value={settings.floatAmount} min={0} max={2} step={.1} onChange={floatAmount => onChange({...settings, floatAmount})}/>
    <ThreeRange id="three-rotation" label="回転の大きさ" value={settings.rotationAmount} min={0} max={2} step={.1} onChange={rotationAmount => onChange({...settings, rotationAmount})}/>
    {settings.particle?.enabled&&<button type="button" onClick={onReplay}>粒子集合を最初から再生</button>}
    {settings.galaxy?.enabled&&<button type="button" onClick={onReplay}>銀河形成を最初から再生</button>}
    <fieldset className="three-kind-fieldset" data-testid="three-entrance-controls"><legend>最初の登場</legend>
      <label className="three-checkbox"><input type="checkbox" aria-label="3D図形を順番に登場させる" checked={entrance.enabled}
        onChange={event=>onChange({...settings,entrance:{...entrance,enabled:event.target.checked}})}/>
        図形を順番に登場させる</label>
      {entrance.enabled&&<>
        <label htmlFor="three-entrance-mode">登場の仕方</label>
        <select id="three-entrance-mode" value={entrance.mode}
          onChange={e=>onChange({...settings,entrance:{...entrance,mode:e.target.value as ThreeEntranceSettings['mode']}})}>
          <option value="seeded">シードで自動選択</option>
          <option value="fade-scale">フェード＋拡大</option>
          <option value="rise">下から浮上</option>
          <option value="spiral">旋回して集合</option>
          <option value="scatter">散らばった図形が集合</option>
          <option value="neural-grow">神経回路：大 → 中 → 小 → ワイヤー</option>
        </select>
        <p className="help" data-testid="three-entrance-style">今回のシードの演出：{({
          'fade-scale':'フェード＋拡大',rise:'下から浮上',spiral:'旋回して集合',scatter:'散らばった図形が集合',
          'neural-grow':'大きい図形 → 中くらい → 小さい図形 → ワイヤー'
        } as const)[threeEntranceStyle(seed,entrance.mode)]}</p>
        <ThreeRange id="three-entrance-duration" label="登場にかかる時間" value={entrance.duration}
          min={2} max={15} step={1} unit="秒" onChange={duration=>onChange({...settings,entrance:{...entrance,duration}})}/>
        {entrance.mode==='neural-grow'&&<HelpInfo>図形の実際の大きさで登場順を決めます。大→中→小の順に完成したあと、接続線が大きい図形から小さい図形へ伸びます。装飾の「接続線を表示」をONにするとワイヤー演出も見られます。入れ替え方式の自動切り替えでも再生されます。</HelpInfo>}
        {entrance.mode!=='neural-grow'&&<label className="three-checkbox"><input type="checkbox" aria-label="主役から順番に登場" checked={entrance.stagger}
          onChange={e=>onChange({...settings,entrance:{...entrance,stagger:e.target.checked}})}/>
          主役 → 補助 → 装飾の順に登場</label>}
        <button type="button" onClick={onReplay}>3D登場演出を最初から再生</button>
      </>}
      <HelpInfo>2Dと同様に最初の1回だけ登場し、完成後は消えません。ランダムシードを押すと再生し直します。3Dアニメーション停止時は現在の場面で静止します。既存の周期的な出現・消失とは別機能です。</HelpInfo>
    </fieldset>
    <fieldset className="three-kind-fieldset"><legend>くり返し登場・消える</legend>
      <label className="three-checkbox"><input type="checkbox" aria-label="出現・消失アニメーションを有効化" checked={(settings.visibilityAnimation??visibilityDefaults).enabled}
        onChange={event=>onChange({...settings,visibilityAnimation:{...(settings.visibilityAnimation??visibilityDefaults),enabled:event.target.checked}})}/> くり返し登場させる</label>
      {(settings.visibilityAnimation??visibilityDefaults).enabled&&<>
        <label htmlFor="three-visibility-mode">動きの種類</label>
        <select id="three-visibility-mode" value={(settings.visibilityAnimation??visibilityDefaults).mode}
          onChange={event=>onChange({...settings,visibilityAnimation:{...(settings.visibilityAnimation??visibilityDefaults),mode:event.target.value as ThreeVisibilitySettings['mode']}})}>
          <option value="fade">フェード</option><option value="scale">拡大・縮小</option><option value="fade-scale">フェード＋拡大・縮小</option>
        </select>
        <ThreeRange id="three-visibility-duration" label="くり返す間隔" value={(settings.visibilityAnimation??visibilityDefaults).duration}
          min={4} max={30} step={1} unit="秒" onChange={duration=>onChange({...settings,visibilityAnimation:{...(settings.visibilityAnimation??visibilityDefaults),duration}})}/>
        <ThreeRange id="three-visibility-ratio" label="表示する時間の割合" value={(settings.visibilityAnimation??visibilityDefaults).visibleRatio*100}
          min={10} max={90} step={5} unit="%" onChange={visibleRatio=>onChange({...settings,visibilityAnimation:{...(settings.visibilityAnimation??visibilityDefaults),visibleRatio:visibleRatio/100}})}/>
        <label className="three-checkbox"><input type="checkbox" checked={(settings.visibilityAnimation??visibilityDefaults).stagger}
          onChange={event=>onChange({...settings,visibilityAnimation:{...(settings.visibilityAnimation??visibilityDefaults),stagger:event.target.checked}})}/> 図形ごとにタイミングをずらす</label>
        <label className="three-checkbox"><input type="checkbox" checked={(settings.visibilityAnimation??visibilityDefaults).keepPrimaryVisible}
          onChange={event=>onChange({...settings,visibilityAnimation:{...(settings.visibilityAnimation??visibilityDefaults),keepPrimaryVisible:event.target.checked}})}/> 主役図形は常に表示</label>
        <HelpInfo>回転・浮遊と同じ再生時計でループします。ネオン輪郭と接続線も図形に合わせて消えます。再生停止中は現在の状態で静止します。</HelpInfo>
      </>}
    </fieldset>
  </section>;
}
