# FocusFlow Security Hardening Checklist

This document covers production security procedures for FocusFlow's Firebase Authentication, Cloud Firestore, Gemini Server Endpoints (`/api/gemini/*`), and API key lifecycle management.

---

## 1. Authorized Domains (Firebase Authentication)

Restrict which domains are allowed to initiate Google Sign-In or Email/Password authentication flows against your Firebase project (`distributed-xanthometer-25v9p`):

1. Open the **[Firebase Console](https://console.firebase.google.com/)** and select your project.
2. Navigate to **Authentication** → **Settings** → **Authorized domains**.
3. Verify that **only** trusted origins are listed:
   - `localhost` (for local development only; remove in strict production if not needed)
   - Your official AI Studio / Cloud Run applet domain (`*.run.app`)
   - Your custom production domain (if applicable)
4. Remove any unused staging, preview, or third-party domains so unauthorized sites cannot host OAuth popups or redirects for your Firebase project.

---

## 2. API Key Restrictions (Google Cloud Console)

### A. Gemini Server API Key (`GEMINI_API_KEY`)
- **Server-Only Secret**: `GEMINI_API_KEY` is read exclusively on the Node/Express server via `process.env.GEMINI_API_KEY` in `/server.ts`. It is **never** bundled into client code, exposed via `VITE_*` variables, or committed to git.
- **Endpoint Protection**: Every `/api/gemini/*` route requires a verified Firebase ID token (`Authorization: Bearer <idToken>`) and enforces a strict per-user sliding-window rate limit (**20 requests per minute per `uid`**).
- **Google Cloud Key Restrictions**:
  1. Go to **Google Cloud Console** → **APIs & Services** → **Credentials**.
  2. Select your Gemini API Key.
  3. Under **API restrictions**, select **Restrict key** and enable **only** the **Generative Language API**.
  4. Under **Application restrictions**, if your server runs on static egress IPs, restrict by **IP addresses**.

### B. Firebase Web API Key (`firebase-applet-config.json`)
- Firebase Web API keys identify your Firebase project to Google servers, but should still be restricted to prevent abuse:
  1. Go to **Google Cloud Console** → **APIs & Services** → **Credentials**.
  2. Select the **Browser key (auto created by Firebase)**.
  3. Under **Application restrictions**, choose **Websites (HTTP referrers)** and add:
     - `https://<your-production-domain>/*`
     - `https://*.run.app/*`
     - `http://localhost:3000/*`
  4. Under **API restrictions**, restrict the key to:
     - **Identity Toolkit API**
     - **Token Service API**
     - **Cloud Firestore API**
     - **Firebase Installations API**

---

## 3. Enabling Firebase App Check (Instructions Only)

Firebase App Check helps ensure that incoming traffic to Cloud Firestore, Firebase Authentication, and your `/api/gemini/*` backend originates exclusively from your authentic FocusFlow web app using **reCAPTCHA Enterprise** or **reCAPTCHA v3**:

1. **Register reCAPTCHA v3 / Enterprise**:
   - Visit the [Google reCAPTCHA Admin Console](https://www.google.com/recaptcha/admin) and register a v3 site key for your production domain, or enable **reCAPTCHA Enterprise** in Google Cloud Console.
2. **Configure App Check in Firebase Console**:
   - Open **Firebase Console** → **Build** → **App Check**.
   - Click **Apps**, select the FocusFlow Web App, and register your reCAPTCHA site key / secret key.
   - Set a token TTL (recommended: `1 hour`).
3. **Initialize App Check in the Client (when ready to enable)**:
   ```ts
   import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

   initializeAppCheck(app, {
     provider: new ReCaptchaV3Provider(import.meta.env.VITE_RECAPTCHA_SITE_KEY),
     isTokenAutoRefreshEnabled: true,
   });
   ```
4. **Enforce App Check**:
   - In **Firebase Console** → **App Check** → **APIs**, monitor metrics first in **Unenforced** mode to confirm legitimate traffic is attested.
   - Once verified, click **Enforce** for **Cloud Firestore** and **Firebase Authentication**.

---

## 4. Admin Role Management (Console-Only)

- **Zero Hardcoded Credentials or Roles**: No admin email, password, or UID is hardcoded anywhere in the application or `firestore.rules`.
- **Client Role Immutability**:
  - New accounts created via `users/{uid}` are strictly required by `firestore.rules` to have `role == 'user'`.
  - Updates to `users/{uid}` enforce `incoming().role == existing().role`, preventing any user from escalating their own role from the client.
- **Granting or Revoking Admin Access**:
  1. Open **Firebase Console** → **Firestore Database** → **Data**.
  2. Navigate to `users/{uid}` for the target administrator account.
  3. Manually edit the `role` field from `"user"` to `"admin"` (or back to `"user"` to revoke).

---

## 5. How to Rotate Keys

If an API key is ever suspected of exposure or scheduled for routine rotation:

### Rotating `GEMINI_API_KEY`
1. Open **Google Cloud Console** → **APIs & Services** → **Credentials**.
2. Click **+ Create Credentials** → **API key**, and apply the **Generative Language API** restriction immediately.
3. Update the `GEMINI_API_KEY` environment secret in AI Studio (**Settings → Secrets** or Cloud Run environment variables) with the new key value.
4. Restart the server and verify `/api/gemini/*` functionality.
5. Return to **Google Cloud Console** → **Credentials** and **Delete** the old API key.

### Rotating the Firebase Web API Key
1. In **Google Cloud Console** → **APIs & Services** → **Credentials**, create a new Browser API key and apply the HTTP referrer and API restrictions listed in Section 2B.
2. Update `apiKey` in `firebase-applet-config.json` and redeploy the web application.
3. After confirming authentication and Firestore connectivity with the new key, delete the previous Browser API key in Google Cloud Console.
