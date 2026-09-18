export const MAX_UPLOAD=4*1024*1024;

/** Percentual da aula que precisa ser assistido para liberar o certificado. */
export const COMPLETION=0.9;

export const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const norm=s=>String(s??'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();

export function text(value,max=4000){
  if(value==null)return '';
  return String(value).trim().slice(0,max);
}

export function toInt(value,max=1000000){
  const n=parseInt(String(value??'').replace(/[^\d-]/g,''),10);
  if(!Number.isFinite(n)||n<0)return 0;
  return Math.min(n,max);
}

/** 'YYYY-MM-DD' ou null. */
export function toDate(value){
  const raw=String(value??'').trim().slice(0,10);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw)?raw:null;
}

export function bool(value,fallback=true){
  if(value===undefined||value===null||value==='')return fallback;
  return value===true||value==='true'||value==='1'||value===1;
}

/** Lê o corpo JSON de uma Vercel Function (req.body pode vir pronto ou não). */
export async function readJson(req){
  if(req.body&&typeof req.body==='object')return req.body;
  let raw='';
  for await(const chunk of req){
    raw+=chunk;
    if(raw.length>1_000_000)break;
  }
  try{const data=JSON.parse(raw||'{}');return data&&typeof data==='object'?data:{}}catch{return {}}
}

/** Lê multipart/form-data (upload de PDF). */
export async function readForm(req){
  const chunks=[];let size=0;
  for await(const chunk of req){
    size+=chunk.length;
    if(size>MAX_UPLOAD+512*1024)throw new Error('FILE_TOO_LARGE');
    chunks.push(chunk);
  }
  return new Response(Buffer.concat(chunks),{headers:{'content-type':req.headers['content-type']||''}}).formData();
}

/** Reconhece links do YouTube e do Vimeo. */
export function parseVideo(url){
  const raw=String(url??'').trim();
  if(!raw)return {provider:'',id:'',url:''};
  let u;
  try{u=new URL(raw.startsWith('http')?raw:'https://'+raw)}catch{return {provider:'',id:'',url:raw}}
  const host=u.hostname.replace(/^www\./,'');
  if(/^(youtube\.com|youtube-nocookie\.com|m\.youtube\.com)$/.test(host)){
    const v=u.searchParams.get('v');
    if(v)return {provider:'youtube',id:v,url:raw};
    const m=u.pathname.match(/\/(embed|shorts|live|v)\/([\w-]{6,})/);
    if(m)return {provider:'youtube',id:m[2],url:raw};
  }
  if(host==='youtu.be'){
    const id=u.pathname.slice(1).split('/')[0];
    if(id)return {provider:'youtube',id,url:raw};
  }
  if(/(^|\.)vimeo\.com$/.test(host)){
    const parts=u.pathname.split('/').filter(Boolean);
    const idx=parts.findIndex(p=>/^\d{6,}$/.test(p));
    if(idx>=0){
      const id=parts[idx];
      const hash=parts[idx+1]&&/^[0-9a-z]{6,}$/i.test(parts[idx+1])?parts[idx+1]:(u.searchParams.get('h')||'');
      return {provider:'vimeo',id:hash?`${id}:${hash}`:id,url:raw};
    }
  }
  return {provider:'',id:'',url:raw};
}

/** Senha inicial legível: 3 letras + 5 dígitos. */
export function randomPassword(){
  const letters='abcdefghjkmnpqrstuvwxyz';
  let out='';
  for(let i=0;i<3;i++)out+=letters[Math.floor(Math.random()*letters.length)];
  return out+String(Math.floor(10000+Math.random()*90000));
}

/** Código público do certificado: DOC-XXXX-XXXX. */
export function certificateCode(){
  const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const block=()=>Array.from({length:4},()=>alphabet[Math.floor(Math.random()*alphabet.length)]).join('');
  return `DOC-${block()}-${block()}`;
}

/** Gera um usuário a partir do nome: "Maria Souza" -> "maria.souza". */
export function usernameFrom(name){
  const parts=norm(name).replace(/[^a-z\s]/g,'').split(/\s+/).filter(Boolean);
  if(!parts.length)return 'usuario';
  const first=parts[0];
  const last=parts.length>1?parts[parts.length-1]:'';
  return (last?`${first}.${last}`:first).slice(0,28);
}

export function fail(res,status,message,extra={}){
  return res.status(status).json({error:message,...extra});
}

export function handleError(res,error){
  console.error(error);
  if(error?.message==='DATABASE_NOT_CONFIGURED')return fail(res,503,'O banco de dados ainda não foi conectado ao projeto na Vercel.');
  if(error?.message==='FILE_TOO_LARGE')return fail(res,413,'O arquivo enviado é maior que 4 MB.');
  if(error?.code==='23505')return fail(res,409,'Já existe um registro com esses dados.');
  return fail(res,500,'Não foi possível concluir a operação.');
}
