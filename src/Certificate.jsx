import {useEffect,useState} from 'react';
import {ArrowLeft, Printer, Search} from 'lucide-react';
import {api} from './api.js';
import {Alert,Spinner,formatDate,formatDuration} from './ui.jsx';

const MONTHS=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

/** Recebe 'YYYY-MM-DD' e devolve "18 de setembro de 2026". */
function longDate(value){
  const [y,m,d]=String(value||'').slice(0,10).split('-').map(Number);
  if(!y||!m||!d){
    const now=new Date();
    return `${now.getDate()} de ${MONTHS[now.getMonth()]} de ${now.getFullYear()}`;
  }
  return `${d} de ${MONTHS[m-1]} de ${y}`;
}

export default function Certificate({code:initial}){
  const [code,setCode]=useState(initial||'');
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(!!initial);
  const [error,setError]=useState('');

  async function find(value){
    if(!value)return;
    setLoading(true);setError('');
    try{
      const result=await api('/api/certificate',{query:{code:value},auth:false});
      setData(result.certificate);
    }catch(e){setError(e.message);setData(null)}
    finally{setLoading(false)}
  }

  useEffect(()=>{if(initial)find(initial)},[initial]);

  if(loading)return <div className="certificate-page"><Spinner label="Consultando o certificado..."/></div>;

  if(!data){
    return (
      <div className="certificate-page">
        <form className="validate-box" onSubmit={e=>{e.preventDefault();find(code.trim().toUpperCase())}}>
          <img className="cert-mark" src="/logo-doccsc-escura.png" alt="DOC CSC"/>
          <h1>Validação de certificado</h1>
          <p className="muted">Digite o código impresso no rodapé do certificado (formato DOC-XXXX-XXXX).</p>
          <input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="DOC-XXXX-XXXX" required/>
          <Alert>{error}</Alert>
          <button className="primary block"><Search size={17}/> Consultar</button>
          <a className="link-plain" href="/"><ArrowLeft size={14}/> Voltar ao sistema</a>
        </form>
      </div>
    );
  }

  const council=[data.council,data.council_number].filter(Boolean).join(' ');
  const hasVideo=!!data.video_provider;
  const hasPdf=!!data.pdf_name;
  const hours=Number(data.workload_minutes)||0;
  const workload=hours>=60?`${(hours/60).toFixed(hours%60?1:0).replace('.',',')} hora(s)`:`${hours} minutos`;

  return (
    <div className="certificate-page">
      <div className="certificate-tools no-print">
        <a className="ghost small" href="/"><ArrowLeft size={16}/> Voltar</a>
        <button className="primary small" onClick={()=>window.print()}><Printer size={16}/> Imprimir / salvar em PDF</button>
      </div>

      <article className="certificate">
        <div className="cert-border">
          <header>
            <div className="cert-brand">
              <img className="cert-mark" src="/logo-doccsc-escura.png" alt="DOC CSC — Centro de Serviços Compartilhados"/>
            </div>
            <div className="cert-kind">Educação Virtual</div>
          </header>

          <h1>Certificado</h1>
          <p className="cert-intro">Certificamos que</p>
          <h2>{data.professional_name}</h2>
          <p className="cert-text">
            {data.professional_role?<>na função de <b>{data.professional_role}</b>{council?<>, inscrição <b>{council}</b></>:null}, </>:null}
            concluiu o treinamento <b>“{data.lesson_title}”</b>
            {hours?<>, com carga horária de <b>{workload}</b></>:null}
            , promovido pela DOC CSC no âmbito do contrato <b>{data.contract_name}</b>
            {data.completed_date?<>, tendo cumprido {hasVideo&&hasPdf?'o conteúdo em vídeo e a leitura do material':hasPdf?'a leitura integral do material':'o conteúdo integral'} em <b>{formatDate(data.completed_date)}</b></>:null}.
          </p>

          <div className="cert-details">
            {hasVideo?<div><span>Tempo de vídeo</span><b>{formatDuration(data.watched_seconds)}</b></div>:null}
            {hasPdf?<div><span>Leitura do material</span><b>{formatDuration(data.pdf_seconds)}</b></div>:null}
            <div><span>Emitido em</span><b>{formatDate(data.certificate_date||data.completed_date)}</b></div>
            <div><span>Código de validação</span><b>{data.certificate_code}</b></div>
          </div>

          <footer>
            <div className="cert-sign">
              <i/>
              <b>DOC CSC · Educação Virtual</b>
              <span>Coordenação de Treinamento</span>
            </div>
            <div className="cert-place">
              <span>{longDate(data.certificate_date||data.completed_date)}</span>
              <small>Valide em {location.host}/?certificado={data.certificate_code}</small>
            </div>
          </footer>
        </div>
      </article>
    </div>
  );
}
