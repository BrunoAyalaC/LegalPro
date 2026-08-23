const FRONTEND = 'https://legalpro-frontend-production-a988.up.railway.app';

const res = await fetch(`${FRONTEND}/`, {
  headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
});
const html = await res.text();
const scripts = [...html.matchAll(/assets\/index-[^"']+\.js/g)].map((m) => m[0]);
const styles = [...html.matchAll(/assets\/index-[^"']+\.css/g)].map((m) => m[0]);
console.log('status', res.status);
console.log('scripts', scripts);
console.log('styles', styles);

if (styles[0]) {
  const css = await fetch(`${FRONTEND}/${styles[0]}`, { headers: { 'Cache-Control': 'no-cache' } }).then((r) => r.text());
  console.log('has layout-main-shell', css.includes('layout-main-shell'));
  console.log('has lg pl 256 arbitrary', css.includes('256px') && css.includes('pl-'));
}

if (scripts[0]) {
  const js = await fetch(`${FRONTEND}/${scripts[0]}`, { headers: { 'Cache-Control': 'no-cache' } }).then((r) => r.text());
  console.log('js has layout-main-shell', js.includes('layout-main-shell'));
  console.log('js has lg:pl-[256px]', js.includes('lg:pl-[256px]'));
}
