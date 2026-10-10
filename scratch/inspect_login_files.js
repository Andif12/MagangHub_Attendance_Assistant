async function inspectSpecific() {
  const files = ['/Brx9h7wV.js', '/CBnnDaXw.js', '/CELGOXXW.js', '/D9dkQe2b.js'];
  for (const f of files) {
    const res = await fetch('https://monev.maganghub.kemnaker.go.id/_nuxt' + f);
    const text = await res.text();
    console.log(`\n=================== FILE: ${f} (${text.length} bytes) ===================`);
    console.log(text.slice(0, 3000));
  }
}

inspectSpecific().catch(console.error);
