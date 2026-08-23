// probe2 - archivo mediano con emojis para testear lock
const emojis = '✅⚠️🚀📂🔬';
const texto = 'test de contenido con acentos: artículo, código, penal, tributario, constitucional';
function foo() {
  const x = emojis + texto.repeat(50);
  return x.length;
}
console.log('probe2 ok', foo());
