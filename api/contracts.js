import {randomUUID} from 'node:crypto';
import {db} from '../lib/db.js';
import {requireAdmin} from '../lib/auth.js';
import {UUID,bool,fail,handleError,readJson,text,toDate} from '../lib/util.js';

async function list(res,sql){
  const rows=await sql`
    SELECT c.id,c.name,c.company,c.cnpj,c.manager,c.email,c.phone,c.city,c.state,c.notes,c.active,c.created_at,
      to_char(c.starts_on,'YYYY-MM-DD') AS starts_on,
      to_char(c.ends_on,'YYYY-MM-DD') AS ends_on,
      (SELECT COUNT(*) FROM professionals p WHERE p.contract_id=c.id) AS professionals,
      (SELECT COUNT(*) FROM lessons l WHERE l.contract_id=c.id) AS lessons
    FROM contracts c ORDER BY c.active DESC, c.name`;
  return res.status(200).json({contracts:rows});
}

function fields(body){
  return {
    name:text(body.name,160),
    company:text(body.company,160),
    cnpj:text(body.cnpj,20),
    manager:text(body.manager,120),
    email:text(body.email,160),
    phone:text(body.phone,40),
    city:text(body.city,80),
    state:text(body.state,2).toUpperCase(),
    starts_on:toDate(body.startsOn),
    ends_on:toDate(body.endsOn),
    notes:text(body.notes,2000),
    active:bool(body.active)
  };
}

export default async function handler(req,res){
  try{
    if(!requireAdmin(req,res))return;
    const sql=await db();

    if(req.method==='GET')return list(res,sql);

    if(req.method==='POST'){
      const body=await readJson(req);
      const f=fields(body);
      if(!f.name)return fail(res,400,'Informe o nome do contrato.');
      const id=UUID.test(String(body.id||''))?String(body.id):null;
      if(id){
        const rows=await sql`UPDATE contracts SET name=${f.name}, company=${f.company}, cnpj=${f.cnpj}, manager=${f.manager},
          email=${f.email}, phone=${f.phone}, city=${f.city}, state=${f.state}, starts_on=${f.starts_on}, ends_on=${f.ends_on},
          notes=${f.notes}, active=${f.active} WHERE id=${id}::uuid RETURNING id`;
        if(!rows.length)return fail(res,404,'Contrato não encontrado.');
        return res.status(200).json({ok:true,id});
      }
      const newId=randomUUID();
      await sql`INSERT INTO contracts (id,name,company,cnpj,manager,email,phone,city,state,starts_on,ends_on,notes,active)
        VALUES (${newId},${f.name},${f.company},${f.cnpj},${f.manager},${f.email},${f.phone},${f.city},${f.state},
        ${f.starts_on},${f.ends_on},${f.notes},${f.active})`;
      return res.status(201).json({ok:true,id:newId});
    }

    if(req.method==='DELETE'){
      const id=String(req.query.id||'');
      if(!UUID.test(id))return fail(res,404,'Contrato não encontrado.');
      const rows=await sql`DELETE FROM contracts WHERE id=${id}::uuid RETURNING id`;
      if(!rows.length)return fail(res,404,'Contrato não encontrado.');
      return res.status(200).json({ok:true,id});
    }

    res.setHeader('Allow','GET, POST, DELETE');
    return fail(res,405,'Método não permitido.');
  }catch(error){return handleError(res,error)}
}
