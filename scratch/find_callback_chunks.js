const fs = require('fs');

async function findChunks() {
  const sRes = await fetch('https://monev.maganghub.kemnaker.go.id/_nuxt/DhS2JSVw.js');
  const code = await sRes.text();
  
  // Find all chunk URLs matching /_nuxt/*.js
  const chunkMatches = code.match(/["'](\/?_nuxt\/[^"']+\.js)["']/g) || [];
  console.log('Chunk matches:', chunkMatches.length);
  const cleanChunks = [...new Set(chunkMatches.map(m => m.replace(/["']/g, '')))];
  console.log('Clean chunks:', cleanChunks);

  // Search in each chunk for callback handling
  for (const chunk of cleanChunks) {
    const url = 'https://monev.maganghub.kemnaker.go.id' + (chunk.startsWith('/') ? chunk : '/' + chunk);
    try {
      const cRes = await fetch(url);
      const cText = await cRes.text();
      if (cText.includes('sso') || cText.includes('callback') || cText.includes('code') || cText.includes('token')) {
        console.log(`\n=== Chunk ${chunk} contains auth keywords ===`);
        // Find fetch / api calls in this chunk
        const apiCalls = cText.match(/(\/api\/[a-zA-Z0-9_\-\/]+|\/v1\/[a-zA-Z0-9_\-\/]+|https?:\/\/[a-zA-Z0-9_\-\.\/]+)/g) || [];
        console.log('APIs in chunk:', [...new Set(apiCalls)].slice(0, 15));
        
        // Find error reasons like callback_failed
        if (cText.includes('callback_failed') || cText.includes('login-error')) {
          console.log(`FOUND login-error / callback_failed in ${chunk}!`);
          const idx = cText.indexOf('callback_failed');
          console.log(cText.slice(Math.max(0, idx - 200), idx + 300));
        }
      }
    } catch (e) {
      console.warn('Error fetching', chunk, e.message);
    }
  }
}

findChunks().catch(console.error);
