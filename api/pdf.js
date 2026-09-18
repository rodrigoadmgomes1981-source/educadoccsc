import {db} from '../lib/db.js';
import {session} from '../lib/auth.js';
import {UUID,fail,handleError} from '../lib/util.js';

export default async function handler(req,res){
  try{
    if(req.method!=='GET'){res.setHeader('Allow','GET');return fail(res,405,'Método não permitido.')}
    const auth=session(req);
    if(!auth)return fail(res,401,'Sessão expirada. Entre novamente.',{auth:true});
    const id=String(req.query.id||'');
    if(!UUID.test(id))return fail(res,404,'Material não encontrado.');

    const sql=await db();
    const rows=auth.role==='admin'
      ? await sql`SELECT pdf_name,pdf_type,encode(pdf_data,'base64') AS data FROM lessons WHERE id=${id}::uuid`
      : await sql`SELECT pdf_name,pdf_type,encode(pdf_data,'base64') AS data FROM lessons
                  WHERE id=${id}::uuid AND published=TRUE AND (contract_id=${auth.contract}::uuid OR contract_id IS NULL)`;
    if(!rows.length||!rows[0].data)return fail(res,404,'Esta aula não tem material em PDF.');

    const buffer=Buffer.from(rows[0].data,'base64');
    res.setHeader('Content-Type',rows[0].pdf_type||'application/pdf');
    res.setHeader('Content-Disposition',`inline; filename="${(rows[0].pdf_name||'material.pdf').replace(/"/g,'')}"`);
    res.setHeader('Cache-Control','private, max-age=300');
    return res.status(200).send(buffer);
  }catch(error){return handleError(res,error)}
}
