const KEY='doccsc.edu.session';

export function loadSession(){
  try{
    const data=JSON.parse(localStorage.getItem(KEY)||'null');
    return data&&data.token?data:null;
  }catch{return null}
}

export function saveSession(data){
  try{localStorage.setItem(KEY,JSON.stringify(data))}catch{}
  return data;
}

export function clearSession(){
  try{localStorage.removeItem(KEY)}catch{}
}

export function token(){
  return loadSession()?.token||'';
}

/** Chamada às APIs. `form` envia multipart; `body` envia JSON. */
export async function api(path,{method='GET',body,form,query,auth=true}={}){
  const url=new URL(path,location.origin);
  Object.entries(query||{}).forEach(([k,v])=>{if(v!==undefined&&v!==null&&v!=='')url.searchParams.set(k,v)});
  const headers={};
  if(auth&&token())headers.authorization=`Bearer ${token()}`;
  let payload;
  if(form)payload=form;
  else if(body!==undefined){headers['content-type']='application/json';payload=JSON.stringify(body)}

  const response=await fetch(url,{method,headers,body:payload});
  let data={};
  try{data=await response.json()}catch{}
  if(!response.ok){
    const error=new Error(data.error||'Não foi possível concluir a operação.');
    error.status=response.status;
    error.auth=!!data.auth;
    if(error.auth)clearSession();
    throw error;
  }
  return data;
}

export const fileUrl=id=>`/api/pdf?id=${id}&t=${encodeURIComponent(token())}`;
