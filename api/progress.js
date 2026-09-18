import {randomUUID} from 'node:crypto';
import {db} from '../lib/db.js';
import {requireAdmin,requireUser} from '../lib/auth.js';
import {UUID,evaluateLesson,fail,handleError,readJson,toInt} from '../lib/util.js';

/** Carrega a aula e confere se o profissional pode registrar tempo nela agora. */
async function openLesson(sql,res,auth,lessonId){
  if(!UUID.test(lessonId)){fail(res,404,'Aula não encontrada.');return null}
  const rows=await sql`SELECT l.id,l.video_provider,l.video_id,l.pdf_name,l.workload_minutes,
      to_char(l.starts_on,'YYYY-MM-DD') AS starts_on, to_char(l.ends_on,'YYYY-MM-DD') AS ends_on
    FROM lessons l
    WHERE l.id=${lessonId}::uuid AND l.published=TRUE
      AND (l.contract_id=${auth.contract}::uuid OR l.contract_id IS NULL)`;
  if(!rows.length){fail(res,403,'Esta aula não está disponível para o seu contrato.');return null}
  const lesson=rows[0];
  const today=new Date().toISOString().slice(0,10);
  if(lesson.starts_on&&today<lesson.starts_on){fail(res,403,'Esta aula ainda não foi liberada.');return null}
  if(lesson.ends_on&&today>lesson.ends_on){fail(res,403,'O prazo para assistir esta aula terminou.');return null}
  return lesson;
}

/** Marca a aula como concluída quando todas as exigências forem cumpridas. */
async function settle(sql,lesson,row){
  const state=evaluateLesson(lesson,row);
  let completedAt=row.completed_at;
  if(!completedAt&&state.complete){
    const done=await sql`UPDATE progress SET completed_at=NOW() WHERE id=${row.id}::uuid RETURNING completed_at`;
    completedAt=done[0].completed_at;
  }
  return {
    ok:true,
    watchedSeconds:row.watched_seconds,
    pdfSeconds:row.pdf_seconds,
    pdfConfirmedAt:row.pdf_confirmed_at,
    percent:state.percent,
    videoPercent:state.videoPercent,
    pdfPercent:state.pdfPercent,
    pdfRequired:state.pdfRequired,
    pdfTimeOk:state.pdfTimeOk,
    videoOk:state.videoOk,
    pdfOk:state.pdfOk,
    completedAt,
    certificateCode:row.certificate_code
  };
}

/** Batida enviada pelo player de vídeo ou pelo leitor de PDF. */
async function heartbeat(req,res,sql){
  const auth=requireUser(req,res);
  if(!auth)return;
  const body=await readJson(req);
  const lesson=await openLesson(sql,res,auth,String(body.lessonId||''));
  if(!lesson)return;

  const isPdf=body.kind==='pdf';
  if(isPdf&&!lesson.pdf_name)return fail(res,400,'Esta aula não tem material em PDF.');

  const add=Math.min(toInt(body.addSeconds,600),600);
  const duration=toInt(body.durationSeconds,60*60*12);
  const starting=body.starting===true;
  const videoAdd=isPdf?0:add;
  const pdfAdd=isPdf?add:0;

  const id=randomUUID();
  const saved=await sql`
    INSERT INTO progress (id,lesson_id,professional_id,watched_seconds,duration_seconds,pdf_seconds,sessions)
    VALUES (${id},${lesson.id}::uuid,${auth.id}::uuid,${videoAdd},${duration},${pdfAdd},${starting?1:0})
    ON CONFLICT (lesson_id,professional_id) DO UPDATE SET
      watched_seconds=progress.watched_seconds+${videoAdd},
      duration_seconds=GREATEST(progress.duration_seconds,${duration}),
      pdf_seconds=progress.pdf_seconds+${pdfAdd},
      sessions=progress.sessions+${starting?1:0},
      last_view_at=NOW()
    RETURNING id,watched_seconds,duration_seconds,pdf_seconds,pdf_confirmed_at,completed_at,certificate_code`;

  return res.status(200).json(await settle(sql,lesson,saved[0]));
}

/** Declaração de leitura do material em PDF. */
async function confirmReading(req,res,sql){
  const auth=requireUser(req,res);
  if(!auth)return;
  const body=await readJson(req);
  const lesson=await openLesson(sql,res,auth,String(body.lessonId||''));
  if(!lesson)return;
  if(!lesson.pdf_name)return fail(res,400,'Esta aula não tem material em PDF.');

  const rows=await sql`SELECT id,watched_seconds,duration_seconds,pdf_seconds,pdf_confirmed_at,completed_at,certificate_code
    FROM progress WHERE lesson_id=${lesson.id}::uuid AND professional_id=${auth.id}::uuid`;
  if(!rows.length)return fail(res,400,'Abra o material em PDF antes de confirmar a leitura.');

  const state=evaluateLesson(lesson,rows[0]);
  if(!state.pdfTimeOk)
    return fail(res,400,`O material precisa ficar aberto por pelo menos ${Math.round(state.pdfRequired/60)} minutos. Tempo de leitura registrado: ${Math.round(state.pdfSeconds/60)} min.`);

  const updated=await sql`UPDATE progress SET pdf_confirmed_at=COALESCE(pdf_confirmed_at,NOW())
    WHERE id=${rows[0].id}::uuid
    RETURNING id,watched_seconds,duration_seconds,pdf_seconds,pdf_confirmed_at,completed_at,certificate_code`;

  return res.status(200).json(await settle(sql,lesson,updated[0]));
}

/** Relatório por contrato: quem assistiu, quando, por quanto tempo e a leitura do PDF. */
async function report(req,res,sql){
  if(!requireAdmin(req,res))return;
  const contract=String(req.query.contract||'');
  const filter=UUID.test(contract)?contract:null;
  const rows=await sql`
    SELECT p.id AS professional_id,p.name,p.role,p.council,p.council_number,p.contract_id,
           c.name AS contract_name,
           l.id AS lesson_id,l.title AS lesson_title,l.workload_minutes,l.video_provider,l.video_id,l.pdf_name,
           to_char(l.ends_on,'YYYY-MM-DD') AS ends_on,
           g.watched_seconds,g.duration_seconds,g.pdf_seconds,g.pdf_confirmed_at,
           g.first_view_at,g.last_view_at,g.completed_at,g.certificate_code
    FROM professionals p
    JOIN contracts c ON c.id=p.contract_id
    JOIN lessons l ON (l.contract_id=p.contract_id OR l.contract_id IS NULL) AND l.published=TRUE
    LEFT JOIN progress g ON g.lesson_id=l.id AND g.professional_id=p.id
    WHERE ${filter}::uuid IS NULL OR p.contract_id=${filter}::uuid
    ORDER BY c.name,p.name,l.created_at DESC`;
  const report=rows.map(r=>{
    const state=evaluateLesson(r,r);
    const started=Number(r.watched_seconds||0)>0||Number(r.pdf_seconds||0)>0;
    return {...r,
      percent:state.percent,
      videoPercent:state.videoPercent,
      pdfPercent:state.pdfPercent,
      pdfRequired:state.pdfRequired,
      hasVideo:state.hasVideo,
      hasPdf:state.hasPdf,
      eligible:!!r.completed_at||state.complete,
      state:r.completed_at||state.complete?'concluida':started?'em andamento':'nao iniciada'};
  });
  return res.status(200).json({report});
}

export default async function handler(req,res){
  try{
    const sql=await db();
    if(req.method==='GET')return report(req,res,sql);
    if(req.method==='POST')return req.query.action==='confirm'?confirmReading(req,res,sql):heartbeat(req,res,sql);
    res.setHeader('Allow','GET, POST');
    return fail(res,405,'Método não permitido.');
  }catch(error){return handleError(res,error)}
}
