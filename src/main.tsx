import React, {Activity, Suspense, lazy, useState} from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './style.css';
import './studio-redesign.css';

const MusicStudio = lazy(()=>import('./music/MusicStudio'));

function Workspace() {
  const [music,setMusic]=useState(()=>new URLSearchParams(location.search).get('mode')==='music');
  const [visited,setVisited]=useState({geometry:!music,music});
  const [requestedMode,setRequestedMode]=useState<{mode:'2d'|'3d'}>();
  const openMusic=()=>{
    setMusic(true);
    setVisited(state=>({...state,music:true}));
  };
  const openGeometry=(mode:'2d'|'3d')=>{
    setRequestedMode({mode});
    setVisited(state=>({...state,geometry:true}));
    setMusic(false);
  };
  return <>
    {visited.geometry&&<Activity mode={music?'hidden':'visible'}>
      <App active={!music} onMusic={openMusic} requestedMode={requestedMode}/>
    </Activity>}
    {visited.music&&<Suspense fallback={music?<p role="status">Seed Music Studioを読み込んでいます…</p>:null}>
      <MusicStudio active={music} onGeometry={openGeometry}/>
    </Suspense>}
  </>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><Workspace /></React.StrictMode>);
