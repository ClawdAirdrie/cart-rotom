
# ⚠️ Cloud Firestore Rules Update Required

Since we added a new collection path for agents, you must update your Firestore Security Rules to allow users to write to their own `agents` subcollection.

Go to **Firebase Console** -> **Firestore Database** -> **Rules** and update them to:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own data
    match /customers/{uid} {
       allow read: if request.auth.uid == uid;
       
       // Stripe Extension collections
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
    
    // NEW: User Agents
    match /users/{uid} {
       allow read, write: if request.auth.uid == uid;
       
       match /agents/{agentId} {
         allow read, write: if request.auth.uid == uid;
       }
    }

    // Products are readable by everyone
    match /products/{id} {
      allow read: if true;
      match /prices/{id} {
        allow read: if true;
      }
    }
  }
}
```

Without this, the "Deploy Agent" page will fail with "Missing or insufficient permissions".
