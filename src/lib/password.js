import { hash, verify } from '@node-rs/argon2';

export const hashPassword = (password) => hash(password); // argon2id
export const verifyPassword = (hashed, password) => verify(hashed, password);