// ============================================================
// CONECTAY — views.js
// Telas HTML do captive portal (renderizadas pelo server.js)
// ============================================================

function esc(s = '') {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function base({ titulo, corpo, cor = '#0ea5e9' }) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<title>${esc(titulo)}</title>
<style>
  :root{ --azul:${esc(cor)}; --ciano:#22d3ee; --navy:#0a0f1e; --card:#101827; --borda:#1e293b; --texto:#e2e8f0; --mudo:#94a3b8; }
  *{box-sizing:border-box;margin:0;padding:0}
  body{min-height:100vh;background:radial-gradient(1200px 600px at 50% -10%, #12213f 0%, var(--navy) 55%);
       font-family:'Inter',system-ui,-apple-system,sans-serif;color:var(--texto);
       display:flex;align-items:center;justify-content:center;padding:20px}
  .card{width:100%;max-width:400px;background:var(--card);border:1px solid var(--borda);
        border-radius:20px;padding:32px 26px;text-align:center;
        box-shadow:0 20px 60px rgba(0,0,0,.45)}
  .logo{width:96px;height:96px;object-fit:contain;margin:0 auto 14px;display:block;border-radius:18px}
  h1{font-family:'Sora','Inter',sans-serif;font-size:1.35rem;font-weight:700;margin-bottom:6px}
  p.sub{color:var(--mudo);font-size:.92rem;margin-bottom:22px;line-height:1.5}
  label{display:block;text-align:left;font-size:.8rem;color:var(--mudo);margin:14px 0 6px}
  input[type=text],input[type=tel],input[type=date]{width:100%;padding:13px 14px;border-radius:12px;
        border:1px solid var(--borda);background:#0b1220;color:var(--texto);font-size:1rem;outline:none}
  input:focus{border-color:var(--azul)}
  .optin{display:flex;gap:10px;align-items:flex-start;text-align:left;margin:18px 0 6px;
         font-size:.78rem;color:var(--mudo);line-height:1.45}
  .optin input{margin-top:2px;accent-color:var(--azul);width:18px;height:18px;flex:none}
  .optin a{color:var(--ciano);text-decoration:none}
  button{width:100%;margin-top:18px;padding:15px;border:0;border-radius:12px;cursor:pointer;
         font-family:'Sora','Inter',sans-serif;font-size:1rem;font-weight:700;color:#fff;
         background:linear-gradient(135deg,var(--azul),var(--ciano));
         box-shadow:0 8px 24px rgba(14,165,233,.35)}
  button:active{transform:translateY(1px)}
  .rodape{margin-top:22px;font-size:.72rem;color:#475569}
  .rodape b{color:var(--mudo)}
  .ok{font-size:3rem;margin-bottom:10px}
  .erro{background:#3b0d0d;border:1px solid #7f1d1d;color:#fecaca;border-radius:10px;
        padding:10px;font-size:.85rem;margin-bottom:14px}
</style>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@600;700&family=Inter:wght@400;500&display=swap" rel="stylesheet">
</head>
<body><div class="card">${corpo}</div></body></html>`;
}

// ---- Tela do formulário (modo formulario) ----
function telaFormulario(loja, { erro = '', mac = '', continueUrl = '' } = {}) {
  const logo = loja.logo_url ? `<img class="logo" src="${esc(loja.logo_url)}" alt="${esc(loja.nome)}">` : '';
  return base({
    titulo: `Wi-Fi ${loja.nome}`,
    cor: loja.cor || '#0ea5e9',
    corpo: `
      ${logo}
      <h1>Wi-Fi grátis · ${esc(loja.nome)}</h1>
      <p class="sub">Preencha rapidinho e conecte-se em segundos.</p>
      ${erro ? `<div class="erro">${esc(erro)}</div>` : ''}
      <form method="POST" action="/lead">
        <input type="hidden" name="mac" value="${esc(mac)}">
        <input type="hidden" name="continue" value="${esc(continueUrl)}">
        <label>Seu nome</label>
        <input type="text" name="nome" placeholder="Como podemos te chamar?" autocomplete="name">
        <label>WhatsApp *</label>
        <input type="tel" name="telefone" required placeholder="(21) 99999-9999" autocomplete="tel" inputmode="tel">
        <label>Data de aniversário 🎂</label>
        <input type="date" name="aniversario" max="2020-12-31">
        <div class="optin">
          <input type="checkbox" name="optin" value="1" required id="opt">
          <span>Aceito receber novidades e promoções da ${esc(loja.nome)} no WhatsApp e concordo com a
          <a href="https://conectay.com.br/privacidade" target="_blank">Política de Privacidade</a>.</span>
        </div>
        <button type="submit">Conectar ao Wi-Fi</button>
      </form>
      <div class="rodape">Powered by <b>ConectaY</b></div>`
  });
}

// ---- Tela modo Instagram (só botão) ----
function telaInstagram(loja, { mac = '', continueUrl = '' } = {}) {
  const logo = loja.logo_url ? `<img class="logo" src="${esc(loja.logo_url)}" alt="${esc(loja.nome)}">` : '';
  return base({
    titulo: `Wi-Fi ${loja.nome}`,
    cor: loja.cor || '#0ea5e9',
    corpo: `
      ${logo}
      <h1>Wi-Fi grátis · ${esc(loja.nome)}</h1>
      <p class="sub">Siga a gente no Instagram e navegue à vontade.</p>
      <form method="POST" action="/conectar">
        <input type="hidden" name="mac" value="${esc(mac)}">
        <input type="hidden" name="continue" value="${esc(continueUrl)}">
        <button type="submit">Conectar e seguir @${esc(loja.instagram || '')}</button>
      </form>
      <div class="rodape">Powered by <b>ConectaY</b></div>`
  });
}

// ---- Tela de sucesso + redirecionamento pro destino da loja ----
function urlDestino(loja) {
  if (loja.destino === 'google_review' && loja.google_review_url) return loja.google_review_url;
  if (loja.destino === 'site' && loja.site_url) return loja.site_url;
  if (loja.instagram) return `https://instagram.com/${loja.instagram.replace('@', '')}`;
  return 'https://conectay.com.br';
}

function telaSucesso(loja) {
  const dest = urlDestino(loja);
  const rotulo = loja.destino === 'google_review' ? 'Avalie a gente no Google ⭐'
               : loja.destino === 'site' ? 'Visite nosso site'
               : `Seguir @${esc((loja.instagram || '').replace('@',''))} no Instagram`;
  return base({
    titulo: 'Conectado!',
    cor: loja.cor || '#0ea5e9',
    corpo: `
      <div class="ok">✅</div>
      <h1>Você está conectado!</h1>
      <p class="sub">Internet liberada. Aproveite! Em instantes vamos te levar para ${loja.destino === 'google_review' ? 'nossa página de avaliação' : loja.destino === 'site' ? 'nosso site' : 'nosso Instagram'}.</p>
      <a href="${esc(dest)}"><button type="button">${rotulo}</button></a>
      <div class="rodape">Powered by <b>ConectaY</b></div>
      <script>setTimeout(function(){ location.href = ${JSON.stringify(dest)}; }, 2500);</script>`
  });
}

function telaErro(msg) {
  return base({
    titulo: 'Ops',
    corpo: `<div class="ok">😕</div><h1>Algo deu errado</h1><p class="sub">${esc(msg)}</p>
            <div class="rodape">Powered by <b>ConectaY</b></div>`
  });
}

module.exports = { telaFormulario, telaInstagram, telaSucesso, telaErro, urlDestino };
