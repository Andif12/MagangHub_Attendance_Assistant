const fs = require('fs');

async function test() {
  const html = fs.readFileSync('scratch/login_page.html', 'utf8');
  const links = [...html.matchAll(/href=["'](\/_nuxt\/[a-zA-Z0-9_\-\.]+\.js)["']/g)].map(m => m[1]);
  
  for (const jsPath of links) {
    try {
      const res = await fetch('https://monev.maganghub.kemnaker.go.id' + jsPath);
      const text = await res.text();
      if (text.includes('attendances') || text.includes('participant') || text.includes('/me') || text.includes('/user')) {
        console.log('\nFound attendance/user references in:', jsPath);
        const matches = text.match(/["'](\/[a-zA-Z0-9_\-\/]+attendances[a-zA-Z0-9_\-\/]*)["']/g) || [];
        console.log('Attendance paths:', [...new Set(matches)]);
        const userMatches = text.match(/["'](\/[a-zA-Z0-9_\-\/]+(?:user|profile|participant|me)[a-zA-Z0-9_\-\/]*)["']/g) || [];
        console.log('User paths:', [...new Set(userMatches)].slice(0, 10));
      }
    } catch {}
  }
}
test();
