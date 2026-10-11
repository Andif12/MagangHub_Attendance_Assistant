async function findApiV1Attendances() {
  const mainBundle = await (await fetch('https://monev.maganghub.kemnaker.go.id/_nuxt/DhS2JSVw.js')).text();
  const chunkRegex = /import\(`\.\/([^`]+)`\)/g;
  const chunks = new Set();
  let m;
  while ((m = chunkRegex.exec(mainBundle)) !== null) {
    chunks.add(m[1]);
  }

  // Also add imported files in DW9
  const dw9 = await (await fetch('https://monev.maganghub.kemnaker.go.id/_nuxt/DW9cM_l_2.js')).text();
  const depRegex = /from"\.\/([^"]+)"/g;
  while ((m = depRegex.exec(dw9)) !== null) {
    chunks.add(m[1]);
  }

  console.log('Searching', chunks.size, 'files for api/v1/attendances...');

  for (const f of chunks) {
    try {
      const text = await (await fetch('https://monev.maganghub.kemnaker.go.id/_nuxt/' + f)).text();
      if (text.includes('/attendances')) {
        console.log(`\nFile ${f} contains /attendances:`);
        const idx = text.indexOf('/attendances');
        console.log(text.slice(Math.max(0, idx - 100), idx + 200));
      }
    } catch {}
  }
}

findApiV1Attendances().catch(console.error);
