const fs = require('fs');

async function main() {
  const html = fs.readFileSync('scratch/login_page.html', 'utf8');
  const links = [...html.matchAll(/href=["'](\/_nuxt\/[a-zA-Z0-9_\-\.]+\.js)["']/g)].map(m => m[1]);
  for (const js of links) {
    try {
      const res = await fetch('https://monev.maganghub.kemnaker.go.id' + js);
      const text = await res.text();
      if (text.includes('loadUser:')) {
        console.log('loadUser: found in', js);
        const idx = text.indexOf('loadUser:');
        console.log(text.slice(idx - 50, idx + 350));
      }
    } catch {}
  }
}
main();
