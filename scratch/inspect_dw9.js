async function test() {
  const code = await (await fetch('https://monev.maganghub.kemnaker.go.id/_nuxt/DW9cM_l_2.js')).text();
  const imports = code.match(/import\{[^}]+\}from"[^"]+"/g) || [];
  console.log('Imports in DW9cM_l_2.js:');
  for (const imp of imports) {
    console.log(' -', imp);
  }
}
test().catch(console.error);
