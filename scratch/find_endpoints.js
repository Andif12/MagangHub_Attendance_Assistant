const fs = require('fs');

async function test() {
  const html = fs.readFileSync('scratch/login_page.html', 'utf8');
  const links = [...html.matchAll(/href=["'](\/_nuxt\/[a-zA-Z0-9_\-\.]+\.js)["']/g)].map(m => m[1]);
  
  const allEndpoints = new Set();
  for (const jsPath of links) {
    try {
      const res = await fetch('https://monev.maganghub.kemnaker.go.id' + jsPath);
      const text = await res.text();
      const matches = text.match(/(\/api\/v1\/[a-zA-Z0-9_\-\/\.]+|\/auth\/[a-zA-Z0-9_\-\/\.]+)/g) || [];
      for (const m of matches) allEndpoints.add(m);
    } catch {}
  }
  console.log('Discovered endpoints:');
  console.log([...allEndpoints].sort());
}
test();
