import { beforeAll, beforeEach, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app';
import { User, Game } from '../src/models';
import { readConfig } from '../src/config';

const secret = 'test-secret-with-at-least-32-characters';
const app = createApp({ jwtSecret: secret });
let mongo: MongoMemoryServer;
let token: string;
let userId: string;
const credentials = { name: 'Aluno Teste', email: 'aluno@example.com', password: 'senha12345' };
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([User.init(), Game.init()]);
});
beforeEach(async () => {
  await Promise.all([User.deleteMany({}), Game.deleteMany({})]);
  const result = await request(app).post('/api/auth/register').send(credentials);
  userId = result.body.id;
  const login = await request(app).post('/api/auth/login').send({ email: credentials.email, password: credentials.password });
  token = login.body.token;
});
afterAll(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });
const auth = () => ({ Authorization: 'Bearer ' + token });
const newGame = async () => request(app).post('/api/games').set(auth()).send({ title: 'Hollow Knight', platform: 'PC' });

describe('Cadastro e login', () => {
  it('armazena hash e nunca devolve senha', async () => {
    const user = await User.findById(userId).select('+password');
    expect(user!.password).not.toBe(credentials.password);
    expect(await bcrypt.compare(credentials.password, user!.password)).toBe(true);
    const result = await request(app).post('/api/auth/register').send({ ...credentials, email: 'novo@example.com' });
    expect(result.status).toBe(201);
    expect(result.body).not.toHaveProperty('password');
  });
  it('rejeita e-mail duplicado com 409', async () => {
    expect((await request(app).post('/api/auth/register').send({ ...credentials, email: 'ALUNO@example.com' })).status).toBe(409);
  });
  it('valida cadastro, campos desconhecidos e limite de bytes da senha', async () => {
    for (const input of [{ ...credentials, email: 'errado' }, { ...credentials, password: 'curta' }, { ...credentials, role: 'admin' }, { ...credentials, password: '🔒'.repeat(20) }]) {
      expect((await request(app).post('/api/auth/register').send(input)).status).toBe(400);
    }
  });
  it('retorna JWT válido para credenciais corretas', async () => {
    const result = await request(app).post('/api/auth/login').send({ email: 'ALUNO@example.com', password: credentials.password });
    expect(result.status).toBe(200);
    expect(result.body.expiresIn).toBe(3600);
    expect(jwt.verify(result.body.token, secret)).toMatchObject({ sub: userId });
  });
  it('rejeita senha incorreta e usuário inexistente com mesma mensagem', async () => {
    const a = await request(app).post('/api/auth/login').send({ email: credentials.email, password: 'incorreta123' });
    const b = await request(app).post('/api/auth/login').send({ email: 'ausente@example.com', password: 'incorreta123' });
    expect(a.status).toBe(401); expect(b.status).toBe(401); expect(a.body).toEqual(b.body);
  });
  it('rejeita login malformado', async () => {
    expect((await request(app).post('/api/auth/login').send({ email: 'inválido' })).status).toBe(400);
  });
});
describe('CRUD de jogos', () => {
  it('cria, lista, consulta, atualiza e exclui no banco', async () => {
    const created = await newGame();
    expect(created.status).toBe(201);
    const id = created.body._id;
    expect(await Game.countDocuments()).toBe(1);
    expect((await request(app).get('/api/games').set(auth())).body).toMatchObject({ total: 1, page: 1 });
    expect((await request(app).get('/api/games/' + id).set(auth())).body.title).toBe('Hollow Knight');
    const updated = await request(app).patch('/api/games/' + id).set(auth()).send({ status: 'completed', rating: 9.5 });
    expect(updated.status).toBe(200);
    expect((await Game.findById(id))!.status).toBe('completed');
    expect((await Game.findById(id))!.rating).toBe(9.5);
    expect((await request(app).delete('/api/games/' + id).set(auth())).status).toBe(204);
    expect(await Game.findById(id)).toBeNull();
  });
  it('preserva registros após reconectar ao MongoDB', async () => {
    const created = await newGame();
    await mongoose.disconnect();
    await mongoose.connect(mongo.getUri());
    expect((await request(app).get('/api/games/' + created.body._id).set(auth())).status).toBe(200);
  });
  it('exige plataforma e valida notas e progresso independentemente', async () => {
    const valid = { title: 'Hades', platform: 'PC' };
    for (const input of [{ title: 'Hades' }, { ...valid, platform: 'invalid' }, { ...valid, rating: -1 }, { ...valid, rating: 10.1 }, { ...valid, rating: '9' }, { ...valid, status: 'invalid' }]) {
      expect((await request(app).post('/api/games').set(auth()).send(input)).status).toBe(400);
    }
    expect(await Game.countDocuments()).toBe(0);
  });
  it('aceita título curto, nota zero, pausado e abandonado, e remove nota', async () => {
    const created = await request(app).post('/api/games').set(auth()).send({ title: 'A', platform: 'Nintendo Switch', rating: 0, status: 'paused' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ rating: 0, status: 'paused', notes: '' });
    const updated = await request(app).patch('/api/games/' + created.body._id).set(auth()).send({ rating: null, status: 'dropped', notes: 'Retomar outro dia.' });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ rating: null, status: 'dropped', notes: 'Retomar outro dia.' });
    expect((await request(app).get('/api/games?status=dropped').set(auth())).body.total).toBe(1);
  });
  it('valida título, plataforma, nota e campos não permitidos', async () => {
    for (const input of [{}, { title: '  ' }, { title: 'Jogo', status: 'invalid' }, { title: 'Jogo', platform: 'PC', rating: 11 }, { title: 'Jogo', owner: userId }]) {
      expect((await request(app).post('/api/games').set(auth()).send(input)).status).toBe(400);
    }
    expect(await Game.countDocuments()).toBe(0);
  });
  it('rejeita atualização vazia ou inválida sem alterar registro', async () => {
    const created = await newGame();
    for (const input of [{}, { title: '' }, { platform: 'invalid' }, { owner: userId }]) {
      expect((await request(app).patch('/api/games/' + created.body._id).set(auth()).send(input)).status).toBe(400);
    }
    expect((await Game.findById(created.body._id))!.title).toBe('Hollow Knight');
  });
  it('retorna 400 para ID inválido e 404 para ID ausente', async () => {
    for (const method of ['get', 'patch', 'delete'] as const) {
      let invalid = request(app)[method]('/api/games/invalid').set(auth());
      let missing = request(app)[method]('/api/games/507f1f77bcf86cd799439011').set(auth());
      if (method === 'patch') { invalid = invalid.send({ title: 'Teste' }); missing = missing.send({ title: 'Teste' }); }
      expect((await invalid).status).toBe(400); expect((await missing).status).toBe(404);
    }
  });
  it('isola jogos de usuários em todas as operações', async () => {
    const created = await newGame();
    await request(app).post('/api/auth/register').send({ ...credentials, email: 'outro@example.com' });
    const login = await request(app).post('/api/auth/login').send({ email: 'outro@example.com', password: credentials.password });
    const header = { Authorization: 'Bearer ' + login.body.token };
    expect((await request(app).get('/api/games').set(header)).body.total).toBe(0);
    expect((await request(app).get('/api/games/' + created.body._id).set(header)).status).toBe(404);
    expect((await request(app).patch('/api/games/' + created.body._id).set(header).send({ title: 'Alterada' })).status).toBe(404);
    expect((await request(app).delete('/api/games/' + created.body._id).set(header)).status).toBe(404);
    expect(await Game.countDocuments()).toBe(1);
  });
  it('pagina e filtra por status', async () => {
    await newGame(); await newGame();
    await request(app).post('/api/games').set(auth()).send({ title: 'Celeste', platform: 'PC', status: 'completed' });
    const page = await request(app).get('/api/games?page=2&limit=1').set(auth());
    expect(page.body).toMatchObject({ total: 3, page: 2, totalPages: 3 }); expect(page.body.data).toHaveLength(1);
    const filtered = await request(app).get('/api/games?status=completed').set(auth());
    expect(filtered.body.total).toBe(1);
    for (const query of ['limit=0', 'page=-1', 'status=invalid', 'limit=101']) {
      expect((await request(app).get('/api/games?' + query).set(auth())).status).toBe(400);
    }
  });
  it('exige autenticação em todas as rotas CRUD', async () => {
    for (const method of ['get', 'post', 'patch', 'delete'] as const) {
      const url = method === 'patch' || method === 'delete' ? '/api/games/507f1f77bcf86cd799439011' : '/api/games';
      expect((await request(app)[method](url).send({ title: 'Teste' })).status).toBe(401);
    }
  });
  it('rejeita token inválido, expirado ou de usuário removido', async () => {
    const expired = jwt.sign({}, secret, { subject: userId, expiresIn: -1, issuer: 'respawn-api', audience: 'respawn-client' });
    for (const value of ['invalid', expired]) {
      expect((await request(app).get('/api/games').set('Authorization', 'Bearer ' + value)).status).toBe(401);
    }
    await User.deleteMany({});
    expect((await request(app).get('/api/games').set(auth())).status).toBe(401);
  });
});
describe('Infraestrutura HTTP', () => {
  it('expõe health, OpenAPI e Swagger', async () => {
    expect((await request(app).get('/health')).status).toBe(200);
    expect((await request(app).get('/openapi.json')).body.openapi).toBe('3.0.3');
    expect((await request(app).get('/api-docs/')).status).toBe(200);
  });
  it('trata JSON inválido, corpo grande e rota inexistente', async () => {
    expect((await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{')).status).toBe(400);
    expect((await request(app).post('/api/auth/login').send({ data: 'x'.repeat(40000) })).status).toBe(413);
    expect((await request(app).get('/ausente')).status).toBe(404);
  });
  it('configura CORS para o frontend', async () => {
    const res = await request(app).options('/api/games').set('Origin', 'http://localhost:5173').set('Access-Control-Request-Method', 'POST');
    expect(res.status).toBe(204); expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });
  it('rejeita segredo curto na configuração', () => {
    const previous = { ...process.env };
    try {
      process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
      process.env.JWT_SECRET = 'curto';
      expect(() => readConfig()).toThrow();
      process.env.JWT_SECRET = secret;
      expect(readConfig().JWT_SECRET).toBe(secret);
    } finally { process.env = previous; }
  });
});
