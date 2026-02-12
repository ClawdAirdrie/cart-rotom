
# ⚠️ Firebase Setup Required to Fix Slow Loading

The "30 second delay" is happening because your app is trying to talk to a Firestore database that **doesn't exist** or **is blocking the request**. The client library keeps retrying until it times out.

To fix this immediately, you must enable Firestore and install the Stripe extension.

## 1. Create the Database (Crucial!)
1. Go to [Firebase Console](https://console.firebase.google.com/) > **Firestore Database**.
2. Click **Create Database**.
3. Select **Production Mode** or **Test Mode** (doesn't matter yet, just create it).
4. Choose a location (e.g., `us-central1`).
5. **Wait for it to initialize.**

## 2. Deploy Security Rules
Once the database exists, go to the **Rules** tab in Firestore and paste this:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /customers/{uid} {
      allow read: if request.auth.uid == uid;
      match /subscriptions/{id} {
        allow read: if request.auth.uid == uid;
      }
    }
    match /products/{id} {
      allow read: if true;
      match /prices/{id} {
        allow read: if true;
      }
    }
  }
}
```
**Why?** Without this, the app might be denied access, or worse, if the DB doesn't exist, it just hangs.

## 3. Install the Stripe Extension
1. Go to **Extensions** in Firebase Console.
2. Install **Run Payments with Stripe**.
3. This will automatically create the `customers` and `subscriptions` collections when you sign up users.

## How to Verify
1. Open your browser console (F12).
2. If you see errors like `FirebaseError: [code=unavailable]: Service unavailable`, your database is missing.
3. If you see `FirebaseError: Missing or insufficient permissions`, your Rules are blocking the read.

**I have pushed a fix to the code** that adds a **5-second timeout**. If it can't reach Firestore in 5 seconds, it will assume you are on the Free tier and load the page. This prevents the infinite spinner.
