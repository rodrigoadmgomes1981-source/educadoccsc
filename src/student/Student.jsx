import {useCallback,useEffect,useRef,useState} from 'react';
import {ArrowLeft, Award, CalendarClock, CheckCircle2, Circle, FileText, GraduationCap, MessageSquare, Send, ThumbsDown, ThumbsUp} from 'lucide-react';
import {api} from '../api.js';
import {Alert,Badge,Empty,Progress,Spinner,daysLeft,formatDate,formatDuration} from '../ui.jsx';
import Player from './Player.jsx';
import PdfReader from './PdfReader.jsx';

const VIDEO_TARGET=90;

export default function Student({session}){
  const [lessons,setLessons]=useState([]);
  const [current,setCurrent]=useState(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const [comment,setComment]=useState('');
  const [busy,setBusy]=useState(false);
  const [confirming,setConfirming]=useState(false);
  const sending=useRef(false);

  async function load(){
    setLoading(true);
    try{
      const data=await api('/api/lessons');
      setLessons(data.lessons||[]);
      setError('');
    }catch(e){setError(e.message)}
    finally{setLoading(false)}
  }

  useEffect(()=>{load()},[]);

  /** Aplica no estado local o que o servidor devolveu sobre o progresso. */
  const apply=useCallback((lessonId,data)=>{
    const patch=item=>({...item,
      watched_seconds:data.watchedSeconds??item.watched_seconds,
      pdf_seconds:data.pdfSeconds??item.pdf_seconds,
      pdf_confirmed_at:data.pdfConfirmedAt??item.pdf_confirmed_at,
      percent:data.percent,
      videoPercent:data.videoPercent,
      pdfPercent:data.pdfPercent,
      pdfRequired:data.pdfRequired,
      pdfTimeOk:data.pdfTimeOk,
      videoOk:data.videoOk,
      pdfOk:data.pdfOk,
      completed_at:data.completedAt||item.completed_at,
      certificate_code:data.certificateCode||item.certificate_code,
      complete:!!(data.completedAt||item.completed_at)
    });
    setCurrent(item=>item&&item.id===lessonId?patch(item):item);
    setLessons(list=>list.map(l=>l.id===lessonId?patch(l):l));
  },[]);

  /** Tempo de vídeo enviado pelo player. */
  const onVideoProgress=useCallback(async(addSeconds,durationSeconds,starting=false)=>{
    if(!current||sending.current)return;
    if(!addSeconds&&!starting)return;
    sending.current=true;
    try{
      const data=await api('/api/progress',{method:'POST',body:{lessonId:current.id,kind:'video',addSeconds,durationSeconds,starting}});
      apply(current.id,{...data,duration_seconds:durationSeconds});
    }catch(e){if(e.status!==401)setError(e.message)}
    finally{sending.current=false}
  },[current?.id,apply]);

  /** Tempo de leitura enviado pelo leitor de PDF. */
  const onPdfProgress=useCallback(async addSeconds=>{
    if(!current||!addSeconds)return;
    try{
      const data=await api('/api/progress',{method:'POST',body:{lessonId:current.id,kind:'pdf',addSeconds}});
      apply(current.id,data);
    }catch(e){if(e.status!==401)setError(e.message)}
  },[current?.id,apply]);

  async function confirmReading(){
    setConfirming(true);
    try{
      const data=await api('/api/progress',{method:'POST',query:{action:'confirm'},body:{lessonId:current.id}});
      apply(current.id,data);
      setMessage('Leitura do material confirmada.');
    }catch(e){setError(e.message)}
    finally{setConfirming(false)}
  }

  async function react(value){
    const next=current.reaction===value?0:value;
    try{
      const data=await api('/api/engagement',{method:'POST',query:{action:'reaction'},body:{lessonId:current.id,value:next}});
      setCurrent(item=>({...item,reaction:data.reaction,likes:data.likes,dislikes:data.dislikes}));
    }catch(e){setError(e.message)}
  }

  async function send(event){
    event.preventDefault();
    setBusy(true);
    try{
      await api('/api/engagement',{method:'POST',query:{action:'comment'},body:{lessonId:current.id,message:comment}});
      setComment('');
      setMessage('Comentário enviado. O administrador foi notificado no painel.');
    }catch(e){setError(e.message)}
    finally{setBusy(false)}
  }

  async function certificate(){
    setBusy(true);
    try{
      const data=await api('/api/certificate',{method:'POST',body:{lessonId:current.id}});
      setCurrent(item=>({...item,certificate_code:data.code}));
      window.open(`?certificado=${data.code}`,'_blank','noopener');
    }catch(e){setError(e.message)}
    finally{setBusy(false)}
  }

  if(loading)return <Spinner label="Carregando as suas aulas..."/>;

  if(current){
    const ready=current.complete||!!current.completed_at;
    return (
      <section className="lesson-view">
        <button className="ghost small" onClick={()=>{setCurrent(null);setMessage('');load()}}><ArrowLeft size={16}/> Voltar às aulas</button>

        <div className="lesson-head">
          <div>
            <h2>{current.title}</h2>
            <p className="muted">
              {current.contract_name||'Todos os contratos'}
              {current.ends_on?` · prazo até ${formatDate(current.ends_on)}`:''}
              {current.workload_minutes?` · ${current.workload_minutes} min`:''}
            </p>
          </div>
          <Badge tone={ready?'ok':'info'}>{ready?'Concluída':`${current.percent||0}% concluído`}</Badge>
        </div>

        <Alert onClose={()=>setError('')}>{error}</Alert>
        {message?<Alert kind="ok" onClose={()=>setMessage('')}>{message}</Alert>:null}

        {current.hasVideo?(
          current.available
            ? <Player lesson={current} onProgress={onVideoProgress}/>
            : <Alert kind="warn">
                {current.status==='agendada'
                  ? `Esta aula será liberada em ${formatDate(current.starts_on)}.`
                  : `O prazo para assistir terminou em ${formatDate(current.ends_on)}. Fale com o administrador.`}
              </Alert>
        ):!current.available?(
          <Alert kind="warn">
            {current.status==='agendada'
              ? `Esta aula será liberada em ${formatDate(current.starts_on)}.`
              : `O prazo terminou em ${formatDate(current.ends_on)}. Fale com o administrador.`}
          </Alert>
        ):null}

        <div className="checklist">
          <h3>Para concluir esta aula</h3>
          {current.hasVideo?(
            <div className={current.videoOk?'done':''}>
              {current.videoOk?<CheckCircle2 size={17}/>:<Circle size={17}/>}
              <div>
                <b>Assistir {VIDEO_TARGET}% do vídeo</b>
                <span>{formatDuration(current.watched_seconds)} assistidos{current.duration_seconds?` de ${formatDuration(current.duration_seconds)}`:''} · {current.videoPercent||0}%</span>
              </div>
              <Progress percent={current.videoPercent}/>
            </div>
          ):null}
          {current.hasPdf?(
            <div className={current.pdfOk?'done':''}>
              {current.pdfOk?<CheckCircle2 size={17}/>:<Circle size={17}/>}
              <div>
                <b>Ler o material em PDF e confirmar a leitura</b>
                <span>mínimo de {formatDuration(current.pdfRequired)} com o material aberto · {formatDuration(current.pdf_seconds)} registrados</span>
              </div>
              <Progress percent={current.pdfPercent}/>
            </div>
          ):null}
          {!current.hasVideo&&!current.hasPdf?(
            <p className="muted">Esta aula não tem vídeo nem material em PDF. Fale com o administrador para emitir o certificado.</p>
          ):null}
        </div>

        {current.hasPdf?(
          <PdfReader lesson={current} onTick={onPdfProgress} onConfirm={confirmReading}
                     busy={confirming} disabled={!current.available}/>
        ):null}

        <div className="lesson-toolbar">
          <button className={current.reaction===1?'chip active':'chip'} onClick={()=>react(1)} disabled={!current.available}>
            <ThumbsUp size={16}/> Curtir {Number(current.likes||0)>0?`(${current.likes})`:''}
          </button>
          <button className={current.reaction===-1?'chip active down':'chip'} onClick={()=>react(-1)} disabled={!current.available}>
            <ThumbsDown size={16}/> Não curtir {Number(current.dislikes||0)>0?`(${current.dislikes})`:''}
          </button>
          {current.certificate_code?(
            <a className="chip gold" href={`?certificado=${current.certificate_code}`} target="_blank" rel="noreferrer">
              <Award size={16}/> Ver certificado
            </a>
          ):(
            <button className="chip gold" onClick={certificate} disabled={!ready||busy}
                    title={ready?'Emitir certificado':'Cumpra os itens acima para liberar'}>
              <Award size={16}/> {busy?'Emitindo...':'Emitir certificado'}
            </button>
          )}
        </div>

        {current.content?(
          <article className="lesson-content">
            <h3>Conteúdo da aula</h3>
            {String(current.content).split(/\n{2,}/).map((p,i)=><p key={i}>{p}</p>)}
          </article>
        ):null}

        <form className="comment-box" onSubmit={send}>
          <h3><MessageSquare size={17}/> Comentário</h3>
          <p className="muted">Dúvidas, sugestões ou observações sobre a aula. O administrador recebe a notificação no painel.</p>
          <textarea rows={4} value={comment} onChange={e=>setComment(e.target.value)}
                    placeholder="Escreva aqui o seu comentário..." required minLength={2}/>
          <button className="primary" disabled={busy||comment.trim().length<2}><Send size={16}/> Enviar comentário</button>
        </form>
      </section>
    );
  }

  return (
    <section>
      <div className="section-head">
        <div>
          <h2>Minhas aulas</h2>
          <p>Contrato: <b>{session.contractName||'—'}</b>. Assista dentro do prazo para liberar o certificado.</p>
        </div>
      </div>

      <Alert onClose={()=>setError('')}>{error}</Alert>

      {lessons.length===0?(
        <Empty icon={<GraduationCap size={40}/>} title="Nenhuma aula disponível">
          Assim que o administrador publicar um treinamento para o seu contrato, ele aparece aqui.
        </Empty>
      ):(
        <div className="cards">
          {lessons.map(l=>{
            const left=daysLeft(l.ends_on);
            const done=l.complete||!!l.completed_at;
            return (
              <article key={l.id} className="lesson-card clickable" onClick={()=>{setCurrent(l);setMessage('');setError('')}}>
                <div className="lesson-main">
                  <div className="lesson-title">
                    <h3>{l.title}</h3>
                    <Badge tone={done?'ok':l.status==='encerrada'?'warn':l.status==='agendada'?'info':'neutral'}>
                      {done?'Concluída':l.status==='encerrada'?'Prazo encerrado':l.status==='agendada'?'Em breve':'Disponível'}
                    </Badge>
                  </div>
                  <p className="muted">{l.content?String(l.content).slice(0,180):'Sem descrição.'}</p>
                  <div className="lesson-meta">
                    <span><CalendarClock size={14}/> {l.ends_on?`Até ${formatDate(l.ends_on)}`:'Sem prazo definido'}</span>
                    {left!==null&&left>=0&&!done?<span className={left<=3?'warn-text':''}>{left===0?'Último dia':`${left} dia(s) restantes`}</span>:null}
                    {l.hasPdf?<span className={l.pdfOk?'ok-text':''}><FileText size={14}/> PDF{l.pdfOk?' lido':' a ler'}</span>:null}
                    {l.certificate_code?<span className="ok-text"><Award size={14}/> Certificado emitido</span>:null}
                  </div>
                </div>
                <div className="lesson-side">
                  <Progress percent={l.percent}/>
                  {done?<span className="ok-text"><CheckCircle2 size={15}/> Concluída</span>:null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
