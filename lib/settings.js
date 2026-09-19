/**
 * Parâmetros do sistema, editáveis pelo administrador na tela de Configurações.
 * Ficam numa única linha da tabela `settings`; o que não estiver gravado usa o padrão.
 */
export const DEFAULT_SETTINGS={
  // Conclusão das aulas
  videoPercent:90,             // % do vídeo que precisa ser assistido
  pdfWorkloadPercent:90,       // % da carga horária como leitura mínima (aula sem vídeo)
  pdfMinutesWithVideo:2,       // leitura mínima do PDF quando a aula também tem vídeo
  requirePdfWithVideo:true,    // exigir a leitura do PDF em aulas que já têm vídeo

  // Certificado
  allowSelfCertificate:true,   // o profissional pode emitir o próprio certificado
  institution:'DOC CSC',
  certificateSignature:'DOC CSC · Educação Virtual',
  certificateRole:'Coordenação de Treinamento',
  certificateCity:'',          // ex.: "Porto Velho/RO" — sai antes da data
  certificateNote:'',          // observação opcional no rodapé

  // Interação
  allowReactions:true,         // botões de curtir / não curtir
  allowComments:true,          // campo de comentário

  // Acesso
  sessionHours:12,             // duração da sessão
  requirePasswordChange:true,  // pedir troca da senha no primeiro acesso

  // Padrões ao criar aulas
  defaultLessonDays:30         // prazo sugerido, em dias, para novas aulas
};

/** Campos visíveis sem login (usados no certificado público). */
export const PUBLIC_KEYS=['institution','certificateSignature','certificateRole','certificateCity','certificateNote'];

const clampInt=(value,min,max,fallback)=>{
  const n=parseInt(String(value??'').replace(/[^\d-]/g,''),10);
  return Number.isFinite(n)?Math.min(max,Math.max(min,n)):fallback;
};
const clampText=(value,max,fallback)=>{
  if(value===undefined||value===null)return fallback;
  return String(value).trim().slice(0,max);
};
const flag=(value,fallback)=>{
  if(value===undefined||value===null||value==='')return fallback;
  return value===true||value==='true'||value==='1'||value===1;
};

/** Normaliza e aplica limites — nunca confia no que chega da tela. */
export function sanitizeSettings(input={},base=DEFAULT_SETTINGS){
  const s={...base};
  return {
    ...s,
    videoPercent:clampInt(input.videoPercent,50,100,s.videoPercent),
    pdfWorkloadPercent:clampInt(input.pdfWorkloadPercent,10,100,s.pdfWorkloadPercent),
    pdfMinutesWithVideo:clampInt(input.pdfMinutesWithVideo,1,180,s.pdfMinutesWithVideo),
    requirePdfWithVideo:flag(input.requirePdfWithVideo,s.requirePdfWithVideo),
    allowSelfCertificate:flag(input.allowSelfCertificate,s.allowSelfCertificate),
    institution:clampText(input.institution,80,s.institution)||DEFAULT_SETTINGS.institution,
    certificateSignature:clampText(input.certificateSignature,120,s.certificateSignature)||DEFAULT_SETTINGS.certificateSignature,
    certificateRole:clampText(input.certificateRole,120,s.certificateRole),
    certificateCity:clampText(input.certificateCity,80,s.certificateCity),
    certificateNote:clampText(input.certificateNote,300,s.certificateNote),
    allowReactions:flag(input.allowReactions,s.allowReactions),
    allowComments:flag(input.allowComments,s.allowComments),
    sessionHours:clampInt(input.sessionHours,1,168,s.sessionHours),
    requirePasswordChange:flag(input.requirePasswordChange,s.requirePasswordChange),
    defaultLessonDays:clampInt(input.defaultLessonDays,0,730,s.defaultLessonDays)
  };
}

/** Lê os parâmetros gravados, completando com os padrões. */
export async function loadSettings(sql){
  try{
    const rows=await sql`SELECT data FROM settings WHERE id=1`;
    if(!rows.length)return {...DEFAULT_SETTINGS};
    const stored=typeof rows[0].data==='string'?JSON.parse(rows[0].data||'{}'):(rows[0].data||{});
    return sanitizeSettings(stored);
  }catch(error){
    console.warn('Não foi possível ler as configurações; usando os padrões.',error?.message);
    return {...DEFAULT_SETTINGS};
  }
}

export async function saveSettings(sql,values){
  const current=await loadSettings(sql);
  const next=sanitizeSettings(values,current);
  await sql`INSERT INTO settings (id,data,updated_at) VALUES (1,${JSON.stringify(next)},NOW())
            ON CONFLICT (id) DO UPDATE SET data=${JSON.stringify(next)}, updated_at=NOW()`;
  return next;
}

export function publicSettings(settings){
  const out={};
  PUBLIC_KEYS.forEach(k=>{out[k]=settings[k]});
  return out;
}
