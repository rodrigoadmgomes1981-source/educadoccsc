import {useEffect,useState} from 'react';
import {Briefcase, Pencil, Plus, Trash2} from 'lucide-react';
import {api} from '../api.js';
import {Alert,Badge,Confirm,Empty,Field,Modal,Spinner,formatDate} from '../ui.jsx';

const EMPTY={name:'',company:'',cnpj:'',manager:'',email:'',phone:'',city:'',state:'',startsOn:'',endsOn:'',notes:'',active:true};

function toForm(contract){
  if(!contract)return {...EMPTY};
  return {
    id:contract.id,
    name:contract.name||'',company:contract.company||'',cnpj:contract.cnpj||'',manager:contract.manager||'',
    email:contract.email||'',phone:contract.phone||'',city:contract.city||'',state:contract.state||'',
    startsOn:contract.starts_on?String(contract.starts_on).slice(0,10):'',
    endsOn:contract.ends_on?String(contract.ends_on).slice(0,10):'',
    notes:contract.notes||'',active:contract.active!==false
  };
}

export default function Contracts({onChanged}){
  const [contracts,setContracts]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [editing,setEditing]=useState(null);
  const [removing,setRemoving]=useState(null);
  const [busy,setBusy]=useState(false);

  async function load(){
    setLoading(true);
    try{
      const data=await api('/api/contracts');
      setContracts(data.contracts||[]);
      setError('');
    }catch(e){setError(e.message)}
    finally{setLoading(false)}
  }

  useEffect(()=>{load()},[]);

  async function save(event){
    event.preventDefault();
    setBusy(true);
    try{
      await api('/api/contracts',{method:'POST',body:editing});
      setEditing(null);
      await load();
      onChanged?.();
    }catch(e){setError(e.message)}
    finally{setBusy(false)}
  }

  async function remove(){
    setBusy(true);
    try{
      await api('/api/contracts',{method:'DELETE',query:{id:removing.id}});
      setRemoving(null);
      await load();
      onChanged?.();
    }catch(e){setError(e.message)}
    finally{setBusy(false)}
  }

  const set=(key,value)=>setEditing(current=>({...current,[key]:value}));

  return (
    <section>
      <div className="section-head">
        <div>
          <h2>Contratos</h2>
          <p>Cada contrato agrupa os profissionais e as aulas que eles devem assistir.</p>
        </div>
        <button className="primary" onClick={()=>setEditing({...EMPTY})}><Plus size={17}/> Novo contrato</button>
      </div>

      <Alert onClose={()=>setError('')}>{error}</Alert>

      {loading?<Spinner/>:contracts.length===0?(
        <Empty icon={<Briefcase size={40}/>} title="Nenhum contrato cadastrado">
          Cadastre o primeiro contrato para depois lançar as aulas e os profissionais.
        </Empty>
      ):(
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Contrato</th><th>Gestor</th><th>Vigência</th>
                <th className="num">Profissionais</th><th className="num">Aulas</th><th>Situação</th><th/>
              </tr>
            </thead>
            <tbody>
              {contracts.map(c=>(
                <tr key={c.id}>
                  <td>
                    <b>{c.name}</b>
                    <small>{[c.company,c.cnpj,[c.city,c.state].filter(Boolean).join('/')].filter(Boolean).join(' · ')||'—'}</small>
                  </td>
                  <td>{c.manager||'—'}<small>{[c.email,c.phone].filter(Boolean).join(' · ')}</small></td>
                  <td>{formatDate(c.starts_on)} <span className="muted">a</span> {formatDate(c.ends_on)}</td>
                  <td className="num">{Number(c.professionals)}</td>
                  <td className="num">{Number(c.lessons)}</td>
                  <td><Badge tone={c.active?'ok':'off'}>{c.active?'Ativo':'Inativo'}</Badge></td>
                  <td className="row-actions">
                    <button className="icon" title="Editar" onClick={()=>setEditing(toForm(c))}><Pencil size={16}/></button>
                    <button className="icon danger" title="Excluir" onClick={()=>setRemoving(c)}><Trash2 size={16}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing?(
        <Modal wide title={editing.id?'Editar contrato':'Novo contrato'}
               subtitle="Dados do cliente e período de vigência." onClose={()=>setEditing(null)}>
          <form onSubmit={save} className="form-grid">
            <Field label="Nome do contrato *" span={2}>
              <input value={editing.name} onChange={e=>set('name',e.target.value)} required placeholder="Ex.: Hospital Municipal — Enfermagem"/>
            </Field>
            <Field label="Razão social"><input value={editing.company} onChange={e=>set('company',e.target.value)}/></Field>
            <Field label="CNPJ"><input value={editing.cnpj} onChange={e=>set('cnpj',e.target.value)} placeholder="00.000.000/0001-00"/></Field>
            <Field label="Gestor responsável"><input value={editing.manager} onChange={e=>set('manager',e.target.value)}/></Field>
            <Field label="E-mail"><input type="email" value={editing.email} onChange={e=>set('email',e.target.value)}/></Field>
            <Field label="Telefone"><input value={editing.phone} onChange={e=>set('phone',e.target.value)}/></Field>
            <Field label="Cidade"><input value={editing.city} onChange={e=>set('city',e.target.value)}/></Field>
            <Field label="UF"><input maxLength={2} value={editing.state} onChange={e=>set('state',e.target.value.toUpperCase())}/></Field>
            <Field label="Início da vigência"><input type="date" value={editing.startsOn} onChange={e=>set('startsOn',e.target.value)}/></Field>
            <Field label="Fim da vigência"><input type="date" value={editing.endsOn} onChange={e=>set('endsOn',e.target.value)}/></Field>
            <Field label="Observações" span={3}>
              <textarea rows={3} value={editing.notes} onChange={e=>set('notes',e.target.value)}/>
            </Field>
            <label className="check span-3">
              <input type="checkbox" checked={editing.active} onChange={e=>set('active',e.target.checked)}/>
              <span>Contrato ativo (profissionais podem acessar)</span>
            </label>
            <div className="modal-actions span-3">
              <button type="button" className="ghost" onClick={()=>setEditing(null)}>Cancelar</button>
              <button className="primary" disabled={busy}>{busy?'Salvando...':'Salvar contrato'}</button>
            </div>
          </form>
        </Modal>
      ):null}

      {removing?(
        <Confirm title="Excluir contrato" busy={busy}
                 message={`Excluir "${removing.name}" apaga também as aulas, os profissionais, o histórico e os certificados deste contrato. Esta ação não pode ser desfeita.`}
                 onConfirm={remove} onClose={()=>setRemoving(null)}/>
      ):null}
    </section>
  );
}
