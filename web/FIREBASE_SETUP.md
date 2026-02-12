
# Firebase Setup Instructions for Rotom Cart

To make the Authentication and Payment system work securely without a backend server, you need to configure your Firebase project as follows:

## 1. Enable Authentication
1. Go to **Authentication** in the Firebase Console.
2. Click **Get Started**.
3. Enable **Email/Password** provider (or Google, etc.).

## 2. specific Firestore Database
1. Go to **Firestore Database**.
2. Click **Create Database**.
3. Start in **Test Mode** (we will add rules next).
4. Choose a location.

## 3. Install "Run Payments with Stripe" Extension
This is the "backend" logic handled by Firebase/Stripe.
1. Go to **Extensions** in the Firebase Console.
2. Search for **"Run Payments with Stripe"**.
3. Click **Install**.
4. You will need a Stripe account (Active or Test mode).
5. Configure the extension:
    - **Cloud Functions location**: Same as Firestore or close.
    - **Products Collection**: `products` (default).
    - **Customers Collection**: `customers` (default).
    - **Sync new users**: Yes (This creates a customer doc when a user signs up).

## 4. Firestore Security Rules
Go to **Firestore Database** -> **Rules** and paste this to secure your data and subscriptions:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own data
    match /customers/{uid} {
      allow read: if request.auth.uid == uid;

      // Only Stripe extension (via admin SDK) can write to subscriptions
      match /checkout_sessions/{id} {
        allow read, write: if request.auth.uid == uid;
      }
      match /subscriptions/{id} {
        allow read: if request.auth.uid == uid;
      }
      match /payments/{id} {
        allow read: if request.auth.uid == uid;
      }
    }

    // Products are readable by everyone (for pricing page)
    match /products/{id} {
      allow read: if true;
      match /prices/{id} {
        allow read: if true;
      }
    }
  }
}
```

## 5. Stripe Setup
1. In Stripe Dashboard, create your products and pricing (e.g., "Premium Plan" - $29/mo).
2. The Extension will sync these to your `products` collection in Firestore.
3. You can then use them in your app.

## Done!
Once this is set up:
1. When a user signs up/logs in, the app checks `customers/{uid}/subscriptions`.
2. If an active subscription exists, they get access to Dashboard.
3. If not, they are redirected to `/pricing`.
