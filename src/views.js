// Páginas HTML renderizadas pelo servidor (sem framework de template para
// manter zero dependências extras). Identidade visual da Absolem: laranja
// #F97316 sobre fundo grafite, com brilho de chama.

const LOGO = '/static/logo.png';
// Página de Política de Privacidade (hospede o privacidade.html neste endereço).
const PRIVACIDADE_URL = 'https://conectay.com.br/privacidade';

function layout({ title, body }) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title}</title>
<style>
  :root{
    --brand:#F97316; --brand-2:#fb9a4b; --ink:#0f0d0c; --ink-2:#1b1917;
    --line:rgba(249,115,22,.25); --text:#f4efe9; --muted:#b9a89b;
  }
  *{box-sizing:border-box}
  html,body{margin:0;height:100%}
  body{
    font-family:"Segoe UI",system-ui,-apple-system,Roboto,Arial,sans-serif;
    color:var(--text); background:radial-gradient(120% 90% at 50% 12%,#3a271b 0%,#1a1512 45%,#0c0a09 100%);
    min-height:100dvh; display:flex; align-items:center; justify-content:center; padding:24px;
  }
  .card{
    width:100%; max-width:400px; background:linear-gradient(180deg,rgba(29,25,22,.9),rgba(16,13,11,.92));
    border:1px solid var(--line); border-radius:22px; padding:34px 26px 30px;
    box-shadow:0 24px 60px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.04);
    position:relative; overflow:hidden;
  }
  .card::before{ /* brilho da chama */
    content:""; position:absolute; inset:-40% 15% auto 15%; height:220px;
    background:radial-gradient(60% 60% at 50% 0,rgba(249,115,22,.5),transparent 70%);
    filter:blur(28px); pointer-events:none;
  }
  .logo{ text-align:center; position:relative; z-index:1; margin-bottom:10px }
  .logo img{ width:74%; max-width:260px; height:auto; display:block; margin:0 auto;
             filter:drop-shadow(0 4px 14px rgba(249,115,22,.35)) }
  h1{ font-size:19px; text-align:center; margin:18px 0 4px; font-weight:700 }
  p.sub{ text-align:center; color:var(--muted); font-size:13.5px; margin:0 0 20px; line-height:1.5 }
  .step{ display:flex; gap:12px; align-items:flex-start; margin:14px 0 }
  .num{ flex:0 0 26px; height:26px; border-radius:50%; background:var(--brand);
        color:#1a1109; font-weight:800; font-size:13px; display:grid; place-items:center; margin-top:1px }
  .step div{ font-size:14px; line-height:1.45 }
  .step small{ color:var(--muted); display:block; font-size:12.5px; margin-top:2px }
  .ig{ display:flex; align-items:center; justify-content:center; gap:9px; width:100%;
       text-decoration:none; margin:8px 0 20px; padding:13px; border-radius:13px; font-weight:700; font-size:15px;
       color:#fff; background:linear-gradient(90deg,#f0983c,#e1306c 55%,#c13584);
       box-shadow:0 8px 22px rgba(193,53,132,.28) }
  .ig:active{ transform:translateY(1px) }
  form{ position:relative; z-index:1 }
  label{ font-size:12.5px; color:var(--muted); display:block; margin:0 0 7px 2px }
  input[type=text]{
    width:100%; padding:14px 15px; border-radius:13px; border:1px solid rgba(255,255,255,.12);
    background:#0c0a09; color:var(--text); font-size:17px; letter-spacing:2px; text-transform:uppercase;
    text-align:center; font-weight:700;
  }
  input[type=text]:focus{ outline:none; border-color:var(--brand); box-shadow:0 0 0 3px rgba(249,115,22,.18) }
  button{
    width:100%; margin-top:14px; padding:15px; border:0; border-radius:13px; cursor:pointer;
    background:linear-gradient(180deg,var(--brand-2),var(--brand)); color:#180f07; font-weight:800; font-size:16px;
    box-shadow:0 10px 24px rgba(249,115,22,.32);
  }
  button:active{ transform:translateY(1px) }
  .err{ background:rgba(220,60,40,.14); border:1px solid rgba(220,60,40,.4); color:#ffb9ac;
        padding:11px 13px; border-radius:11px; font-size:13px; margin:0 0 16px; text-align:center }
  .ighint{ text-align:center; font-size:13.5px; color:#ffd7b0; background:rgba(249,115,22,.10);
           border:1px solid var(--line); border-radius:12px; padding:12px 14px; margin:0 0 20px; line-height:1.5 }
  .ighint b{ color:var(--brand) }
  .igbtn{ display:flex; align-items:center; justify-content:center; gap:10px; width:100%;
       border:0; cursor:pointer; margin:6px 0 16px; padding:17px; border-radius:14px; font-weight:800; font-size:16px;
       color:#fff; background:linear-gradient(90deg,#f0983c,#e1306c 55%,#c13584);
       box-shadow:0 10px 26px rgba(193,53,132,.32) }
    /* --- botão carregando --- */
    .igbtn{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:9px;transition:opacity .18s,transform .1s}
    .igbtn:active{transform:scale(.985)}
    .igbtn .spin{display:none;width:17px;height:17px;border-radius:50%;border:2.5px solid rgba(255,255,255,.35);border-top-color:#fff;animation:gira .7s linear infinite;flex-shrink:0}
    .igbtn.carregando{opacity:.85;cursor:wait}
    .igbtn.carregando .spin{display:block}
    .igbtn:disabled{cursor:wait}
    @keyframes gira{to{transform:rotate(360deg)}}
    /* --- tela de carregando --- */
    .load{position:fixed;inset:0;background:rgba(10,10,12,.94);backdrop-filter:blur(4px);display:none;align-items:center;justify-content:center;z-index:99;padding:24px}
    .load.on{display:flex;animation:apar .25s ease}
    @keyframes apar{from{opacity:0}to{opacity:1}}
    .load-in{text-align:center;max-width:300px}
    .ring{width:52px;height:52px;margin:0 auto 20px;border-radius:50%;border:4px solid rgba(255,255,255,.14);border-top-color:#ff6a1a;animation:gira .8s linear infinite}
    .load-t{color:#fff;font-size:17px;font-weight:800;margin-bottom:8px}
    .load-s{color:#9a9aa2;font-size:13.5px;line-height:1.55}
    .load-s b{color:#ff8c4a}
    @media (prefers-reduced-motion:reduce){.ring,.igbtn .spin{animation-duration:2s}}

  .igbtn:active{ transform:translateY(1px) }
  .hint{ text-align:center; font-size:12.5px; color:var(--muted); margin:0 0 4px; line-height:1.5 }
  .hint b{ color:var(--brand-2) }
  .foot{ text-align:center; color:var(--muted); font-size:11px; margin-top:20px; letter-spacing:.3px }
  @media (prefers-reduced-motion:no-preference){
    .card{ animation:rise .5s ease both } @keyframes rise{ from{opacity:0; transform:translateY(10px)} }
  }
</style>
</head>
<body><main class="card">${body}</main></body></html>`;
}

function hidden(ap) {
  // Reenvia os parâmetros do AP no POST (além do cookie), por robustez.
  return ['continue','ip','ap_mac','mac','radio','ssid','ts','redirect_uri','user_hash','loja']
    .map(k => `<input type="hidden" name="${k}" value="${escapeAttr(ap[k] || '')}">`).join('');
}

function escapeAttr(s){ return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function renderPortal({ ap, instagram, autoCode, error, marca }) {
  marca = marca || {};
  // liberação automática: o código vai escondido no botão. Nunca pode ficar vazio,
  // senão o AP não libera. Ordem: o que veio > o da marca > o global do ambiente.
  autoCode = autoCode || marca.autoCode || process.env.AUTO_CODE || 'ABSOLEM';
  const cor = marca.cor || '#F97316';
  const cor2 = marca.cor2 || cor;
  const logo = marca.logo || LOGO;
  const nome = marca.nome || 'Absolem Tabacaria';
  const igHandle = (instagram || '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '@').replace(/\/$/, '') || ('@' + (marca.igHandle || 'absolem'));
  const ehWpp = marca.destinoTipo === 'whatsapp' && marca.whatsappLink;
  const ehForm = marca.destinoTipo === 'formulario' && Array.isArray(marca.formCampos) && marca.formCampos.length;
  const btnLabel = ehWpp ? '💬 Entrar no grupo e conectar' : '📸 Seguir no Instagram e conectar';
  const subTxt = ehWpp ? 'Toque no botão abaixo para entrar no nosso grupo e conectar à internet.'
                       : 'Toque no botão abaixo para seguir a gente e conectar à internet.';
  const hintTxt = ehWpp ? 'Você vai entrar no nosso grupo de WhatsApp com a internet já liberada.'
                        : `Você será direcionado ao nosso Instagram <b>${escapeAttr(igHandle)}</b> com a internet já liberada.`;
  // se for modo formulário, monta os campos que o cliente escolheu
  const tiposInput = { nome:'text', telefone:'tel', email:'email', aniversario:'date', cpf:'text', cep:'text', bairro:'text' };
  const camposHtml = ehForm ? marca.formCampos.map(c =>
    `<input class="fld-form" type="${tiposInput[c.campo]||'text'}" name="lead_${c.campo}" placeholder="${escapeAttr(c.label)}${c.obrigatorio?' *':''}" ${c.obrigatorio?'required':''}>`
  ).join('') : '';
  const formTitulo = marca.formTitulo || 'Cadastre-se para usar o Wi-Fi';

  const body = `
    <div class="logo">${(logo && !logo.endsWith('/static/logo.png')) ? `<img src="${escapeAttr(logo)}" alt="${escapeAttr(nome)}">` : `<div class="logo-nome">${escapeAttr(nome)}</div>`}</div>
    <h1>Wi-Fi liberado</h1>
    <p class="sub">${subTxt}</p>

    ${error ? `<div class="err">${escapeAttr(error)}</div>` : ''}
    ${ehForm ? `
    <form method="post" action="/auth" id="f">
      ${hidden(ap)}
      <input type="hidden" name="code" value="${escapeAttr(autoCode || '')}">
      <input type="hidden" name="go" value="form">
      <div class="form-titulo">${escapeAttr(formTitulo)}</div>
      ${camposHtml}
      <label class="optin">
        <input type="checkbox" name="lead_optin" value="sim" required>
        <span>Aceito receber novidades e ofertas no WhatsApp e concordo com a <a href="${escapeAttr(PRIVACIDADE_URL)}" target="_blank" rel="noopener">Política de Privacidade</a>.</span>
      </label>
      <button type="submit" class="igbtn" id="btn">
        <span class="spin" aria-hidden="true"></span>
        <span class="lbl">✅ Cadastrar e conectar</span>
      </button>
    </form>
    <div class="hint" id="hint">Seus dados vão só pra ${escapeAttr(nome)}. Ao cadastrar, a internet libera na hora.</div>
    ` : `
    <form method="post" action="/auth" id="f">
      ${hidden(ap)}
      <input type="hidden" name="code" value="${escapeAttr(autoCode || '')}">
      <input type="hidden" name="go" value="instagram">
      <button type="submit" class="igbtn" id="btn">
        <span class="spin" aria-hidden="true"></span>
        <span class="lbl">${btnLabel}</span>
      </button>
    </form>
    <div class="hint" id="hint">${hintTxt}</div>
    `}
    <div class="foot">Ao conectar você concorda com nossos <a href="${escapeAttr(PRIVACIDADE_URL)}" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline">termos e política de privacidade</a>.</div>
    <div class="pby">
      <span>Wi-Fi por</span>
      <img src="https://i.postimg.cc/BQjJGBKf/logo-conectay-transparent.png" alt="ConectaY" style="height:36px;object-fit:contain;opacity:.9">
    </div>

    <div class="load" id="load" aria-hidden="true">
      <div class="load-in">
        <div class="ring"></div>
        <div class="load-t">Liberando sua internet…</div>
        <div class="load-s" id="loadS">Só um instante, não feche a página.</div>
      </div>
    </div>

    <script>
    (function(){
      var f=document.getElementById('f'), b=document.getElementById('btn'), ld=document.getElementById('load'), ls=document.getElementById('loadS');
      var enviando=false;
      f.addEventListener('submit',function(e){
        if(enviando){ e.preventDefault(); return false; }   // trava o clique duplo
        enviando=true;
        b.classList.add('carregando');
        b.disabled=true;
        b.querySelector('.lbl').textContent='Conectando…';
        ld.classList.add('on');
        setTimeout(function(){ if(ls)ls.textContent=${JSON.stringify(ehWpp?'Quase lá… o grupo abre em seguida.':'Quase lá… o Instagram abre em seguida.')}; },2500);
        setTimeout(function(){ if(ls)ls.innerHTML='Tá demorando mais que o normal. Se não abrir, <b>toque no botão de novo</b>.'; liberar(); },9000);
      });
      // se a pessoa voltar pra essa página (botão voltar), destrava tudo
      function liberar(){
        enviando=false; b.disabled=false; b.classList.remove('carregando');
        b.querySelector('.lbl').textContent=${JSON.stringify(btnLabel)};
        ld.classList.remove('on');
      }
      window.addEventListener('pageshow',function(ev){ if(ev.persisted)liberar(); });
    })();
    </script>
    <style>:root{ --brand:${cor}; --brand-2:${cor2} }
      .igbtn,.igbtn2{ background:linear-gradient(135deg,${cor},${cor2}) !important }
      .fld-form{width:100%;box-sizing:border-box;padding:14px 16px;margin:0 0 10px;border:1.5px solid #e5e7eb;border-radius:12px;font-size:16px;background:#fff;color:#111}
      .fld-form:focus{outline:none;border-color:${cor}}
      .form-titulo{font-weight:800;font-size:17px;margin:4px 0 14px;color:#1a1a1a}
      .optin{display:flex;gap:9px;align-items:flex-start;margin:2px 2px 6px;font-size:12.5px;color:var(--muted);line-height:1.45;cursor:pointer}
      .optin input{flex:0 0 18px;width:18px;height:18px;margin-top:1px;accent-color:${cor};cursor:pointer}
      .optin a{color:${cor2};text-decoration:underline}
      .pby{text-align:center;margin-top:18px;padding-top:14px;border-top:1px solid rgba(255,255,255,.07);display:flex;align-items:center;justify-content:center;gap:7px}
      .pby span{font-size:10px;color:rgba(255,255,255,.35);letter-spacing:.5px}
      .logo-nome{font-size:26px;font-weight:900;background:linear-gradient(135deg,${cor},${cor2});-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;padding:8px 0}
      .num{ background:${cor} }
      .ring{ border-top-color:${cor} }
    </style>`;
  return layout({ title: escapeAttr(nome) + ' — Wi-Fi', body });
}

function renderResult({ ok, title, msg, link }) {
  const body = `
    <div class="logo"><img src="${LOGO}" alt="Absolem Tabacaria"></div>
    <h1>${escapeAttr(title)}</h1>
    <p class="sub">${escapeAttr(msg)}</p>
    ${link ? `<a href="${escapeAttr(link.href)}" class="igbtn" style="text-decoration:none;margin-top:18px">${escapeAttr(link.label)}</a>` : ''}`;
  return layout({ title: `Absolem — ${title}`, body });
}

module.exports = { renderPortal, renderResult };
