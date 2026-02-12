
# Troubleshooting: Missing Firestore Collections

If your Firestore is empty even after installing the **Run Payments with Stripe** extension, it is likely because the extension **only syncs new events**. It does not automatically import your existing Stripe products unless you tell it to.

## Solution 1: Trigger a Sync (Easiest)
The extension listens for "Product Created" or "Product Updated" events from Stripe.

1.  Go to your [Stripe Dashboard > Products](https://dashboard.stripe.com/products).
2.  **Create a NEW Product**:
    *   Name: `Pro Plan` (or similar)
    *   Price: `29.00`
    *   Billing period: `Monthly`
3.  **Wait 10-20 seconds**.
4.  Refresh your **Firebase Console > Firestore Database**.
5.  You should now see a `products` collection appear.

## Solution 2: Edit an Existing Product
If you already have products in Stripe:
1.  Open the product in Stripe.
2.  Click **Edit**.
3.  Add a small change (e.g., add a description "Synced with Firebase").
4.  Save.
5.  This "update" event will trigger the extension to create the document in Firestore.

## Solution 3: Check Extension Logs
If the above doesn't work:
1.  Go to **Firebase Console > Extensions > Run Payments with Stripe**.
2.  Click **View Logs** (in the cloud functions tab that opens).
3.  Look for "Error" entries. Common issues:
    *   **Billing not enabled**: Your Firebase project must be on the **Blaze (Pay-as-you-go)** plan to use Extensions.
    *   **API Key permissions**: Ensure the API key you gave the extension has sufficient permissions (Restricted keys can block this).
    *   **Webhook Signing Secret**: If you are testing locally or used a different secret, the events might be rejected.

**Note on "customers" collection**:
The `customers` collection is only created when a **user signs up** in your app. The extension listens to Firebase Auth `user.create`. If you already have users, they won't have customer docs. You might need to sign up a **new** user to test the flow.
