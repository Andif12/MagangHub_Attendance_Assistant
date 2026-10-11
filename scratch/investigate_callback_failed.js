async function inspect() {
  const res = await fetch('https://monev.maganghub.kemnaker.go.id/sso/callback');
  console.log('HTTP Status for /sso/callback without params:', res.status);
  const html = await res.text();
  console.log('HTML snippet:', html.slice(0, 300));

  const scriptMatches = html.match(/src="([^"]+)"/g) || [];
  console.log('Scripts loaded on callback page:');
  const scriptUrls = scriptMatches.map(s => s.replace('src="', '').replace('"', ''));
  console.log(scriptUrls);

  for (const sUrl of scriptUrls) {
    const fullUrl = sUrl.startsWith('http') ? sUrl : 'https://monev.maganghub.kemnaker.go.id' + sUrl;
    try {
      const sRes = await fetch(fullUrl);
      const sText = await sRes.text();
      if (sText.includes('callback_failed') || sText.includes('login-error')) {
        console.log(`\n*** FOUND in ${fullUrl} ***`);
        const idx = sText.indexOf('callback_failed');
        console.log(sText.slice(Math.max(0, idx - 300), idx + 400));
      }
    } catch(e) {
      console.warn('Err fetching', fullUrl, e.message);
    }
  }
}

inspect();
