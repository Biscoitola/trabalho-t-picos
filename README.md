# Respawn — backlog de jogos

Biblioteca pessoal para organizar o que você quer jogar, acompanhar suas jornadas e registrar suas avaliações. Cada usuário mantém sua própria coleção, com plataforma, progresso, nota e comentários.

Primeira entrega da disciplina: API em Node.js/Express com TypeScript, persistência MongoDB, Docker, Swagger e testes automatizados.

## Tecnologias

Node.js 22+, TypeScript, Express 5, MongoDB 8, Mongoose, Zod, JWT, bcryptjs, Docker Compose, Swagger UI/OpenAPI 3, Vitest e Supertest.

## Configurar e executar

Pré-requisitos: Node.js 22 ou superior e Docker Desktop iniciado.

1. Instale as dependências com `npm ci`.
2. Copie `.env.example` para `.env`: `Copy-Item .env.example .env` no PowerShell, ou `cp .env.example .env` no Linux/macOS.
3. Gere um segredo com `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` e preencha `JWT_SECRET` no `.env`.
4. Execute `docker compose up -d --wait`.
5. Execute `npm run dev`.

No PowerShell, caso a política de execução bloqueie `npm`, use `npm.cmd`.

- Swagger interativo: **http://localhost:3000/api-docs/**.
- OpenAPI JSON: http://localhost:3000/openapi.json.
- Health check: http://localhost:3000/health (200 conectado; 503 desconectado).

Para executar a versão compilada: `npm run build` seguido de `npm start`.

## Variáveis de ambiente

| Variável | Finalidade |
| --- | --- |
| PORT | Porta HTTP; padrão 3000 |
| MONGODB_URI | Obrigatória; conexão MongoDB. Exemplo: mongodb://127.0.0.1:27017/respawn |
| JWT_SECRET | Obrigatória; segredo aleatório com pelo menos 32 caracteres |
| CORS_ORIGIN | Origem de um frontend separado; padrão http://localhost:5173 |

O `.env.example` não contém credenciais reais e o `.env` é ignorado pelo Git.

## Recurso principal: jogo da coleção

| Campo | Regra |
| --- | --- |
| title | Obrigatório; 1 a 120 caracteres após remover espaços nas extremidades |
| platform | Obrigatório; PC, PlayStation, Xbox, Nintendo Switch, Mobile ou Outro |
| status | backlog, playing, completed, paused ou dropped; padrão backlog |
| rating | Número de 0 a 10, inclusive decimais, ou null; padrão null |
| notes | Comentários de até 2000 caracteres; padrão vazio |
| owner | Definido pelo token; não pode ser enviado ou alterado pelo cliente |
| createdAt / updatedAt | Datas geradas pelo banco |

Os estados correspondem a **quero jogar**, **jogando**, **zerado**, **pausado** e **abandonado**. A nota é opcional em qualquer estado. É permitido registrar o mesmo jogo em plataformas diferentes.

Exemplo:

```json
{
  "title": "Hollow Knight",
  "platform": "PC",
  "status": "playing",
  "rating": 9.5,
  "notes": "Explorar as áreas que ficaram para trás na próxima sessão."
}
```

## Endpoints e autenticação

| Método | Rota | Resultado |
| --- | --- | --- |
| POST | /api/auth/register | Cadastra usuário (201) |
| POST | /api/auth/login | Retorna JWT válido por uma hora (200) |
| POST | /api/games | Adiciona jogo (201) |
| GET | /api/games | Lista coleção paginada e filtrada (200) |
| GET | /api/games/:id | Consulta jogo (200) |
| PATCH | /api/games/:id | Atualiza um ou mais campos (200) |
| DELETE | /api/games/:id | Remove jogo (204, sem corpo) |

Cadastro: `name` (2 a 100 caracteres), `email` válido e único, `password` (8 a 72 caracteres, no máximo 72 bytes UTF-8). Senhas são armazenadas como hash bcrypt e não aparecem nas respostas.

Para testar no Swagger: cadastre um usuário, faça login e copie o `token` para **Authorize**. Em outros clientes envie `Authorization: Bearer <token>`. O login recebe somente e-mail e senha.

Listagem: `GET /api/games?page=1&limit=10&status=playing`. Página de 1 a 100000 e limite de 1 a 100. A resposta contém `data`, `page`, `limit`, `total` e `totalPages`, ordenada por criação decrescente.

Campos desconhecidos e atualização vazia são rejeitados. Jogos de outros usuários retornam 404 para consulta, atualização e exclusão.

Erros documentados: 400 dados ou ID inválidos; 401 autenticação inválida; 404 recurso ausente; 409 e-mail duplicado; 413 corpo maior que 32 KB; 429 excesso de tentativas nas rotas de autenticação (100 por IP a cada 15 minutos); 500 erro interno. Login incorreto não revela se o e-mail existe.

## Docker e persistência

O Compose executa MongoDB 8 com health check e volume nomeado `mongo_data`, publicando a porta apenas em 127.0.0.1. O backend roda no Node.js local.

- Iniciar: `docker compose up -d --wait`.
- Ver estado: `docker compose ps`.
- Ver logs: `docker compose logs mongodb`.
- Parar: `docker compose down`.
- Retomar: `docker compose up -d --wait`.

O volume preserva os dados mesmo depois de parar e recriar o container. **`docker compose down -v` apaga os dados.**

A troca do tema utiliza a coleção `games`. Registros da antiga coleção `tasks` permanecem no banco original; não são convertidos em jogos. Usuários existentes continuam disponíveis se o MONGODB_URI original for mantido. Tokens emitidos pela versão anterior exigem novo login.

## Testes

```sh
npm test
npm run test:coverage
npm run typecheck
npm run build
```

Os testes de integração usam Supertest e um MongoDB real temporário gerenciado por mongodb-memory-server. Não acessam o banco da aplicação e não exigem Docker. A primeira execução precisa de internet para baixar o binário MongoDB; as seguintes usam cache.

Incluem CRUD completo, persistência após reconexão, isolamento por usuário, paginação, filtros, plataforma obrigatória, limites da nota, título curto, estados pausado/abandonado, remoção da nota, validação de cadastro, hash de senha, login válido e inválido, JWT expirado, JSON malformado, CORS e documentação.

## Organização

- `src/server.ts`: inicialização, conexão e encerramento.
- `src/app.ts`: rotas HTTP e tratamento de erros.
- `src/models.ts`: modelos User e Game.
- `src/auth.ts`: autenticação JWT.
- `src/validation.ts`: validação dos dados.
- `src/config.ts`: variáveis de ambiente.
- `src/openapi.ts`: documentação Swagger.
- `tests/api.test.ts`: testes de integração.

## Escopo

Não inclui recuperação de senha, renovação de token ou integração com lojas de jogos. MongoDB sem autenticação é uma configuração para desenvolvimento local. Para publicação, configure banco autenticado, HTTPS e segredos próprios do ambiente.


