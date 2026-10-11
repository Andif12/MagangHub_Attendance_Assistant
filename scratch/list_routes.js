async function listAllRoutes() {
  const code = await (await fetch('https://monev.maganghub.kemnaker.go.id/_nuxt/DhS2JSVw.js')).text();
  const routeRegex = /name:([^,]+),path:`([^`]+)`,component:[^}]*import\(`\.\/([^`]+)`\)/g;
  let m;
  const list = [];
  while ((m = routeRegex.exec(code)) !== null) {
    list.push({ name: m[1], path: m[2], file: m[3] });
  }
  console.log('Total routes:', list.length);
  for (const r of list) {
    console.log(`- Path: ${r.path} | Component: ${r.file}`);
  }
}

listAllRoutes().catch(console.error);
