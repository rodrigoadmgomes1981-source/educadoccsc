import {createHmac,randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
import {fail} from './util.js';

const DAY=24*60*60;
const SESSION_SECONDS=12*60*60; // 12 horas

function secret(){
  const value=process.env.AUTH_SECRET||process.env.ADMIN_PASSWORD||process.env.DATABASE_URL||process.env.POSTGRES_URL;
  if(!value)throw new Error('AUTH_NOT_CONFIGURED');
  return value;
}

const b64=buf=>Buffer.from(buf).toString('base64url');

/** Hash de senha (scrypt) no formato salt:hash. */
export function hashPassword(password){
  const salt=randomBytes(16);
  const hash=scryptSync(String(password),salt,64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifyPassword(password,stored){
  const [saltHex,hashHex]=String(stored||'').split(':');
  if(!saltHex||!hashHex)return false;
  try{
    const expected=Buffer.from(hashHex,'hex');
    const actual=scryptSync(String(password),Buffer.from(saltHex,'hex'),expected.length);
    return timingSafeEqual(expected,actual);
  }catch{return false}
}

/** Compara textos sem vazar tempo. */
export function sameText(a,b){
  const x=Buffer.from(String(a??''));
  const y=Buffer.from(String(b??''));
  return x.length===y.length&&timingSafeEqual(x,y);
}

export function createToken(payload,seconds=SESSION_SECONDS){
  const body=b64(JSON.stringify({...payload,exp:Math.floor(Date.now()/1000)+seconds}));
  const sign=createHmac('sha256',secret()).update(body).digest('base64url');
  return `${body}.${sign}`;
}

export function readToken(token){
  const [body,sign]=String(token||'').split('.');
  if(!body||!sign)return null;
  const expected=createHmac('sha256',secret()).update(body).digest('base64url');
  if(!sameText(sign,expected))return null;
  try{
    const data=JSON.parse(Buffer.from(body,'base64url').toString('utf8'));
    if(!data.exp||data.exp<Math.floor(Date.now()/1000))return null;
    return data;
  }catch{return null}
}

function tokenFrom(req){
  const header=req.headers?.authorization||'';
  if(/^Bearer /i.test(header))return header.slice(7).trim();
  return String(req.query?.t||'');
}

export function session(req){
  return readToken(tokenFrom(req));
}

/** Exige sessão de administrador. */
export function requireAdmin(req,res){
  const data=session(req);
  if(!data||data.role!=='admin'){fail(res,401,'Sessão expirada. Entre novamente como administrador.',{auth:true});return null}
  return data;
}

/** Exige sessão de profissional. */
export function requireUser(req,res){
  const data=session(req);
  if(!data||data.role!=='user'){fail(res,401,'Sessão expirada. Entre novamente.',{auth:true});return null}
  return data;
}

export const SESSION_TTL=SESSION_SECONDS;
export const ONE_DAY=DAY;
