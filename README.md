# Social Media Unified API Server

**Repository:** [https://github.com/storizzi/social-server](https://github.com/storizzi/social-server)

A lightweight, self-hosted Node.js server for managing social media accounts via a unified API. It currently supports **LinkedIn** (Profile & Company Pages) with an extensible architecture for adding other platforms (Twitter/X, etc.).

It handles OAuth2 authentication flows, token management, and posting, allowing you to interact with your social accounts using simple HTTP requests protected by your own secret tokens.

**License:** MIT

---

## 🚀 Features

* **Self-Hosted:** You own your data and tokens.
* **Multi-Account:** Manage multiple LinkedIn profiles or company pages.
* **Secure:** Uses internal "Secret Tokens" (API Keys) to map requests to specific social accounts.
* **Token Rotation:** API endpoint to rotate your secret keys without restarting the server.
* **Dry Run Mode:** Test your connectivity without actually posting content.
* **Manual URN Bypass:** Built-in fallback for LinkedIn's strict OpenID permissions.

---

## 🛠️ Installation

### 1. Prerequisites
* Node.js (v14 or higher)
* npm

### 2. Setup
Clone the repository and install dependencies:

```bash
git clone [https://github.com/storizzi/social-server.git](https://github.com/storizzi/social-server.git)
cd social-server
npm install express axios fs-extra dotenv body-parser
```

### 3. Configuration
Create a `.env` file in the root directory:

```ini
PORT=8277
DATA_DIR=./data
```

Create an `accounts.json` file in the root directory (see "Configuration Reference" below for details).

---

## 🔑 LinkedIn Developer Setup (Required)

To use this server, you must create an App on the LinkedIn Developer Portal.

### Step 1: Create the App
1.  Go to [LinkedIn Developers](https://www.linkedin.com/developers/apps).
2.  Click **Create App**.
3.  Fill in the details (App Name, LinkedIn Page, Logo).
4.  If you don't have a Company Page, create a dummy one to link it.

### Step 2: Request Products (Permissions)
**Crucial Step:** You must explicitly add "Products" to your app to get API access.
1.  Click the **Products** tab.
2.  Request/Add **"Share on LinkedIn"** (Gives `w_member_social`).
3.  Request/Add **"Sign In with LinkedIn using OpenID Connect"** (Gives `openid`, `profile`, `email`).
    * *Note: If your application is new, LinkedIn might only grant the "Share" product immediately. This server supports a "Manual Bypass" mode if OpenID is denied.*

### Step 3: Get Credentials
1.  Go to the **Auth** tab.
2.  Copy the **Client ID** and **Client Secret**.
3.  Under **"OAuth 2.0 settings"**, add your Redirect URI:
    `http://localhost:8277/api/linkedin/callback`

### Step 4: Find Your User ID (Manual URN)
If your app cannot fetch your profile automatically (common with new apps), you need your manual ID.
1.  Open your LinkedIn Profile in a browser.
2.  Right-click the page background -> **View Page Source**.
3.  Search (`Ctrl+F` or `Cmd+F`) for: `urn:li:fsd_profile`
4.  Copy the ID part (e.g., `ACoAAABclcIB...`).
5.  Add this to your `accounts.json` as `"manualUrn": "urn:li:person:YOUR_ID"`.

---

## ⚙️ Configuration Reference (`accounts.json`)

Create `accounts.json` in the root. You can have multiple objects in the array.

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "secretToken": "my-secret-key-001",
    "name": "My Personal LinkedIn",
    "platform": "linkedin",
    "clientId": "YOUR_LINKEDIN_CLIENT_ID",
    "clientSecret": "YOUR_LINKEDIN_CLIENT_SECRET",
    "redirectUri": "http://localhost:8277/api/linkedin/callback",
    "manualUrn": "urn:li:person:ACoAAABxyzDEFghijKLMNOpqrstuvwxyZ",
    "scopes": [
      "openid",
      "profile",
      "email",
      "w_member_social"
    ]
  }
]
```

* **id:** A unique GUID (generate one online). Used to name the session file.
* **secretToken:** The key you use in API requests (like a password).
* **manualUrn:** (Optional but recommended) Your LinkedIn ID found in Step 4 above.

---

## 🏃 Usage

### 1. Start the Server
```bash
node server.js
```

### 2. Connect Your Account
Open your browser and visit:
`http://localhost:8277/api/linkedin/login?authtoken=my-secret-key-001`

Follow the LinkedIn prompts. When finished, you will see a **"Connected!"** message.

### 3. Post to LinkedIn
You can now send posts using your `secretToken`.

**Example (Curl):**
```bash
curl -X POST "http://localhost:8277/api/linkedin/post?authtoken=my-secret-key-001" \
     -H "Content-Type: application/json" \
     -d '{
           "text": "Hello world from my API!",
           "url": "[https://example.com](https://example.com)"
         }'
```

### 4. Dry Run (Test Mode)
To test your token without actually posting publicly, add `&dryrun=true`.

```bash
curl -X POST "http://localhost:8277/api/linkedin/post?authtoken=my-secret-key-001&dryrun=true" \
     -H "Content-Type: application/json" \
     -d '{ "text": "Test" }'
```

---

## 🛡️ Management API

### Rotate Secret Token
If a token is leaked or you want to change it, use this endpoint. It updates `accounts.json` instantly.

```bash
curl -X POST http://localhost:8277/api/management/update-token \
     -H "Content-Type: application/json" \
     -d '{
           "currentToken": "my-secret-key-001",
           "newToken": "new-secure-key-999"
         }'
```

## 📢 Meta: Announce This Project

Want to announce that you are using this tool by posting about it *using* the tool itself? Run this command (replace `YOUR_TOKEN` with your actual secret):

```bash
curl -X POST "http://localhost:8277/api/linkedin/post?authtoken=YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
           "text": "🚀 Just spun up my own open-source Social Media API Server! It handles OAuth and posting for LinkedIn (with more platforms coming). Self-hosted and fully controllable. Check out the code here:",
           "url": "[https://github.com/storizzi/social-server](https://github.com/storizzi/social-server)"
         }'
```

## Releases

### 0.1.0 - Initial Release

- Added LinkedIn OAuth and posting functionality
- Added management API for token rotation
- Added dry-run mode for testing of LinkedIn post

---

## 📄 License

**MIT License**

Copyright (c) 2024 Storizzi

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.