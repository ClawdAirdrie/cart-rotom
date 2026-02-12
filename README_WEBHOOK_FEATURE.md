# 🔔 Webhook Notifications Feature

## Quick Start

### For Users

1. **Open Settings**
   - Navigate to Settings page in Cart Rotom
   - Click on "Notifications" tab

2. **Add Webhook**
   - Paste your Discord/Slack/Generic webhook URL
   - Click "Save Webhook"
   - Click "Test Webhook" to verify it works

3. **Done!**
   - You'll now receive notifications when monitored products change status
   - Notifications show: Product name, status, thumbnail, URL, timestamp

### For Developers

**Deploy:**
```bash
cd web
firebase deploy --only functions
firebase deploy --only hosting
```

**Test:**
1. Add webhook URL in Settings → Notifications
2. Test webhook works
3. Create agent with monitored product
4. Wait for status change or manually trigger
5. Verify webhook fires

## Features

### Supported Platforms

#### Discord
```
Server Settings → Integrations → Webhooks → New Webhook
```
Rich embeds with:
- Color coding (green/red)
- Product thumbnails
- Clickable URLs
- Timestamps

#### Slack
```
Workspace Settings → Apps → Incoming Webhooks
```
Block-based messages with:
- Color attachments
- Product images
- Markdown formatting
- Clickable links

#### Generic
```
Any endpoint accepting JSON POST
```
Clean JSON payload with all product data

### Notification Triggers

- ✅ OUT_OF_STOCK → IN_STOCK
- ✅ IN_STOCK → OUT_OF_STOCK
- ❌ No notification if status unchanged

### Security

- 🔒 Webhook URLs encrypted at rest (AES-256-GCM)
- 🔒 Same encryption as payment card data
- 🔒 User authentication required for all operations
- 🔒 Error handling prevents webhook failures from breaking checks

## Architecture

### Data Flow

```
Agent Check → Status Change Detected → fireWebhook()
                                            ↓
                                    Fetch encrypted URL
                                            ↓
                                    Decrypt URL
                                            ↓
                                    Detect platform type
                                            ↓
                                    Format payload
                                            ↓
                                    POST to webhook URL
```

### Database Schema

```
users/
  └─ {userId}/
      ├─ notificationWebhook (encrypted string)
      └─ agents/
          └─ {agentId}/
              ├─ lastResult (IN_STOCK/OUT_OF_STOCK/ERROR)
              ├─ lastChecked (timestamp)
              └─ ... other fields
```

### Cloud Functions

| Function | Type | Purpose |
|----------|------|---------|
| `saveWebhook` | Callable | Encrypt & save webhook URL |
| `testWebhook` | Callable | Send test notification |
| `fireWebhook` | Internal | Send real notifications |
| `checkStock` | Scheduled | Check agent & trigger webhooks |

## Examples

### Discord Notification
```
🟢 Cart Rotom Stock Alert

✅ IN STOCK: RTX 4090 GPU

URL: https://example.com/product
Last Checked: Feb 12, 2026, 11:30 AM

[Product thumbnail displayed]
```

### Slack Notification
```
✅ IN STOCK: RTX 4090 GPU

• Product: RTX 4090 GPU
• Status: ✅ IN STOCK  
• URL: View Product (link)

[Product image displayed]

Last checked: Feb 12, 2026, 11:30 AM
```

### Generic JSON
```json
{
  "agent": {
    "id": "abc123",
    "name": "RTX 4090 GPU",
    "alias": "GPU Alert",
    "url": "https://example.com/product",
    "thumbnail": "https://example.com/image.jpg"
  },
  "status": "IN_STOCK",
  "isInStock": true,
  "timestamp": "2026-02-12T16:30:00.000Z",
  "message": "RTX 4090 GPU is now ✅ IN STOCK"
}
```

## Configuration

### Environment Variables

Required in Firebase Functions:
```bash
CARD_ENCRYPTION_KEY=<32-byte-hex-string>
```

Generate new key if needed:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Firebase Rules

Ensure Firestore rules allow:
- Users can read/write their own webhook settings
- Users can read/write their own agents

Example:
```javascript
match /users/{userId} {
  allow read, write: if request.auth.uid == userId;
  
  match /agents/{agentId} {
    allow read, write: if request.auth.uid == userId;
  }
}
```

## Troubleshooting

### Webhook not firing
1. Check agent status is ENABLED
2. Verify status actually changed (check lastResult)
3. Check cloud function logs for errors
4. Verify webhook URL is valid

### Test webhook fails
1. Verify webhook URL format
2. Check webhook still active on platform
3. Try regenerating webhook on platform
4. Check cloud function logs

### Notifications delayed
- Scheduler runs every 1 minute
- Status must actually change to fire
- Check agent frequency setting
- Review cloud function execution time

## Monitoring

### Firebase Console

Check function logs:
```
functions → scheduleAgentChecks → Logs
```

Look for:
- "Status changed for {agentId}"
- "Webhook fired successfully"
- "Webhook failed" (errors)

### Webhook Platform

Most platforms show:
- Webhook delivery history
- Failed deliveries
- Response codes

## API Reference

### saveWebhook(webhookUrl)
```javascript
const saveWebhook = httpsCallable(functions, 'saveWebhook');
await saveWebhook({ webhookUrl: 'https://...' });
```

### testWebhook(webhookUrl)
```javascript
const testWebhook = httpsCallable(functions, 'testWebhook');
await testWebhook({ webhookUrl: 'https://...' });
```

## Support

For issues or questions:
1. Check function logs in Firebase Console
2. Review this documentation
3. Check PR description: `PR_DESCRIPTION.md`
4. Review implementation: `IMPLEMENTATION_COMPLETE.md`

---

**Built with ❤️ for Cart Rotom**
