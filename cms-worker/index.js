/**
 * cms-auth — Cloudflare Worker
 * GitHub OAuth proxy for Decap CMS.
 *
 * This Worker handles two endpoints:
 *   GET /auth        — redirects the user to GitHub's OAuth login page
 *   GET /callback    — GitHub redirects here after login; this exchanges
 *                      the code for a token and posts it back to Decap CMS
 *                      via window.postMessage so the admin UI can proceed.
 *
 * Environment variables (set in Cloudflare Workers dashboard under
 * Settings → Variables and Secrets — mark both as Secret):
 *   GITHUB_CLIENT_ID      — from your GitHub OAuth App
 *   GITHUB_CLIENT_SECRET  — from your GitHub OAuth App
 */

const ALLOWED_ORIGINS = [
  'https://isrwithdaphne.com',
  'https://www.isrwithdaphne.com',
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ── /auth ──────────────────────────────────────────────────
    // Step 1: send the user to GitHub to approve access
    if (url.pathname === '/auth') {
      const params = new URLSearchParams({
        client_id: env.GITHUB_CLIENT_ID,
        scope: 'repo,user',
        redirect_uri: `${url.origin}/callback`,
      });
      return Response.redirect(
        `https://github.com/login/oauth/authorize?${params}`,
        302
      );
    }

    // ── /callback ──────────────────────────────────────────────
    // Step 2: GitHub sends the user back here with a short-lived code.
    // Exchange it for a real access token, then post it back to the
    // Decap CMS window via postMessage so it can make GitHub API calls.
    if (url.pathname === '/callback') {
      const code = url.searchParams.get('code');
      if (!code) {
        return new Response('Missing code parameter', { status: 400 });
      }

      // Exchange the code for a token
      const tokenRes = await fetch(
        'https://github.com/login/oauth/access_token',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            client_id: env.GITHUB_CLIENT_ID,
            client_secret: env.GITHUB_CLIENT_SECRET,
            code,
            redirect_uri: `${url.origin}/callback`,
          }),
        }
      );

      const tokenData = await tokenRes.json();

      if (tokenData.error) {
        return new Response(`GitHub OAuth error: ${tokenData.error_description}`, {
          status: 400,
        });
      }

      const token = tokenData.access_token;
      const provider = 'github';

      // Decap CMS listens for a postMessage from the OAuth popup.
      // This page closes itself after sending the token.
      const html = `<!DOCTYPE html>
<html>
<head><title>Authenticating...</title></head>
<body>
<p>Authenticating, please wait...</p>
<script>
  (function () {
    function receiveMessage(e) {
      console.log('cms-auth: received message from', e.origin);
    }
    window.addEventListener('message', receiveMessage, false);

    // Send the token back to the Decap CMS opener window
    const token = ${JSON.stringify(token)};
    const provider = ${JSON.stringify(provider)};
    const message = 'authorization:' + provider + ':success:' + JSON.stringify({ token, provider });

    // Try to find the opener — works for popup flow
    if (window.opener) {
      window.opener.postMessage(message, '*');
      window.close();
    } else {
      // Fallback: redirect back with token in hash (implicit flow)
      document.body.innerHTML = '<p>Authentication complete. You can close this window.</p>';
    }
  })();
</script>
</body>
</html>`;

      return new Response(html, {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    // Health check
    if (url.pathname === '/') {
      return new Response('cms-auth worker is running 👋', { status: 200 });
    }

    return new Response('Not found', { status: 404 });
  },
};
