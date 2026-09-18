import {useEffect,useState} from 'react';
import {Copy, IdCard, KeyRound, Pencil, Plus, Trash2, UserPlus} from 'lucide-react';
import {api} from '../api.js';
import {Alert,Badge,Confirm,Empty,Field,Modal,Spinner} from '../ui.jsx';

const COUNCILS=['COREN','CRM','CRF','CRO','CREFITO','CRN','CRP','CRBM','CRESS','CREF','COFFITO','Outro'];
const EMPTY={contractId:'',name:'',role:'',council:'',councilNumber:'',cpf:'',email:'',phone:'',username:'',active:true};

function toForm(person){
  if(!person)return {...EMPTY};
  return {
    id:person.id,contractId:person.contract_id||'',name:person.name||'',role:person.role||'',
    council:person.council||'',councilNumber:person.council_number||'',cpf:person.cpf||'',
    email:person.email||'',phone:person.phone||'',username:person.username||'',active:person.active!==false
  };
}

export default function Professionals({contracts}){
  const [people,setPeople]=useState([]);
  const [filter,setFilter]=useState('');
  const [search,setSearch]=useState('');
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [editing,setEditing]=useState(null);
  const [removing,setRemoving]=useState(null);
  const [credentials,setCredentials]=useState(null);
  const [busy,setBusy]=useState(false);

  async function load(contract=filter){
    setLoading(true);
    try{
      const data=await api('/api/professionals',{query:{contract}});
      setPeople(data.professionals||[]);
      setError('');
    }catch(e){setError(e.message)}
    finally{setLoading(false)}
  }

  useEffect(()=>{load(filter)},[filter]);

  async function save(event){
    event.preventDefault();
    setBusy(true);
    try{
      const data=await api('/api/professionals',{method:'POST',body:editing});
      const name=editing.name;
      setEditing(null);
      await load();
      if(data.password)setCredentials({name,username:data.username,password:data.password});
    }catch(e){setError(e.message)}
    finally{setBusy(false)}
  }

  async function reset(person){
    setBusy(true);
    try{
      const data=await api('/api/professionals',{method:'POST',query:{action:'reset',id:person.id}});
      setCredentials({name:data.name,username:data.username,password:data.password});
    }catch(e){setError(e.message)}
    finally{setBusy(false)}
  }

  async function remove(){
    setBusy(true);
    try{
      await api('/api/professionals',{method:'DELETE',query:{id:removing.id}});
      setRemoving(null);
      await load();
    }catch(e){setError(e.message)}
    finally{setBusy(false)}
  }

  const set=(key,value)=>setEditing(current=>({...current,[key]:value}));
  const term=search.trim().toLowerCase();
  const visible=term
    ? people.filter(p=>[p.name,p.role,p.council_number,p.username].join(' ').toLowerCase().includes(term))
    : people;

  function copy(){
    const line=`Sistema: ${location.origin}\nUsuário: ${credentials.username}\nSenha: ${credentials.password}`;
    navigator.clipboard?.writeText(line);
  }

  return (
    <section>
      <div className="section-head">
        <div>
          <h2>Profissionais</h2>
          <p>Quem deve assistir aos treinamentos, por contrato, com login e senha individuais.</p>
        </div>
        <div className="head-tools">
          <input placeholder="Buscar por nome, função ou conselho" value={search} onChange={e=>setSearch(e.target.value)}/>
          <select value={filter} onChange={e=>setFilter(e.target.value)}>
            <option value="">Todos os contratos</option>
            {contracts.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button className="primary" onClick={()=>setEditing({...EMPTY,contractId:filter||contracts[0]?.id||''})} disabled={!contracts.length}>
            <Plus size={17}/> Novo profissional
          </button>
        </div>
      </div>

      <Alert onClose={()=>setError('')}>{error}</Alert>
      {!contracts.length&&!loading?<Alert kind="warn">Cadastre um contrato antes de incluir profissionais.</Alert>:null}

      {loading?<Spinner/>:visible.length===0?(
        <Empty icon={<UserPlus size={40}/>} title="Nenhum profissional cadastrado">
          Cadastre os profissionais do contrato para gerar o acesso de cada um.
        </Empty>
      ):(
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Profissional</th><th>Função</th><th>Conselho de classe</th><th>Contrato</th>
                <th>Acesso</th><th className="num">Aulas</th><th>Situação</th><th/>
              </tr>
            </thead>
            <tbody>
              {visible.map(p=>(
                <tr key={p.id}>
                  <td><b>{p.name}</b><small>{[p.email,p.phone].filter(Boolean).join(' · ')}</small></td>
                  <td>{p.role||'—'}</td>
                  <td>{p.council||p.council_number?<span className="council"><IdCard size={14}/> {[p.council,p.council_number].filter(Boolean).join(' ')}</span>:'—'}</td>
                  <td>{p.contract_name}</td>
                  <td><code>{p.username}</code>{p.must_change?<small>senha inicial</small>:null}</td>
                  <td className="num">{Number(p.completed)}/{Number(p.started)}</td>
                  <td><Badge tone={p.active?'ok':'off'}>{p.active?'Ativo':'Inativo'}</Badge></td>
                  <td className="row-actions">
                    <button className="icon" title="Gerar nova senha" onClick={()=>reset(p)} disabled={busy}><KeyRound size={16}/></button>
                    <button className="icon" title="Editar" onClick={()=>setEditing(toForm(p))}><Pencil size={16}/></button>
                    <button className="icon danger" title="Excluir" onClick={()=>setRemoving(p)}><Trash2 size={16}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing?(
        <Modal wide title={editing.id?'Editar profissional':'Novo profissional'}
               subtitle={editing.id?'O usuário e a senha continuam os mesmos.':'O usuário e a senha são gerados ao salvar.'}
               onClose={()=>setEditing(null)}>
          <form onSubmit={save} className="form-grid">
            <Field label="Nome completo *" span={2}>
              <input value={editing.name} onChange={e=>set('name',e.target.value)} required/>
            </Field>
            <Field label="Contrato *">
              <select value={editing.contractId} onChange={e=>set('contractId',e.target.value)} required>
                <option value="">Selecione</option>
                {contracts.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Função *">
              <input value={editing.role} onChange={e=>set('role',e.target.value)} placeholder="Ex.: Enfermeiro assistencial"/>
            </Field>
            <Field label="Conselho">
              <select value={editing.council} onChange={e=>set('council',e.target.value)}>
                <option value="">—</option>
                {COUNCILS.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Nº do conselho de classe">
              <input value={editing.councilNumber} onChange={e=>set('councilNumber',e.target.value)} placeholder="Ex.: 123456-RO"/>
            </Field>
            <Field label="CPF"><input value={editing.cpf} onChange={e=>set('cpf',e.target.value)}/></Field>
            <Field label="E-mail"><input type="email" value={editing.email} onChange={e=>set('email',e.target.value)}/></Field>
            <Field label="Telefone"><input value={editing.phone} onChange={e=>set('phone',e.target.value)}/></Field>
            <Field label="Usuário de acesso" span={3} hint="Deixe em branco para gerar a partir do nome (ex.: maria.souza).">
              <input value={editing.username} onChange={e=>set('username',e.target.value)}/>
            </Field>
            <label className="check span-3">
              <input type="checkbox" checked={editing.active} onChange={e=>set('active',e.target.checked)}/>
              <span>Acesso ativo</span>
            </label>
            <div className="modal-actions span-3">
              <button type="button" className="ghost" onClick={()=>setEditing(null)}>Cancelar</button>
              <button className="primary" disabled={busy}>{busy?'Salvando...':'Salvar profissional'}</button>
            </div>
          </form>
        </Modal>
      ):null}

      {credentials?(
        <Modal title="Acesso gerado" subtitle="Anote ou copie agora: a senha não é exibida novamente."
               onClose={()=>setCredentials(null)}>
          <div className="credentials">
            <p><b>{credentials.name}</b></p>
            <div><span>Endereço</span><code>{location.origin}</code></div>
            <div><span>Usuário</span><code>{credentials.username}</code></div>
            <div><span>Senha</span><code>{credentials.password}</code></div>
          </div>
          <div className="modal-actions">
            <button type="button" className="ghost" onClick={copy}><Copy size={16}/> Copiar</button>
            <button type="button" className="primary" onClick={()=>setCredentials(null)}>Concluído</button>
          </div>
        </Modal>
      ):null}

      {removing?(
        <Confirm title="Excluir profissional" busy={busy}
                 message={`Excluir "${removing.name}" apaga o acesso, o histórico de aulas assistidas e os certificados emitidos.`}
                 onConfirm={remove} onClose={()=>setRemoving(null)}/>
      ):null}
    </section>
  );
}
