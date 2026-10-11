async function inspectRiwayat() {
  const code = await (await fetch('https://monev.maganghub.kemnaker.go.id/_nuxt/DW9cM_l_2.js')).text();
  console.log('Size of DW9cM_l_2.js (/riwayat):', code.length);
  // find endpoints called in /riwayat
  const apis = code.match(/["'`]((\/api|\/v1)[^"'`\s]+)["'`]/g) || [];
  console.log('APIs in /riwayat:', [...new Set(apis)]);
  
  // check if there is download or export in /riwayat
  const dl = code.match(/[^;]{0,60}(?:download|export|unduh|csv|xlsx|pdf)[^;]{0,60}/gi) || [];
  console.log('Download/export references in /riwayat:', dl);
}

inspectRiwayat().catch(console.error);
