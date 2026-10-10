async function inspectAuthJs() {
  const res = await fetch('https://account.kemnaker.go.id/js/auth.js?id=a0f77810056db8fc029c');
  const code = await res.text();
  console.log('auth.js length:', code.length);
  // Find axios or fetch or endpoints
  const endpoints = [...code.matchAll(/(\/auth\/[a-zA-Z0-9_\-\/]+|\/api\/[a-zA-Z0-9_\-\/]+)/g)].map(m => m[0]);
  console.log('Endpoints found in auth.js:', [...new Set(endpoints)]);
}
inspectAuthJs().catch(console.error);
