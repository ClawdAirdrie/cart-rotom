# Telegram Notifications Setup Guide

## Overview
Cart Rotom now supports sending stock alerts directly to your Telegram account via a Cart Rotom Bot.

## Prerequisites
1. A Telegram account
2. Access to Google Cloud Console for your Firebase project
3. Firebase Cloud Functions enabled

## Step 1: Create a Telegram Bot

1. Open Telegram and search for **@BotFather**
2. Click "Start" and send the command `/newbot`
3. Follow the prompts:
   - **Name**: `Cart Rotom Bot`
   - **Username**: `CartRotomBot`
4. BotFather will return a **token** that looks like: `123456789:ABCDEfghijklmnopqrstuvwxyz123456789`
5. **Save this token** — you'll need it in the next step

## Step 2: Store Token in Google Cloud Secret Manager

### Using Google Cloud Console (Recommended for Production)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **Secret Manager** (search in top bar)
3. Click **Create Secret**
4. Fill in:
   - **Name**: `TELEGRAM_BOT_TOKEN`
   - **Secret value**: Paste the token from BotFather
   - **Replication**: Automatic
5. Click **Create Secret**
6. Grant your Cloud Functions service account access:
   - Click the secret you just created
   - Click **Manage Roles** in the sidebar
   - Under "Principal", enter: `<YOUR-PROJECT-ID>@appspot.gserviceaccount.com`
   - Assign role: **Secret Accessor**
   - Click **Save**

### Using Firebase CLI (Development)

```bash
# Set the secret in your Firebase project
firebase functions:secrets:set TELEGRAM_BOT_TOKEN

# When prompted, paste the token from BotFather
# Then deploy functions
firebase deploy --only functions
```

## Step 3: Deploy Code and Set Webhook

```bash
cd web
firebase deploy --only functions
```

After deployment, you'll see a URL like:
```
✔ Function URL: https://us-central1-[PROJECT-ID].cloudfunctions.net/telegramWebhook
```

Save that URL. Then set the Telegram webhook (run this command anywhere):

```bash
curl -X POST https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook \
  -H "Content-Type: application/json" \
  -d '{"url": "https://us-central1-cart-rotom.cloudfunctions.net/telegramWebhook"}'
```

Replace:
- `<YOUR_BOT_TOKEN>` with your token from BotFather
- `us-central1-cart-rotom` with your actual Cloud Functions region and project

You should get a response like: `{"ok":true,"result":true}`

## Step 4: Connect in Cart Rotom UI

1. Open Cart Rotom Settings → Notifications tab
2. Select **Telegram** as your notification method
3. Open Telegram and find your bot `@CartRotomBot`
4. Send `/start` command to the bot
5. **The bot will instantly reply with your Telegram User ID** (looks like: `123456789`)
6. Copy that number from Telegram
7. Go back to Cart Rotom Settings → paste the ID into the "Telegram User ID" field
8. Click **"Connect Telegram"**
9. Click **"Test Telegram"** to verify everything works
   - You should receive a test message in Telegram immediately

## How It Works

When an item you're monitoring goes in/out of stock:
- Cart Rotom checks the product
- The Cloud Function detects the status change
- If Telegram is configured, it sends you a direct message via @CartRotomBot
- Message format: `✅ Product Name` with URL and timestamp

## Security

- Bot tokens are stored in Google Cloud Secret Manager (encrypted at rest)
- Telegram User IDs are encrypted in Firestore before storage
- Tokens are cached in-memory for 1 hour to reduce API calls
- Cloud Functions authenticate all requests via Firebase Auth
- Secrets are retrieved with proper service account permissions

## Troubleshooting

### /start command doesn't reply with my ID
- Verify webhook is set correctly: `gcloud functions describe telegramWebhook --region us-central1`
- Check webhook URL: Replace `cart-rotom` in the URL with your actual Firebase project ID
- Verify webhook is set: 
  ```bash
  curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo
  ```
  Should show your webhook URL with `"ok": true`
- Check logs: `firebase functions:log --follow` and send `/start` again

### Webhook returns 404 error
- Your Cloud Functions region might not be `us-central1`
- Find the correct region in your Firebase Console → Functions
- Update the webhook URL with the correct region:
  ```bash
  curl -X POST https://api.telegram.org/bot<TOKEN>/setWebhook \
    -H "Content-Type: application/json" \
    -d '{"url": "https://<REGION>-<PROJECT>.cloudfunctions.net/telegramWebhook"}'
  ```

### "Telegram bot not configured" error
- Verify `TELEGRAM_BOT_TOKEN` secret exists in Google Cloud Secret Manager
- Check the Cloud Functions service account has **Secret Accessor** role
- Redeploy: `firebase deploy --only functions`

### Test button doesn't send message
- Verify your Telegram user ID is correct (should be a number like `123456789`)
- Make sure you've run `/start` and got your ID from the bot
- Check Cloud Functions logs: `firebase functions:log`

### "Failed to retrieve secret" in logs
- Ensure secret name is exactly `TELEGRAM_BOT_TOKEN`
- Verify service account permissions in Secret Manager
- Check your GCP project ID is correct

## Switching Between Webhook and Telegram

You can switch notification methods anytime in Settings → Notifications without losing your configuration.

---

For issues, check Cloud Functions logs:
```bash
firebase functions:log --follow
```
