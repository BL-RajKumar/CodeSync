import crypto from 'crypto';

const ALGORITHM = 'aes-128-ecb';
const SECRET_KEY = crypto
  .createHash('sha256')
  .update(process.env.JWT_SECRET || 'supersecretcodesync')
  .digest()
  .slice(0, 16); // 16 bytes for aes-128

/**
 * Converts a 24-character hex MongoDB ObjectId into a 32-character obfuscated hex hash.
 */
export const obfuscateId = (id) => {
  if (!id) return '';
  const idStr = id.toString();
  
  // Only obfuscate valid 24-character hex MongoDB ObjectIds
  if (!/^[0-9a-fA-F]{24}$/.test(idStr)) {
    return idStr;
  }

  try {
    const buffer = Buffer.from(idStr, 'hex'); // 12 bytes
    const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, null);
    let encrypted = cipher.update(buffer);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return encrypted.toString('hex'); // 32 characters
  } catch (error) {
    return idStr;
  }
};

/**
 * Decrypts a 32-character obfuscated hex hash back to the 24-character hex MongoDB ObjectId.
 * If input is not a 32-character hex hash, or if decryption fails, returns original input.
 */
export const deobfuscateId = (hash) => {
  if (!hash || typeof hash !== 'string') return hash;
  
  // If it's not a 32-character hex string, check if it's already a 24-character raw ObjectId
  if (!/^[0-9a-fA-F]{32}$/.test(hash)) {
    return hash;
  }

  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, null);
    const buffer = Buffer.from(hash, 'hex');
    let decrypted = decipher.update(buffer);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    const decryptedStr = decrypted.toString('hex');
    
    // Ensure the decrypted output is a valid 24-character hex string
    if (/^[0-9a-fA-F]{24}$/.test(decryptedStr)) {
      return decryptedStr;
    }
  } catch (error) {
    // Decryption failed (e.g. invalid signature or key mismatch), keep original
  }
  
  return hash;
};
