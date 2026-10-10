const fs = require('fs');

async function inspectMainBundle() {
  const sRes = await fetch('https://monev.maganghub.kemnaker.go.id/_nuxt/DhS2JSVw.js');
  const code = await sRes.text();
  console.log('Main bundle size:', code.length);

  // Search for all occurrences of "callback"
  let pos = 0;
  while ((pos = code.indexOf('callback', pos)) !== -1) {
    console.log('\n--- MATCH AT', pos, '---');
    console.log(code.slice(Math.max(0, pos - 150), pos + 250));
    pos += 8;
  }
}

inspectMainBundle().catch(console.error);
