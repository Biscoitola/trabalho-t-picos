import { Schema, model } from 'mongoose';

const userSchema = new Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
}, { timestamps: true, versionKey: false });

const gameSchema = new Schema({
  title: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
  notes: { type: String, default: '', maxlength: 2000 },
  status: { type: String, enum: ['backlog', 'playing', 'completed', 'paused', 'dropped'], default: 'backlog' },
  platform: { type: String, required: true, enum: ['PC', 'PlayStation', 'Xbox', 'Nintendo Switch', 'Mobile', 'Outro'] },
  rating: { type: Number, min: 0, max: 10, default: null },
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true, versionKey: false });
gameSchema.index({ owner: 1, createdAt: -1 });
export const User = model('User', userSchema);
export const Game = model('Game', gameSchema);
