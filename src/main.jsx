import {StrictMode,useCallback,useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Bell, Briefcase, ClipboardList, GraduationCap, KeyRound, LogOut, Users, Video} from 'lucide-react';
import {api,clearSession,loadSession,saveSession} from './api.js';
import {Alert,Field,Modal} from './ui.jsx';
import Login from './Login.jsx';
import Certificate from './Certificate.jsx';
import Contracts from './admin/Contracts.jsx';
import Lessons from './admin/Lessons.jsx';
import Professionals from './admin/Professionals.jsx';
import Tracking from './admin/Tracking.jsx';
import Notifications from './admin/Notifications.jsx';
import Student from './student/Student.jsx';
import './styles.css';

const TABS=[
  {key:'contracts',label:'Contratos',icon:Briefcase},
  {key:'lessons',label:'Aulas',icon:Video},
  {key:'professionals',label:'Profissionais',icon:Users},
  {key:'tracking',label:'Acompanhamento',icon:ClipboardList},
  {key:'notifications',label:'Notificações',icon:Bell}
];

function ChangePassword({onClose,onDone}){
  const [current,setCurrent]=useState('');
  const [next,setNext]=useState('');
  const [repeat,setRepeat]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);

  async function submit(event){
    event.preventDefault();
    if(next!==repeat)return setError('A confirmação não confere com a nova senha.');
    setBusy(true);setError('');
    try{
      await api('/api/auth',{method:'POST',query:{action:'password'},body:{current,next}});
      onDone();
    }catch(e){setError(e.message)}
    finally{setBusy(false)}
  }

  return (
    <Modal title="Alterar senha" subtitle="Defina uma senha pessoal para o seu acesso." onClose={onClose}>
      <form onSubmit={submit} className="form-grid one">
        <Field label="Senha atual"><input type="password" value={current} onChange={e=>setCurrent(e.target.value)} required/></Field>
        <Field label="Nova senha" hint="Mínimo de 6 caracteres."><input type="password" value={next} onChange={e=>setNext(e.target.value)} required minLength={6}/></Field>
        <Field label="Repita a nova senha"><input type="password" value={repeat} onChange={e=>setRepeat(e.target.value)} required/></Field>
        <Alert>{error}</Alert>
        <div className="modal-actions">
          <button type="button" className="ghost" onClick={onClose}>Agora não</button>
          <button className="primary" disabled={busy}>{busy?'Salvando...':'Salvar senha'}</button>
        </div>
      </form>
    </Modal>
  );
}

function AdminApp({session,onLogout}){
  const [tab,setTab]=useState('contracts');
  const [contracts,setContracts]=useState([]);
  const [unread,setUnread]=useState(0);
  const [error,setError]=useState('');

  const loadContracts=useCallback(async()=>{
    try{
      const data=await api('/api/contracts');
      setContracts((data.contracts||[]).filter(c=>c.active!==false||true));
    }catch(e){if(e.auth)onLogout();else setError(e.message)}
  },[onLogout]);

  const loadUnread=useCallback(async()=>{
    try{
      const data=await api('/api/engagement',{query:{unread:'1'}});
      setUnread(data.unread||0);
    }catch{}
  },[]);

  useEffect(()=>{loadContracts();loadUnread()},[loadContracts,loadUnread]);
  useEffect(()=>{
    const timer=setInterval(loadUnread,60000);
    return()=>clearInterval(timer);
  },[loadUnread]);

  return (
    <div className="app">
      <aside>
        <div className="brand">
          <div className="brandmark"><GraduationCap size={22}/></div>
          <div>
            <b>DOC CSC</b>
            <span>Educação Virtual</span>
          </div>
        </div>
        <nav>
          {TABS.map(({key,label,icon:Icon})=>(
            <button key={key} className={tab===key?'active':''} onClick={()=>{setTab(key);if(key==='notifications')loadUnread()}}>
              <Icon size={18}/> {label}
              {key==='notifications'&&unread?<i className="dot">{unread}</i>:null}
            </button>
          ))}
        </nav>
        <div className="aside-foot">
          <span>Administrador</span>
          <button className="ghost small" onClick={onLogout}><LogOut size={15}/> Sair</button>
        </div>
      </aside>

      <main>
        <Alert onClose={()=>setError('')}>{error}</Alert>
        {tab==='contracts'?<Contracts onChanged={loadContracts}/>:null}
        {tab==='lessons'?<Lessons contracts={contracts} onChanged={loadContracts}/>:null}
        {tab==='professionals'?<Professionals contracts={contracts}/>:null}
        {tab==='tracking'?<Tracking contracts={contracts}/>:null}
        {tab==='notifications'?<Notifications onRead={setUnread}/>:null}
      </main>
    </div>
  );
}

function StudentApp({session,onLogout,onSession}){
  const [changing,setChanging]=useState(!!session.mustChange);
  return (
    <div className="app student">
      <aside>
        <div className="brand">
          <div className="brandmark"><GraduationCap size={22}/></div>
          <div>
            <b>DOC CSC</b>
            <span>Educação Virtual</span>
          </div>
        </div>
        <div className="who">
          <b>{session.name}</b>
          <span>{session.contractName}</span>
        </div>
        <div className="aside-foot">
          <button className="ghost small" onClick={()=>setChanging(true)}><KeyRound size={15}/> Alterar senha</button>
          <button className="ghost small" onClick={onLogout}><LogOut size={15}/> Sair</button>
        </div>
      </aside>
      <main>
        <Student session={session}/>
        {changing?(
          <ChangePassword onClose={()=>setChanging(false)}
                          onDone={()=>{setChanging(false);onSession({...session,mustChange:false})}}/>
        ):null}
      </main>
    </div>
  );
}

function App(){
  const params=new URLSearchParams(location.search);
  const certificate=params.get('certificado');
  const [session,setSession]=useState(loadSession());

  const logout=useCallback(()=>{clearSession();setSession(null)},[]);

  if(certificate!==null)return <Certificate code={certificate}/>;
  if(!session)return <Login onDone={setSession}/>;
  if(session.role==='admin')return <AdminApp session={session} onLogout={logout}/>;
  return <StudentApp session={session} onLogout={logout} onSession={data=>setSession(saveSession(data))}/>;
}

createRoot(document.getElementById('root')).render(<StrictMode><App/></StrictMode>);

if('serviceWorker' in navigator&&location.protocol==='https:'){
  window.addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js').catch(()=>{})});
}
