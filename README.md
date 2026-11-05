# LIFT.OS

App pessoal de treino, dieta e evolução corporal. Treino com progressão de carga,
dieta com TACO como fonte nutricional, composição corporal por avaliação, hidratação
por horário e relatório em PDF.

## O que é este repositório

Hoje o LIFT.OS é um único arquivo HTML/CSS/JS autocontido (`public/app.html`) que
guarda todos os dados no `localStorage` do navegador — sem backend, sem conta, sem
sincronização entre aparelhos. Este repositório é um wrapper mínimo em Next.js que:

- Serve esse arquivo como está (nenhuma reescrita de código, nenhum componente React)
- Redireciona a raiz (`/`) para `/app.html`
- Deixa pronto pra build e deploy no Vercel, igual ao fluxo usado em outros projetos

**Não tem banco de dados nem autenticação ainda.** Cada navegador/aparelho tem seus
próprios dados, isolados. Isso é intencional nesta fase — ver "Próximos passos".

## Estrutura

```
liftos-web/
├── app/
│   ├── layout.tsx       # layout raiz do Next.js (mínimo)
│   └── page.tsx         # fallback de redirecionamento pra /app.html
├── public/
│   └── app.html         # o LIFT.OS completo (HTML/CSS/JS + localStorage)
├── next.config.mjs      # redirect de "/" para "/app.html"
├── package.json
├── tsconfig.json
└── .gitignore
```

## Rodar localmente

Pré-requisito: Node.js 18.17+ (`node -v` pra checar).

```bash
npm install
npm run dev
```

Abre em http://localhost:3000 — já redireciona pro app.

Pra testar a versão de produção (igual ao que vai pro Vercel):

```bash
npm run build
npm run start
```

## Deploy no Vercel

### Opção A — pelo site (mais simples)

1. Suba este repositório pro GitHub (veja seção abaixo se ainda não fez isso)
2. Entra em [vercel.com/new](https://vercel.com/new)
3. Importa o repositório `liftos-web`
4. Framework Preset: Vercel já detecta **Next.js** automaticamente
5. Não precisa configurar nenhuma variável de ambiente nesta fase
6. Clica em **Deploy**

Em ~1 minuto o app está no ar num link `https://liftos-web-xxxx.vercel.app`. Pode
trocar pro domínio que quiser em Settings → Domains.

### Opção B — pela CLI

```bash
npm install -g vercel
vercel login
vercel          # deploy de preview
vercel --prod   # deploy de produção
```

### Subindo pro GitHub primeiro (se ainda não tem o remoto)

```bash
# cria um repositório vazio no GitHub (via site ou gh CLI), depois:
git remote add origin git@github.com:SEU_USUARIO/liftos-web.git
git branch -M main
git push -u origin main
```

Depois disso, qualquer `git push` pra `main` gera um novo deploy automático no Vercel
(se você conectou o repositório pela Opção A).

## Importante: dados ficam no navegador

Como o app usa `localStorage`, abrir o link do Vercel em outro celular/navegador
**não traz o histórico de treino, dieta ou avaliações** — cada aparelho começa do
zero. Pra levar os dados de um aparelho pra outro, use o botão de exportar/backup
dentro do próprio app (dentro da aba Perfil) e importe no outro aparelho.

Isso é esperado nesta fase do projeto. Resolver isso de verdade (dados sincronizados
entre aparelhos, login) é o próximo passo descrito abaixo.

## Próximos passos (não neste deploy)

Combinado: por agora, subir exatamente o app como está. Os itens abaixo ficam pra
depois, quando fizer sentido evoluir:

1. **Persistência real** — migrar de `localStorage` pra um banco (ex: Supabase
   Postgres), permitindo acessar os mesmos dados em qualquer aparelho
2. **Autenticação** — login simples (ex: Supabase Auth) pra proteger os dados,
   já que o link do Vercel é público por padrão
3. **Refatoração em componentes React** — separar o HTML único em componentes
   Next.js, facilitando manutenção e abrindo espaço pra novas features
4. **Integração com o LIFT.OS Vision** — a feature de análise de foto de alimento
   (projeto separado, hoje pausado) poderia ser incorporada aqui
5. **PWA instalável** — manifest + service worker, pra "instalar" o app na tela
   inicial do celular com ícone próprio

Nenhum desses é necessário pra usar o app hoje — só importam quando quiser dados
sincronizados entre aparelhos ou multiusuário.

## Atualizando o conteúdo do app

Enquanto o LIFT.OS continuar sendo um arquivo único, qualquer alteração (correção de
bug, nova feature, ajuste de dieta/treino) é feita direto em `public/app.html` e
versionada normalmente:

```bash
# depois de editar public/app.html
git add public/app.html
git commit -m "atualiza LIFT.OS: <descrição da mudança>"
git push
```

O Vercel redeploya automaticamente a cada push na branch conectada.
