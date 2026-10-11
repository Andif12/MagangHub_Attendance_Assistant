async function findAttendancesInAllChunks() {
  const mainBundle = await (await fetch('https://monev.maganghub.kemnaker.go.id/_nuxt/DhS2JSVw.js')).text();
  const chunkRegex = /import\(`\.\/([^`]+)`\)/g;
  const chunks = new Set();
  let m;
  while ((m = chunkRegex.exec(mainBundle)) !== null) {
    chunks.add(m[1]);
  }

  for (const chunk of chunks) {
    const code = await (await fetch('https://monev.maganghub.kemnaker.go.id/_nuxt/' + chunk)).text();
    if (code.includes('attendances') || code.includes('/attendances')) {
      console.log(`\n=== Chunk ${chunk} calls attendances ===`);
      const matches = code.match(/[^;]{0,100}attendances[^;]{0,100}/g) || [];
      for (const s of matches.slice(0, 5)) {
        console.log('Snippet:', s.trim());
      }
    }
  }
}

findAttendancesInAllChunks().catch(console.error);
