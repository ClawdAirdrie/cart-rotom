# GitHub Actions CI/CD Setup Guide

This guide walks you through setting up automatic Cloud Functions deployment via GitHub Actions using a Firebase Service Account.

## Overview

When you merge a PR to `main`, GitHub Actions will automatically:
1. Check out the code
2. Install dependencies
3. Authenticate with Google Cloud Service Account
4. Deploy Cloud Functions to production

## Setup Instructions

### Step 1: Create a Firebase Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Make sure your **Firebase project** is selected (top-left dropdown)
3. Navigate to **IAM & Admin → Service Accounts**
4. Click **Create Service Account**
5. Fill in:
   - **Service account name**: `github-actions` (or similar)
   - **Service account ID**: Auto-generated
   - **Description**: `GitHub Actions deployment account`
6. Click **Create and Continue**
7. In "Grant this service account access to project":
   - Click **Select a role**
   - Search for `Cloud Functions Developer`
   - Click to select it
   - Click **Continue**
8. Click **Done**

### Step 2: Create and Download Service Account Key

1. In the Service Accounts list, click the **github-actions** account you just created
2. Go to the **Keys** tab
3. Click **Add Key → Create new key**
4. Select **JSON**
5. Click **Create**
6. A JSON file will download automatically - **save it somewhere safe**

**⚠️ Important**: This file contains credentials. Never commit it to git!

### Step 3: Add GitHub Secret

1. Go to your GitHub repo: **Settings → Secrets and variables → Actions**
2. Click **New repository secret**
3. Fill in:
   - **Name**: `FIREBASE_SERVICE_ACCOUNT_KEY`
   - **Value**: Open the JSON file you downloaded in Step 2, copy the **entire contents**, and paste it here
   - Click **Add secret**
4. Add a second secret for your Firebase Project ID:
   - **Name**: `FIREBASE_PROJECT_ID`
   - **Value**: Your Firebase **Project ID** (e.g., `cart-rotom`, NOT the project number)
   - Find it in [Firebase Console](https://console.firebase.google.com/) → **Project Settings** (gear icon) → Copy **Project ID**
   - Click **Add secret**
   
   ⚠️ **Important**: Use the **Project ID** (e.g., "cart-rotom"), not the **Project Number** (a long number)

### Step 4: Verify Setup

1. Make a small change to any file in `web/functions/`
2. Create a PR to `main`
3. After merge, GitHub Actions should automatically trigger
4. Go to **Actions** tab to see the deployment in progress
5. Check the logs to confirm success

## How It Works

### Workflow Trigger
The workflow runs when:
- Code is **pushed to main** branch
- Changes are in `web/functions/` directory or the workflow file itself

### Workflow Steps
1. **Checkout**: Pull the latest code
2. **Setup Node.js**: Install Node 20 with dependency caching
3. **Install Firebase CLI**: Get the deployment tool
4. **Install Dependencies**: Run `npm install` in `web/functions/`
5. **Deploy**: Authenticate with token and deploy functions

### Automatic Deployments
- Merging a PR to `main` automatically deploys
- No manual `firebase deploy` commands needed
- All team members benefit from the same deployment pipeline

## Security Best Practices

✅ **Service Account Key**
- JSON key stored as encrypted GitHub secret
- Only accessible to GitHub Actions
- Never commit keys to git
- Credentials only used during deployment, cleaned up after

✅ **Least Privilege**
- Service account only has `Cloud Functions Developer` role
- Cannot delete projects, databases, or other resources
- Limited to Cloud Functions operations only

✅ **Project ID**
- Stored separately for easy rotation
- Not sensitive, but good practice to use secrets

✅ **Access Control**
- Only runs on pushes to `main`
- Cannot be triggered by PRs from forks
- Deployment logs visible to team members
- Service account can be rotated anytime

## Troubleshooting

### "Unauthorized" or "Permission denied" Error
**Problem**: Service account doesn't have access  
**Solution**: 
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **IAM & Admin → IAM**
3. Find the **github-actions** service account
4. Click the pencil icon to edit
5. Verify it has **Cloud Functions Developer** role
6. If missing, click **Add Role** and select it

### "GOOGLE_APPLICATION_CREDENTIALS not found"
**Problem**: Missing `FIREBASE_SERVICE_ACCOUNT_KEY` secret  
**Solution**:
1. Go to GitHub **Settings → Secrets and variables → Actions**
2. Verify `FIREBASE_SERVICE_ACCOUNT_KEY` exists
3. If missing, follow Step 2-3 of setup instructions
4. Paste the entire JSON from the service account key file

### Deployment Not Triggering
**Problem**: Workflow doesn't run on merge  
**Solution**:
1. Verify you're pushing to `main` (not `master`)
2. Confirm changes are in `web/functions/` directory
3. Check **Actions** tab for workflow runs
4. Verify both secrets are set:
   - `FIREBASE_SERVICE_ACCOUNT_KEY`
   - `FIREBASE_PROJECT_ID`

### "Project ID not set" Error
**Problem**: Missing `FIREBASE_PROJECT_ID` secret  
**Solution**:
1. Find your project ID in [Firebase Console](https://console.firebase.google.com/)
2. Go to **Project Settings** (gear icon)
3. Copy the **Project ID**
4. Add it as a GitHub secret named `FIREBASE_PROJECT_ID`

### Deployment Timeout
**Problem**: Firebase deploy takes too long  
**Solution**:
1. GitHub has a default 360-minute timeout (should be fine)
2. If truly hanging, check Firebase Console for stuck operations
3. Can manually cancel the workflow in the **Actions** tab

### "Invalid service account key" / "is not valid JSON"
**Problem**: JSON key is malformed or incomplete  
**Solution**:
1. Download a fresh service account key from Google Cloud Console
2. Open it in a text editor and verify:
   - It starts with `{`
   - It ends with `}`
   - It's valid JSON (no missing quotes or commas)
3. Copy the **entire file contents** - make sure you get everything from start to finish
4. Go to GitHub → Settings → Secrets → Edit `FIREBASE_SERVICE_ACCOUNT_KEY`
5. Replace the entire value with the new JSON
6. Click **Update secret**

**Note**: The secret should look like:
```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "...",
  ...
}
```

### "Failed to authenticate" after secrets check passes
**Problem**: Service account credentials aren't working  
**Solution**:
1. Verify the service account has **Cloud Functions Developer** role:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - **IAM & Admin → IAM**
   - Find `github-actions@...` service account
   - Verify it has **Cloud Functions Developer** role
   - If missing, click the pencil, **Add Role**, select **Cloud Functions Developer**

2. Try downloading a NEW service account key and updating the GitHub secret:
   - Delete the old key in Google Cloud
   - Create a new key (JSON format)
   - Replace the GitHub secret with the new key contents

3. Verify your **FIREBASE_PROJECT_ID** is the **Project ID** (like `cart-rotom`), not the project number

## Manual Deployment (Fallback)

If GitHub Actions fails or you need to deploy immediately:

```bash
# Option 1: Use your local Firebase login
firebase login
cd web/functions
firebase deploy --only functions

# Option 2: Use the service account JSON
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
cd web/functions
firebase deploy --only functions --project YOUR_PROJECT_ID
```

Replace `/path/to/service-account-key.json` with the path to your downloaded JSON file.

## Monitoring Deployments

### View Deployment Logs
1. Go to **Actions** tab on GitHub
2. Click the workflow run
3. Click **deploy** job
4. Expand each step to see detailed logs
5. You'll see:
   - Node.js setup and caching
   - Firebase CLI installation
   - Dependency installation
   - Deployment progress
   - Success/failure message

### Firebase Console
Check [Firebase Console](https://console.firebase.google.com/) under:
- **Functions** → See deployed functions with latest deployment time
- **Cloud Functions** logs to verify execution
- **Logs** → View application logs from your functions

## Advanced: Environment-Specific Deployments

To deploy to different Firebase projects (staging vs production), you can:

1. Create service accounts in each project and download their keys
2. Create multiple secrets in GitHub:
   - `FIREBASE_SERVICE_ACCOUNT_KEY_PROD`
   - `FIREBASE_SERVICE_ACCOUNT_KEY_STAGING`
   - `FIREBASE_PROJECT_ID_PROD`
   - `FIREBASE_PROJECT_ID_STAGING`

3. Create separate workflows or use conditional steps:
   ```yaml
   - name: Deploy to Production (Main)
     if: github.ref == 'refs/heads/main'
     env:
       GOOGLE_APPLICATION_CREDENTIALS: /tmp/prod-key.json
     run: |
       echo "${{ secrets.FIREBASE_SERVICE_ACCOUNT_KEY_PROD }}" > /tmp/prod-key.json
       cd web/functions
       firebase deploy --only functions --project "${{ secrets.FIREBASE_PROJECT_ID_PROD }}"
   ```

## What Gets Deployed

The workflow deploys:
- ✅ All files in `web/functions/`
- ✅ Updated `package.json` dependencies
- ✅ New callable functions (e.g., `saveTelegram`, `testTelegram`)
- ✅ Updated `fireWebhook()` logic
- ✅ New secrets helper (reads from Google Cloud Secret Manager)

---

**Questions?** Check the deployment logs in the Actions tab for detailed error messages.
