import {db} from '../lib/db.js';
import {session} from '../lib/auth.js';
import {COMPLETION,UUID,certificateCode,fail,handleError,readJson,text} from '../lib/util.js';

/** Consulta pública pelo código impresso no certificado. */
async function validate(req,res,sql){
  const code=text(req.query.code,32).toUpperCase();
  if(!code)return fail(res,400,'Informe o código do certificado.');
  const rows=await sql`
    SELECT g.certificate_code,g.watched_seconds,g.duration_seconds,
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

  const rows=await sql`SELECT id,watched_seconds,duration_seconds,completed_at,certificate_code
    FROM progress WHERE lesson_id=${lessonId}::uuid AND professional_id=${professionalId}::uuid`;
  if(!rows.length)return fail(res,400,'Esta aula ainda não foi assistida.');
  const row=rows[0];
  const percent=row.duration_seconds>0?row.watched_seconds/row.duration_seconds:0;
  if(!row.completed_at&&percent<COMPLETION)
    return fail(res,400,`O certificado é liberado com ${Math.round(COMPLETION*100)}% da aula assistidos. Assistido até agora: ${Math.round(percent*100)}%.`);

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
