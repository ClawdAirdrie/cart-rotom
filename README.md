# Cart Rotom

> **Note:** This README was modified by **Clawd** (an AI assistant) on 2026-02-12 as a test of automated PR workflows with OpenClaw.

Cart Rotom is an agent-based stock monitoring system with a React frontend and Firebase backend. It allows users to deploy monitoring agents to track product availability and manage subscriptions via Stripe.

## Prerequisites

Before you begin, ensure you have the following installed:

*   [Node.js](https://nodejs.org/) (Project uses v20)
*   [Firebase CLI](https://firebase.google.com/docs/cli) (`npm install -g firebase-tools`)
*   [Java](https://www.java.com/en/download/) (Required for Firebase Emulators)

## Project Structure

The project is organized into the following directories:

*   **`web`**: The main React application (Vite) and Firebase configuration.
*   **`web/functions`**: Cloud Functions for Firebase (Backend logic).

## Setup Instructions

### 1. Install Dependencies

**Frontend:**

```bash
cd web
npm install
```

**Backend (Cloud Functions):**

```bash
cd web/functions
npm install
```

### 2. Firebase & Environment Setup

This project relies on Firebase Authentication, Firestore, and the "Run Payments with Stripe" extension.

1.  **Login to Firebase:**
    ```bash
    firebase login
    ```

2.  **Select Project:**
    Ensure you are using the correct Firebase project.
    ```bash
    firebase use <your-project-id>
    ```

3.  **Detailed Configuration:**
    Please refer to `web/FIREBASE_SETUP.md` for critical setup steps, including:
    *   Enabling Authentication (Email/Password).
    *   Creating the Firestore Database.
    *   Installing and exploring the Stripe Extension (required for payments).
    *   Applying security rules.

## Running Locally

To run the application locally, you need to start both the frontend development server and the Firebase emulators (for functions/firestore).

**Option 1: Two Terminals (Recommended)**

Terminal 1 (Frontend):
```bash
cd web
npm run dev
```

Terminal 2 (Backend/Emulators):
```bash
cd web/functions
npm run serve
```

**Option 2: Concurrent (If configured)**
*Check `package.json` in `web` for any concurrent scripts.*

## Deployment

To deploy the application to Firebase Hosting and Cloud Functions:

```bash
cd web
npm run build
firebase deploy
```
