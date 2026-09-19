import {useEffect,useRef,useState} from 'react';
import {FileText, MessageSquare, Pencil, Plus, ThumbsDown, ThumbsUp, Trash2, Users, Video} from 'lucide-react';
import {api,fileUrl} from '../api.js';
import {Alert,Badge,Confirm,Empty,Field,Modal,Spinner,formatDate} from '../ui.jsx';

const EMPTY={contractId:'',title:'',content:'',videoUrl:'',workloadMinutes:'',startsOn:'',endsOn:'',published:true};

function toForm(lesson){
  if(!lesson)return {...EMPTY};
  return {
    id:lesson.id,
    contractId:lesson.contract_id||'',
    title:lesson.title||'',
    content:lesson.content||'',
    videoUrl:lesson.video_url||'',
    workloadMinutes:lesson.workload_minutes?String(lesson.workload_minutes):'',
    startsOn:lesson.starts_on?String(lesson.starts_on).slice(0,10):'',
    endsOn:lesson.ends_on?String(lesson.ends_on).slice(0,10):'',
    published:lesson.published!==false,
    pdfName:lesson.pdf_name||''
  };
}

export default function Lessons({contracts,settings,onChanged}){
  const [lessons,setLessons]=useState([]);
  const [filter,setFilter]=useState('');
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [editing,setEditing]=useState(null);
  const [removePdf,setRemovePdf]=useState(false);
  const [removing,setRemoving]=useState(null);
  const [busy,setBusy]=useState(false);
  const fileRef=useRef(null);

  async function load(contract=filter){
    setLoading(true);
    try{
      const data=await api('/api/lessons',{query:{contract}});
      setLessons(data.lessons||[]);
      setError('');
    }catch(e){setError(e.message)}
    finally{setLoading(false)}
  }

  useEffect(()=>{load(filter)},[filter]);

  function open(lesson){
    setRemovePdf(false);
    const form=toForm(lesson);
    // Nova aula: já sugere o prazo padrão definido em Configurações.
    const days=Number(settings?.defaultLessonDays||0);
    if(!lesson&&days>0&&!form.endsOn){
      const end=new Date();
      end.setDate(end.getDate()+days);
      form.endsOn=end.toISOString().slice(0,10);
    }
    setEditing(form);
  }

  async function save(event){
    event.preventDefault();
    setBusy(true);
    try{
      const form=new FormData();
      Object.entries(editing).forEach(([k,v])=>{if(k!=='pdfName')form.append(k,v===true?'true':v===false?'false':v??'')});
      form.append('removePdf',removePdf?'true':'false');
      const file=fileRef.current?.files?.[0];
      if(file)form.append('pdf',file);
      await api('/api/lessons',{method:'POST',form});
      setEditing(null);
      await load();
      onChanged?.();
    }catch(e){setError(e.message)}
    finally{setBusy(false)}
  }

  async function remove(){
    setBusy(true);
    try{
      await api('/api/lessons',{method:'DELETE',query:{id:removing.id}});
      setRemoving(null);
      await load();
      onChanged?.();
    }catch(e){setError(e.message)}
    finally{setBusy(false)}
  }

  const set=(key,value)=>setEditing(current=>({...current,[key]:value}));
  const today=new Date().toISOString().slice(0,10);

  return (
    <section>
      <div className="section-head">
        <div>
          <h2>Aulas</h2>
          <p>Conteúdo, vídeo, material em PDF, contrato e prazo para assistir.</p>
        </div>
        <div className="head-tools">
          <select value={filter} onChange={e=>setFilter(e.target.value)}>
            <option value="">Todos os contratos</option>
            {contracts.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button className="primary" onClick={()=>open(null)} disabled={!contracts.length}><Plus size={17}/> Nova aula</button>
        </div>
      </div>

      <Alert onClose={()=>setError('')}>{error}</Alert>
      {!contracts.length&&!loading?<Alert kind="warn">Cadastre um contrato antes de criar as aulas.</Alert>:null}

      {loading?<Spinner/>:lessons.length===0?(
        <Empty icon={<Video size={40}/>} title="Nenhuma aula cadastrada">
          Crie a primeira aula com o link do vídeo, o conteúdo e o prazo para assistir.
        </Empty>
      ):(
        <div className="cards">
          {lessons.map(l=>{
            const closed=l.ends_on&&today>String(l.ends_on).slice(0,10);
            const scheduled=l.starts_on&&today<String(l.starts_on).slice(0,10);
            return (
              <article key={l.id} className="lesson-card">
                <div className="lesson-main">
                  <div className="lesson-title">
                    <h3>{l.title}</h3>
                    <Badge tone={!l.published?'off':closed?'warn':scheduled?'info':'ok'}>
                      {!l.published?'Rascunho':closed?'Prazo encerrado':scheduled?'Agendada':'Disponível'}
                    </Badge>
                  </div>
                  <p className="muted">{l.content?String(l.content).slice(0,220):'Sem descrição.'}</p>
                  <div className="lesson-meta">
                    <span><Users size={14}/> {l.contract_name||'Todos os contratos'}</span>
                    <span>Prazo: {formatDate(l.starts_on)} a {formatDate(l.ends_on)}</span>
                    {l.workload_minutes?<span>{l.workload_minutes} min de carga horária</span>:null}
                    {l.video_provider?<span><Video size={14}/> {l.video_provider==='youtube'?'YouTube':'Vimeo'}</span>:<span className="warn-text">Sem vídeo</span>}
                    {l.pdf_name?<a href={fileUrl(l.id)} target="_blank" rel="noreferrer"><FileText size={14}/> {l.pdf_name}</a>:null}
                  </div>
                </div>
                <div className="lesson-stats">
                  <div><b>{Number(l.viewers)}</b><span>assistiram</span></div>
                  <div><b>{Number(l.completed)}</b><span>concluíram</span></div>
                  <div className="ok-text"><b><ThumbsUp size={14}/> {Number(l.likes)}</b><span>curtiram</span></div>
                  <div className="warn-text"><b><ThumbsDown size={14}/> {Number(l.dislikes)}</b><span>não curtiram</span></div>
                  <div><b><MessageSquare size={14}/> {Number(l.comments)}</b><span>comentários</span></div>
                </div>
                <div className="lesson-actions">
                  <button className="icon" title="Editar" onClick={()=>open(l)}><Pencil size={16}/></button>
                  <button className="icon danger" title="Excluir" onClick={()=>setRemoving(l)}><Trash2 size={16}/></button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {editing?(
        <Modal wide title={editing.id?'Editar aula':'Nova aula'}
               subtitle={`Vídeo por link do YouTube ou Vimeo (${settings?.videoPercent??90}% assistidos).${settings?.requirePdfWithVideo===false?" Com vídeo, o PDF é apenas material de apoio.":" Havendo PDF, o profissional também precisa lê-lo e confirmar a leitura."}`}
               onClose={()=>setEditing(null)}>
          <form onSubmit={save} className="form-grid">
            <Field label="Título da aula *" span={2}>
              <input value={editing.title} onChange={e=>set('title',e.target.value)} required placeholder="Ex.: Segurança do paciente — identificação"/>
            </Field>
            <Field label="Contrato *" hint="“Todos os contratos” libera a aula para todos os profissionais.">
              <select value={editing.contractId} onChange={e=>set('contractId',e.target.value)}>
                <option value="">Todos os contratos</option>
                {contracts.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Conteúdo da aula" span={3} hint="Texto exibido ao profissional junto com o vídeo.">
              <textarea rows={5} value={editing.content} onChange={e=>set('content',e.target.value)}
                        placeholder="Objetivos, tópicos abordados, orientações..."/>
            </Field>
            <Field label="Link do vídeo" span={2} hint="Ex.: https://youtu.be/XXXXXXX ou https://vimeo.com/123456789">
              <input value={editing.videoUrl} onChange={e=>set('videoUrl',e.target.value)} placeholder="https://"/>
            </Field>
            <Field label="Carga horária (minutos)" hint={`Aparece no certificado. Sem vídeo, define o tempo mínimo de leitura do PDF (${settings?.pdfWorkloadPercent??90}% dela).`}>
              <input inputMode="numeric" value={editing.workloadMinutes} onChange={e=>set('workloadMinutes',e.target.value.replace(/\D/g,''))}/>
            </Field>
            <Field label="Data de início" hint="Quando a aula fica disponível.">
              <input type="date" value={editing.startsOn} onChange={e=>set('startsOn',e.target.value)}/>
            </Field>
            <Field label="Prazo final" hint="Último dia para assistir.">
              <input type="date" value={editing.endsOn} onChange={e=>set('endsOn',e.target.value)}/>
            </Field>
            <Field label="Material de apoio (PDF)" hint={editing.pdfName?`Atual: ${editing.pdfName}`:'Opcional, até 4 MB. Havendo PDF, a aula só conclui com a leitura confirmada.'}>
              <input type="file" accept="application/pdf" ref={fileRef}/>
            </Field>
            {editing.pdfName?(
              <label className="check span-3">
                <input type="checkbox" checked={removePdf} onChange={e=>setRemovePdf(e.target.checked)}/>
                <span>Remover o PDF atual desta aula</span>
              </label>
            ):null}
            <label className="check span-3">
              <input type="checkbox" checked={editing.published} onChange={e=>set('published',e.target.checked)}/>
              <span>Publicada (visível para os profissionais dentro do prazo)</span>
            </label>
            <div className="modal-actions span-3">
              <button type="button" className="ghost" onClick={()=>setEditing(null)}>Cancelar</button>
              <button className="primary" disabled={busy}>{busy?'Salvando...':'Salvar aula'}</button>
            </div>
          </form>
        </Modal>
      ):null}

      {removing?(
        <Confirm title="Excluir aula" busy={busy}
                 message={`Excluir "${removing.title}" apaga o histórico de quem assistiu, as avaliações, os comentários e os certificados desta aula.`}
                 onConfirm={remove} onClose={()=>setRemoving(null)}/>
      ):null}
    </section>
  );
}
