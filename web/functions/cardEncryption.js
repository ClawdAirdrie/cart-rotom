/**
 * Card Encryption Helper
 * Uses AES-256-GCM for secure encryption of payment card data
 */

const crypto = require('crypto');

// Algorithm configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // AES block size
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const TAG_POSITION = SALT_LENGTH + IV_LENGTH;
const ENCRYPTED_POSITION = TAG_POSITION + TAG_LENGTH;

/**
 * Get encryption key from environment
 * Key should be a 32-byte hex string (64 characters)
 */
function getEncryptionKey() {
    const key = process.env.CARD_ENCRYPTION_KEY;
    
    if (!key) {
        throw new Error('CARD_ENCRYPTION_KEY environment variable is not set');
    }
    
    // If key is hex string, convert to buffer
    if (key.length === 64) {
        return Buffer.from(key, 'hex');
    }
    
    // Otherwise, derive key from string using pbkdf2
    const salt = Buffer.from('cart-rotom-encryption-salt', 'utf-8');
    return crypto.pbkdf2Sync(key, salt, 100000, 32, 'sha512');
}

/**
 * Encrypt sensitive data
 * @param {string} text - Plain text to encrypt
 * @returns {string} - Base64 encoded encrypted data with salt, IV, and auth tag
 */
function encrypt(text) {
    if (!text) {
        throw new Error('Text to encrypt cannot be empty');
    }

    const key = getEncryptionKey();
    
    // Generate random salt and IV
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    // Encrypt the data
    const encrypted = Buffer.concat([
        cipher.update(text, 'utf8'),
        cipher.final()
    ]);
    
    // Get authentication tag
    const tag = cipher.getAuthTag();
    
    // Combine salt + iv + tag + encrypted data
    const result = Buffer.concat([salt, iv, tag, encrypted]);
    
    // Return as base64 string
    return result.toString('base64');
}

/**
 * Decrypt encrypted data
 * @param {string} encryptedData - Base64 encoded encrypted data
 * @returns {string} - Decrypted plain text
 */
function decrypt(encryptedData) {
    if (!encryptedData) {
        throw new Error('Encrypted data cannot be empty');
    }

    const key = getEncryptionKey();
    
    // Convert from base64
    const buffer = Buffer.from(encryptedData, 'base64');
    
    // Extract components
    const salt = buffer.slice(0, SALT_LENGTH);
    const iv = buffer.slice(SALT_LENGTH, TAG_POSITION);
    const tag = buffer.slice(TAG_POSITION, ENCRYPTED_POSITION);
    const encrypted = buffer.slice(ENCRYPTED_POSITION);
    
    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    // Decrypt the data
    const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
    ]);
    
    return decrypted.toString('utf8');
}

/**
 * Encrypt card data object
 * @param {Object} cardData - Card data with number, cvc fields
 * @returns {Object} - Encrypted card data
 */
function encryptCardData(cardData) {
    const { cardNumber, cvc, expiry, cardholderName, last4, isPrepaid, balance } = cardData;
    
    if (!cardNumber || !cvc) {
        throw new Error('Card number and CVC are required');
    }
    
    return {
        encryptedNumber: encrypt(cardNumber),
        encryptedCVC: encrypt(cvc),
        expiry,
        cardholderName,
        last4,
        isPrepaid: isPrepaid || false,
        balance: isPrepaid ? balance : null
    };
}

/**
 * Decrypt card data object
 * @param {Object} encryptedCardData - Encrypted card data
 * @returns {Object} - Decrypted card data
 */
function decryptCardData(encryptedCardData) {
    const { encryptedNumber, encryptedCVC, expiry, cardholderName, last4, isPrepaid, balance } = encryptedCardData;
    
    if (!encryptedNumber || !encryptedCVC) {
        throw new Error('Encrypted card data is incomplete');
    }
    
    return {
        cardNumber: decrypt(encryptedNumber),
        cvc: decrypt(encryptedCVC),
        expiry,
        cardholderName,
        last4,
        isPrepaid: isPrepaid || false,
        balance
    };
}

module.exports = {
    encrypt,
    decrypt,
    encryptCardData,
    decryptCardData
};
