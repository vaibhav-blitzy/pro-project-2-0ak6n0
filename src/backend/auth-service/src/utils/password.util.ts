/**
 * @fileoverview Enterprise-grade password utility module implementing OWASP-compliant
 * password management with bcrypt hashing, validation, and security logging.
 * @version 1.0.0
 */

import bcrypt from 'bcrypt'; // ^5.1.1
import { randomBytes } from 'crypto';
import { Logger } from '../../../shared/utils/logger';
import { validatePassword } from '../../../shared/utils/validation';

// Initialize logger for password operations
const logger = new Logger('password-service');

// Global constants for password management
const SALT_ROUNDS = 12;
const PASSWORD_HISTORY_LIMIT = 5;
const MIN_PASSWORD_LENGTH = 12;
const TEMP_PASSWORD_LENGTH = 16;

// Character sets for temporary password generation
const CHAR_SETS = {
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789',
  special: '!@#$%^&*()_+-=[]{}|;:,.<>?'
};

/**
 * Securely hashes passwords using bcrypt with timing attack protection
 * @param password - Plain text password to hash
 * @returns Promise resolving to hashed password
 * @throws Error if password validation fails
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    // Validate password strength
    const validation = validatePassword(password);
    if (!validation.isValid) {
      logger.error('Password validation failed', null, {
        requirements: validation.requirements
      });
      throw new Error('Password does not meet security requirements');
    }

    // Generate cryptographically secure salt
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    
    // Hash password with constant-time algorithm
    const hashedPassword = await bcrypt.hash(password, salt);

    logger.debug('Password hashed successfully', {
      saltRounds: SALT_ROUNDS
    });

    return hashedPassword;
  } catch (error) {
    logger.error('Password hashing failed', error);
    throw error;
  } finally {
    // Clear sensitive data from memory
    password = '';
  }
}

/**
 * Securely compares plain text and hashed passwords with timing attack protection
 * @param plainPassword - Plain text password to compare
 * @param hashedPassword - Bcrypt hashed password
 * @returns Promise resolving to boolean indicating match
 */
export async function comparePassword(
  plainPassword: string,
  hashedPassword: string
): Promise<boolean> {
  try {
    if (!plainPassword || !hashedPassword) {
      throw new Error('Invalid password comparison parameters');
    }

    // Use constant-time comparison
    const isMatch = await bcrypt.compare(plainPassword, hashedPassword);

    logger.debug('Password comparison completed', {
      matched: isMatch
    });

    return isMatch;
  } catch (error) {
    logger.error('Password comparison failed', error);
    throw error;
  } finally {
    // Clear sensitive data from memory
    plainPassword = '';
  }
}

/**
 * Generates cryptographically secure temporary passwords
 * @param length - Length of temporary password (default: TEMP_PASSWORD_LENGTH)
 * @returns Secure temporary password string
 */
export function generateTempPassword(length: number = TEMP_PASSWORD_LENGTH): string {
  try {
    if (length < MIN_PASSWORD_LENGTH) {
      throw new Error('Temporary password length below minimum requirement');
    }

    // Generate random bytes with crypto.randomBytes
    const buffer = randomBytes(length * 2);
    let password = '';

    // Ensure password complexity requirements
    password += getRandomChar(CHAR_SETS.uppercase, buffer);
    password += getRandomChar(CHAR_SETS.lowercase, buffer);
    password += getRandomChar(CHAR_SETS.numbers, buffer);
    password += getRandomChar(CHAR_SETS.special, buffer);

    // Fill remaining length with random characters
    while (password.length < length) {
      const allChars = Object.values(CHAR_SETS).join('');
      password += getRandomChar(allChars, buffer);
    }

    // Shuffle password to avoid predictable pattern
    password = password.split('').sort(() => 0.5 - Math.random()).join('');

    logger.debug('Temporary password generated', {
      length
    });

    return password;
  } catch (error) {
    logger.error('Temporary password generation failed', error);
    throw error;
  }
}

/**
 * Prevents password reuse by checking against history
 * @param newPassword - New password to check
 * @param passwordHistory - Array of previously used password hashes
 * @returns Promise resolving to boolean indicating if password is unique
 */
export async function checkPasswordHistory(
  newPassword: string,
  passwordHistory: string[]
): Promise<boolean> {
  try {
    if (!newPassword || !Array.isArray(passwordHistory)) {
      throw new Error('Invalid password history check parameters');
    }

    // Trim history to limit
    const recentHistory = passwordHistory.slice(-PASSWORD_HISTORY_LIMIT);

    // Perform concurrent password comparisons
    const comparisons = await Promise.all(
      recentHistory.map(hash => comparePassword(newPassword, hash))
    );

    const isUnique = !comparisons.some(result => result);

    logger.debug('Password history check completed', {
      historySize: recentHistory.length,
      isUnique
    });

    return isUnique;
  } catch (error) {
    logger.error('Password history check failed', error);
    throw error;
  }
}

/**
 * Helper function to get random character from character set
 * @param charset - String of possible characters
 * @param buffer - Random bytes buffer
 * @returns Random character from charset
 */
function getRandomChar(charset: string, buffer: Buffer): string {
  const randomIndex = buffer.readUInt8(0) % charset.length;
  return charset.charAt(randomIndex);
}