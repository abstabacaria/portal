/* Simula a chamada que o AP 360 faz ao autenticador, para você testar o
   fluxo inteiro na VPS sem depender do hardware.
   Uso:  node src/simulate-ap.js  -> imprime a URL que o AP abriria. */
const params = new URLSearchParams({
  continue: 'http://www.google.com',
  ip: '10.0.0.1',
  ap_mac: '00:11:22:33:44:66',
  mac: 'AA:BB:CC:DD:EE:FF',
  radio: 'radio0',
  ssid: 'Absolem',
  ts: String(Math.floor(Date.now() / 1000)),
  redirect_uri: 'http://10.0.0.1:2061/cp/itbcaptive.cgi',
  user_hash: 'sim' + Math.random().toString(36).slice(2, 10),
});
const port = process.env.PORT || 8080;
console.log('Abra no navegador (simula o redirect do AP):');
console.log(`http://localhost:${port}/?${params.toString()}`);
console.log('\nApós digitar um código válido, o app tentará redirecionar para o');
console.log('redirect_uri (10.0.0.1:2061) — que só existe quando há um AP real.');
console.log('No teste, veja o "Location" da resposta 302 para confirmar o token.');
