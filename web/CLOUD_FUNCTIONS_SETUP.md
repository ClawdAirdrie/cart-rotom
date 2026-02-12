
# ⚡ Setting Up the Scheduled Cloud Reagent

To make your agents actually run every minute, you must deploy these Cloud Functions to Firebase.

## Prerequisites
1.  **Node.js LTS**: Ensure you have Node 18 or 20 installed.
2.  **Firebase CLI**: `npm install -g firebase-tools`
3.  **Blaze Plan**: Your project must be on the **Blaze (Pay-as-you-go)** plan. Cloud Scheduler and external HTTP requests (axios) will fail on the free Spark plan.

## 1. Login and Initialize
Open your terminal in `rotom-cart/web`:
```bash
firebase login
firebase init functions
```
*   Select **Use an existing project**.
*   Choose your project (`cart-rotom`).
*   Language: **JavaScript**.
*   Use ESLint? **No** (to keep it simple for now).
*   Install dependencies? **Yes**.
*   **Overwrite index.js?** **NO!!** (Start typing 'n' or it will delete my code).

## 2. Install Dependencies
If `firebase init` didn't install them, run this manually in the `functions` folder:
```bash
cd functions
npm install firebase-admin firebase-functions axios cheerio
```

## 3. Deploy
Back in the root `web` folder:
```bash
firebase deploy --only functions
```
This will take a few minutes. If it asks to enable APIs (Cloud Build API, Artifact Registry API, Cloud Scheduler API), say **Yes** (or go to Google Cloud Console and enable them).

## 4. How It Works (The Logic)
I wrote a function called `scheduleAgentChecks` in `functions/index.js`.
1.  **Trigger**: It uses `onSchedule("every 1 minutes")`. Firebase manages the cron job for you.
2.  **Scan**: It queries Firestore for all documents in `users/{uid}/agents`.
3.  **Filter**: It checks if `status == "RUNNING"` AND if `lastChecked + frequency` < `now`.
4.  **Action**: If due, it fetches the URL using `axios`.
5.  **Parse**: It uses `cheerio` (like jQuery for server) to scan the HTML body for "Out of Stock" keywords.
6.  **Update**: It writes the result (`IN_STOCK` or `OUT_OF_STOCK`) back to the agent document and adds a log entry to `logs` subcollection.

## 5. Verify It's Running
1.  Go to **Firebase Console** -> **Functions**. You should see `scheduleAgentChecks`.
2.  Go to **Logs**. You should see "Scheduler started..." every minute.
3.  If you have a running agent, you will see "Agent [ID] due for check...".
