import {useEffect,useMemo,useState} from 'react';
import {Award, ClipboardList, Download} from 'lucide-react';
import {api} from '../api.js';
import {Alert,Badge,Empty,Progress,Spinner,formatDateTime,formatDuration} from '../ui.jsx';

const STATES={concluida:{tone:'ok',label:'Concluída'},'em andamento':{tone:'info',label:'Em andamento'},'nao iniciada':{tone:'off',label:'Não iniciada'}};

export default function Tracking({contracts}){
  const [rows,setRows]=useState([]);
  const [contract,setContract]=useState('');
  const [state,setState]=useState('');
  const [search,setSearch]=useState('');
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState('');

  async function load(){
    setLoading(true);
    try{
      const data=await api('/api/progress',{query:{contract}});
      setRows(data.report||[]);
      setError('');
    }catch(e){setError(e.message)}
    finally{setLoading(false)}
  }

  useEffect(()=>{load()},[contract]);

  const visible=useMemo(()=>{
    const term=search.trim().toLowerCase();
    return rows.filter(r=>{
      if(state&&r.state!==state)return false;
      if(!term)return true;
      return [r.name,r.role,r.council_number,r.lesson_title].join(' ').toLowerCase().includes(term);
    });
  },[rows,state,search]);

  const totals=useMemo(()=>({
    completed:rows.filter(r=>r.state==='concluida').length,
    running:rows.filter(r=>r.state==='em andamento').length,
    pending:rows.filter(r=>r.state==='nao iniciada').length
  }),[rows]);

  async function certificate(row){
    setBusy(`${row.professional_id}:${row.lesson_id}`);
    try{
      const data=await api('/api/certificate',{method:'POST',body:{lessonId:row.lesson_id,professionalId:row.professional_id}});
      await load();
      window.open(`?certificado=${data.code}`,'_blank','noopener');
    }catch(e){setError(e.message)}
    finally{setBusy('')}
  }

  function exportCsv(){
    const header=['Contrato','Profissional','Função','Conselho','Aula','Situação','Primeiro acesso','Última visualização',
      'Tempo de vídeo (min)','% do vídeo','Leitura do PDF (min)','Leitura confirmada em','% concluído','Certificado'];
    const lines=visible.map(r=>[
      r.contract_name,r.name,r.role,[r.council,r.council_number].filter(Boolean).join(' '),r.lesson_title,
      STATES[r.state]?.label||r.state,
      r.first_view_at?formatDateTime(r.first_view_at):'',
      r.last_view_at?formatDateTime(r.last_view_at):'',
      r.hasVideo?Math.round((Number(r.watched_seconds)||0)/60):'',
      r.hasVideo?r.videoPercent:'',
      r.hasPdf?Math.round((Number(r.pdf_seconds)||0)/60):'',
      r.pdf_confirmed_at?formatDateTime(r.pdf_confirmed_at):'',
      r.percent,
      r.certificate_code||''
    ].map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(';'));
    const csv='﻿'+[header.join(';'),...lines].join('\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    const link=document.createElement('a');
    link.href=url;link.download='acompanhamento-educacao-virtual.csv';link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section>
      <div className="section-head">
        <div>
          <h2>Acompanhamento</h2>
          <p>Quem assistiu cada aula, quando, por quanto tempo — e a emissão do certificado.</p>
        </div>
        <div className="head-tools">
          <input placeholder="Buscar por profissional ou aula" value={search} onChange={e=>setSearch(e.target.value)}/>
          <select value={contract} onChange={e=>setContract(e.target.value)}>
            <option value="">Todos os contratos</option>
            {contracts.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={state} onChange={e=>setState(e.target.value)}>
            <option value="">Todas as situações</option>
            <option value="concluida">Concluídas</option>
            <option value="em andamento">Em andamento</option>
            <option value="nao iniciada">Não iniciadas</option>
          </select>
          <button className="ghost" onClick={exportCsv} disabled={!visible.length}><Download size={16}/> CSV</button>
        </div>
      </div>

      <Alert onClose={()=>setError('')}>{error}</Alert>

      <div className="tiles">
        <div className="tile ok"><b>{totals.completed}</b><span>aulas concluídas</span></div>
        <div className="tile info"><b>{totals.running}</b><span>em andamento</span></div>
        <div className="tile off"><b>{totals.pending}</b><span>não iniciadas</span></div>
      </div>

      {loading?<Spinner/>:visible.length===0?(
        <Empty icon={<ClipboardList size={40}/>} title="Nada para mostrar">
          Cadastre aulas e profissionais para acompanhar as visualizações aqui.
        </Empty>
      ):(
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Profissional</th><th>Função / conselho</th><th>Aula</th><th>Assistiu em</th>
                <th>Tempo</th><th>Progresso</th><th>Situação</th><th>Certificado</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(r=>{
                const key=`${r.professional_id}:${r.lesson_id}`;
                return (
                  <tr key={key}>
                    <td><b>{r.name}</b><small>{r.contract_name}</small></td>
                    <td>{r.role||'—'}<small>{[r.council,r.council_number].filter(Boolean).join(' ')}</small></td>
                    <td>{r.lesson_title}</td>
                    <td>{r.first_view_at?formatDateTime(r.first_view_at):'—'}<small>{r.last_view_at?`último: ${formatDateTime(r.last_view_at)}`:''}</small></td>
                    <td>{formatDuration(r.watched_seconds)}</td>
                    <td className="progress-cell"><Progress percent={r.percent}/></td>
                    <td><Badge tone={STATES[r.state]?.tone}>{STATES[r.state]?.label||r.state}</Badge></td>
                    <td>
                      {r.certificate_code?(
                        <a className="link" href={`?certificado=${r.certificate_code}`} target="_blank" rel="noreferrer">
                          <Award size={15}/> {r.certificate_code}
                        </a>
                      ):(
                        <button className="ghost small" disabled={!r.eligible||busy===key} onClick={()=>certificate(r)}
                                title={r.eligible?'Emitir certificado':'Disponível a partir de 90% assistidos'}>
                          <Award size={15}/> {busy===key?'Emitindo...':'Emitir'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
