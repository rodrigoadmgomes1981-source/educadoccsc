import {db} from '../lib/db.js';
import {session} from '../lib/auth.js';
import {UUID,certificateCode,evaluateLesson,fail,handleError,missingMessage,readJson,text} from '../lib/util.js';
import {loadSettings} from '../lib/settings.js';

/** Consulta pública pelo código impresso no certificado. */
async function validate(req,res,sql){
  const code=text(req.query.code,32).toUpperCase();
  if(!code)return fail(res,400,'Informe o código do certificado.');
  const rows=await sql`
    SELECT g.certificate_code,g.watched_seconds,g.duration_seconds,g.pdf_seconds,g.pdf_confirmed_at,
           l.video_provider,l.pdf_name,
           to_char(g.certificate_at AT TIME ZONE 'America/Porto_Velho','YYYY-MM-DD') AS certificate_date,
           to_char(g.completed_at AT TIME ZONE 'America/Porto_Velho','YYYY-MM-DD') AS completed_date,
           p.name AS professional_name,p.role AS professional_role,p.council,p.council_number,
           l.title AS lesson_title,l.workload_minutes,l.content AS lesson_content,
           c.name AS contract_name
    FROM progress g
    JOIN professionals p ON p.id=g.professional_id
    JOIN lessons l ON l.id=g.lesson_id
    JOIN contracts c ON c.id=p.contract_id
    WHERE g.certificate_code=${code} LIMIT 1`;
  if(!rows.length)return fail(res,404,'Certificado não encontrado. Confira o código.');
  return res.status(200).json({certificate:rows[0]});
}

/** Emite (ou recupera) o certificado de uma aula. */
async function issue(req,res,sql){
  const auth=session(req);
  if(!auth)return fail(res,401,'Sessão expirada. Entre novamente.',{auth:true});
  const body=await readJson(req);
  const lessonId=String(body.lessonId||'');
  const professionalId=auth.role==='admin'?String(body.professionalId||''):auth.id;
  if(!UUID.test(lessonId)||!UUID.test(String(professionalId)))return fail(res,404,'Aula ou profissional não encontrado.');

  const rows=await sql`SELECT g.id,g.watched_seconds,g.duration_seconds,g.pdf_seconds,g.pdf_confirmed_at,
           g.completed_at,g.certificate_code,
           l.video_provider,l.video_id,l.pdf_name,l.workload_minutes
    FROM progress g JOIN lessons l ON l.id=g.lesson_id
    WHERE g.lesson_id=${lessonId}::uuid AND g.professional_id=${professionalId}::uuid`;
  if(!rows.length)return fail(res,400,'Esta aula ainda não foi iniciada.');
  const row=rows[0];
  const settings=await loadSettings(sql);
  if(auth.role!=='admin'&&settings.allowSelfCertificate===false)
    return fail(res,403,'A emissão do certificado é feita pelo administrador do contrato.');
  const state=evaluateLesson(row,row,settings);
  if(!row.completed_at&&!state.complete)return fail(res,400,missingMessage(state));

  if(row.certificate_code)return res.status(200).json({ok:true,code:row.certificate_code});

  for(let i=0;i<5;i++){
    const code=certificateCode();
    try{
      const done=await sql`UPDATE progress SET certificate_code=${code}, certificate_at=NOW(),
        completed_at=COALESCE(completed_at,NOW()) WHERE id=${row.id}::uuid RETURNING certificate_code`;
      return res.status(200).json({ok:true,code:done[0].certificate_code});
    }catch(error){if(error?.code!=='23505')throw error}
  }
  return fail(res,500,'Não foi possível gerar o código do certificado. Tente novamente.');
}

export default async function handler(req,res){
  try{
    const sql=await db();
    if(req.method==='GET')return validate(req,res,sql);
    if(req.method==='POST')return issue(req,res,sql);
    res.setHeader('Allow','GET, POST');
    return fail(res,405,'Método não permitido.');
  }catch(error){return handleError(res,error)}
}
