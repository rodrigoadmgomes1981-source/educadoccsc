import {useEffect,useRef,useState} from 'react';
import {VideoOff} from 'lucide-react';

const FLUSH_SECONDS=15;

function loadScript(id,src){
  return new Promise((resolve,reject)=>{
    const existing=document.getElementById(id);
    if(existing){
      if(existing.dataset.loaded==='1')return resolve();
      existing.addEventListener('load',()=>resolve());
      existing.addEventListener('error',reject);
      return;
    }
    const script=document.createElement('script');
    script.id=id;script.src=src;script.async=true;
    script.addEventListener('load',()=>{script.dataset.loaded='1';resolve()});
    script.addEventListener('error',reject);
    document.head.appendChild(script);
  });
}

function loadYouTube(){
  if(window.YT&&window.YT.Player)return Promise.resolve();
  return new Promise((resolve,reject)=>{
    const previous=window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady=()=>{previous?.();resolve()};
    loadScript('yt-iframe-api','https://www.youtube.com/iframe_api').catch(reject);
    const check=setInterval(()=>{if(window.YT&&window.YT.Player){clearInterval(check);resolve()}},300);
    setTimeout(()=>clearInterval(check),20000);
  });
}

const loadVimeo=()=>window.Vimeo?.Player?Promise.resolve():loadScript('vimeo-player-api','https://player.vimeo.com/api/player.js');

/**
 * Player do YouTube/Vimeo que mede o tempo realmente assistido.
 * Conta 1 segundo por segundo de reprodução — avançar a barra não conta.
 */
export default function Player({lesson,onProgress}){
  const holder=useRef(null);
  const playing=useRef(false);
  const pending=useRef(0);
  const duration=useRef(Number(lesson.duration_seconds||0));
  const flushRef=useRef(()=>{});
  const [error,setError]=useState('');
  const [live,setLive]=useState(false);

  flushRef.current=force=>{
    const seconds=Math.round(pending.current);
    if(seconds<=0&&!force)return;
    pending.current=0;
    onProgress?.(seconds,Math.round(duration.current||0));
  };

  useEffect(()=>{
    let player=null,cancelled=false,poll=null,flushTimer=null;
    playing.current=false;pending.current=0;
    duration.current=Number(lesson.duration_seconds||0);

    async function start(){
      if(!lesson.video_provider||!lesson.video_id)return;
      try{
        if(lesson.video_provider==='youtube'){
          await loadYouTube();
          if(cancelled||!holder.current)return;
          const node=document.createElement('div');
          holder.current.innerHTML='';
          holder.current.appendChild(node);
          player=new window.YT.Player(node,{
            videoId:lesson.video_id,
            playerVars:{rel:0,modestbranding:1,playsinline:1},
            events:{
              onReady:e=>{duration.current=e.target.getDuration()||duration.current;setLive(true)},
              onStateChange:e=>{
                const state=e.data;
                duration.current=player?.getDuration?.()||duration.current;
                if(state===window.YT.PlayerState.PLAYING){
                  if(!playing.current)onProgress?.(0,Math.round(duration.current||0),true);
                  playing.current=true;
                }else{
                  playing.current=false;
                  flushRef.current();
                }
              }
            }
          });
        }else if(lesson.video_provider==='vimeo'){
          await loadVimeo();
          if(cancelled||!holder.current)return;
          const [id,hash]=String(lesson.video_id).split(':');
          holder.current.innerHTML='';
          player=new window.Vimeo.Player(holder.current,{id:Number(id),...(hash?{h:hash}:{}),responsive:true});
          player.getDuration().then(d=>{duration.current=d||duration.current;setLive(true)}).catch(()=>{});
          player.on('play',()=>{if(!playing.current)onProgress?.(0,Math.round(duration.current||0),true);playing.current=true});
          player.on('pause',()=>{playing.current=false;flushRef.current()});
          player.on('ended',()=>{playing.current=false;flushRef.current(true)});
        }
      }catch{
        if(!cancelled)setError('Não foi possível carregar o vídeo. Verifique a conexão e recarregue a página.');
      }
    }

    start();
    poll=setInterval(()=>{if(playing.current)pending.current+=1},1000);
    flushTimer=setInterval(()=>flushRef.current(),FLUSH_SECONDS*1000);
    const onHide=()=>{if(document.hidden){playing.current=false;flushRef.current()}};
    document.addEventListener('visibilitychange',onHide);

    return()=>{
      cancelled=true;
      clearInterval(poll);clearInterval(flushTimer);
      document.removeEventListener('visibilitychange',onHide);
      flushRef.current();
      try{player?.destroy?.()}catch{}
      try{player?.unload?.()}catch{}
    };
  },[lesson.id]);

  if(!lesson.video_provider||!lesson.video_id){
    return (
      <div className="video-frame empty-video">
        <VideoOff size={32}/>
        <p>Esta aula não tem vídeo. Consulte o conteúdo e o material de apoio abaixo.</p>
      </div>
    );
  }

  return (
    <div className="video-wrap">
      <div className="video-frame" ref={holder}/>
      {error?<p className="warn-text small">{error}</p>
       :!live?<p className="muted small">Carregando o vídeo...</p>
       :<p className="muted small">O tempo assistido é registrado enquanto o vídeo está em reprodução.</p>}
    </div>
  );
}
