# Security Audit Report - Cart Rotom

**Last Updated**: February 14, 2026  
**Status**: 🔴 CRITICAL ISSUES FOUND

---

## Executive Summary

The Cart Rotom application has **good frontend auth UX**, but is missing **critical backend security controls**. Real security requires:

1. ❌ **Firestore Security Rules** - MISSING (Critical)
2. ❌ **Input Validation** - Minimal
3. ✅ **Authentication Checks** - Good (on callable functions)
4. ✅ **Data Encryption** - Good (payment cards, webhooks, Telegram IDs)
5. ⚠️ **Rate Limiting** - Not implemented
6. ⚠️ **IDOR Protection** - Needs verification

---

## Critical Issues

### 1. ❌ CRITICAL: No Firestore Security Rules

**Current State**: Firestore is completely open to anonymous reads/writes

**Impact**: 
- Any unauthenticated user can read ALL user data (payment methods, agents, webhooks, Telegram IDs)
- Any user can modify ANY other user's agents, webhooks, or settings
- Massive data breach potential

**What's Protected**: None. Data is completely exposed.

**Example Attack**:
```javascript
// Attacker could do this:
const db = firebase.firestore();
const allUsers = await db.collection('users').get(); // Gets ALL users!
const userPaymentMethods = await db.collection('users').doc('anyone-uid').collection('paymentMethods').get();
```

**Fix**: Implement Firestore Security Rules (PR includes this)

---

### 2. ⚠️ CRITICAL: No Input Validation on Cloud Functions

**Current State**: Callable functions accept user input without validation

**Impact**:
- Malicious URLs, long strings, unexpected data types could cause errors or exploits
- Webhook URLs not validated before saving
- Payment method data not validated
- Telegram user IDs could be non-numeric strings

**Example Issues**:
```javascript
// User could send:
saveWebhook({ webhookUrl: "' OR '1'='1" }) // SQL injection-like attempts
saveTelegram({ userId: "'; DROP TABLE users; --" }) // XSS attempt
addPaymentMethod({ cardNumber: "A".repeat(10000) }) // DOS attack
```

**Fix**: Add input validation (PR includes this)

---

### 3. ⚠️ IDOR: Cross-User Data Access

**Current State**: Cloud Functions use `auth.uid` correctly, BUT Firestore rules aren't enforced

**Impact**:
- If someone gets another user's UID, they could call functions to modify that user's data
- Firestore rules would catch this, but they don't exist

**Fix**: Firestore Security Rules prevent this (PR includes this)

---

## Good Security Practices ✅

### Authentication
```javascript
exports.saveWebhook = onCall(async (request) => {
    const { auth, data } = request;
    
    if (!auth) {  // ✅ Good - checks authentication
        throw new Error("Unauthorized");
    }
    
    const userId = auth.uid;  // ✅ Good - uses real user ID
    // ...
});
```

**Status**: ✅ All callable functions properly check `auth`

### Encryption
```javascript
// ✅ Payment cards encrypted with AES-256-GCM
const encryptedCard = encryptCardData(cardData);

// ✅ Webhook URLs encrypted
const encryptedWebhookUrl = encrypt(webhookUrl);

// ✅ Telegram IDs encrypted (will be added)
```

**Status**: ✅ Sensitive data properly encrypted

### Secret Management
```javascript
// ✅ Secrets stored in Google Cloud Secret Manager (not in code)
const telegramBotToken = await getSecret('TELEGRAM_BOT_TOKEN');

// ✅ Card encryption keys in Secrets Manager
const cardEncryptionKey = process.env.CARD_ENCRYPTION_KEY;
```

**Status**: ✅ No hardcoded secrets

---

## Issues to Fix (This PR)

### 1. Add Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Default: deny all
    match /{document=**} {
      allow read, write: if false;
    }
    
    // Users can only read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
      
      // And their subcollections
      match /{collection}/{document=**} {
        allow read, write: if request.auth.uid == userId;
      }
    }
  }
}
```

### 2. Add Input Validation to Cloud Functions

Example:
```javascript
exports.saveWebhook = onCall(async (request) => {
    const { webhookUrl } = request.data;
    
    // ✅ Validate input
    if (typeof webhookUrl !== 'string') {
        throw new Error('Webhook URL must be a string');
    }
    if (webhookUrl.length > 2048) {
        throw new Error('Webhook URL too long');
    }
    try {
        new URL(webhookUrl); // Validate it's a real URL
    } catch {
        throw new Error('Invalid webhook URL');
    }
    // ...
});
```

### 3. Add Telegram User ID Validation

```javascript
exports.saveTelegram = onCall(async (request) => {
    const { userId } = request.data;
    
    // Validate it's a positive integer
    if (!Number.isInteger(userId) || userId <= 0) {
        throw new Error('Invalid Telegram user ID');
    }
    // ...
});
```

---

## Recommended Security Checklist

### Already Done ✅
- [x] Authentication checks on all callable functions
- [x] Payment card encryption (AES-256-GCM)
- [x] Webhook URL encryption
- [x] Secrets in Google Cloud (not hardcoded)
- [x] GitHub Actions secret handling (env: section)
- [x] Service account with minimal permissions

### Need to Implement (This PR) 🔴
- [ ] Firestore Security Rules
- [ ] Input validation on all callable functions
- [ ] Type checking on parameters
- [ ] URL validation for webhooks
- [ ] Telegram ID validation
- [ ] Rate limiting on functions

### Future Improvements (Post-MVP) 🟡
- [ ] Audit logging for sensitive operations
- [ ] IP whitelisting (optional)
- [ ] 2FA for account access
- [ ] Payment PCI compliance review
- [ ] Penetration testing
- [ ] GDPR data export/delete functions
- [ ] API key rate limiting per user

---

## Testing Security

### To Test Current Vulnerabilities (Before This PR):

```javascript
// Anyone can read all users' data (BAD)
const db = firebase.firestore();
const allAgents = await db.collectionGroup('agents').get();

// Anyone can modify any user's data (BAD)
await db.collection('users').doc('other-user-id').set({ 
    hackedField: true 
});
```

### After This PR:

These attacks will be blocked by Firestore Security Rules ✅

---

## Impact Summary

| Issue | Severity | Impact | Status |
|-------|----------|--------|--------|
| No Firestore Rules | 🔴 CRITICAL | Data breach risk | Fixed in PR |
| No Input Validation | 🔴 CRITICAL | Invalid data, DOS | Fixed in PR |
| No Rate Limiting | 🟡 HIGH | Spam/DOS attacks | Post-MVP |
| No Audit Logging | 🟡 HIGH | Can't track changes | Post-MVP |

---

## Deployment Notes

This PR includes:
1. `firestore.rules` - Security rules file
2. Updated Cloud Functions with input validation
3. This security audit document
4. Instructions to deploy rules

**Important**: Deploy Firestore rules before/with this PR to protect data!

```bash
firebase deploy --only firestore:rules
```

---

## Questions?

For security concerns or questions, review:
- `/firestore.rules` - Firestore security configuration
- `web/functions/index.js` - Cloud Functions with validation
- This document - Full security audit

---

**Status**: 🟡 **IN PROGRESS** - This PR implements critical fixes
