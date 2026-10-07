import { RequestHandler } from 'express';
import { Game } from '../models';
import { gameInput, updateInput, listInput } from '../validation';

export const createGame: RequestHandler = async (req, res) => {
  const game = await Game.create({ ...gameInput.parse(req.body), owner: req.userId });
  res.status(201).json(game);
};

export const listGames: RequestHandler = async (req, res) => {
  const { page, limit, status } = listInput.parse(req.query);
  const filter = { owner: req.userId, ...(status ? { status } : {}) };
  const [data, total] = await Promise.all([
    Game.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit),
    Game.countDocuments(filter),
  ]);
  res.json({ data, page, limit, total, totalPages: Math.ceil(total / limit) });
};

export const getGame: RequestHandler = async (req, res) => {
  const game = await Game.findOne({ _id: req.params.id, owner: req.userId });
  if (!game) { res.status(404).json({ message: 'Jogo não encontrado' }); return; }
  res.json(game);
};

export const updateGame: RequestHandler = async (req, res) => {
  const input = updateInput.parse(req.body);
  const game = await Game.findOneAndUpdate(
    { _id: req.params.id, owner: req.userId }, { $set: input }, { new: true, runValidators: true },
  );
  if (!game) { res.status(404).json({ message: 'Jogo não encontrado' }); return; }
  res.json(game);
};

export const deleteGame: RequestHandler = async (req, res) => {
  const game = await Game.findOneAndDelete({ _id: req.params.id, owner: req.userId });
  if (!game) { res.status(404).json({ message: 'Jogo não encontrado' }); return; }
  res.status(204).send();
};
