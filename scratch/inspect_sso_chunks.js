const fs = require('fs');

async function inspectChunks() {
  const c1 = await (await fetch('https://monev.maganghub.kemnaker.go.id/_nuxt/CELGOXXW.js')).text();
  console.log('=== CELGOXXW.js (sso/callback) ===');
  console.log(c1);

  const c2 = await (await fetch('https://monev.maganghub.kemnaker.go.id/_nuxt/D9dkQe2b.js')).text();
  console.log('\n=== D9dkQe2b.js (authenticate/login/callback) ===');
  console.log(c2);
}

inspectChunks().catch(console.error);
