import { RequestHandler } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models';
import { registerInput, loginInput } from '../validation';

export const register: RequestHandler = async (req, res) => {
  const input = registerInput.parse(req.body);
  const user = await User.create({ ...input, password: await bcrypt.hash(input.password, 12) });
  res.status(201).json({ id: user.id, name: user.name, email: user.email });
};

export const login = (jwtSecret: string): RequestHandler => async (req, res) => {
  const input = loginInput.parse(req.body);
  const user = await User.findOne({ email: input.email }).select('+password');
  if (!user || !await bcrypt.compare(input.password, user.password)) {
    res.status(401).json({ message: 'E-mail ou senha inválidos' }); return;
  }
  const token = jwt.sign({}, jwtSecret, {
    subject: user.id, expiresIn: '1h', algorithm: 'HS256', issuer: 'respawn-api', audience: 'respawn-client',
  });
  res.json({ token, tokenType: 'Bearer', expiresIn: 3600 });
};
