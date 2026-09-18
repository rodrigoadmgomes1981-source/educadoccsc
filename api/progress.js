import {randomUUID} from 'node:crypto';
import {db} from '../lib/db.js';
import {requireAdmin,requireUser} from '../lib/auth.js';
import {COMPLETION,UUID,fail,handleError,readJson,toInt} from '../lib/util.js';

/** Batida enviada pelo player a cada poucos segundos. */
async function heartbeat(req,res,sql){
  const auth=requireUser(req,res);
  if(!auth)return;
  const body=await readJson(req);
  const lessonId=String(body.lessonId||'');
  if(!UUID.test(lessonId))return fail(res,404,'Aula não encontrada.');
  const add=Math.min(toInt(body.addSeconds,600),600);
  const duration=toInt(body.durationSeconds,60*60*12);
  const starting=body.starting===true;

  const rows=await sql`SELECT l.id,to_char(l.starts_on,'YYYY-MM-DD') AS starts_on,to_char(l.ends_on,'YYYY-MM-DD') AS ends_on FROM lessons l
    WHERE l.id=${lessonId}::uuid AND l.published=TRUE
      AND (l.contract_id=${auth.contract}::uuid OR l.contract_id IS NULL)`;
  if(!rows.length)return fail(res,403,'Esta aula não está disponível para o seu contrato.');
  const lesson=rows[0];
  const today=new Date().toISOString().slice(0,10);
  if(lesson.starts_on&&today<String(lesson.starts_on).slice(0,10))return fail(res,403,'Esta aula ainda não foi liberada.');
  if(lesson.ends_on&&today>String(lesson.ends_on).slice(0,10))return fail(res,403,'O prazo para assistir esta aula terminou.');

  const id=randomUUID();
  const saved=await sql`
    INSERT INTO progress (id,lesson_id,professional_id,watched_seconds,duration_seconds,sessions)
    VALUES (${id},${lessonId}::uuid,${auth.id}::uuid,${add},${duration},${starting?1:0})
    ON CONFLICT (lesson_id,professional_id) DO UPDATE SET
      watched_seconds=progress.watched_seconds+${add},
      duration_seconds=GREATEST(progress.duration_seconds,${duration}),
      sessions=progress.sessions+${starting?1:0},
      last_view_at=NOW()
    RETURNING id,watched_seconds,duration_seconds,completed_at,certificate_code`;

  let row=saved[0];
  if(!row.completed_at&&row.duration_seconds>0&&row.watched_seconds>=row.duration_seconds*COMPLETION){
    const done=await sql`UPDATE progress SET completed_at=NOW() WHERE id=${row.id}::uuid RETURNING completed_at`;
    row={...row,completed_at:done[0].completed_at};
  }
  const percent=row.duration_seconds>0?Math.min(100,Math.round(row.watched_seconds/row.duration_seconds*100)):0;
  return res.status(200).json({ok:true,watchedSeconds:row.watched_seconds,percent,completedAt:row.completed_at,certificateCode:row.certificate_code});
}

/** Relatório por contrato: quem assistiu, quando e por quanto tempo. */
async function report(req,res,sql){
  if(!requireAdmin(req,res))return;
  const contract=String(req.query.contract||'');
  const filter=UUID.test(contract)?contract:null;
  const rows=await sql`
    SELECT p.id AS professional_id,p.name,p.role,p.council,p.council_number,p.contract_id,
           c.name AS contract_name,
           l.id AS lesson_id,l.title AS lesson_title,l.workload_minutes,
           to_char(l.ends_on,'YYYY-MM-DD') AS ends_on,
           g.watched_seconds,g.duration_seconds,g.first_view_at,g.last_view_at,g.completed_at,g.certificate_code
    FROM professionals p
    JOIN contracts c ON c.id=p.contract_id
    JOIN lessons l ON (l.contract_id=p.contract_id OR l.contract_id IS NULL) AND l.published=TRUE
    LEFT JOIN progress g ON g.lesson_id=l.id AND g.professional_id=p.id
    WHERE ${filter}::uuid IS NULL OR p.contract_id=${filter}::uuid
    ORDER BY c.name,p.name,l.created_at DESC`;
  const report=rows.map(r=>{
    const duration=Number(r.duration_seconds||0);
    const watched=Number(r.watched_seconds||0);
    const percent=duration>0?Math.min(100,Math.round(watched/duration*100)):0;
    return {...r,percent,
      eligible:!!r.completed_at,
      state:r.completed_at?'concluida':watched>0?'em andamento':'nao iniciada'};
  });
  return res.status(200).json({report});
}

export default async function handler(req,res){
  try{
    const sql=await db();
    if(req.method==='GET')return report(req,res,sql);
    if(req.method==='POST')return heartbeat(req,res,sql);
    res.setHeader('Allow','GET, POST');
    return fail(res,405,'Método não permitido.');
  }catch(error){return handleError(res,error)}
}
