async function inspectKemnaker() {
  const loginRes = await fetch('https://account.kemnaker.go.id/auth/login');
  const html = await loginRes.text();
  const scriptSrcs = [...html.matchAll(/src=["']([^"']+)["']/g)].map(m => m[1]);
  console.log('Scripts:', scriptSrcs);
  for (const src of scriptSrcs) {
    if (src.includes('auth') || src.includes('app') || src.includes('manifest') || src.includes('vendor')) {
      const fullUrl = src.startsWith('http') ? src : 'https://account.kemnaker.go.id' + src;
      const sRes = await fetch(fullUrl);
      const text = await sRes.text();
      console.log('Script', src, 'length:', text.length);
      const posts = [...text.matchAll(/(\/auth\/[a-zA-Z0-9_\-]+|\/api\/[a-zA-Z0-9_\-]+)/g)].map(m => m[0]);
      console.log('Endpoints in', src, ':', [...new Set(posts)].slice(0, 20));
    }
  }
}
inspectKemnaker().catch(console.error);
