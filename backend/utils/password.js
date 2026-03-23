import crypto from "crypto";

const KEY_LENGTH = 64;
const HASH_ALGORITHM = "sha512";

function scryptAsync(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, KEY_LENGTH, { N: 16384, r: 8, p: 1 }, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = await scryptAsync(password, salt);
  return `scrypt$${HASH_ALGORITHM}$${salt}$${hash.toString("hex")}`;
}

export async function verifyPassword(password, storedHash) {
  const [method, algorithm, salt, expectedHash] = String(storedHash || "").split("$");
  if (method !== "scrypt" || !algorithm || !salt || !expectedHash) {
    return false;
  }

  const hash = await scryptAsync(password, salt);
  const expectedBuffer = Buffer.from(expectedHash, "hex");

  if (expectedBuffer.length !== hash.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, hash);
}
