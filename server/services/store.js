import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import Interview from '../models/Interview.js';
const dir = path.resolve('data');
export async function connectStore() {
  await mkdir(dir, {recursive: true});
  if (process.env.MONGODB_URI) {
    try { await mongoose.connect(process.env.MONGODB_URI, {serverSelectionTimeoutMS: 4000}); console.log('MongoDB connected'); }
    catch { console.warn('MongoDB unavailable. Using local session files.'); }
  }
}
export async function save(session) {
  const filename = path.join(dir, `${session._id}.json`);
  await writeFile(`${filename}.tmp`, JSON.stringify(session), {mode: 0o600});
  await rename(`${filename}.tmp`, filename);
  if (process.env.MONGODB_URI) {
    try { if (mongoose.connection.readyState !== 1) throw new Error('Offline'); await Interview.findOneAndReplace({_id: session._id}, session, {upsert: true}); }
    catch { return {storage: 'local', warning: "We couldn't save this session to MongoDB. Your current answers are still safe locally."}; }
    return {storage: 'mongodb'};
  }
  return {storage: 'local'};
}
export async function get(id) {
  if (!/^[a-f0-9-]{36}$/.test(id)) return null;
  try { return JSON.parse(await readFile(path.join(dir, `${id}.json`), 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  if (mongoose.connection.readyState === 1) return Interview.findById(id).lean();
  return null;
}
