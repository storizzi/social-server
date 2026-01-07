require('dotenv').config();
const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 8277;
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const ACCOUNTS_FILE = path.join(process.cwd(), 'accounts.json');

app.use(bodyParser.json());
fs.ensureDirSync(DATA_DIR);

// --- 1. SHARED HELPERS ---

// Resolve Account by Secret Token
async function resolveAccount(authtoken) {
    if (!authtoken) throw new Error("Missing 'authtoken' parameter.");
    if (!fs.existsSync(ACCOUNTS_FILE)) throw new Error("accounts.json missing");
    
    const accounts = await fs.readJson(ACCOUNTS_FILE);
    const account = accounts.find(acc => acc.secretToken === authtoken);
    
    if (!account) throw new Error("Invalid Auth Token. No matching account found.");
    return account;
}

// Session Storage (Using stable ID)
async function saveSession(accountId, data) {
    const filePath = path.join(DATA_DIR, `${accountId}.json`);
    await fs.writeJson(filePath, data, { spaces: 2 });
}

async function getSession(accountId) {
    const filePath = path.join(DATA_DIR, `${accountId}.json`);
    if (!fs.existsSync(filePath)) throw new Error(`Not authenticated. Please login first.`);
    return await fs.readJson(filePath);
}

const context = { resolveAccount, saveSession, getSession };

// --- 2. GENERIC MANAGEMENT ENDPOINTS ---

/**
 * ROTATE TOKEN
 * Usage: POST /api/management/update-token
 * Body: { "currentToken": "sk_live_old...", "newToken": "sk_live_new..." }
 */
app.post('/api/management/update-token', async (req, res) => {
    const { currentToken, newToken } = req.body;

    if (!currentToken || !newToken) {
        return res.status(400).json({ error: "Missing 'currentToken' or 'newToken'" });
    }

    try {
        // 1. Read the full config file
        if (!fs.existsSync(ACCOUNTS_FILE)) throw new Error("accounts.json not found");
        const accounts = await fs.readJson(ACCOUNTS_FILE);

        // 2. Find the account index matching the existing token
        const index = accounts.findIndex(acc => acc.secretToken === currentToken);

        if (index === -1) {
            return res.status(403).json({ error: "Access Denied: Current token is invalid." });
        }

        // 3. Safety Check: Ensure new token isn't already used by another account
        const duplicateCheck = accounts.find(acc => acc.secretToken === newToken);
        if (duplicateCheck) {
            return res.status(409).json({ error: "Conflict: The 'newToken' is already in use by another account." });
        }

        // 4. Update the token
        accounts[index].secretToken = newToken;

        // 5. Write back to disk
        await fs.writeJson(ACCOUNTS_FILE, accounts, { spaces: 2 });

        console.log(`♻️  Token rotated for account: ${accounts[index].name} (ID: ${accounts[index].id})`);

        res.json({
            success: true,
            message: "Token updated successfully.",
            accountId: accounts[index].id,
            accountName: accounts[index].name
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Update failed", details: err.message });
    }
});

// --- 3. DYNAMIC PLATFORM LOADER ---

async function mountPlatforms() {
    const platformsDir = path.join(__dirname, 'platforms');
    if (!fs.existsSync(platformsDir)) return;

    const files = fs.readdirSync(platformsDir);

    files.forEach(file => {
        if (!file.endsWith('.js')) return;
        const platformName = file.replace('.js', '');
        
        try {
            const routerFactory = require(path.join(platformsDir, file));
            const router = routerFactory(context);
            app.use(`/api/${platformName}`, router);
            console.log(`✅ Platform mounted: /api/${platformName}`);
        } catch (e) {
            console.error(`❌ Failed to load ${file}:`, e.message);
        }
    });
}

// Start
mountPlatforms().then(() => {
    app.listen(PORT, () => {
        console.log(`\n🚀 Server running on port ${PORT}`);
        console.log(`📂 Configuration: ${ACCOUNTS_FILE}`);
        console.log(`🔒 Management: POST /api/management/update-token`);
    });
});