const fs = require('fs');

async function main() {
  const html = fs.readFileSync('scratch/login_page.html', 'utf8');
  const links = [...html.matchAll(/href=["'](\/_nuxt\/[a-zA-Z0-9_\-\.]+\.js)["']/g)].map(m => m[1]);
  for (const js of links) {
    try {
      const res = await fetch('https://monev.maganghub.kemnaker.go.id' + js);
      const text = await res.text();
      if (text.includes('attendances')) {
        console.log('attendances in', js);
        let idx = 0;
        while ((idx = text.indexOf('attendances', idx)) !== -1) {
          console.log(text.slice(Math.max(0, idx - 100), idx + 200));
          idx += 11;
        }
      }
    } catch {}
  }
}
main();
