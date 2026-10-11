async function searchExportInBundle() {
  const mainBundle = await (await fetch('https://monev.maganghub.kemnaker.go.id/_nuxt/DhS2JSVw.js')).text();

  const chunkRegex = /import\(`\.\/([^`]+)`\)/g;
  const chunks = new Set();
  let m;
  while ((m = chunkRegex.exec(mainBundle)) !== null) {
    chunks.add(m[1]);
  }
  console.log('Total chunks found in main bundle:', chunks.size);
  console.log('Chunks:', Array.from(chunks));

  for (const chunk of chunks) {
    try {
      const code = await (await fetch('https://monev.maganghub.kemnaker.go.id/_nuxt/' + chunk)).text();
      const lower = code.toLowerCase();

      // Check export or download or rekap
      if (lower.includes('export') || lower.includes('unduh') || lower.includes('download') || lower.includes('cetak') || lower.includes('rekap') || lower.includes('.xlsx') || lower.includes('.csv') || lower.includes('.pdf')) {
        console.log(`\n=== Chunk ${chunk} contains export/download keywords ===`);
        const matches = code.match(/[^;]{0,80}(?:export|unduh|download|rekap|cetak|xlsx|csv|pdf)[^;]{0,80}/gi) || [];
        for (const snippet of matches.slice(0, 5)) {
          console.log('  Snippet:', snippet.trim());
        }
      }

      if (lower.includes('attendance') || lower.includes('presensi')) {
        const apiMatches = code.match(/["'`]((\/api|\/v1)[^"'`\s]+)["'`]/g) || [];
        if (apiMatches.length > 0) {
          console.log(`Chunk ${chunk} has APIs:`, [...new Set(apiMatches)]);
        }
      }
    } catch (e) {
      console.warn('Err fetching', chunk, e.message);
    }
  }
}

searchExportInBundle().catch(console.error);
