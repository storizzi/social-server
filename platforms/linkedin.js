const express = require('express');
const axios = require('axios');

module.exports = function(context) {
    const router = express.Router();
    const { resolveAccount, saveSession, getSession } = context;

    // --- ROUTE 1: Login ---
    router.get('/login', async (req, res) => {
        const { authtoken } = req.query;

        try {
            const account = await resolveAccount(authtoken);

            const params = new URLSearchParams({
                response_type: 'code',
                client_id: account.clientId,
                redirect_uri: account.redirectUri,
                state: authtoken,
                scope: account.scopes.join(' ')
            });

            res.redirect(`https://www.linkedin.com/oauth/v2/authorization?${params.toString()}&prompt=consent`);
        } catch (err) {
            res.status(403).send(err.message);
        }
    });

    // --- ROUTE 2: Callback ---
    router.get('/callback', async (req, res) => {
        const { code, state, error } = req.query;
        const authtoken = state; 

        if (error) return res.send(`LinkedIn Error: ${error}`);

        try {
            const account = await resolveAccount(authtoken);

            // 1. Exchange Code for Token
            const tokenResp = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: account.redirectUri,
                client_id: account.clientId,
                client_secret: account.clientSecret
            }), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            const grantedScopes = tokenResp.data.scope;
            console.log(`\n🔍 Scopes Granted: [${grantedScopes}]`);

            let sessionData = {};

            // --- STRATEGY A: OpenID is working ---
            if (grantedScopes.includes('openid')) {
                console.log('✅ OpenID present. Fetching profile...');
                const userInfoResp = await axios.get('https://api.linkedin.com/v2/userinfo', {
                    headers: { 'Authorization': `Bearer ${tokenResp.data.access_token}` }
                });

                sessionData = {
                    lastUpdated: new Date().toISOString(),
                    userUrn: `urn:li:person:${userInfoResp.data.sub}`,
                    name: userInfoResp.data.name,
                    ...tokenResp.data
                };
            } 
            // --- STRATEGY B: Manual Bypass (Your situation) ---
            else if (grantedScopes.includes('w_member_social') && account.manualUrn) {
                console.warn('⚠️ OpenID missing, but Manual URN found. Using Bypass Mode.');
                
                sessionData = {
                    lastUpdated: new Date().toISOString(),
                    userUrn: account.manualUrn, // Uses the ID from accounts.json
                    name: "Manual Bypass User",
                    ...tokenResp.data
                };
            } 
            // --- FAILURE ---
            else {
                throw new Error(`CRITICAL: Missing 'openid' and no 'manualUrn' found in config. Cannot identify user.`);
            }

            // 2. Save Session
            await saveSession(account.id, sessionData);
            res.send(`<h1>✅ Connected!</h1><p>Mode: ${sessionData.name}</p><p>You can now use the Post endpoint.</p>`);

        } catch (err) {
            console.error('[Auth Error]', err.message);
            res.status(500).send(`Error: ${err.message}`);
        }
    });

// --- ROUTE 3: Post ---
    // Usage: POST /api/linkedin/post?authtoken=sk_...&dryrun=true
    router.post('/post', async (req, res) => {
        const { authtoken, dryrun } = req.query; // Check for dryrun flag
        const { text, url } = req.body;

        try {
            // 1. Validate Account & Token (This checks if Auth is working)
            const account = await resolveAccount(authtoken);
            const session = await getSession(account.id);

            // 2. Construct the Body (To ensure your data structure is valid)
            const postBody = {
                author: session.userUrn,
                lifecycleState: "PUBLISHED",
                specificContent: {
                    "com.linkedin.ugc.ShareContent": {
                        shareCommentary: { text },
                        shareMediaCategory: url ? "ARTICLE" : "NONE",
                        media: url ? [{ status: "READY", originalUrl: url }] : undefined
                    }
                },
                visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" }
            };

            // 3. DRY RUN CHECK
            if (dryrun === 'true') {
                console.log(`[Dry Run] Validation Successful for ${account.name}`);
                console.log(`[Dry Run] Would have posted to URN: ${session.userUrn}`);
                console.log(`[Dry Run] Payload:`, JSON.stringify(postBody, null, 2));
                
                return res.json({ 
                    success: true, 
                    mode: "dry-run", 
                    message: "Token is valid and payload is ready. No post was sent to LinkedIn." 
                });
            }

            // 4. Actual Send (Only happens if dryrun is NOT true)
            const resp = await axios.post('https://api.linkedin.com/v2/ugcPosts', postBody, {
                headers: { 
                    'Authorization': `Bearer ${session.access_token}`,
                    'X-Restli-Protocol-Version': '2.0.0'
                }
            });

            res.json({ success: true, id: resp.data.id });

        } catch (err) {
            res.status(500).json({ error: err.response?.data || err.message });
        }
    });

    return router;
};