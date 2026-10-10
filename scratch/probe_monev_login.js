const fs = require('fs');

async function probe() {
  const res = await fetch('https://monev.maganghub.kemnaker.go.id/login', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
  });

  const html = await res.text();
  console.log('Status:', res.status);
  console.log('HTML length:', html.length);
  fs.writeFileSync('scratch/login_page.html', html, 'utf8');

  // find script tags
  const scripts = [...html.matchAll(/<script[^>]*src=["']([^"']+)["']/gi)].map(m => m[1]);
  console.log('Scripts found:', scripts);

  // find form action
  const forms = [...html.matchAll(/<form[^>]*action=["']([^"']+)["']/gi)].map(m => m[1]);
  console.log('Forms found:', forms);

  // search for api endpoints or auth URLs in HTML
  const apiMatches = html.match(/(https?:\/\/[^\s"'<>]+|api\/[^\s"'<>]+|\/v1\/[^\s"'<>]+)/gi) || [];
  console.log('API / URL references:', [...new Set(apiMatches)].slice(0, 20));
}

probe().catch(console.error);
