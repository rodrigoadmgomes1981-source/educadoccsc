import {randomUUID} from 'node:crypto';
import {db} from '../lib/db.js';
import {requireAdmin,requireUser,session} from '../lib/auth.js';
import {UUID,fail,handleError,readJson,text} from '../lib/util.js';

async function assertLesson(sql,res,auth,lessonId){
  if(!UUID.test(lessonId)){fail(res,404,'Aula não encontrada.');return false}
  const rows=await sql`SELECT id FROM lessons WHERE id=${lessonId}::uuid AND published=TRUE
    AND (contract_id=${auth.contract}::uuid OR contract_id IS NULL)`;
  if(!rows.length){fail(res,403,'Esta aula não está disponível para o seu contrato.');return false}
  return true;
}

async function react(req,res,sql){
  const auth=requireUser(req,res);
  if(!auth)return;
  const body=await readJson(req);
  const lessonId=String(body.lessonId||'');
  if(!await assertLesson(sql,res,auth,lessonId))return;
  const value=Number(body.value);
  if(value===0){
    await sql`DELETE FROM reactions WHERE lesson_id=${lessonId}::uuid AND professional_id=${auth.id}::uuid`;
  }else if(value===1||value===-1){
    await sql`INSERT INTO reactions (lesson_id,professional_id,value) VALUES (${lessonId}::uuid,${auth.id}::uuid,${value})
      ON CONFLICT (lesson_id,professional_id) DO UPDATE SET value=${value}, created_at=NOW()`;
  }else return fail(res,400,'Avaliação inválida.');
  const rows=await sql`SELECT
      COUNT(*) FILTER (WHERE value=1) AS likes,
      COUNT(*) FILTER (WHERE value=-1) AS dislikes
    FROM reactions WHERE lesson_id=${lessonId}::uuid`;
  return res.status(200).json({ok:true,reaction:value||null,likes:Number(rows[0].likes),dislikes:Number(rows[0].dislikes)});
}

async function comment(req,res,sql){
  const auth=requireUser(req,res);
  if(!auth)return;
  const body=await readJson(req);
  const lessonId=String(body.lessonId||'');
  if(!await assertLesson(sql,res,auth,lessonId))return;
  const message=text(body.message,4000);
  if(message.length<2)return fail(res,400,'Escreva o seu comentário.');
  const id=randomUUID();
  await sql`INSERT INTO comments (id,lesson_id,professional_id,message) VALUES (${id},${lessonId}::uuid,${auth.id}::uuid,${message})`;
  return res.status(201).json({ok:true,id});
}

/** Painel do administrador: comentários (notificações) e quem curtiu/não curtiu. */
async function panel(req,res,sql){
  if(!requireAdmin(req,res))return;
  const lesson=String(req.query.lesson||'');
  const lessonFilter=UUID.test(lesson)?lesson:null;
  const onlyUnread=req.query.unread==='1';

  const comments=await sql`
    SELECT m.id,m.message,m.created_at,m.read_at,
           p.name AS professional_name,p.role AS professional_role,
           l.id AS lesson_id,l.title AS lesson_title,
           c.name AS contract_name
    FROM comments m
    JOIN professionals p ON p.id=m.professional_id
    JOIN lessons l ON l.id=m.lesson_id
    JOIN contracts c ON c.id=p.contract_id
    WHERE (${lessonFilter}::uuid IS NULL OR m.lesson_id=${lessonFilter}::uuid)
      AND (${onlyUnread}::boolean=FALSE OR m.read_at IS NULL)
    ORDER BY m.created_at DESC LIMIT 300`;

  const reactions=await sql`
    SELECT r.value,r.created_at,
           p.name AS professional_name,p.role AS professional_role,
           l.id AS lesson_id,l.title AS lesson_title,
           c.name AS contract_name
    FROM reactions r
    JOIN professionals p ON p.id=r.professional_id
    JOIN lessons l ON l.id=r.lesson_id
    JOIN contracts c ON c.id=p.contract_id
    WHERE ${lessonFilter}::uuid IS NULL OR r.lesson_id=${lessonFilter}::uuid
    ORDER BY r.created_at DESC LIMIT 500`;

  const unread=await sql`SELECT COUNT(*) AS total FROM comments WHERE read_at IS NULL`;
  return res.status(200).json({comments,reactions,unread:Number(unread[0].total)});
}

async function markRead(req,res,sql){
  if(!requireAdmin(req,res))return;
  const body=await readJson(req);
  if(body.all===true){
    await sql`UPDATE comments SET read_at=NOW() WHERE read_at IS NULL`;
    return res.status(200).json({ok:true});
  }
  const id=String(body.id||'');
  if(!UUID.test(id))return fail(res,404,'Comentário não encontrado.');
  await sql`UPDATE comments SET read_at=NOW() WHERE id=${id}::uuid`;
  return res.status(200).json({ok:true,id});
}

export default async function handler(req,res){
  try{
    const auth=session(req);
    if(!auth)return fail(res,401,'Sessão expirada. Entre novamente.',{auth:true});
    const sql=await db();

    if(req.method==='GET')return panel(req,res,sql);
    if(req.method==='POST'){
      const action=String(req.query.action||'');
      if(action==='reaction')return react(req,res,sql);
      if(action==='comment')return comment(req,res,sql);
      if(action==='read')return markRead(req,res,sql);
      return fail(res,400,'Ação inválida.');
    }
    res.setHeader('Allow','GET, POST');
    return fail(res,405,'Método não permitido.');
  }catch(error){return handleError(res,error)}
}
