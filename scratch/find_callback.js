const fs = require('fs');

async function findCallbackJs() {
  const res = await fetch('https://monev.maganghub.kemnaker.go.id/sso/callback');
  const html = await res.text();
  const scriptRegex = /src=["'](\/_nuxt\/[^"']+\.js)["']/g;
  const scripts = [];
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    scripts.push(match[1]);
  }
  console.log('Scripts found:', scripts.length);

  for (const s of scripts) {
    const sRes = await fetch('https://monev.maganghub.kemnaker.go.id' + s);
    const code = await sRes.text();
    if (code.includes('sso/callback') || code.includes('callback') || code.includes('/api/v1/auth/callback') || code.includes('/auth/callback')) {
      console.log('Script', s, 'matches!');
      const idx = code.indexOf('callback');
      console.log('Snippet around callback:\n', code.slice(Math.max(0, idx - 150), idx + 250));
    }
  }
}

findCallbackJs().catch(console.error);
