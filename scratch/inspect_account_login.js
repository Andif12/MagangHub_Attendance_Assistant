async function inspectLoginForm() {
  const res = await fetch('https://account.kemnaker.go.id/auth/login');
  const html = await res.text();
  console.log('HTML length:', html.length);
  const forms = [...html.matchAll(/<form[^>]*>/gi)].map(m => m[0]);
  console.log('Forms:', forms);
  const inputs = [...html.matchAll(/<input[^>]*name=["']([^"']+)["'][^>]*>/gi)].map(m => m[1]);
  console.log('Inputs:', inputs);
  const scripts = [...html.matchAll(/<script[^>]*src=["']([^"']+)["'][^>]*>/gi)].map(m => m[1]);
  console.log('Scripts:', scripts);
}
inspectLoginForm().catch(console.error);
