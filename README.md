# DOC CSC · Educação Virtual

Plataforma de treinamento por contrato: o administrador cadastra clientes/contratos, aulas (vídeo + PDF + prazo) e profissionais; cada profissional entra com login próprio, assiste, curte ou não curte, comenta e emite o certificado.

Stack: React + Vite no front, Vercel Functions no back, Postgres (Neon) no banco. Mesma base do Ágile Talentos.

## Publicar na Vercel

1. **Banco de dados** — crie um Neon Postgres no Marketplace da Vercel e conecte ao projeto. As tabelas são criadas sozinhas na primeira utilização (o `db/schema.sql` é opcional, para quem preferir rodar à mão).
2. **Variáveis de ambiente** (Settings → Environment Variables):

   | Variável | Obrigatória | Para que serve |
   |---|---|---|
   | `DATABASE_URL` (ou `POSTGRES_URL`) | sim | conexão com o Neon — a integração já cria |
   | `ADMIN_PASSWORD` | sim | senha do administrador |
   | `ADMIN_USER` | não | usuário do administrador (padrão `admin`) |
   | `AUTH_SECRET` | recomendada | texto longo e aleatório que assina as sessões. Sem ela o sistema usa a `ADMIN_PASSWORD` — e trocar a senha derruba todos os acessos |

3. Importe a pasta na Vercel ou rode `vercel --prod`.
4. Entre em `/` na aba **Administrador** com o usuário e a senha definidos acima.

Para rodar na sua máquina: `npm install` e `npm run dev` (as rotas `/api/*` só funcionam publicadas na Vercel ou com `vercel dev`).

## Como funciona

### Administrador

- **Contratos** — cliente, CNPJ, gestor, vigência e situação. Excluir um contrato apaga aulas, profissionais e histórico dele.
- **Aulas** — título, conteúdo em texto, link do vídeo (YouTube ou Vimeo), PDF de apoio (até 4 MB), carga horária, contrato a que se aplica (ou *todos os contratos*), data de início e prazo final. Fora da janela de datas a aula fica visível mas bloqueada. Aulas em rascunho não aparecem para ninguém.
- **Profissionais** — nome, função, conselho e nº de inscrição, contrato, contato. Ao salvar, o sistema gera o **usuário** (`nome.sobrenome`, com sufixo se já existir) e uma **senha inicial**, exibidos uma única vez — copie e entregue ao profissional. A senha fica guardada só como hash (scrypt); se perder, use o botão da chave para gerar outra.
- **Acompanhamento** — uma linha por profissional e por aula: quando assistiu pela primeira vez, último acesso, tempo assistido, percentual, situação e certificado. Filtra por contrato, situação e busca livre; exporta CSV (abre direto no Excel).
- **Notificações** — todo comentário enviado cai aqui como não lido, com contador no menu. A aba ao lado mostra nominalmente quem curtiu e quem não curtiu cada aula.

### Profissional

Vê apenas as aulas do seu contrato (mais as marcadas como "todos os contratos"), com prazo e progresso. Na aula: vídeo, conteúdo, PDF, curtir/não curtir, campo de comentário livre e botão de certificado.

## Regras que valem a pena conhecer

- **Tempo assistido** — conta 1 segundo por segundo de vídeo em reprodução. Arrastar a barra para o fim não conta; sair da aba pausa a contagem. O tempo é gravado a cada 15 segundos e ao pausar.
- **Certificado** — liberado com **90%** da duração do vídeo assistidos. Traz nome, função, conselho de classe, aula, carga horária, tempo registrado, data e um **código de validação** (`DOC-XXXX-XXXX`). Qualquer pessoa confere o código em `/?certificado=CODIGO` — inclusive sem login. O botão *Imprimir / salvar em PDF* já sai em A4 paisagem.
- **Prazos** — antes da data de início a aula aparece como "Em breve"; depois do prazo final ela trava e o tempo deixa de ser contado.
- **Vídeos** — links do YouTube (`youtu.be/…`, `watch?v=…`, `/shorts/…`) e do Vimeo (inclusive com hash de vídeo privado). Deixe o vídeo como **não listado** para que só quem tem o link assista. Outros links são recusados no cadastro.
- **Sessões** — duram 12 horas e são assinadas com `AUTH_SECRET`.

## Identidade visual

As cores seguem a linha da DOC CSC (azul `#092e46` + verde `#16a88b`). Para usar a logo oficial, substitua os arquivos em `public/` (`icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`) e troque o bloco `.cert-logo` em `src/Certificate.jsx` por uma `<img>` com a logo — é o único lugar do certificado que usa a marca em texto.

O sistema é instalável como app de celular (PWA): no Android, menu ⋮ → *Instalar app*; no iPhone, *Compartilhar* → *Adicionar à Tela de Início*.

## Estrutura

```
api/          auth, contracts, lessons, professionals, progress, engagement, certificate, pdf
lib/          db (schema), auth (senhas e sessões), util (datas, vídeos, validações)
src/          main (rotas), Login, Certificate, admin/*, student/* (Player mede o tempo)
db/schema.sql schema completo, opcional
```

## LGPD

O sistema guarda nome, função, conselho de classe, contato e histórico de treinamento dos profissionais. Use `AUTH_SECRET` e uma senha forte de administrador, e mantenha os vídeos como não listados.
