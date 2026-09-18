import {randomUUID} from 'node:crypto';
import {db} from '../lib/db.js';
import {requireAdmin,session} from '../lib/auth.js';
import {MAX_UPLOAD,UUID,bool,fail,handleError,parseVideo,readForm,text,toDate,toInt} from '../lib/util.js';

/** Lista para o administrador, com indicadores de cada aula. */
async function listForAdmin(req,res,sql){
  const contract=String(req.query.contract||'');
  const filter=UUID.test(contract)?contract:null;
  const rows=await sql`
    SELECT l.id,l.contract_id,l.title,l.content,l.video_url,l.video_provider,l.video_id,l.workload_minutes,
           l.pdf_name,l.published,l.created_at,
           to_char(l.starts_on,'YYYY-MM-DD') AS starts_on,
           to_char(l.ends_on,'YYYY-MM-DD') AS ends_on,
           c.name AS contract_name,
           (SELECT COUNT(*) FROM progress p WHERE p.lesson_id=l.id) AS viewers,
           (SELECT COUNT(*) FROM progress p WHERE p.lesson_id=l.id AND p.completed_at IS NOT NULL) AS completed,
           (SELECT COUNT(*) FROM reactions r WHERE r.lesson_id=l.id AND r.value=1) AS likes,
           (SELECT COUNT(*) FROM reactions r WHERE r.lesson_id=l.id AND r.value=-1) AS dislikes,
           (SELECT COUNT(*) FROM comments m WHERE m.lesson_id=l.id) AS comments
    FROM lessons l LEFT JOIN contracts c ON c.id=l.contract_id
    WHERE ${filter}::uuid IS NULL OR l.contract_id=${filter}::uuid OR l.contract_id IS NULL
    ORDER BY l.created_at DESC`;
  return res.status(200).json({lessons:rows});
}

/** Lista para o profissional: aulas do contrato dele (ou de todos os contratos). */
async function listForUser(req,res,sql,auth){
  const rows=await sql`
    SELECT l.id,l.title,l.content,l.video_url,l.video_provider,l.video_id,l.workload_minutes,l.pdf_name,
           to_char(l.starts_on,'YYYY-MM-DD') AS starts_on,
           to_char(l.ends_on,'YYYY-MM-DD') AS ends_on,
           c.name AS contract_name,
           p.watched_seconds,p.duration_seconds,p.completed_at,p.certificate_code,p.last_view_at,
           r.value AS reaction,
           (SELECT COUNT(*) FROM reactions x WHERE x.lesson_id=l.id AND x.value=1) AS likes,
           (SELECT COUNT(*) FROM reactions x WHERE x.lesson_id=l.id AND x.value=-1) AS dislikes
    FROM lessons l
    LEFT JOIN contracts c ON c.id=l.contract_id
    LEFT JOIN progress p ON p.lesson_id=l.id AND p.professional_id=${auth.id}::uuid
    LEFT JOIN reactions r ON r.lesson_id=l.id AND r.professional_id=${auth.id}::uuid
    WHERE l.published=TRUE AND (l.contract_id=${auth.contract}::uuid OR l.contract_id IS NULL)
    ORDER BY COALESCE(l.ends_on,'2999-12-31'::date), l.created_at DESC`;
  const today=new Date().toISOString().slice(0,10);
  const lessons=rows.map(l=>{
    const before=l.starts_on&&today<String(l.starts_on).slice(0,10);
    const after=l.ends_on&&today>String(l.ends_on).slice(0,10);
    const duration=Number(l.duration_seconds||0);
    const watched=Number(l.watched_seconds||0);
    return {...l,
      available:!before&&!after,
      status:before?'agendada':after?'encerrada':'disponivel',
      percent:duration>0?Math.min(100,Math.round(watched/duration*100)):0
    };
  });
  return res.status(200).json({lessons});
}

async function save(req,res,sql){
  const form=await readForm(req);
  const value=k=>text(form.get(k),8000);
  const id=UUID.test(String(form.get('id')||''))?String(form.get('id')):null;
  const title=text(form.get('title'),200);
  if(!title)return fail(res,400,'Informe o título da aula.');

  const contractRaw=String(form.get('contractId')||'');
  const contractId=UUID.test(contractRaw)?contractRaw:null; // null = todos os contratos
  const content=value('content');
  const video=parseVideo(form.get('videoUrl'));
  if(video.url&&!video.provider)return fail(res,400,'Use um link do YouTube ou do Vimeo (ex.: https://youtu.be/XXXX).');
  const workload=toInt(form.get('workloadMinutes'),6000);
  const startsOn=toDate(form.get('startsOn'));
  const endsOn=toDate(form.get('endsOn'));
  if(startsOn&&endsOn&&endsOn<startsOn)return fail(res,400,'O prazo final não pode ser anterior à data de início.');
  const published=bool(form.get('published'));
  const removePdf=bool(form.get('removePdf'),false);

  const file=form.get('pdf');
  let pdfName='',pdfType='',pdfB64=null;
  if(file&&typeof file.arrayBuffer==='function'&&file.size>0){
    if(!/\.pdf$/i.test(file.name||''))return fail(res,400,'O material de apoio deve ser um arquivo PDF.');
    if(file.size>MAX_UPLOAD)return fail(res,413,'O PDF deve ter até 4 MB.');
    pdfName=String(file.name||'material.pdf').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^\w.-]+/g,'_').slice(-120);
    pdfType='application/pdf';
    pdfB64=Buffer.from(await file.arrayBuffer()).toString('base64');
  }

  if(id){
    const rows=await sql`UPDATE lessons SET contract_id=${contractId}::uuid, title=${title}, content=${content},
      video_url=${video.url}, video_provider=${video.provider}, video_id=${video.id},
      workload_minutes=${workload}, starts_on=${startsOn}, ends_on=${endsOn}, published=${published}
      WHERE id=${id}::uuid RETURNING id`;
    if(!rows.length)return fail(res,404,'Aula não encontrada.');
    if(pdfB64)await sql`UPDATE lessons SET pdf_name=${pdfName}, pdf_type=${pdfType}, pdf_data=decode(${pdfB64},'base64') WHERE id=${id}::uuid`;
    else if(removePdf)await sql`UPDATE lessons SET pdf_name='', pdf_type='', pdf_data=NULL WHERE id=${id}::uuid`;
    return res.status(200).json({ok:true,id});
  }

  const newId=randomUUID();
  await sql`INSERT INTO lessons (id,contract_id,title,content,video_url,video_provider,video_id,workload_minutes,pdf_name,pdf_type,pdf_data,starts_on,ends_on,published)
    VALUES (${newId},${contractId}::uuid,${title},${content},${video.url},${video.provider},${video.id},${workload},
    ${pdfName},${pdfType},decode(${pdfB64},'base64'),${startsOn},${endsOn},${published})`;
  return res.status(201).json({ok:true,id:newId});
}

export default async function handler(req,res){
  try{
    const auth=session(req);
    if(!auth)return fail(res,401,'Sessão expirada. Entre novamente.',{auth:true});
    const sql=await db();

    if(req.method==='GET')return auth.role==='admin'?listForAdmin(req,res,sql):listForUser(req,res,sql,auth);

    if(!requireAdmin(req,res))return;

    if(req.method==='POST')return save(req,res,sql);

    if(req.method==='DELETE'){
      const id=String(req.query.id||'');
      if(!UUID.test(id))return fail(res,404,'Aula não encontrada.');
      const rows=await sql`DELETE FROM lessons WHERE id=${id}::uuid RETURNING id`;
      if(!rows.length)return fail(res,404,'Aula não encontrada.');
      return res.status(200).json({ok:true,id});
    }

    res.setHeader('Allow','GET, POST, DELETE');
    return fail(res,405,'Método não permitido.');
  }catch(error){return handleError(res,error)}
}
