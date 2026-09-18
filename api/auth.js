import {db} from '../lib/db.js';
import {createToken,hashPassword,requireUser,sameText,session,verifyPassword} from '../lib/auth.js';
import {fail,handleError,norm,readJson,text} from '../lib/util.js';

function adminUser(){return process.env.ADMIN_USER||'admin'}

async function login(req,res){
  const body=await readJson(req);
  const user=text(body.user,120);
  const password=text(body.password,200);
  if(!user||!password)return fail(res,400,'Informe o usuário e a senha.');

  if(body.mode==='admin'){
    const expected=process.env.ADMIN_PASSWORD;
    if(!expected)return fail(res,503,'Defina a variável ADMIN_PASSWORD no projeto da Vercel para liberar o acesso do administrador.');
    if(!sameText(norm(user),norm(adminUser()))||!sameText(password,expected))return fail(res,401,'Usuário ou senha do administrador incorretos.');
    return res.status(200).json({token:createToken({role:'admin',name:'Administrador'}),role:'admin',name:'Administrador'});
  }

  const sql=await db();
  const rows=await sql`SELECT p.*, c.name AS contract_name, c.active AS contract_active
                       FROM professionals p JOIN contracts c ON c.id=p.contract_id
                       WHERE lower(p.username)=${norm(user)} LIMIT 1`;
  const person=rows[0];
  if(!person||!verifyPassword(password,person.password_hash))return fail(res,401,'Usuário ou senha incorretos.');
  if(!person.active)return fail(res,403,'Este acesso está desativado. Fale com o administrador.');
  if(!person.contract_active)return fail(res,403,'O contrato deste acesso está inativo. Fale com o administrador.');

  return res.status(200).json({
    token:createToken({role:'user',id:person.id,name:person.name,contract:person.contract_id}),
    role:'user',
    name:person.name,
    contractName:person.contract_name,
    mustChange:person.must_change
  });
}

async function changePassword(req,res){
  const auth=requireUser(req,res);
  if(!auth)return;
  const body=await readJson(req);
  const current=text(body.current,200);
  const next=text(body.next,200);
  if(next.length<6)return fail(res,400,'A nova senha deve ter pelo menos 6 caracteres.');
  const sql=await db();
  const rows=await sql`SELECT password_hash FROM professionals WHERE id=${auth.id}::uuid`;
  if(!rows.length)return fail(res,404,'Cadastro não encontrado.');
  if(!verifyPassword(current,rows[0].password_hash))return fail(res,401,'A senha atual está incorreta.');
  await sql`UPDATE professionals SET password_hash=${hashPassword(next)}, must_change=FALSE WHERE id=${auth.id}::uuid`;
  return res.status(200).json({ok:true});
}

export default async function handler(req,res){
  try{
    if(req.method==='GET'){
      const data=session(req);
      if(!data)return res.status(200).json({role:null});
      return res.status(200).json({role:data.role,name:data.name,id:data.id||null});
    }
    if(req.method!=='POST'){res.setHeader('Allow','GET, POST');return fail(res,405,'Método não permitido.')}
    if(req.query.action==='password')return changePassword(req,res);
    return login(req,res);
  }catch(error){return handleError(res,error)}
}
