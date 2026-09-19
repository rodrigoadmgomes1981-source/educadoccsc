import {useEffect,useState} from 'react';
import {Award, Clock, Download, KeyRound, MessageSquare, RotateCcw, Save, ShieldCheck, Sliders} from 'lucide-react';
import {api} from '../api.js';
import {Alert,Confirm,Field,Modal,Spinner} from '../ui.jsx';

const DEFAULTS={
  videoPercent:90,pdfWorkloadPercent:90,pdfMinutesWithVideo:2,requirePdfWithVideo:true,
  allowSelfCertificate:true,institution:'DOC CSC',certificateSignature:'DOC CSC · Educação Virtual',
  certificateRole:'Coordenação de Treinamento',certificateCity:'',certificateNote:'',
  allowReactions:true,allowComments:true,sessionHours:12,requirePasswordChange:true,defaultLessonDays:30
};

export default function Settings({contracts,onSaved}){
  const [values,setValues]=useState(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);

  const [contract,setContract]=useState('');
  const [asking,setAsking]=useState(false);
  const [batch,setBatch]=useState(null);

  async function load(){
    setLoading(true);
    try{
      const data=await api('/api/settings');
      setValues({...DEFAULTS,...(data.settings||{})});
      setError('');
    }catch(e){setError(e.message)}
    finally{setLoading(false)}
  }

  useEffect(()=>{load()},[]);

  const set=(key,value)=>setValues(current=>({...current,[key]:value}));
  const number=(key,value,min,max)=>{
    const n=parseInt(String(value).replace(/\D/g,''),10);
    set(key,Number.isFinite(n)?Math.min(max,Math.max(min,n)):'');
  };

  async function save(event){
    event.preventDefault();
    setBusy(true);setMessage('');
    try{
      const data=await api('/api/settings',{method:'POST',body:values});
      setValues({...DEFAULTS,...data.settings});
      setMessage('Configurações salvas. As regras valem a partir de agora, inclusive para quem já está com a aula aberta.');
      onSaved?.(data.settings);
    }catch(e){setError(e.message)}
    finally{setBusy(false)}
  }

  async function resetAll(){
    setBusy(true);
    try{
      const data=await api('/api/professionals',{method:'POST',query:{action:'reset-all'},body:{contractId:contract}});
      setAsking(false);
      setBatch(data.credentials||[]);
    }catch(e){setError(e.message);setAsking(false)}
    finally{setBusy(false)}
  }

  function exportCsv(){
    const header=['Nome','Função','Usuário','Senha provisória'];
    const lines=batch.map(c=>[c.name,c.role,c.username,c.password].map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(';'));
    const csv='﻿'+[header.join(';'),...lines].join('\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    const link=document.createElement('a');
    link.href=url;link.download='senhas-provisorias.csv';link.click();
    URL.revokeObjectURL(url);
  }

  if(loading||!values)return <Spinner label="Carregando as configurações..."/>;

  const contractName=contracts.find(c=>c.id===contract)?.name||'';

  return (
    <section>
      <div className="section-head">
        <div>
          <h2>Configurações</h2>
          <p>Parâmetros de conclusão, certificado, interação e acesso. Valem para todo o sistema.</p>
        </div>
        <button className="primary" onClick={save} disabled={busy}><Save size={17}/> {busy?'Salvando...':'Salvar alterações'}</button>
      </div>

      <Alert onClose={()=>setError('')}>{error}</Alert>
      {message?<Alert kind="ok" onClose={()=>setMessage('')}>{message}</Alert>:null}

      <form onSubmit={save} className="settings">
        <fieldset>
          <legend><Sliders size={16}/> Conclusão da aula</legend>
          <p className="muted">Definem quando a aula é dada como concluída e o certificado é liberado.</p>
          <div className="form-grid">
            <Field label="Mínimo do vídeo assistido (%)" hint="Entre 50 e 100. Padrão: 90%.">
              <input inputMode="numeric" value={values.videoPercent}
                     onChange={e=>number('videoPercent',e.target.value,50,100)}/>
            </Field>
            <Field label="Leitura do PDF sem vídeo (% da carga horária)" hint="Aula só com PDF. Padrão: 90% da carga horária cadastrada.">
              <input inputMode="numeric" value={values.pdfWorkloadPercent}
                     onChange={e=>number('pdfWorkloadPercent',e.target.value,10,100)}/>
            </Field>
            <Field label="Leitura do PDF com vídeo (minutos)" hint="Aula que tem vídeo e PDF. Padrão: 2 minutos.">
              <input inputMode="numeric" value={values.pdfMinutesWithVideo}
                     onChange={e=>number('pdfMinutesWithVideo',e.target.value,1,180)}/>
            </Field>
            <label className="check span-3">
              <input type="checkbox" checked={values.requirePdfWithVideo}
                     onChange={e=>set('requirePdfWithVideo',e.target.checked)}/>
              <span>Exigir a leitura do PDF também nas aulas que têm vídeo
                <em>Desligado, o PDF vira material de apoio opcional quando a aula tem vídeo.</em></span>
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend><Award size={16}/> Certificado</legend>
          <div className="form-grid">
            <Field label="Instituição" hint="Nome usado no texto do certificado.">
              <input value={values.institution} onChange={e=>set('institution',e.target.value)}/>
            </Field>
            <Field label="Assinatura" hint="Linha principal do rodapé.">
              <input value={values.certificateSignature} onChange={e=>set('certificateSignature',e.target.value)}/>
            </Field>
            <Field label="Cargo / setor" hint="Linha menor abaixo da assinatura.">
              <input value={values.certificateRole} onChange={e=>set('certificateRole',e.target.value)}/>
            </Field>
            <Field label="Cidade" hint="Ex.: Porto Velho/RO. Sai antes da data.">
              <input value={values.certificateCity} onChange={e=>set('certificateCity',e.target.value)}/>
            </Field>
            <Field label="Observação no rodapé" span={2} hint="Opcional. Ex.: referência de portaria ou programa.">
              <input value={values.certificateNote} onChange={e=>set('certificateNote',e.target.value)}/>
            </Field>
            <label className="check span-3">
              <input type="checkbox" checked={values.allowSelfCertificate}
                     onChange={e=>set('allowSelfCertificate',e.target.checked)}/>
              <span>O profissional pode emitir o próprio certificado
                <em>Desligado, só o administrador emite pela tela de Acompanhamento.</em></span>
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend><MessageSquare size={16}/> Interação</legend>
          <div className="form-grid">
            <label className="check span-3">
              <input type="checkbox" checked={values.allowReactions} onChange={e=>set('allowReactions',e.target.checked)}/>
              <span>Permitir curtir / não curtir nas aulas</span>
            </label>
            <label className="check span-3">
              <input type="checkbox" checked={values.allowComments} onChange={e=>set('allowComments',e.target.checked)}/>
              <span>Permitir comentários (geram notificação no painel)</span>
            </label>
            <Field label="Prazo padrão para novas aulas (dias)" hint="Preenche o prazo final ao criar uma aula. 0 = sem sugestão.">
              <input inputMode="numeric" value={values.defaultLessonDays}
                     onChange={e=>number('defaultLessonDays',e.target.value,0,730)}/>
            </Field>
          </div>
        </fieldset>

        <fieldset>
          <legend><ShieldCheck size={16}/> Acesso</legend>
          <div className="form-grid">
            <Field label="Duração da sessão (horas)" hint="Depois disso é preciso entrar de novo. Padrão: 12.">
              <input inputMode="numeric" value={values.sessionHours}
                     onChange={e=>number('sessionHours',e.target.value,1,168)}/>
            </Field>
            <label className="check span-2">
              <input type="checkbox" checked={values.requirePasswordChange}
                     onChange={e=>set('requirePasswordChange',e.target.checked)}/>
              <span>Pedir troca de senha no primeiro acesso do profissional</span>
            </label>
          </div>
        </fieldset>

        <div className="modal-actions">
          <button type="button" className="ghost" onClick={()=>setValues({...DEFAULTS})}>
            <RotateCcw size={16}/> Restaurar padrões
          </button>
          <button className="primary" disabled={busy}><Save size={17}/> {busy?'Salvando...':'Salvar alterações'}</button>
        </div>
      </form>

      <fieldset className="settings danger-zone">
        <legend><KeyRound size={16}/> Redefinir senhas em lote</legend>
        <p className="muted">
          Gera uma senha provisória nova para <b>todos os profissionais ativos</b> de um contrato e derruba as senhas atuais.
          Para uma pessoa só, use o botão da chave na tela de Profissionais.
        </p>
        <div className="head-tools">
          <select value={contract} onChange={e=>setContract(e.target.value)}>
            <option value="">Selecione o contrato</option>
            {contracts.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button type="button" className="danger" disabled={!contract||busy} onClick={()=>setAsking(true)}>
            <KeyRound size={16}/> Redefinir senhas do contrato
          </button>
        </div>
      </fieldset>

      {asking?(
        <Confirm title="Redefinir todas as senhas" confirmLabel="Redefinir agora" busy={busy}
                 message={`Todos os profissionais ativos de "${contractName}" receberão uma senha provisória nova e perderão o acesso atual. A lista aparece uma única vez — exporte antes de fechar.`}
                 onConfirm={resetAll} onClose={()=>setAsking(false)}/>
      ):null}

      {batch?(
        <Modal wide title="Senhas provisórias geradas"
               subtitle={`${batch.length} profissional(is). Esta lista não é exibida novamente — exporte ou copie agora.`}
               onClose={()=>setBatch(null)}>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Profissional</th><th>Função</th><th>Usuário</th><th>Senha provisória</th></tr></thead>
              <tbody>
                {batch.map(c=>(
                  <tr key={c.id}>
                    <td><b>{c.name}</b></td>
                    <td>{c.role||'—'}</td>
                    <td><code>{c.username}</code></td>
                    <td><code>{c.password}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="modal-actions">
            <button type="button" className="ghost" onClick={exportCsv}><Download size={16}/> Exportar CSV</button>
            <button type="button" className="primary" onClick={()=>setBatch(null)}>Concluído</button>
          </div>
        </Modal>
      ):null}

      <p className="muted small settings-foot">
        <Clock size={13}/> O usuário e a senha do administrador continuam nas variáveis de ambiente da Vercel
        (<code>ADMIN_USER</code> e <code>ADMIN_PASSWORD</code>) — não são editáveis por aqui, de propósito.
      </p>
    </section>
  );
}
