const fs = require('fs');

async function inspectNuxtBundle() {
  const html = fs.readFileSync('scratch/login_page.html', 'utf8');
  console.log('--- HTML content snippet: ---');
  console.log(html.slice(0, 1500));

  // Find all script links in html
  const scriptRegex = /src=["'](\/_nuxt\/[^"']+)["']/g;
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    const scriptPath = match[1];
    const scriptUrl = 'https://monev.maganghub.kemnaker.go.id' + scriptPath;
    console.log('Downloading script:', scriptUrl);
    try {
      const res = await fetch(scriptUrl);
      const text = await res.text();
      console.log('Downloaded length:', text.length);

      // Search for login, auth, kemnaker, attendances, token
      const authOccurrences = [...text.matchAll(/(account\.kemnaker\.go\.id[^\s"'\)]*|auth[^\s"'\)]*|login[^\s"'\)]*|api\/v1\/[^\s"'\)]*)/gi)]
        .map(m => m[0]);
      console.log('Auth references in', scriptPath, ':', [...new Set(authOccurrences)].slice(0, 30));

      // Look for OAuth params: client_id, redirect_uri, response_type, etc.
      const oauthMatches = [...text.matchAll(/(client_id|redirect_uri|response_type|grant_type|scope|code)/gi)].map(m => m[0]);
      console.log('OAuth keywords count in', scriptPath, ':', oauthMatches.length);
    } catch (e) {
      console.error('Error fetching script:', e.message);
    }
  }
}

inspectNuxtBundle().catch(console.error);
