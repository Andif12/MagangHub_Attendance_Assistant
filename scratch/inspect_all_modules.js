const fs = require('fs');

async function inspectAllModules() {
  const html = fs.readFileSync('scratch/login_page.html', 'utf8');
  const links = [...html.matchAll(/href=["'](\/_nuxt\/[a-zA-Z0-9_\-\.]+\.js)["']/g)].map(m => m[1]);
  console.log('Total preload scripts:', links.length);

  for (const jsPath of links) {
    const url = 'https://monev.maganghub.kemnaker.go.id' + jsPath;
    try {
      const res = await fetch(url);
      const text = await res.text();
      
      const containsAccount = text.includes('account.kemnaker.go.id') || text.includes('/auth') || text.includes('kemnaker');
      const containsLogin = text.includes('/login') || text.includes('callback') || text.includes('client_id');
      
      if (containsAccount || containsLogin) {
        console.log('\n=== MATCH FOUND IN:', jsPath, '===');
        // Extract lines or chunks mentioning account.kemnaker.go.id or callback
        const lines = text.split(/[;\{\}]/);
        for (const line of lines) {
          if (line.includes('account.kemnaker.go.id') || line.includes('/authenticate') || line.includes('sso') || line.includes('/login')) {
            if (line.trim().length > 10 && line.trim().length < 500) {
              console.log('  ->', line.trim());
            }
          }
        }
      }
    } catch (e) {
      console.error('Error:', jsPath, e.message);
    }
  }
}

inspectAllModules().catch(console.error);
