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
- **Aulas** — título, conteúdo em texto, link do vídeo (YouTube ou Vimeo), PDF de apoio (até 4 MB), carga horária, contrato a que se aplica (ou *todos os contratos*), data de início e prazo final. Fora da janela de datas a aula fica visível mas bloqueada. Aulas em rascunho não aparecem para ninguém. Havendo PDF, ele deixa de ser material opcional: vira exigência de conclusão.
- **Profissionais** — nome, função, conselho e nº de inscrição, contrato, contato. Ao salvar, o sistema gera o **usuário** (`nome.sobrenome`, com sufixo se já existir) e uma **senha inicial**, exibidos uma única vez — copie e entregue ao profissional. A senha fica guardada só como hash (scrypt); se perder, use o botão da chave para gerar outra.
- **Acompanhamento** — uma linha por profissional e por aula: quando assistiu pela primeira vez, último acesso, tempo assistido, percentual, situação e certificado. Filtra por contrato, situação e busca livre; exporta CSV (abre direto no Excel).
- **Notificações** — todo comentário enviado cai aqui como não lido, com contador no menu. A aba ao lado mostra nominalmente quem curtiu e quem não curtiu cada aula.
- **Configurações** — os parâmetros do sistema, que antes ficavam fixos no código:

  | Grupo | O que dá para ajustar |
  |---|---|
  | Conclusão da aula | % mínimo do vídeo assistido; leitura mínima do PDF sem vídeo (% da carga horária); leitura mínima do PDF com vídeo (minutos); exigir ou não a leitura do PDF em aulas que já têm vídeo |
  | Certificado | instituição, assinatura, cargo/setor, cidade e observação do rodapé; se o profissional pode emitir o próprio certificado ou se só o administrador emite |
  | Interação | ligar/desligar curtir e comentários; prazo padrão em dias para novas aulas |
  | Acesso | duração da sessão em horas; pedir troca de senha no primeiro acesso |

  As mudanças valem na hora, inclusive para quem já está com a aula aberta. O botão **Restaurar padrões** devolve os valores originais (é preciso salvar depois).

  Na mesma tela há a **redefinição de senhas em lote**: escolha o contrato e o sistema gera uma senha provisória nova para todos os profissionais ativos, com exportação em CSV. A lista aparece uma única vez. Para uma pessoa só, use o botão da chave na tela de Profissionais — ele pede confirmação e mostra a nova senha.

### Profissional

Vê apenas as aulas do seu contrato (mais as marcadas como "todos os contratos"), com prazo e progresso. A tela da aula abre com um quadro **"Para concluir esta aula"** listando o que falta — vídeo, leitura do PDF, ou os dois. Abaixo ficam o player, o leitor de PDF, curtir/não curtir, o campo de comentário e o botão de certificado.

## Regras que valem a pena conhecer

- **Tempo assistido (vídeo)** — conta 1 segundo por segundo de vídeo em reprodução. Arrastar a barra para o fim não conta; sair da aba pausa a contagem. O tempo é gravado a cada 15 segundos e ao pausar.
- **Leitura do material (PDF)** — o PDF abre dentro da própria aula e o tempo de leitura é contado do mesmo jeito: só com a aba em primeiro plano. Cumprido o tempo mínimo, libera o botão **"Li e compreendi o material"**; a aula só conclui depois dessa declaração, que fica registrada com data e hora.
  - **Tempo mínimo de leitura (padrão):** aula sem vídeo → 90% da carga horária cadastrada (por isso a carga horária passa a ser obrigatória nesse caso); aula com vídeo → 2 minutos, já que o vídeo cobre a carga horária.
  - **Aula com vídeo e PDF** exige as duas coisas: 90% do vídeo **e** a leitura confirmada.
  - Todos esses números saem da tela de **Configurações** — os valores acima são só o padrão de fábrica.
- **Certificado** — liberado quando todas as exigências da aula forem cumpridas. Traz nome, função, conselho de classe, aula, carga horária, tempo registrado, data e um **código de validação** (`DOC-XXXX-XXXX`). Qualquer pessoa confere o código em `/?certificado=CODIGO` — inclusive sem login. O botão *Imprimir / salvar em PDF* já sai em A4 paisagem.
- **Prazos** — antes da data de início a aula aparece como "Em breve"; depois do prazo final ela trava e o tempo deixa de ser contado.
- **Vídeos** — links do YouTube (`youtu.be/…`, `watch?v=…`, `/shorts/…`) e do Vimeo (inclusive com hash de vídeo privado). Deixe o vídeo como **não listado** para que só quem tem o link assista. Outros links são recusados no cadastro.
- **Sessões** — duram 12 horas por padrão (ajustável em Configurações) e são assinadas com `AUTH_SECRET`.
- **Senhas** — ficam guardadas só como hash (scrypt); nem o administrador consegue lê-las. O caminho para quem esqueceu é redefinir, individualmente ou em lote.

## Identidade visual

A marca DOC CSC está aplicada em todo o sistema: roxo `#6a59f7` como cor principal e azul-escuro `#1c1a40` nos menus e no login.

Arquivos em `public/`:

| Arquivo | Onde aparece |
|---|---|
| `logo-doccsc.png` | menu lateral e tela de login (fundos escuros) |
| `logo-doccsc-escura.png` | certificado e tela de validação (fundos claros) |
| `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` | ícone do app e favicon |
| `icon-maskable-512.png` | ícone adaptável do Android |

Para trocar por novas versões da marca, basta substituir esses arquivos mantendo os nomes.

O sistema é instalável como app de celular (PWA): no Android, menu ⋮ → *Instalar app*; no iPhone, *Compartilhar* → *Adicionar à Tela de Início*.

## Estrutura

```
api/          auth, contracts, lessons, professionals, progress, engagement, certificate, pdf, settings
lib/          db (schema), auth (senhas e sessões), settings (parâmetros), util (datas, vídeos, regra de conclusão)
src/          main (rotas), Login, Certificate, admin/* (inclui Settings), student/* (Player e PdfReader medem o tempo)
db/schema.sql schema completo, opcional
```

## LGPD

O sistema guarda nome, função, conselho de classe, contato e histórico de treinamento dos profissionais. Use `AUTH_SECRET` e uma senha forte de administrador, e mantenha os vídeos como não listados.
