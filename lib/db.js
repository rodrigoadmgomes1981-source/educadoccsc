import {neon} from '@neondatabase/serverless';

export function database(){
  const connection=process.env.DATABASE_URL||process.env.POSTGRES_URL;
  if(!connection)throw new Error('DATABASE_NOT_CONFIGURED');
  return neon(connection);
}

let schemaReady=null;

/** Cria/atualiza o schema na primeira chamada de cada instância. */
export function ensureSchema(sql){
  if(!schemaReady){
    schemaReady=(async()=>{
      await sql`CREATE TABLE IF NOT EXISTS contracts (
        id UUID PRIMARY KEY,
        name TEXT NOT NULL,
        company TEXT NOT NULL DEFAULT '',
        cnpj TEXT NOT NULL DEFAULT '',
        manager TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL DEFAULT '',
        phone TEXT NOT NULL DEFAULT '',
        city TEXT NOT NULL DEFAULT '',
        state TEXT NOT NULL DEFAULT '',
        starts_on DATE,
        ends_on DATE,
        notes TEXT NOT NULL DEFAULT '',
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;

      await sql`CREATE TABLE IF NOT EXISTS lessons (
        id UUID PRIMARY KEY,
        contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        video_url TEXT NOT NULL DEFAULT '',
        video_provider TEXT NOT NULL DEFAULT '',
        video_id TEXT NOT NULL DEFAULT '',
        workload_minutes INTEGER NOT NULL DEFAULT 0,
        pdf_name TEXT NOT NULL DEFAULT '',
        pdf_type TEXT NOT NULL DEFAULT '',
        pdf_data BYTEA,
        starts_on DATE,
        ends_on DATE,
        published BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;

      await sql`CREATE TABLE IF NOT EXISTS professionals (
        id UUID PRIMARY KEY,
        contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT '',
        council TEXT NOT NULL DEFAULT '',
        council_number TEXT NOT NULL DEFAULT '',
        cpf TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL DEFAULT '',
        phone TEXT NOT NULL DEFAULT '',
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL DEFAULT '',
        must_change BOOLEAN NOT NULL DEFAULT TRUE,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;

      await sql`CREATE TABLE IF NOT EXISTS progress (
        id UUID PRIMARY KEY,
        lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
        professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
        watched_seconds INTEGER NOT NULL DEFAULT 0,
        duration_seconds INTEGER NOT NULL DEFAULT 0,
        pdf_seconds INTEGER NOT NULL DEFAULT 0,
        pdf_confirmed_at TIMESTAMPTZ,
        sessions INTEGER NOT NULL DEFAULT 0,
        first_view_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_view_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMPTZ,
        certificate_code TEXT UNIQUE,
        certificate_at TIMESTAMPTZ,
        UNIQUE (lesson_id, professional_id)
      )`;

      await sql`CREATE TABLE IF NOT EXISTS reactions (
        lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
        professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
        value SMALLINT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (lesson_id, professional_id)
      )`;

      await sql`CREATE TABLE IF NOT EXISTS comments (
        id UUID PRIMARY KEY,
        lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
        professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
        message TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        read_at TIMESTAMPTZ
      )`;

      await sql`CREATE TABLE IF NOT EXISTS settings (
        id SMALLINT PRIMARY KEY,
        data TEXT NOT NULL DEFAULT '{}',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;

      // Bases criadas antes da regra de leitura do PDF.
      await sql`ALTER TABLE progress ADD COLUMN IF NOT EXISTS pdf_seconds INTEGER NOT NULL DEFAULT 0`;
      await sql`ALTER TABLE progress ADD COLUMN IF NOT EXISTS pdf_confirmed_at TIMESTAMPTZ`;

      await sql`CREATE INDEX IF NOT EXISTS idx_lessons_contract ON lessons(contract_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_professionals_contract ON professionals(contract_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_progress_lesson ON progress(lesson_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_progress_professional ON progress(professional_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_comments_unread ON comments(read_at, created_at DESC)`;
    })().catch(error=>{schemaReady=null;throw error});
  }
  return schemaReady;
}

/** Conexão + schema garantidos. */
export async function db(){
  const sql=database();
  await ensureSchema(sql);
  return sql;
}
