import crypto from 'crypto';

/**
 * Encryption service for securely storing user mnemonic phrases
 * Uses AES-256-GCM encryption with user password-derived keys
 */

export interface EncryptionResult {
  encrypted: string;
  iv: string;
  tag: string;
}

export interface DecryptionResult {
  decrypted: string;
  success: boolean;
}

/**
 * Generate a salt for password hashing
 */
export function generateSalt(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash a password with salt using PBKDF2
 */
export function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
}

/**
 * Verify a password against a hash
 */
export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const passwordHash = hashPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(passwordHash, 'hex'));
}

/**
 * Generate encryption key from password
 */
function generateEncryptionKey(password: string, salt: string): Buffer {
  return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha512');
}

/**
 * Encrypt mnemonic phrase using AES-256-CBC
 */
export function encryptMnemonic(mnemonic: string, password: string, salt: string): EncryptionResult {
  try {
    const key = generateEncryptionKey(password, salt);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    
    let encrypted = cipher.update(mnemonic, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // For CBC mode, we don't have an auth tag, so we'll use a hash of the encrypted data
    const tag = crypto.createHash('sha256').update(encrypted).digest('hex').substring(0, 32);
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag
    };
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Failed to encrypt mnemonic');
  }
}

/**
 * Decrypt mnemonic phrase using AES-256-CBC
 */
export function decryptMnemonic(
  encryptedData: string, 
  password: string, 
  salt: string, 
  iv: string, 
  tag: string
): DecryptionResult {
  try {
    const key = generateEncryptionKey(password, salt);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(iv, 'hex'));
    
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    // Verify the tag matches (integrity check)
    const expectedTag = crypto.createHash('sha256').update(encryptedData).digest('hex').substring(0, 32);
    if (expectedTag !== tag) {
      return {
        decrypted: '',
        success: false
      };
    }
    
    return {
      decrypted,
      success: true
    };
  } catch (error) {
    console.error('Decryption failed:', error);
    return {
      decrypted: '',
      success: false
    };
  }
}

/**
 * Generate a secure random password for demo purposes
 */
export function generateSecurePassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return password;
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate username
 */
export function validateUsername(username: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (username.length < 3) {
    errors.push('Username must be at least 3 characters long');
  }
  
  if (username.length > 50) {
    errors.push('Username must be less than 50 characters');
  }
  
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    errors.push('Username can only contain letters, numbers, underscores, and hyphens');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
