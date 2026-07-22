// ============================================================
// CONECTAY — views.js
// Telas do captive portal. Usa destino_tipo (padrão do sistema):
//   instagram | whatsapp | formulario | google_review
// form_campos aceita os 2 formatos existentes em produção.
// ============================================================

function esc(s = '') {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---- Normaliza form_campos: array novo OU objeto antigo ----
function lerCampos(fc) {
  const padrao = [
    { campo: 'nome',        label: 'Seu nome',           obrigatorio: false },
    { campo: 'telefone',    label: 'WhatsApp',           obrigatorio: true  },
    { campo: 'aniversario', label: 'Data de aniversário', obrigatorio: false }
  ];
  if (!fc) return padrao;
  if (Array.isArray(fc)) {
    const l = fc.map(c => ({
      campo: c.campo || c.nome || c.key,
      label: c.label || c.rotulo || c.campo,
      obrigatorio: !!(c.obrigatorio ?? c.obrig ?? c.req)
    })).filter(c => c.campo);
    return l.length ? l : padrao;
  }
  if (typeof fc === 'object') {
    const l = Object.entries(fc).map(([k, v]) => ({
      campo: k,
      label: (v && (v.label || v.rotulo)) || (k.charAt(0).toUpperCase() + k.slice(1)),
      obrigatorio: !!(v && (v.obrig ?? v.obrigatorio ?? v.req))
    }));
    return l.length ? l : padrao;
  }
  return padrao;
}

function tipoInput(campo) {
  if (campo === 'telefone' || campo === 'whatsapp' || campo === 'celular') return 'tel';
  if (campo === 'aniversario' || campo === 'nascimento') return 'date';
  if (campo === 'email') return 'email';
  return 'text';
}

// ---- Destino ----
function urlDestino(loja) {
  const t = loja.destino_tipo || 'instagram';
  if (t === 'whatsapp' && loja.whatsapp_link) return loja.whatsapp_link;
  if (t === 'google_review' && loja.google_review_url) return loja.google_review_url;
  if (t === 'site' && loja.site_url) return loja.site_url;
  if (loja.instagram) return `https://instagram.com/${String(loja.instagram).replace('@', '')}`;
  return 'https://conectay.com.br';
}
function rotuloDestino(loja) {
  const t = loja.destino_tipo || 'instagram';
  if (t === 'whatsapp')      return 'Entrar no grupo do WhatsApp';
  if (t === 'google_review') return 'Avalie a gente no Google ⭐';
  if (t === 'site')          return 'Visitar nosso site';
  return `Seguir @${String(loja.instagram || '').replace('@', '')} no Instagram`;
}
function fraseDestino(loja) {
  const t = loja.destino_tipo || 'instagram';
  if (t === 'whatsapp')      return 'nosso grupo do WhatsApp';
  if (t === 'google_review') return 'nossa página de avaliação';
  if (t === 'site')          return 'nosso site';
  return 'nosso Instagram';
}

// ---- Base HTML ----
function base({ titulo, corpo, cor = '#0ea5e9', cor2 }) {
  const c2 = cor2 || cor;
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<title>${esc(titulo)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@600;700&family=Inter:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root{ --c1:${esc(cor)}; --c2:${esc(c2)}; --navy:#0a0f1e; --card:#101827; --borda:#1e293b; --texto:#e2e8f0; --mudo:#94a3b8 }
  *{box-sizing:border-box;margin:0;padding:0}
  body{min-height:100vh;background:radial-gradient(1200px 600px at 50% -10%, #12213f 0%, var(--navy) 55%);
       font-family:'Inter',system-ui,sans-serif;color:var(--texto);
       display:flex;align-items:center;justify-content:center;padding:20px}
  .card{width:100%;max-width:400px;background:var(--card);border:1px solid var(--borda);
        border-radius:20px;padding:32px 26px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.45)}
  .logo{width:96px;height:96px;object-fit:contain;margin:0 auto 14px;display:block;border-radius:18px}
  h1{font-family:'Sora',sans-serif;font-size:1.35rem;font-weight:700;margin-bottom:6px}
  p.sub{color:var(--mudo);font-size:.92rem;margin-bottom:22px;line-height:1.5}
  label{display:block;text-align:left;font-size:.8rem;color:var(--mudo);margin:14px 0 6px}
  input{width:100%;padding:13px 14px;border-radius:12px;border:1px solid var(--borda);
        background:#0b1220;color:var(--texto);font-size:1rem;outline:none;font-family:inherit}
  input:focus{border-color:var(--c1)}
  .optin{display:flex;gap:10px;align-items:flex-start;text-align:left;margin:18px 0 6px;
         font-size:.78rem;color:var(--mudo);line-height:1.45}
  .optin input{margin-top:2px;accent-color:var(--c1);width:18px;height:18px;flex:none}
  .optin a{color:var(--c1);text-decoration:none}
  button{width:100%;margin-top:18px;padding:15px;border:0;border-radius:12px;cursor:pointer;
         font-family:'Sora',sans-serif;font-size:1rem;font-weight:700;color:#fff;
         background:linear-gradient(135deg,var(--c1),var(--c2));box-shadow:0 8px 24px rgba(0,0,0,.3)}
  button:active{transform:translateY(1px)}
  .rodape{margin-top:22px;font-size:.72rem;color:#475569}
  .rodape b{color:var(--mudo)}
  .ok{font-size:3rem;margin-bottom:10px}
  .erro{background:#3b0d0d;border:1px solid #7f1d1d;color:#fecaca;border-radius:10px;
        padding:10px;font-size:.85rem;margin-bottom:14px}
</style>
</head>
<body><div class="card">${corpo}</div></body></html>`;
}

// ---- Tela do formulário ----
function telaFormulario(loja, { erro = '', mac = '', continueUrl = '' } = {}) {
  const logo = loja.logo_url ? `<img class="logo" src="${esc(loja.logo_url)}" alt="${esc(loja.nome)}">` : '';
  const campos = lerCampos(loja.form_campos).map(c => `
        <label>${esc(c.label)}${c.obrigatorio ? ' *' : ''}</label>
        <input type="${tipoInput(c.campo)}" name="${esc(c.campo)}" ${c.obrigatorio ? 'required' : ''}
               ${c.campo === 'telefone' ? 'inputmode="tel" placeholder="(21) 99999-9999"' : ''}>`).join('');
  return base({
    titulo: `Wi-Fi ${loja.nome}`, cor: loja.cor, cor2: loja.cor2,
    corpo: `
      ${logo}
      <h1>${esc(loja.form_titulo || `Wi-Fi grátis · ${loja.nome}`)}</h1>
      <p class="sub">Preencha rapidinho e conecte-se em segundos.</p>
      ${erro ? `<div class="erro">${esc(erro)}</div>` : ''}
      <form method="POST" action="/lead">
        <input type="hidden" name="mac" value="${esc(mac)}">
        <input type="hidden" name="continue" value="${esc(continueUrl)}">
        ${campos}
        <div class="optin">
          <input type="checkbox" name="optin" value="1" required>
          <span>Aceito receber novidades e promoções da ${esc(loja.nome)} no WhatsApp e concordo com a
          <a href="https://conectay.com.br/privacidade" target="_blank">Política de Privacidade</a>.</span>
        </div>
        <button type="submit">${esc(loja.botao_txt || 'Conectar ao Wi-Fi')}</button>
      </form>
      <div class="rodape">Powered by <b>ConectaY</b></div>`
  });
}

// ---- Tela de 1 clique (instagram / whatsapp / google_review) ----
function telaBotao(loja, { mac = '', continueUrl = '' } = {}) {
  const logo = loja.logo_url ? `<img class="logo" src="${esc(loja.logo_url)}" alt="${esc(loja.nome)}">` : '';
  const t = loja.destino_tipo || 'instagram';
  const sub = t === 'whatsapp'      ? 'Entre no nosso grupo e navegue à vontade.'
            : t === 'google_review' ? 'Deixe sua avaliação e navegue à vontade.'
            : 'Siga a gente no Instagram e navegue à vontade.';
  return base({
    titulo: `Wi-Fi ${loja.nome}`, cor: loja.cor, cor2: loja.cor2,
    corpo: `
      ${logo}
      <h1>Wi-Fi grátis · ${esc(loja.nome)}</h1>
      <p class="sub">${sub}</p>
      <form method="POST" action="/conectar">
        <input type="hidden" name="mac" value="${esc(mac)}">
        <input type="hidden" name="continue" value="${esc(continueUrl)}">
        <button type="submit">${esc(loja.botao_txt || rotuloDestino(loja))}</button>
      </form>
      <div class="rodape">Powered by <b>ConectaY</b></div>`
  });
}

// ---- Sucesso ----
function telaSucesso(loja) {
  const dest = urlDestino(loja);
  return base({
    titulo: 'Conectado!', cor: loja.cor, cor2: loja.cor2,
    corpo: `
      <div class="ok">✅</div>
      <h1>Você está conectado!</h1>
      <p class="sub">Internet liberada. Aproveite! Em instantes vamos te levar para ${fraseDestino(loja)}.</p>
      <a href="${esc(dest)}"><button type="button">${esc(rotuloDestino(loja))}</button></a>
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

module.exports = { telaFormulario, telaBotao, telaSucesso, telaErro, urlDestino, lerCampos };
