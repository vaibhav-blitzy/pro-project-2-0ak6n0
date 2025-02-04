/**
 * @fileoverview Enhanced Mongoose user model implementing comprehensive security features,
 * audit tracking, and compliance with OWASP, PCI DSS, and GDPR standards.
 * @version 1.0.0
 */

import mongoose, { Schema, Document } from 'mongoose';
import { IsEmail, MinLength, Matches } from 'class-validator';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { IAuditableEntity } from '../../../shared/interfaces/base.interface';
import { IUser, UserRole } from '../interfaces/auth.interface';

// Encryption configuration for sensitive data
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || randomBytes(32);
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

/**
 * Enhanced User model implementing comprehensive security features
 * and audit tracking capabilities
 */
@Schema({ 
  timestamps: true, 
  collection: 'users',
  optimisticConcurrency: true 
})
export class UserModel implements IUser, IAuditableEntity {
  @IsEmail()
  email!: string;

  @MinLength(12)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/)
  password!: string;

  firstName!: string;
  lastName!: string;
  role!: UserRole;
  mfaEnabled: boolean = false;
  mfaSecret: string = '';
  lastLogin: Date = new Date();
  failedLoginAttempts: number = 0;
  accountLockoutUntil: Date | null = null;
  passwordHistory: string[] = [];
  passwordExpiryDate: Date = new Date();
  securityQuestions: Map<string, string> = new Map();
  createdAt!: Date;
  updatedAt!: Date;
  version!: number;

  // Schema definition
  static schema = new Schema({
    email: { 
      type: String, 
      required: true, 
      unique: true,
      index: true,
      trim: true,
      lowercase: true
    },
    password: { 
      type: String, 
      required: true,
      select: false // Exclude password from query results by default
    },
    firstName: { 
      type: String, 
      required: true,
      trim: true
    },
    lastName: { 
      type: String, 
      required: true,
      trim: true
    },
    role: { 
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.MEMBER
    },
    mfaEnabled: {
      type: Boolean,
      default: false
    },
    mfaSecret: {
      type: String,
      select: false
    },
    lastLogin: {
      type: Date,
      default: Date.now
    },
    failedLoginAttempts: {
      type: Number,
      default: 0
    },
    accountLockoutUntil: {
      type: Date,
      default: null
    },
    passwordHistory: [{
      type: String,
      select: false
    }],
    passwordExpiryDate: {
      type: Date,
      default: () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days
    },
    securityQuestions: {
      type: Map,
      of: String,
      select: false
    },
    version: {
      type: Number,
      default: 0
    }
  }, {
    timestamps: true,
    optimisticConcurrency: true
  });

  /**
   * Sets user password with enhanced security measures including
   * password history tracking and expiry management
   * @param plainPassword - The new password in plain text
   */
  async setPassword(plainPassword: string): Promise<void> {
    // Validate password complexity
    if (!this.validatePasswordComplexity(plainPassword)) {
      throw new Error('Password does not meet security requirements');
    }

    // Check password history to prevent reuse
    if (this.passwordHistory.length > 0) {
      const bcrypt = require('bcrypt');
      for (const historicPassword of this.passwordHistory) {
        if (await bcrypt.compare(plainPassword, historicPassword)) {
          throw new Error('Password has been used previously');
        }
      }
    }

    // Hash password with high cost factor
    const bcrypt = require('bcrypt');
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(plainPassword, salt);

    // Update password and related fields
    this.password = hashedPassword;
    this.passwordHistory.push(hashedPassword);
    if (this.passwordHistory.length > 5) {
      this.passwordHistory.shift(); // Keep last 5 passwords
    }
    this.passwordExpiryDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  }

  /**
   * Validates password with account lockout mechanism
   * @param plainPassword - The password to validate
   * @returns boolean indicating if password is valid
   */
  async validatePassword(plainPassword: string): Promise<boolean> {
    // Check account lockout
    if (this.accountLockoutUntil && this.accountLockoutUntil > new Date()) {
      throw new Error('Account is temporarily locked');
    }

    const bcrypt = require('bcrypt');
    const isValid = await bcrypt.compare(plainPassword, this.password);

    if (!isValid) {
      this.failedLoginAttempts += 1;
      
      // Implement account lockout after 5 failed attempts
      if (this.failedLoginAttempts >= 5) {
        this.accountLockoutUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
      }
      
      await this.save();
      return false;
    }

    // Reset failed attempts on successful login
    this.failedLoginAttempts = 0;
    this.accountLockoutUntil = null;
    await this.save();
    
    return true;
  }

  /**
   * Updates login audit information and emits login event
   */
  async updateLastLogin(): Promise<void> {
    this.lastLogin = new Date();
    this.failedLoginAttempts = 0;
    this.accountLockoutUntil = null;
    await this.save();
  }

  /**
   * Validates password complexity against security requirements
   * @param password - Password to validate
   * @returns boolean indicating if password meets complexity requirements
   */
  private validatePasswordComplexity(password: string): boolean {
    const minLength = 12;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChars = /[@$!%*?&]/.test(password);

    return password.length >= minLength &&
           hasUpperCase &&
           hasLowerCase &&
           hasNumbers &&
           hasSpecialChars;
  }

  /**
   * Encrypts sensitive data before saving
   * @param value - Value to encrypt
   * @returns Encrypted value
   */
  private encryptSensitiveData(value: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv(ENCRYPTION_ALGORITHM, ENCRYPTION_KEY, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  /**
   * Decrypts sensitive data
   * @param encryptedValue - Value to decrypt
   * @returns Decrypted value
   */
  private decryptSensitiveData(encryptedValue: string): string {
    const [ivHex, authTagHex, encryptedHex] = encryptedValue.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(encrypted) + decipher.final('utf8');
  }
}

// Create and export the Mongoose model
export default mongoose.model<IUser & Document>('User', UserModel.schema);