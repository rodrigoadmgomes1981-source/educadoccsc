import {useState} from 'react';
import {KeyRound, LogIn, ShieldCheck, User} from 'lucide-react';
import {api,saveSession} from './api.js';
import {Alert} from './ui.jsx';

export default function Login({onDone}){
  const [mode,setMode]=useState('user');
  const [user,setUser]=useState('');
  const [password,setPassword]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);

  async function submit(event){
    event.preventDefault();
    setError('');setBusy(true);
    try{
      const data=await api('/api/auth',{method:'POST',auth:false,body:{mode,user,password}});
      saveSession(data);
      onDone(data);
    }catch(e){setError(e.message)}
    finally{setBusy(false)}
  }

  return (
    <div className="login">
      <div className="login-side">
        <img className="login-logo" src="/logo-doccsc.png" alt="DOC CSC — Centro de Serviços Compartilhados"/>
        <h1>Educação Virtual</h1>
        <p>Plataforma de treinamento por contrato da <b>DOC CSC</b>: aulas em vídeo, material de apoio, acompanhamento de quem assistiu e emissão de certificados.</p>
        <ul>
          <li><ShieldCheck size={16}/> Acesso individual por profissional</li>
          <li><ShieldCheck size={16}/> Registro de tempo assistido por aula</li>
          <li><ShieldCheck size={16}/> Certificado com código de validação</li>
        </ul>
      </div>

      <form className="login-form" onSubmit={submit}>
        <div className="tabs">
          <button type="button" className={mode==='user'?'active':''} onClick={()=>{setMode('user');setError('')}}>
            <User size={16}/> Profissional
          </button>
          <button type="button" className={mode==='admin'?'active':''} onClick={()=>{setMode('admin');setError('')}}>
            <KeyRound size={16}/> Administrador
          </button>
        </div>

        <h2>{mode==='admin'?'Acesso do administrador':'Entrar para assistir às aulas'}</h2>
        <p className="muted">
          {mode==='admin'
            ? 'Somente o administrador cadastra contratos, aulas e profissionais.'
            : 'Use o usuário e a senha entregues pelo administrador do seu contrato.'}
        </p>

        <label className="field">
          <span>Usuário</span>
          <input value={user} onChange={e=>setUser(e.target.value)} autoComplete="username"
                 placeholder={mode==='admin'?'admin':'nome.sobrenome'} required/>
        </label>
        <label className="field">
          <span>Senha</span>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required/>
        </label>

        <Alert>{error}</Alert>

        <button className="primary block" disabled={busy}>
          <LogIn size={17}/> {busy?'Entrando...':'Entrar'}
        </button>

        <a className="link-plain" href="?certificado=">Validar um certificado</a>
      </form>
    </div>
  );
}
