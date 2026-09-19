import {db} from '../lib/db.js';
import {requireAdmin,session} from '../lib/auth.js';
import {fail,handleError,readJson} from '../lib/util.js';
import {loadSettings,publicSettings,saveSettings} from '../lib/settings.js';

export default async function handler(req,res){
  try{
    const sql=await db();

    if(req.method==='GET'){
      const settings=await loadSettings(sql);
      const auth=session(req);
      // Sem login (certificado público) só saem os dados de identificação.
      return res.status(200).json({settings:auth?settings:publicSettings(settings)});
    }

    if(req.method==='POST'){
      if(!requireAdmin(req,res))return;
      const body=await readJson(req);
      const settings=await saveSettings(sql,body);
      return res.status(200).json({ok:true,settings});
    }

    res.setHeader('Allow','GET, POST');
    return fail(res,405,'Método não permitido.');
  }catch(error){return handleError(res,error)}
}
