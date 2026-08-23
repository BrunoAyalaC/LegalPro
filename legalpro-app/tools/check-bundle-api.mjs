const t = await fetch('https://legalpro-frontend-production-a988.up.railway.app/assets/index-UerkGyjk.js').then((r) => r.text());
const urls = [...t.matchAll(/https:\/\/legalpro-[a-z-]+\.up\.railway\.app|localhost:3001|localhost:5000/g)].map((m) => m[0]);
console.log('API URLs in bundle:', [...new Set(urls)]);
