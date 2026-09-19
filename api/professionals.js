import {randomUUID} from 'node:crypto';
import {db} from '../lib/db.js';
import {hashPassword,requireAdmin} from '../lib/auth.js';
import {UUID,bool,fail,handleError,norm,randomPassword,readJson,text,usernameFrom} from '../lib/util.js';

async function uniqueUsername(sql,wanted,ignoreId=null){
  const base=(usernameFrom(wanted)||'usuario').slice(0,28);
  for(let i=0;i<60;i++){
    const candidate=i?`${base}${i+1}`:base;
    const rows=ignoreId
      ? await sql`SELECT 1 FROM professionals WHERE lower(username)=${candidate} AND id<>${ignoreId}::uuid LIMIT 1`
      : await sql`SELECT 1 FROM professionals WHERE lower(username)=${candidate} LIMIT 1`;
    if(!rows.length)return candidate;
  }
  return `${base}.${Math.floor(Math.random()*9000+1000)}`;
}

async function list(req,res,sql){
  const contract=String(req.query.contract||'');
  const filter=UUID.test(contract)?contract:null;
  const rows=await sql`
    SELECT p.id,p.contract_id,p.name,p.role,p.council,p.council_number,p.cpf,p.email,p.phone,
           p.username,p.active,p.must_change,p.created_at,c.name AS contract_name,
           (SELECT COUNT(*) FROM progress g WHERE g.professional_id=p.id) AS started,
           (SELECT COUNT(*) FROM progress g WHERE g.professional_id=p.id AND g.completed_at IS NOT NULL) AS completed
    FROM professionals p JOIN contracts c ON c.id=p.contract_id
    WHERE ${filter}::uuid IS NULL OR p.contract_id=${filter}::uuid
    ORDER BY c.name, p.name`;
  return res.status(200).json({professionals:rows});
}

async function save(req,res,sql){
  const body=await readJson(req);
  const id=UUID.test(String(body.id||''))?String(body.id):null;
  const name=text(body.name,160);
  const contractId=String(body.contractId||'');
  if(!name)return fail(res,400,'Informe o nome do profissional.');
  if(!UUID.test(contractId))return fail(res,400,'Selecione o contrato do profissional.');

  const f={
    role:text(body.role,120),
    council:text(body.council,20).toUpperCase(),
    council_number:text(body.councilNumber,40),
    cpf:text(body.cpf,20),
    email:text(body.email,160),
    phone:text(body.phone,40),
    active:bool(body.active)
  };

  if(id){
    const wanted=text(body.username,40);
    const rows=await sql`SELECT username FROM professionals WHERE id=${id}::uuid`;
    if(!rows.length)return fail(res,404,'Profissional não encontrado.');
    const username=wanted&&norm(wanted)!==rows[0].username?await uniqueUsername(sql,wanted,id):rows[0].username;
    await sql`UPDATE professionals SET contract_id=${contractId}::uuid, name=${name}, role=${f.role}, council=${f.council},
      council_number=${f.council_number}, cpf=${f.cpf}, email=${f.email}, phone=${f.phone}, active=${f.active}, username=${username}
      WHERE id=${id}::uuid`;
    return res.status(200).json({ok:true,id,username});
  }

  const newId=randomUUID();
  const username=await uniqueUsername(sql,text(body.username,40)||name);
  const password=randomPassword();
  await sql`INSERT INTO professionals (id,contract_id,name,role,council,council_number,cpf,email,phone,username,password_hash,must_change,active)
    VALUES (${newId},${contractId}::uuid,${name},${f.role},${f.council},${f.council_number},${f.cpf},${f.email},${f.phone},
    ${username},${hashPassword(password)},TRUE,${f.active})`;
  return res.status(201).json({ok:true,id:newId,username,password});
}

/** Redefine a senha de todos os profissionais ativos de um contrato. */
async function resetAll(req,res,sql){
  const body=await readJson(req);
  const contractId=String(body.contractId||'');
  if(!UUID.test(contractId))return fail(res,400,'Selecione o contrato.');
  const people=await sql`SELECT id,name,username,role FROM professionals
    WHERE contract_id=${contractId}::uuid AND active=TRUE ORDER BY name`;
  if(!people.length)return fail(res,400,'Este contrato não tem profissionais ativos.');
  if(people.length>300)return fail(res,400,'Contrato com profissionais demais para redefinir de uma vez. Refaça por profissional.');

  const credentials=[];
  for(const person of people){
    const password=randomPassword();
    await sql`UPDATE professionals SET password_hash=${hashPassword(password)}, must_change=TRUE WHERE id=${person.id}::uuid`;
    credentials.push({id:person.id,name:person.name,role:person.role,username:person.username,password});
  }
  return res.status(200).json({ok:true,total:credentials.length,credentials});
}

async function reset(req,res,sql){
  const id=String(req.query.id||'');
  if(!UUID.test(id))return fail(res,404,'Profissional não encontrado.');
  const password=randomPassword();
  const rows=await sql`UPDATE professionals SET password_hash=${hashPassword(password)}, must_change=TRUE
                       WHERE id=${id}::uuid RETURNING username,name`;
  if(!rows.length)return fail(res,404,'Profissional não encontrado.');
  return res.status(200).json({ok:true,id,username:rows[0].username,name:rows[0].name,password});
}

export default async function handler(req,res){
  try{
    if(!requireAdmin(req,res))return;
    const sql=await db();

    if(req.method==='GET')return list(req,res,sql);
    if(req.method==='POST'){
      if(req.query.action==='reset')return reset(req,res,sql);
      if(req.query.action==='reset-all')return resetAll(req,res,sql);
      return save(req,res,sql);
    }

    if(req.method==='DELETE'){
      const id=String(req.query.id||'');
      if(!UUID.test(id))return fail(res,404,'Profissional não encontrado.');
      const rows=await sql`DELETE FROM professionals WHERE id=${id}::uuid RETURNING id`;
      if(!rows.length)return fail(res,404,'Profissional não encontrado.');
      return res.status(200).json({ok:true,id});
    }

    res.setHeader('Allow','GET, POST, DELETE');
    return fail(res,405,'Método não permitido.');
  }catch(error){return handleError(res,error)}
}
