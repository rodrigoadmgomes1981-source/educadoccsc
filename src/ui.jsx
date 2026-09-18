import {useEffect} from 'react';
import {AlertCircle, CheckCircle2, Loader2, X} from 'lucide-react';

export const pad=n=>String(n).padStart(2,'0');

export function formatDate(value){
  if(!value)return '—';
  const raw=String(value).slice(0,10);
  const [y,m,d]=raw.split('-');
  return y&&m&&d?`${d}/${m}/${y}`:'—';
}

export function formatDateTime(value){
  if(!value)return '—';
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return '—';
  return `${pad(date.getDate())}/${pad(date.getMonth()+1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 4512 -> "1h 15min" ; 180 -> "3min" */
export function formatDuration(seconds){
  const total=Math.max(0,Math.round(Number(seconds)||0));
  if(!total)return '—';
  const h=Math.floor(total/3600), m=Math.floor((total%3600)/60), s=total%60;
  if(h)return `${h}h ${pad(m)}min`;
  if(m)return `${m}min ${pad(s)}s`;
  return `${s}s`;
}

export function daysLeft(endsOn){
  if(!endsOn)return null;
  const end=new Date(`${String(endsOn).slice(0,10)}T23:59:59`);
  return Math.ceil((end.getTime()-Date.now())/86400000);
}

export function Field({label,hint,children,span}){
  return (
    <label className={span?`field span-${span}`:'field'}>
      <span>{label}</span>
      {children}
      {hint?<em>{hint}</em>:null}
    </label>
  );
}

export function Alert({kind='error',children,onClose}){
  if(!children)return null;
  return (
    <div className={`alert ${kind}`}>
      {kind==='ok'?<CheckCircle2 size={17}/>:<AlertCircle size={17}/>}
      <div>{children}</div>
      {onClose?<button type="button" className="icon" onClick={onClose} aria-label="Fechar"><X size={15}/></button>:null}
    </div>
  );
}

export function Spinner({label='Carregando...'}){
  return <div className="loading"><Loader2 size={18} className="spin"/> {label}</div>;
}

export function Empty({icon,title,children}){
  return (
    <div className="empty">
      {icon}
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}

export function Badge({tone='neutral',children}){
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function Modal({title,subtitle,onClose,children,wide}){
  useEffect(()=>{
    const onKey=e=>{if(e.key==='Escape')onClose()};
    document.addEventListener('keydown',onKey);
    document.body.style.overflow='hidden';
    return()=>{document.removeEventListener('keydown',onKey);document.body.style.overflow=''};
  },[onClose]);
  return (
    <div className="backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div className={wide?'modal wide':'modal'} role="dialog" aria-modal="true">
        <header>
          <div>
            <h2>{title}</h2>
            {subtitle?<p>{subtitle}</p>:null}
          </div>
          <button type="button" className="icon" onClick={onClose} aria-label="Fechar"><X size={18}/></button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function Confirm({title,message,confirmLabel='Excluir',onConfirm,onClose,busy}){
  return (
    <Modal title={title} onClose={onClose}>
      <p className="muted">{message}</p>
      <div className="modal-actions">
        <button type="button" className="ghost" onClick={onClose}>Cancelar</button>
        <button type="button" className="danger" onClick={onConfirm} disabled={busy}>{busy?'Aguarde...':confirmLabel}</button>
      </div>
    </Modal>
  );
}

export function Progress({percent,tone}){
  const value=Math.max(0,Math.min(100,Math.round(percent||0)));
  return (
    <div className="progress" title={`${value}% assistido`}>
      <div className="track"><i style={{width:`${value}%`}} className={tone||''}/></div>
      <b>{value}%</b>
    </div>
  );
}
