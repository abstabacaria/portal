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

// ---- Contraste automático: escolhe texto claro ou escuro ----
function lum(hex) {
  const h = String(hex || '#000').replace('#', '');
  const v = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const n = parseInt(v.slice(0, 6) || '000000', 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = c => { c /= 255; return c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); };
  return .2126 * f(r) + .7152 * f(g) + .0722 * f(b);
}
function paleta(loja) {
  const card = loja.cor_card || '#101827';
  const fundo = loja.cor_fundo || '#0a0f1e';
  const claro = lum(card) > .45;
  return {
    c1: loja.cor || '#0ea5e9',
    c2: loja.cor2 || loja.cor || '#22d3ee',
    fundo,
    fundo2: loja.cor_fundo2 || fundo,
    card,
    texto: claro ? '#0f172a' : '#e2e8f0',
    mudo:  claro ? '#475569' : '#94a3b8',
    borda: claro ? 'rgba(15,23,42,.14)' : '#1e293b',
    input: claro ? 'rgba(255,255,255,.65)' : '#0b1220',
    rodape: claro ? '#94a3b8' : '#475569'
  };
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
function base({ titulo, corpo, loja = {} }) {
  const p = paleta(loja);
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<title>${esc(titulo)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@600;700&family=Inter:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root{ --c1:${esc(p.c1)}; --c2:${esc(p.c2)}; --card:${esc(p.card)}; --borda:${esc(p.borda)};
         --texto:${esc(p.texto)}; --mudo:${esc(p.mudo)}; --input:${esc(p.input)} }
  *{box-sizing:border-box;margin:0;padding:0}
  body{min-height:100vh;background:${p.fundo === p.fundo2
        ? esc(p.fundo)
        : `linear-gradient(160deg, ${esc(p.fundo)}, ${esc(p.fundo2)})`};
       font-family:'Inter',system-ui,sans-serif;color:var(--texto);
       display:flex;align-items:center;justify-content:center;padding:20px}
  .card{width:100%;max-width:400px;background:var(--card);border:1px solid var(--borda);
        border-radius:20px;padding:32px 26px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.25)}
  .logo{width:96px;height:96px;object-fit:contain;margin:0 auto 14px;display:block;border-radius:18px}
  h1{font-family:'Sora',sans-serif;font-size:1.35rem;font-weight:700;margin-bottom:6px}
  p.sub{color:var(--mudo);font-size:.92rem;margin-bottom:22px;line-height:1.5}
  label{display:block;text-align:left;font-size:.8rem;color:var(--mudo);margin:14px 0 6px}
  input{width:100%;padding:13px 14px;border-radius:12px;border:1px solid var(--borda);
        background:var(--input);color:var(--texto);font-size:1rem;outline:none;font-family:inherit}
  input:focus{border-color:var(--c1)}
  .optin{display:flex;gap:10px;align-items:flex-start;text-align:left;margin:18px 0 6px;
         font-size:.78rem;color:var(--mudo);line-height:1.45}
  .optin input{margin-top:2px;accent-color:var(--c1);width:18px;height:18px;flex:none}
  .optin a{color:var(--c1);text-decoration:none}
  button{width:100%;margin-top:18px;padding:15px;border:0;border-radius:12px;cursor:pointer;
         font-family:'Sora',sans-serif;font-size:1rem;font-weight:700;color:#fff;
         background:linear-gradient(135deg,var(--c1),var(--c2));box-shadow:0 8px 24px rgba(0,0,0,.22)}
  button:active{transform:translateY(1px)}
  .rodape{margin-top:22px;font-size:.72rem;color:${esc(p.rodape)}}
  .rodape b{color:var(--mudo)}
  .ok{font-size:3rem;margin-bottom:10px}
  .erro{background:rgba(220,38,38,.14);border:1px solid rgba(220,38,38,.4);color:#dc2626;
        border-radius:10px;padding:10px;font-size:.85rem;margin-bottom:14px}
</style>
</head>
<body><div class="card">${corpo}</div></body></html>`;
}


// ---- Política de privacidade (privacidade.conectay.com.br e /privacidade) ----
function telaPrivacidade() {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Política de Privacidade · ConectaY</title>
<meta name="robots" content="index,follow">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@700&family=Inter:wght@400;600&display=swap" rel="stylesheet">
<style>
  :root{--azul:#0ea5e9;--ciano:#22d3ee;--navy:#0a0f1e;--borda:#1e293b;--texto:#e2e8f0;--mudo:#94a3b8}
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--navy);color:var(--texto);font-family:'Inter',system-ui,sans-serif;line-height:1.7}
  .wrap{max-width:760px;margin:0 auto;padding:40px 22px 70px}
  .marca{display:flex;align-items:center;gap:9px;font-family:'Sora';font-weight:700;margin-bottom:26px}
  .marca b{color:var(--azul)}
  h1{font-family:'Sora';font-size:1.7rem;margin-bottom:6px}
  .data{color:var(--mudo);font-size:.83rem;margin-bottom:30px}
  h2{font-family:'Sora';font-size:1.05rem;margin:28px 0 10px;color:var(--ciano)}
  p,li{font-size:.93rem;margin-bottom:10px}
  ul{padding-left:22px}
  a{color:var(--ciano)}
  footer{margin-top:40px;padding-top:18px;border-top:1px solid var(--borda);color:var(--mudo);font-size:.8rem}
</style>
</head>
<body><div class="wrap">
  <div class="marca">
    <svg width="24" height="24" viewBox="0 0 64 64" fill="none">
      <path d="M32 4 56 18v28L32 60 8 46V18L32 4Z" stroke="#0ea5e9" stroke-width="4" fill="#0b1220"/>
      <path d="M20 34c6.6-6.6 17.4-6.6 24 0" stroke="#22d3ee" stroke-width="4" stroke-linecap="round"/>
      <circle cx="32" cy="43" r="3" fill="#22d3ee"/>
    </svg>Conecta<b>Y</b>
  </div>
  <h1>Política de Privacidade</h1>
  <div class="data">Última atualização: julho de 2026</div>

  <p>Esta política explica como o <b>ConectaY</b> trata os dados pessoais coletados quando você se conecta ao Wi-Fi de um estabelecimento parceiro através do nosso portal.</p>

  <h2>1. Quais dados coletamos</h2>
  <ul>
    <li><b>Informados por você:</b> nome, número de WhatsApp e, opcionalmente, data de aniversário e outros campos que o estabelecimento solicitar.</li>
    <li><b>Técnicos da conexão:</b> endereço MAC do aparelho, endereço IP, tipo de dispositivo e sistema operacional, data e hora do acesso.</li>
  </ul>

  <h2>2. Para que usamos</h2>
  <ul>
    <li>Liberar seu acesso à internet no estabelecimento;</li>
    <li>Cumprir a guarda de registros de conexão prevista no Marco Civil da Internet (Lei 12.965/2014);</li>
    <li>Permitir que o estabelecimento visitado envie comunicações e ofertas pelo WhatsApp e direcione ofertas em redes sociais, <b>somente quando você marca a caixa de consentimento</b> no portal;</li>
    <li>Reconhecer seu aparelho em visitas seguintes, para que você não precise preencher o cadastro novamente;</li>
    <li>Gerar estatísticas de visitação (horários, frequência) para o estabelecimento.</li>
  </ul>

  <h2>3. Base legal (LGPD)</h2>
  <p>Tratamos seus dados com base no <b>consentimento</b> (art. 7º, I da Lei 13.709/2018) para comunicações de marketing, no <b>cumprimento de obrigação legal</b> (art. 7º, II) para os registros de conexão, e no <b>legítimo interesse</b> (art. 7º, IX) para estatísticas de uso do Wi-Fi.</p>

  <h2>4. Com quem compartilhamos</h2>
  <p>Seus dados de cadastro ficam visíveis apenas para o estabelecimento onde você se conectou e para o ConectaY, como operador da plataforma. Não vendemos seus dados. Quando o estabelecimento usa plataformas de anúncio (como Meta Ads) para alcançar seus clientes, o envio é feito de forma criptografada, sem expor seu número.</p>

  <h2>5. Por quanto tempo guardamos</h2>
  <p>Registros de conexão são mantidos pelo período mínimo de 6 meses exigido pelo Marco Civil. Dados de cadastro são mantidos enquanto durar o relacionamento com o estabelecimento ou até você solicitar a exclusão.</p>

  <h2>6. Seus direitos</h2>
  <p>Você pode, a qualquer momento: confirmar se tratamos seus dados, acessá-los, corrigi-los, solicitar a exclusão ou <b>revogar o consentimento</b> — basta responder "sair" a qualquer mensagem ou usar o contato abaixo.</p>

  <h2>7. Segurança</h2>
  <p>Os dados são armazenados em infraestrutura na nuvem com criptografia em trânsito (HTTPS) e controle de acesso por perfil: cada estabelecimento acessa apenas os dados dos próprios clientes.</p>

  <h2>8. Contato</h2>
  <p>Encarregado de dados (DPO): <a href="mailto:raynoruan@icloud.com">raynoruan@icloud.com</a></p>

  <footer>ConectaY · Rio de Janeiro/RJ · <a href="https://conectay.com.br">conectay.com.br</a></footer>
</div></body></html>`;
}

// ---- Tela do formulário ----
function telaFormulario(loja, { erro = '', mac = '', continueUrl = '' } = {}) {
  const logo = loja.logo_url ? `<img class="logo" src="${esc(loja.logo_url)}" alt="${esc(loja.nome)}">` : '';
  const campos = lerCampos(loja.form_campos).map(c => `
        <label>${esc(c.label)}${c.obrigatorio ? ' *' : ''}</label>
        <input type="${tipoInput(c.campo)}" name="${esc(c.campo)}" ${c.obrigatorio ? 'required' : ''}
               ${c.campo === 'telefone' ? 'inputmode="tel" placeholder="(21) 99999-9999"' : ''}>`).join('');
  return base({
    titulo: `Wi-Fi ${loja.nome}`, loja,
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
          <a href="https://privacidade.conectay.com.br" target="_blank">Política de Privacidade</a>.</span>
        </div>
        <button type="submit">${esc(loja.botao_txt || 'Conectar ao Wi-Fi')}</button>
      </form>
      <div class="rodape">Powered by <b>ConectaY</b></div>`
  });
}

// ---- Tela de 1 clique (instagram / whatsapp / google_review) ----
function telaBotao(loja, { mac = '', continueUrl = '', voltou = false } = {}) {
  const logo = loja.logo_url ? `<img class="logo" src="${esc(loja.logo_url)}" alt="${esc(loja.nome)}">` : '';
  const t = loja.destino_tipo || 'instagram';
  const sub = t === 'whatsapp'      ? 'Entre no nosso grupo e navegue à vontade.'
            : t === 'google_review' ? 'Deixe sua avaliação e navegue à vontade.'
            : 'Siga a gente no Instagram e navegue à vontade.';
  return base({
    titulo: `Wi-Fi ${loja.nome}`, loja,
    corpo: `
      ${logo}
      <h1>${voltou ? 'Que bom te ver de novo!' : `Wi-Fi grátis · ${esc(loja.nome)}`}</h1>
      <p class="sub">${voltou ? 'Você já está cadastrado — é só um clique pra conectar. ' : ''}${sub}</p>
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
  const tel = String(loja.vcard_telefone || '').replace(/\D/g, '');
  const vcard = (loja.vcard_ativo && tel) ? `
      <a href="/contato.vcf" download="${esc((loja.vcard_nome || loja.nome || 'contato').replace(/[^\w\s-]/g,''))}.vcf">
        <button type="button" style="background:var(--input);border:1px solid var(--borda);
          box-shadow:none;margin-top:10px;color:var(--texto)">
          📇 Salvar nosso contato
        </button>
      </a>
      <p style="color:var(--mudo);font-size:.72rem;margin-top:8px;line-height:1.4">
        Salve pra receber nossas novidades e promoções em primeira mão.
      </p>` : '';
  return base({
    titulo: 'Conectado!', loja,
    corpo: `
      <div class="ok">✅</div>
      <h1>Você está conectado!</h1>
      <p class="sub">Internet liberada. Aproveite! Em instantes vamos te levar para ${fraseDestino(loja)}.</p>
      <a href="${esc(dest)}"><button type="button">${esc(rotuloDestino(loja))}</button></a>
      ${vcard}
      <div class="rodape">Powered by <b>ConectaY</b></div>
      <script>setTimeout(function(){ location.href = ${JSON.stringify(dest)}; }, ${vcard ? 9000 : 2500});</script>`
  });
}

// ---- Gera o arquivo .vcf da loja ----
function montarVcard(loja) {
  const tel = String(loja.vcard_telefone || '').replace(/\D/g, '');
  const nome = (loja.vcard_nome || loja.nome || 'Contato').replace(/[\r\n]/g, ' ');
  const linhas = [
    'BEGIN:VCARD', 'VERSION:3.0',
    `N:;${nome};;;`, `FN:${nome}`, `ORG:${nome}`,
    `TEL;TYPE=CELL:+55${tel}`
  ];
  if (loja.instagram) linhas.push(`URL:https://instagram.com/${String(loja.instagram).replace('@','')}`);
  if (loja.endereco)  linhas.push(`ADR;TYPE=WORK:;;${String(loja.endereco).replace(/[\r\n,]/g,' ')};;;;`);
  linhas.push('END:VCARD');
  return linhas.join('\r\n');
}

function telaErro(msg) {
  return base({
    titulo: 'Ops', loja: {},
    corpo: `<div class="ok">😕</div><h1>Algo deu errado</h1><p class="sub">${esc(msg)}</p>
            <div class="rodape">Powered by <b>ConectaY</b></div>`
  });
}

module.exports = { telaFormulario, telaBotao, telaSucesso, telaErro, urlDestino, lerCampos, montarVcard, telaPrivacidade };
