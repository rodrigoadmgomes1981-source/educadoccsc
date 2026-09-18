import {useEffect,useRef,useState} from 'react';
import {CheckCircle2, FileText, X} from 'lucide-react';
import {fileUrl} from '../api.js';
import {Progress,formatDuration} from '../ui.jsx';

const FLUSH_SECONDS=15;

/**
 * Leitor do material em PDF. Conta o tempo com o documento aberto e a aba ativa,
 * e só libera a declaração de leitura depois do tempo mínimo da aula.
 */
export default function PdfReader({lesson,onTick,onConfirm,busy,disabled}){
  const [open,setOpen]=useState(false);
  const pending=useRef(0);
  const flushRef=useRef(()=>{});

  flushRef.current=()=>{
    const seconds=Math.round(pending.current);
    if(seconds<=0)return;
    pending.current=0;
    onTick?.(seconds);
  };

  useEffect(()=>{
    if(!open)return undefined;
    const tick=setInterval(()=>{if(!document.hidden)pending.current+=1},1000);
    const flush=setInterval(()=>flushRef.current(),FLUSH_SECONDS*1000);
    const onHide=()=>{if(document.hidden)flushRef.current()};
    document.addEventListener('visibilitychange',onHide);
    return()=>{
      clearInterval(tick);clearInterval(flush);
      document.removeEventListener('visibilitychange',onHide);
      flushRef.current();
    };
  },[open,lesson.id]);

  const required=Number(lesson.pdfRequired||0);
  const seconds=Number(lesson.pdf_seconds||0);
  const confirmed=!!lesson.pdf_confirmed_at;
  const timeOk=!!lesson.pdfTimeOk;
  const remaining=Math.max(0,required-seconds);

  return (
    <section className="pdf-box">
      <header>
        <h3><FileText size={17}/> Material de apoio (PDF)</h3>
        {confirmed
          ? <span className="ok-text"><CheckCircle2 size={16}/> Leitura confirmada</span>
          : <span className="muted small">Leitura mínima: {formatDuration(required)}</span>}
      </header>

      {!confirmed?(
        <div className="pdf-progress">
          <Progress percent={lesson.pdfPercent}/>
          <span>
            {formatDuration(seconds)} de leitura registrados
            {remaining>0?` · faltam ${formatDuration(remaining)}`:' · tempo mínimo cumprido'}
          </span>
        </div>
      ):null}

      <div className="pdf-actions">
        <button type="button" className={open?'ghost':'chip'} onClick={()=>setOpen(v=>!v)} disabled={disabled}>
          {open?<><X size={16}/> Fechar material</>:<><FileText size={16}/> Abrir material</>}
        </button>
        <a className="chip" href={fileUrl(lesson.id)} target="_blank" rel="noreferrer">Abrir em outra aba</a>
        {!confirmed?(
          <button type="button" className="primary" disabled={!timeOk||busy||disabled}
                  title={timeOk?'Confirmar a leitura':`Disponível após ${formatDuration(required)} com o material aberto`}
                  onClick={onConfirm}>
            <CheckCircle2 size={16}/> {busy?'Registrando...':'Li e compreendi o material'}
          </button>
        ):null}
      </div>

      {open?(
        <>
          <iframe className="pdf-frame" src={fileUrl(lesson.id)} title={lesson.pdf_name||'Material da aula'}/>
          <p className="muted small">O tempo de leitura só corre com esta aba aberta em primeiro plano.</p>
        </>
      ):null}
    </section>
  );
}
