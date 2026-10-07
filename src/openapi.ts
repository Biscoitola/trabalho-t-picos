// Definições compartilhadas evitam repetir campos e respostas em cada rota.
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (name: string) => ({ 'application/json': { schema: ref(name) } });
const body = (name: string) => ({ required: true, content: json(name) });
const response = (description: string, schema = 'Error') => ({ description, content: json(schema) });

const credentials = {
  email: { type: 'string', format: 'email', maxLength: 254, example: 'maria@example.com' },
  password: { type: 'string', minLength: 8, maxLength: 72, description: 'Máximo 72 bytes UTF-8', example: 'SenhaExemplo123' },
};
const statuses = ['backlog', 'playing', 'completed', 'paused', 'dropped'];
const gameFields = {
  title: { type: 'string', minLength: 1, maxLength: 120, example: 'Hollow Knight' },
  platform: { type: 'string', enum: ['PC', 'PlayStation', 'Xbox', 'Nintendo Switch', 'Mobile', 'Outro'], example: 'PC' },
  status: { type: 'string', enum: statuses, default: 'backlog' },
  rating: { type: 'number', minimum: 0, maximum: 10, nullable: true, example: 9.5 },
  notes: { type: 'string', maxLength: 2000, default: '' },
};
const security = [{ bearerAuth: [] }];
const idParameter = {
  name: 'id', in: 'path', required: true,
  description: 'ObjectId do jogo (24 caracteres hexadecimais)',
  schema: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' },
};
const crudErrors = {
  400: response('Dados, JSON ou identificador inválidos'),
  401: response('Token ausente, inválido ou expirado'),
  500: response('Erro interno'),
};
const authErrors = {
  400: response('Dados inválidos ou JSON malformado'),
  413: response('Corpo acima de 32 KB'),
  429: response('Limite de tentativas excedido'),
  500: response('Erro interno'),
};

export const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'Respawn · Backlog de jogos', version: '1.0.0',
    description: 'Cadastre-se, faça login e use Authorize com o token recebido. Cada usuário acessa somente seus jogos.',
  },
  tags: [{ name: 'Autenticação' }, { name: 'Jogos' }, { name: 'Infraestrutura' }],
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      Error: {
        type: 'object', required: ['message'],
        properties: {
          message: { type: 'string' },
          errors: {
            type: 'array', items: {
              type: 'object', properties: { field: { type: 'string' }, message: { type: 'string' } },
            },
          },
        },
      },
      Register: {
        type: 'object', additionalProperties: false, required: ['name', 'email', 'password'],
        properties: { name: { type: 'string', minLength: 2, maxLength: 100, example: 'Maria Silva' }, ...credentials },
      },
      Login: { type: 'object', additionalProperties: false, required: ['email', 'password'], properties: credentials },
      User: {
        type: 'object', properties: {
          id: { type: 'string' }, name: { type: 'string' }, email: { type: 'string', format: 'email' },
        },
      },
      Token: {
        type: 'object', properties: {
          token: { type: 'string' }, tokenType: { type: 'string', example: 'Bearer' }, expiresIn: { type: 'integer', example: 3600 },
        },
      },
      GameInput: { type: 'object', additionalProperties: false, required: ['title', 'platform'], properties: gameFields },
      GameUpdate: { type: 'object', additionalProperties: false, minProperties: 1, properties: gameFields },
      Game: {
        type: 'object', properties: {
          _id: { type: 'string' }, ...gameFields, owner: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' }, updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      GameList: {
        type: 'object', properties: {
          data: { type: 'array', items: ref('Game') }, page: { type: 'integer' },
          limit: { type: 'integer' }, total: { type: 'integer' }, totalPages: { type: 'integer' },
        },
      },
    },
  },
  paths: {
    '/api/auth/register': {
      post: {
        tags: ['Autenticação'], summary: 'Cadastrar usuário', requestBody: body('Register'),
        responses: { 201: response('Usuário cadastrado', 'User'), ...authErrors, 409: response('E-mail já cadastrado') },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Autenticação'], summary: 'Entrar e obter token', requestBody: body('Login'),
        responses: { 200: response('Token válido por uma hora', 'Token'), ...authErrors, 401: response('E-mail ou senha inválidos') },
      },
    },
    '/api/games': {
      post: {
        tags: ['Jogos'], summary: 'Criar jogo', security, requestBody: body('GameInput'),
        responses: { 201: response('Jogo adicionado', 'Game'), ...crudErrors, 413: response('Corpo acima de 32 KB') },
      },
      get: {
        tags: ['Jogos'], summary: 'Listar jogos do usuário', security,
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100000, default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 10 } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: statuses } },
        ],
        responses: { 200: response('Lista paginada, ordenada por criação decrescente', 'GameList'), ...crudErrors },
      },
    },
    '/api/games/{id}': {
      get: {
        tags: ['Jogos'], summary: 'Consultar jogo', security, parameters: [idParameter],
        responses: { 200: response('Jogo encontrado', 'Game'), ...crudErrors, 404: response('Jogo não encontrado') },
      },
      patch: {
        tags: ['Jogos'], summary: 'Atualizar parcialmente um jogo', security,
        parameters: [idParameter], requestBody: body('GameUpdate'),
        responses: {
          200: response('Jogo atualizado', 'Game'), ...crudErrors,
          404: response('Jogo não encontrado'), 413: response('Corpo acima de 32 KB'),
        },
      },
      delete: {
        tags: ['Jogos'], summary: 'Excluir jogo', security, parameters: [idParameter],
        responses: { 204: { description: 'Jogo removido, sem corpo' }, ...crudErrors, 404: response('Jogo não encontrado') },
      },
    },
    '/health': {
      get: {
        tags: ['Infraestrutura'], summary: 'Verificar conexão com banco',
        responses: {
          200: { description: 'Conectado', content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string', example: 'ok' } } } } } },
          503: { description: 'Banco indisponível', content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string', example: 'unavailable' } } } } } },
        },
      },
    },
  },
};
