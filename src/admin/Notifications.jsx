import {useEffect,useState} from 'react';
import {Bell, Check, CheckCheck, MessageSquare, ThumbsDown, ThumbsUp} from 'lucide-react';
import {api} from '../api.js';
import {Alert,Empty,Spinner,formatDateTime} from '../ui.jsx';

export default function Notifications({onRead}){
  const [tab,setTab]=useState('comments');
  const [data,setData]=useState({comments:[],reactions:[],unread:0});
  const [onlyUnread,setOnlyUnread]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);

  async function load(){
    setLoading(true);
    try{
      const result=await api('/api/engagement',{query:{unread:onlyUnread?'1':''}});
      setData(result);
      setError('');
      onRead?.(result.unread);
    }catch(e){setError(e.message)}
    finally{setLoading(false)}
  }

  useEffect(()=>{load()},[onlyUnread]);

  async function markRead(payload){
    setBusy(true);
    try{
      await api('/api/engagement',{method:'POST',query:{action:'read'},body:payload});
      await load();
    }catch(e){setError(e.message)}
    finally{setBusy(false)}
  }

  return (
    <section>
      <div className="section-head">
        <div>
          <h2>Notificações</h2>
          <p>Comentários enviados pelos profissionais e avaliações de cada aula.</p>
        </div>
        <div className="head-tools">
          <label className="check inline">
            <input type="checkbox" checked={onlyUnread} onChange={e=>setOnlyUnread(e.target.checked)}/>
            <span>Só não lidos</span>
          </label>
          <button className="ghost" onClick={()=>markRead({all:true})} disabled={busy||!data.unread}>
            <CheckCheck size={16}/> Marcar todos como lidos
          </button>
        </div>
      </div>

      <Alert onClose={()=>setError('')}>{error}</Alert>

      <div className="tabs slim">
        <button className={tab==='comments'?'active':''} onClick={()=>setTab('comments')}>
          <MessageSquare size={16}/> Comentários {data.unread?<i className="dot">{data.unread}</i>:null}
        </button>
        <button className={tab==='reactions'?'active':''} onClick={()=>setTab('reactions')}>
          <ThumbsUp size={16}/> Curtidas e não curtidas
        </button>
      </div>

      {loading?<Spinner/>:tab==='comments'?(
        data.comments.length===0?(
          <Empty icon={<Bell size={40}/>} title="Nenhum comentário">Os comentários das aulas aparecem aqui assim que forem enviados.</Empty>
        ):(
          <div className="feed">
            {data.comments.map(c=>(
              <article key={c.id} className={c.read_at?'note':'note unread'}>
                <div className="note-head">
                  <div>
                    <b>{c.professional_name}</b>
                    <span>{[c.professional_role,c.contract_name].filter(Boolean).join(' · ')}</span>
                  </div>
                  <div className="note-right">
                    <time>{formatDateTime(c.created_at)}</time>
                    {!c.read_at?(
                      <button className="icon" title="Marcar como lido" onClick={()=>markRead({id:c.id})} disabled={busy}><Check size={15}/></button>
                    ):null}
                  </div>
                </div>
                <p className="note-lesson">{c.lesson_title}</p>
                <p className="note-message">{c.message}</p>
              </article>
            ))}
          </div>
        )
      ):(
        data.reactions.length===0?(
          <Empty icon={<ThumbsUp size={40}/>} title="Nenhuma avaliação">As curtidas e não curtidas das aulas aparecem aqui.</Empty>
        ):(
          <div className="table-wrap">
            <table>
              <thead><tr><th>Profissional</th><th>Contrato</th><th>Aula</th><th>Avaliação</th><th>Quando</th></tr></thead>
              <tbody>
                {data.reactions.map((r,i)=>(
                  <tr key={`${r.lesson_id}-${i}`}>
                    <td><b>{r.professional_name}</b><small>{r.professional_role}</small></td>
                    <td>{r.contract_name}</td>
                    <td>{r.lesson_title}</td>
                    <td className={r.value===1?'ok-text':'warn-text'}>
                      {r.value===1?<><ThumbsUp size={15}/> Curtiu</>:<><ThumbsDown size={15}/> Não curtiu</>}
                    </td>
                    <td>{formatDateTime(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </section>
  );
}
