// Páginas HTML renderizadas pelo servidor (sem framework de template para
// manter zero dependências extras).
// A identidade visual agora vem DA LOJA (cores, fundo, logo). O texto se
// ajusta sozinho ao contraste do cartão, então nenhuma combinação de cores
// deixa o portal ilegível.

const LOGO = '/static/logo.png';
const LOGO_CONECTAY = 'https://i.postimg.cc/BQjJGBKf/logo-conectay-transparent.png';
const PRIVACIDADE_URL = 'https://privacidade.conectay.com.br';

function escapeAttr(s){ return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// ---- Contraste automático ----
function lum(hex) {
  const h = String(hex || '#000').replace('#', '');
  const v = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const n = parseInt(v.slice(0, 6) || '000000', 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = c => { c /= 255; return c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); };
  return .2126 * f(r) + .7152 * f(g) + .0722 * f(b);
}
function tema(marca) {
  const card  = marca.corCard  || '#1b1917';
  const fundo = marca.corFundo || '#1a1512';
  const claro = lum(card) > .45;
  return {
    cor: marca.cor || '#F97316',
    cor2: marca.cor2 || marca.cor || '#F97316',
    fundo,
    fundo2: marca.corFundo2 || fundo,
    card,
    texto: claro ? '#12100e' : '#f4efe9',
    muted: claro ? '#5b5551' : '#b9a89b',
    linha: claro ? 'rgba(0,0,0,.12)' : 'rgba(249,115,22,.25)',
    campoBg: claro ? '#ffffff' : '#0c0a09',
    campoTx: claro ? '#111111' : '#f4efe9',
  };
}

function layout({ title, body, marca }) {
  const t = tema(marca || {});
  const fundoCss = t.fundo === t.fundo2
    ? t.fundo
    : `radial-gradient(120% 90% at 50% 12%, ${t.fundo2} 0%, ${t.fundo} 60%)`;
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title}</title>
<link rel="icon" type="image/png" href="${marca && marca.logo && !String(marca.logo).endsWith('/static/logo.png') ? marca.logo : 'https://i.postimg.cc/BQjJGBKf/logo-conectay-transparent.png'}">
<style>
  :root{
    --brand:${t.cor}; --brand-2:${t.cor2}; --ink:${t.fundo}; --ink-2:${t.card};
    --line:${t.linha}; --text:${t.texto}; --muted:${t.muted};
  }
  *{box-sizing:border-box}
  html,body{margin:0;height:100%}
  body{
    font-family:"Segoe UI",system-ui,-apple-system,Roboto,Arial,sans-serif;
    color:var(--text); background:${fundoCss};
    min-height:100dvh; display:flex; align-items:center; justify-content:center; padding:24px;
  }
  .card{
    width:100%; max-width:400px; background:${t.card};
    border:1px solid var(--line); border-radius:22px; padding:34px 26px 30px;
    box-shadow:0 24px 60px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.04);
    position:relative; overflow:hidden;
  }
  .card::before{
    content:""; position:absolute; inset:-40% 15% auto 15%; height:220px;
    background:radial-gradient(60% 60% at 50% 0,${t.cor}44,transparent 70%);
    filter:blur(28px); pointer-events:none;
  }
  .logo{ text-align:center; position:relative; z-index:1; margin-bottom:10px }
  .logo img{ width:74%; max-width:260px; height:auto; display:block; margin:0 auto;
             filter:drop-shadow(0 4px 14px ${t.cor}59) }
  h1{ font-size:19px; text-align:center; margin:18px 0 4px; font-weight:700 }
  p.sub{ text-align:center; color:var(--muted); font-size:13.5px; margin:0 0 20px; line-height:1.5 }
  form{ position:relative; z-index:1 }
  label{ font-size:12.5px; color:var(--muted); display:block; margin:0 0 7px 2px }
  button{
    width:100%; margin-top:14px; padding:15px; border:0; border-radius:13px; cursor:pointer;
    background:linear-gradient(135deg,var(--brand-2),var(--brand)); color:#fff; font-weight:800; font-size:16px;
    box-shadow:0 10px 24px ${t.cor}52;
  }
  button:active{ transform:translateY(1px) }
  .err{ background:rgba(220,60,40,.14); border:1px solid rgba(220,60,40,.4); color:#e05a45;
        padding:11px 13px; border-radius:11px; font-size:13px; margin:0 0 16px; text-align:center }
  .igbtn{ display:flex; align-items:center; justify-content:center; gap:10px; width:100%;
       border:0; cursor:pointer; margin:6px 0 16px; padding:17px; border-radius:14px; font-weight:800; font-size:16px;
       color:#fff; background:linear-gradient(135deg,${t.cor},${t.cor2});
       box-shadow:0 10px 26px ${t.cor}52; position:relative; transition:opacity .18s,transform .1s }
  .igbtn:active{ transform:scale(.985) }
  .igbtn .spin{display:none;width:17px;height:17px;border-radius:50%;border:2.5px solid rgba(255,255,255,.35);border-top-color:#fff;animation:gira .7s linear infinite;flex-shrink:0}
  .igbtn.carregando{opacity:.85;cursor:wait}
  .igbtn.carregando .spin{display:block}
  .igbtn:disabled{cursor:wait}
  @keyframes gira{to{transform:rotate(360deg)}}
  .load{position:fixed;inset:0;background:rgba(10,10,12,.94);backdrop-filter:blur(4px);display:none;align-items:center;justify-content:center;z-index:99;padding:24px}
  .load.on{display:flex;animation:apar .25s ease}
  @keyframes apar{from{opacity:0}to{opacity:1}}
  .load-in{text-align:center;max-width:300px}
  .ring{width:52px;height:52px;margin:0 auto 20px;border-radius:50%;border:4px solid rgba(255,255,255,.14);border-top-color:${t.cor};animation:gira .8s linear infinite}
  .load-t{color:#fff;font-size:17px;font-weight:800;margin-bottom:8px}
  .load-s{color:#9a9aa2;font-size:13.5px;line-height:1.55}
  .load-s b{color:${t.cor2}}
  @media (prefers-reduced-motion:reduce){.ring,.igbtn .spin{animation-duration:2s}}
  .hint{ text-align:center; font-size:12.5px; color:var(--muted); margin:0 0 4px; line-height:1.5 }
  .banner-aviso{ background:linear-gradient(135deg,${t.cor},${t.cor2}); color:#fff; font-weight:700;
    font-size:14px; text-align:center; padding:12px 14px; border-radius:12px; margin:0 0 18px;
    box-shadow:0 6px 18px ${t.cor}44; line-height:1.4; position:relative; z-index:1 }
  .cupom{ background:#fff; border:1.5px solid rgba(23,21,18,.12); border-radius:20px;
    overflow:hidden; position:relative; margin:4px 0 16px; text-align:center; color:#171512 }
  .cupom-top{ background:oklch(.88 .11 88); padding:22px 20px 20px }
  .cupom-eyebrow{ font-family:ui-monospace,monospace; font-size:11.5px; text-transform:uppercase;
    letter-spacing:.14em; color:oklch(.42 .07 88); margin-bottom:6px }
  .cupom-valor{ font-size:40px; font-weight:800; letter-spacing:-.03em; line-height:1 }
  .cupom-cond{ font-size:13px; font-weight:600; color:oklch(.4 .06 88); margin-top:6px }
  .cupom-pic{ border-top:2px dashed rgba(23,21,18,.2); position:relative; height:0 }
  .cupom-pic::before,.cupom-pic::after{ content:''; position:absolute; top:-11px; width:22px; height:22px;
    border-radius:50%; background:${t.bg || '#FAF8F5'} }
  .cupom-pic::before{ left:-11px } .cupom-pic::after{ right:-11px }
  .cupom-base{ padding:18px 20px 20px }
  .cupom-rot{ font-family:ui-monospace,monospace; font-size:11px; text-transform:uppercase;
    letter-spacing:.1em; color:rgba(23,21,18,.5); margin-bottom:8px }
  .cupom-code{ font-family:ui-monospace,monospace; font-size:30px; font-weight:700; letter-spacing:.1em }
  .cupom-val{ font-size:12.5px; font-weight:600; color:rgba(23,21,18,.5); margin-top:10px }
  .popup-bg{ position:fixed; inset:0; background:rgba(0,0,0,.82); backdrop-filter:blur(4px);
    z-index:200; display:flex; align-items:center; justify-content:center; padding:20px;
    animation:popfade .25s ease }
  @keyframes popfade{ from{opacity:0} to{opacity:1} }
  .popup-in{ position:relative; max-width:100%; max-height:88vh; border-radius:16px; overflow:hidden;
    box-shadow:0 24px 70px rgba(0,0,0,.6); animation:popup-up .3s ease }
  @keyframes popup-up{ from{transform:translateY(16px);opacity:.5} to{transform:none;opacity:1} }
  .popup-in img,.popup-in video{ display:block; max-width:100%; max-height:88vh; width:auto; height:auto }
  .popup-x{ position:absolute; top:10px; right:10px; width:34px; height:34px; border-radius:50%;
    background:rgba(0,0,0,.6); color:#fff; border:0; font-size:20px; line-height:1; cursor:pointer;
    display:flex; align-items:center; justify-content:center; z-index:2 }
  .popup-x:disabled{ opacity:.45 }
  .popup-timer{ position:absolute; bottom:10px; left:50%; transform:translateX(-50%);
    background:rgba(0,0,0,.6); color:#fff; font-size:11px; padding:4px 10px; border-radius:99px }
  .hint b{ color:var(--brand-2) }
  .foot{ text-align:center; color:var(--muted); font-size:11px; margin-top:20px; letter-spacing:.3px }
  .foot a{ color:inherit; text-decoration:underline }
  .fld-form{width:100%;box-sizing:border-box;padding:14px 16px;margin:0 0 10px;border:1.5px solid ${t.linha};border-radius:12px;font-size:16px;background:${t.campoBg};color:${t.campoTx}}
  .fld-form:focus{outline:none;border-color:${t.cor}}
  .fld-rot{font-size:12.5px;color:${t.muted};margin:2px 2px 6px;font-weight:600}
  .fld-rot b{color:${t.cor2};font-weight:700}
  .form-titulo{font-weight:800;font-size:17px;margin:4px 0 14px;color:var(--text)}
  .optin{display:flex;gap:9px;align-items:flex-start;margin:2px 2px 6px;font-size:12.5px;color:var(--muted);line-height:1.45;cursor:pointer}
  .optin input{flex:0 0 18px;width:18px;height:18px;margin-top:1px;accent-color:${t.cor};cursor:pointer}
  .optin a{color:${t.cor2};text-decoration:underline}
  .pby{text-align:center;margin-top:18px;padding-top:14px;border-top:1px solid var(--line);display:flex;align-items:center;justify-content:center;gap:7px}
  .pby span{font-size:10px;color:var(--muted);opacity:.7;letter-spacing:.5px}
  .logo-nome{font-size:26px;font-weight:900;background:linear-gradient(135deg,${t.cor},${t.cor2});-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;padding:8px 0}
  .modalPol{position:fixed;inset:0;background:rgba(6,8,14,.82);z-index:120;display:none;
    align-items:flex-end;justify-content:center;padding:0}
  .modalPol.on{display:flex}
  .modalPol-in{background:${t.card};width:100%;max-width:460px;max-height:88vh;
    border-radius:20px 20px 0 0;display:flex;flex-direction:column;
    border:1px solid var(--line);border-bottom:0;animation:sobe .22s ease}
  @keyframes sobe{from{transform:translateY(24px);opacity:.6}to{transform:none;opacity:1}}
  .modalPol-cab{display:flex;align-items:center;padding:16px 18px 12px;border-bottom:1px solid var(--line)}
  .modalPol-cab b{font-size:15px}
  .modalPol-x{margin-left:auto;background:transparent;border:0;color:var(--muted);
    font-size:26px;line-height:1;width:auto;padding:0 4px;margin:0;box-shadow:none;cursor:pointer}
  .modalPol-txt{overflow-y:auto;-webkit-overflow-scrolling:touch;padding:4px 18px 8px;font-size:13px;line-height:1.6}
  .modalPol-txt h2{font-size:13.5px;margin:16px 0 6px;color:var(--brand-2)}
  .modalPol-txt p,.modalPol-txt li{margin:0 0 8px;color:var(--muted)}
  .modalPol-txt ul{padding-left:18px;margin:0 0 8px}
  .modalPol-txt b{color:var(--text)}
  .modalPol-txt a{color:var(--brand-2)}
  .modalPol-ok{margin:8px 18px 18px;width:calc(100% - 36px)}
  @media(min-width:520px){ .modalPol{align-items:center} .modalPol-in{border-radius:20px;border-bottom:1px solid var(--line)} }
  .vcard{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;text-decoration:none;
     margin-top:10px;padding:14px;border-radius:13px;font-weight:700;font-size:14px;
     color:var(--text);background:${t.campoBg};border:1px solid var(--line)}
  @media (prefers-reduced-motion:no-preference){
    .card{ animation:rise .5s ease both } @keyframes rise{ from{opacity:0; transform:translateY(10px)} }
  }
</style>
</head>
<body><main class="card">${body}</main></body></html>`;
}

function hidden(ap) {
  // Reenvia os parâmetros do AP no POST (além do cookie), por robustez.
  return ['continue','ip','ap_mac','mac','radio','ssid','ts','redirect_uri','user_hash','loja','modo']
    .map(k => `<input type="hidden" name="${k}" value="${escapeAttr(ap[k] || '')}">`).join('');
}

// Aceita os 2 formatos de form_campos existentes no banco:
//  array  [{campo,label,obrigatorio}]   |   objeto {nome:{obrig:true}}
function lerCampos(fc) {
  if (!fc) return [];
  if (Array.isArray(fc)) {
    return fc.map(c => ({
      campo: c.campo || c.nome || c.key,
      label: c.label || c.rotulo || c.campo,
      obrigatorio: !!(c.obrigatorio !== undefined ? c.obrigatorio : (c.obrig !== undefined ? c.obrig : c.req)),
    })).filter(c => c.campo);
  }
  if (typeof fc === 'object') {
    return Object.entries(fc).map(([k, v]) => ({
      campo: k,
      label: (v && (v.label || v.rotulo)) || (k.charAt(0).toUpperCase() + k.slice(1)),
      obrigatorio: !!(v && (v.obrig !== undefined ? v.obrig : (v.obrigatorio !== undefined ? v.obrigatorio : v.req))),
    }));
  }
  return [];
}


// Texto da política — usado na página completa E no modal do portal.
function politicaCorpo() {
  return `
<h2>1. Quais dados coletamos</h2>
<ul>
<li><b>Informados por você:</b> nome, WhatsApp e, conforme o estabelecimento, aniversário, e-mail ou outros campos do formulário.</li>
<li><b>Técnicos da conexão:</b> endereço MAC do aparelho, endereço IP, tipo de dispositivo e sistema operacional, data e hora do acesso.</li>
</ul>
<h2>2. Para que usamos</h2>
<ul>
<li>Liberar seu acesso à internet no estabelecimento;</li>
<li>Cumprir a guarda de registros de conexão do Marco Civil da Internet (Lei 12.965/2014);</li>
<li>Permitir que o estabelecimento visitado envie comunicações e ofertas pelo WhatsApp e direcione ofertas em redes sociais, <b>somente quando você marca a caixa de consentimento</b>;</li>
<li>Reconhecer seu aparelho em visitas seguintes, para você não precisar preencher o cadastro de novo;</li>
<li>Gerar estatísticas de visitação (horários e frequência) para o estabelecimento.</li>
</ul>
<h2>3. Base legal (LGPD)</h2>
<p>Consentimento (art. 7º, I da Lei 13.709/2018) para marketing; cumprimento de obrigação legal (art. 7º, II) para os registros de conexão; e legítimo interesse (art. 7º, IX) para estatísticas de uso.</p>
<h2>4. Com quem compartilhamos</h2>
<p>Seus dados ficam visíveis apenas para o estabelecimento onde você se conectou e para o ConectaY, como operador. Não vendemos seus dados. Quando o estabelecimento usa plataformas de anúncio, o envio é criptografado, sem expor seu número.</p>
<h2>5. Por quanto tempo guardamos</h2>
<p>Registros de conexão: no mínimo 6 meses, conforme o Marco Civil. Dados de cadastro: enquanto durar o relacionamento com o estabelecimento ou até você pedir a exclusão.</p>
<h2>6. Seus direitos</h2>
<p>Você pode confirmar, acessar, corrigir, excluir seus dados ou revogar o consentimento a qualquer momento — basta responder "sair" a qualquer mensagem ou usar o contato abaixo.</p>
<h2>7. Segurança</h2>
<p>Dados armazenados em nuvem com criptografia em trânsito (HTTPS) e acesso por perfil: cada estabelecimento vê apenas os próprios clientes.</p>
<h2>8. Contato</h2>
<p>Encarregado de dados (DPO): <a href="mailto:raynoruan@icloud.com">raynoruan@icloud.com</a></p>`;
}

function renderPortal({ ap, instagram, autoCode, error, marca }) {
  marca = marca || {};
  // liberação automática: o código vai escondido no botão. Nunca pode ficar vazio,
  // senão o AP não libera. Ordem: o que veio > o da marca > o global do ambiente.
  autoCode = autoCode || marca.autoCode || process.env.AUTO_CODE || 'ABSOLEM';
  const logo = marca.logo || LOGO;
  const nome = marca.nome || 'Wi-Fi';
  const igHandle = (instagram || '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '@').replace(/\/$/, '') || ('@' + (marca.igHandle || ''));

  const destino = marca.destinoTipo || 'instagram';
  const campos = lerCampos(marca.formCampos);
  const ehForm   = destino === 'formulario' && campos.length > 0;
  const ehWpp    = destino === 'whatsapp' && marca.whatsappLink;
  const ehGoogle = destino === 'google_review' && marca.googleReviewUrl;

  const btnLabel = ehForm  ? '✅ Cadastrar e conectar'
                 : ehWpp   ? '💬 Entrar no grupo e conectar'
                 : ehGoogle? '⭐ Avaliar e conectar'
                 : '📸 Seguir no Instagram e conectar';
  const subTxt = marca.voltou
      ? 'Você já é cadastrado — é só um toque pra conectar.'
      : ehWpp    ? 'Toque no botão abaixo para entrar no nosso grupo e conectar à internet.'
      : ehGoogle ? 'Toque no botão abaixo para avaliar a gente e conectar à internet.'
      : ehForm   ? 'Preencha rapidinho e conecte-se em segundos.'
      : 'Toque no botão abaixo para seguir a gente e conectar à internet.';
  const hintTxt = ehWpp    ? 'Você vai entrar no nosso grupo de WhatsApp com a internet já liberada.'
                : ehGoogle ? 'Você vai para a nossa página de avaliação com a internet já liberada.'
                : ehForm   ? `Seus dados vão só pra ${escapeAttr(nome)}. Ao cadastrar, a internet libera na hora.`
                : `Você será direcionado ao nosso Instagram <b>${escapeAttr(igHandle)}</b> com a internet já liberada.`;

  // Campos de data usam TEXTO com máscara dd/mm/aaaa: o <input type=date>
  // fica vazio e sem dica no iOS (placeholder é ignorado). A conversão pro
  // formato do banco (aaaa-mm-dd) acontece via JS no envio do formulário.
  const tiposInput = { nome:'text', telefone:'tel', whatsapp:'tel', email:'email', cpf:'text', cep:'text', bairro:'text' };
  const ehData = c => c === 'aniversario' || c === 'nascimento';
  const camposHtml = ehForm ? campos.map(c => {
    const rot = `<div class="fld-rot">${escapeAttr(c.label)}${c.obrigatorio?' <b>*</b>':''}</div>`;
    if (ehData(c.campo)) {
      return rot + `<input class="fld-form fld-data" type="text" inputmode="numeric" maxlength="10"
        name="lead_${escapeAttr(c.campo)}" placeholder="dd/mm/aaaa" autocomplete="bday" ${c.obrigatorio?'required':''}>`;
    }
    if (c.campo === 'nome') {
      return rot + `<input class="fld-form fld-nome" type="text" maxlength="80" autocomplete="name"
        name="lead_${escapeAttr(c.campo)}" placeholder="${escapeAttr(c.label)}${c.obrigatorio?' *':''}" ${c.obrigatorio?'required':''}>`;
    }
    if (c.campo === 'telefone' || c.campo === 'whatsapp' || c.campo === 'celular') {
      return rot + `<input class="fld-form fld-tel" type="tel" inputmode="numeric" maxlength="16"
        name="lead_${escapeAttr(c.campo)}" placeholder="(21) 99999-9999" autocomplete="tel-national" ${c.obrigatorio?'required':''}>`;
    }
    return rot + `<input class="fld-form" type="${tiposInput[c.campo]||'text'}" name="lead_${escapeAttr(c.campo)}" placeholder="${escapeAttr(c.label)}${c.obrigatorio?' *':''}" ${c.obrigatorio?'required':''}>`;
  }).join('') : '';
  const formTitulo = marca.formTitulo || 'Cadastre-se para usar o Wi-Fi';
  const go = ehForm ? 'form' : destino;

  const body = `
    ${(marca.bannerAtivo && marca.mensagem) ? `<div class="banner-aviso">${escapeAttr(marca.mensagem)}</div>` : ''}
    <div class="logo">${(logo && !logo.endsWith('/static/logo.png')) ? `<img src="${escapeAttr(logo)}" alt="${escapeAttr(nome)}">` : `<div class="logo-nome">${escapeAttr(nome)}</div>`}</div>
    <h1>${
      marca.clienteNome
        ? (marca.clienteVip
            ? `⭐ Olá, ${escapeAttr(marca.clienteNome)}!`
            : `Que bom te ver, ${escapeAttr(marca.clienteNome)}!`)
        : (marca.voltou ? 'Que bom te ver de novo!' : 'Wi-Fi liberado')
    }</h1>
    <p class="sub">${subTxt}</p>

    ${error ? `<div class="err">${escapeAttr(error)}</div>` : ''}
    <form method="post" action="/auth" id="f">
      ${hidden(ap)}
      <input type="hidden" name="cyid" value="${escapeAttr(marca.cyid || '')}">
      <input type="hidden" name="code" value="${escapeAttr(autoCode || '')}">
      <input type="hidden" name="go" value="${escapeAttr(go)}">
      ${ehForm ? `<div class="form-titulo">${escapeAttr(formTitulo)}</div>${camposHtml}
      <label class="optin">
        <input type="checkbox" name="lead_optin" value="sim" required>
        <span>Aceito receber novidades e ofertas no WhatsApp e nas redes sociais, e concordo com a <a href="#" onclick="return abrirPolitica(event)">Política de Privacidade</a>.</span>
      </label>` : ''}
      <button type="submit" class="igbtn" id="btn">
        <span class="spin" aria-hidden="true"></span>
        <span class="lbl">${btnLabel}</span>
      </button>
    </form>
    <div class="hint" id="hint">${hintTxt}</div>

    <div class="foot">Ao conectar você concorda com nossos <a href="#" onclick="return abrirPolitica(event)">termos e política de privacidade</a>.</div>
    <div class="pby">
      <span>Wi-Fi por</span>
      <img src="${LOGO_CONECTAY}" alt="ConectaY" style="height:36px;object-fit:contain;opacity:.9">
    </div>

    <div class="modalPol" id="modalPol" aria-hidden="true" role="dialog" aria-label="Política de Privacidade">
      <div class="modalPol-in">
        <div class="modalPol-cab"><b>Política de Privacidade</b>
          <button type="button" class="modalPol-x" onclick="fecharPolitica()" aria-label="Fechar">&times;</button></div>
        <div class="modalPol-txt">${politicaCorpo()}</div>
        <button type="button" class="modalPol-ok" onclick="fecharPolitica()">Entendi</button>
      </div>
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

      // ---- Campos de data: máscara dd/mm/aaaa + conversão pro banco ----
      var camposData = [].slice.call(document.querySelectorAll('.fld-data'));
      camposData.forEach(function(inp){
        inp.addEventListener('input', function(){
          var d = inp.value.replace(/\\D/g,'').slice(0,8);
          var out = d;
          if (d.length > 4) out = d.slice(0,2)+'/'+d.slice(2,4)+'/'+d.slice(4);
          else if (d.length > 2) out = d.slice(0,2)+'/'+d.slice(2);
          inp.value = out;
        });
      });
      function dataValida(v){
        var m = v.match(/^(\\d{2})\\/(\\d{2})\\/(\\d{4})$/);
        if(!m) return null;
        var di=+m[1], me=+m[2], an=+m[3], agora=new Date().getFullYear();
        if(di<1||di>31||me<1||me>12||an<1900||an>agora) return null;
        return an+'-'+('0'+me).slice(-2)+'-'+('0'+di).slice(-2);
      }

      // ---- Campos de WhatsApp: máscara (XX) XXXXX-XXXX + validação BR ----
      var camposTel = [].slice.call(document.querySelectorAll('.fld-tel'));
      camposTel.forEach(function(inp){
        inp.addEventListener('input', function(){
          var d = inp.value.replace(/\\D/g,'').slice(0,11);
          var out = d;
          if (d.length > 7) out = '('+d.slice(0,2)+') '+d.slice(2,7)+'-'+d.slice(7);
          else if (d.length > 2) out = '('+d.slice(0,2)+') '+d.slice(2);
          inp.value = out;
        });
      });
      var DDDS = [11,12,13,14,15,16,17,18,19,21,22,24,27,28,31,32,33,34,35,37,38,
                  41,42,43,44,45,46,47,48,49,51,53,54,55,61,62,63,64,65,66,67,68,69,
                  71,73,74,75,77,79,81,82,83,84,85,86,87,88,89,91,92,93,94,95,96,97,98,99];
      function telValido(v){
        var d = v.replace(/\\D/g,'');
        if (d.length === 13 && d.slice(0,2) === '55') d = d.slice(2);
        if (d.length !== 11) return null;                       // celular BR = 11 dígitos
        if (DDDS.indexOf(+d.slice(0,2)) < 0) return null;       // DDD tem que existir
        if (d[2] !== '9') return null;                          // celular começa com 9
        var num = d.slice(2);
        var resto = num.slice(1);                               // 8 dígitos após o 9 fixo
        if (/^(\\d)\\1+$/.test(resto)) return null;               // 9 8888-8888 etc.
        if ('01234567890123456789'.indexOf(resto) >= 0) return null; // 9 1234-5678
        if ('98765432109876543210'.indexOf(resto) >= 0) return null; // 9 8765-4321
        return d;
      }

      // ---- Campo nome: só letras, espaço, hífen e apóstrofo ----
      var camposNome = [].slice.call(document.querySelectorAll('.fld-nome'));
      camposNome.forEach(function(inp){
        inp.addEventListener('input', function(){
          var limpo = inp.value.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ' -]/g, '');
          if (limpo !== inp.value) inp.value = limpo;
        });
      });

      f.addEventListener('submit',function(e){
        // valida o nome (mínimo 2 letras quando obrigatório)
        for (var k=0;k<camposNome.length;k++){
          var nin=camposNome[k];
          var nv=nin.value.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ' -]/g,'').replace(/ {2,}/g,' ').trim();
          nin.value=nv;
          if (nin.required && nv.length < 2){
            e.preventDefault();
            nin.style.borderColor='#e05a45'; nin.focus();
            nin.value=''; nin.placeholder='digite seu nome (só letras)';
            return false;
          }
        }
        // valida e converte as datas ANTES de qualquer coisa
        for (var i=0;i<camposData.length;i++){
          var inp=camposData[i], v=inp.value.trim();
          if (!v){ if(inp.required){ e.preventDefault(); inp.focus(); return false; } continue; }
          var iso=dataValida(v);
          if(!iso){
            e.preventDefault();
            inp.style.borderColor='#e05a45'; inp.focus();
            inp.value=''; inp.placeholder='data inválida — dd/mm/aaaa';
            return false;
          }
          inp.value=iso;   // banco recebe aaaa-mm-dd (formato do CRM)
        }
        // valida os WhatsApps (DDD real + celular com 9 + anti-fake)
        for (var j=0;j<camposTel.length;j++){
          var tin=camposTel[j], tv=tin.value.trim();
          if (!tv){ if(tin.required){ e.preventDefault(); tin.focus(); return false; } continue; }
          var tok=telValido(tv);
          if(!tok){
            e.preventDefault();
            tin.style.borderColor='#e05a45'; tin.focus();
            tin.value=''; tin.placeholder='número inválido — (DDD) 9XXXX-XXXX';
            return false;
          }
          tin.value=tok;   // envia só os dígitos, limpo
        }
        if(enviando){ e.preventDefault(); return false; }   // trava o clique duplo
        enviando=true;
        b.classList.add('carregando');
        b.disabled=true;
        b.querySelector('.lbl').textContent='Conectando…';
        ld.classList.add('on');
        setTimeout(function(){ if(ls)ls.textContent=${JSON.stringify('Quase lá… seu destino abre em seguida.')}; },2500);
        setTimeout(function(){ if(ls)ls.innerHTML='Tá demorando mais que o normal. Se não abrir, <b>toque no botão de novo</b>.'; liberar(); },9000);
      });
      function liberar(){
        enviando=false; b.disabled=false; b.classList.remove('carregando');
        b.querySelector('.lbl').textContent=${JSON.stringify(btnLabel)};
        ld.classList.remove('on');
      }
      window.addEventListener('pageshow',function(ev){ if(ev.persisted)liberar(); });
      var mp=document.getElementById('modalPol');
      mp.addEventListener('click',function(e){ if(e.target===this) fecharPolitica(); });
      document.addEventListener('keydown',function(e){ if(e.key==='Escape') fecharPolitica(); });
    })();
    function abrirPolitica(e){
      if(e){ e.preventDefault(); e.stopPropagation(); }
      var m=document.getElementById('modalPol');
      m.classList.add('on'); m.setAttribute('aria-hidden','false');
      return false;
    }
    function fecharPolitica(){
      var m=document.getElementById('modalPol');
      m.classList.remove('on'); m.setAttribute('aria-hidden','true');
    }
    ${(marca.popupAtivo && marca.popupUrl) ? `
    // ---- Pop-up promocional ----
    (function(){
      var tipo=${JSON.stringify(marca.popupTipo)};
      var url=${JSON.stringify(marca.popupUrl)};
      var link=${JSON.stringify(marca.popupLink)};
      var segs=${JSON.stringify(marca.popupSegundos)};
      var bg=document.createElement('div'); bg.className='popup-bg';
      var midia = tipo==='video'
        ? '<video src="'+url+'" autoplay muted playsinline loop></video>'
        : '<img src="'+url+'" alt="">';
      var clicavel = link ? 'style="cursor:pointer"' : '';
      bg.innerHTML='<div class="popup-in">'
        + '<button class="popup-x" id="popX" title="Fechar">&times;</button>'
        + '<div id="popMidia" '+clicavel+'>'+midia+'</div>'
        + (segs>0?'<div class="popup-timer" id="popTimer"></div>':'')
        + '</div>';
      document.body.appendChild(bg);
      function fechar(){ if(bg.parentNode) bg.parentNode.removeChild(bg); }
      var x=document.getElementById('popX');
      if(link){ document.getElementById('popMidia').onclick=function(){ window.open(link,'_blank'); }; }
      if(segs>0){
        var rest=segs; x.disabled=true;
        var tm=document.getElementById('popTimer');
        tm.textContent='Fecha em '+rest+'s';
        var iv=setInterval(function(){
          rest--;
          if(rest<=0){ clearInterval(iv); fechar(); }
          else tm.textContent='Fecha em '+rest+'s';
        },1000);
        // libera o X quando o tempo acabar (ou deixa fechar sozinho)
        setTimeout(function(){ x.disabled=false; }, segs*1000);
      }
      x.onclick=fechar;
      bg.onclick=function(e){ if(e.target===bg && !x.disabled) fechar(); };
    })();
    ` : ''}
    </script>`;
  return layout({ title: escapeAttr(nome) + ' — Wi-Fi', body, marca });
}

// Tela de aviso/erro — AGORA usa a marca da loja (antes era fixa na Absolem).
function renderResult({ ok, title, msg, link, marca }) {
  marca = marca || {};
  const logo = marca.logo || LOGO;
  const nome = marca.nome || 'Wi-Fi';
  const body = `
    <div class="logo">${(logo && !logo.endsWith('/static/logo.png')) ? `<img src="${escapeAttr(logo)}" alt="${escapeAttr(nome)}">` : `<div class="logo-nome">${escapeAttr(nome)}</div>`}</div>
    <h1>${escapeAttr(title)}</h1>
    <p class="sub">${escapeAttr(msg)}</p>
    ${link ? `<a href="${escapeAttr(link.href)}" class="igbtn" style="text-decoration:none;margin-top:18px">${escapeAttr(link.label)}</a>` : ''}`;
  return layout({ title: `${escapeAttr(nome)} — ${escapeAttr(title)}`, body, marca });
}

// Tela pós-liberação: oferece salvar o contato e segue pro destino.
// ATUALIZADO: no Android, destino Instagram abre o APP via intent:// —
// tentativa automática + botão como garantia (o mini-navegador do captive
// pode bloquear navegação automática pra apps externos).
function renderPronto({ marca, destinoUrl, rotulo, cupomHtml }) {
  marca = marca || {};
  const logo = marca.logo || LOGO;
  const nome = marca.nome || 'Wi-Fi';

  // Detecta destino Instagram e monta as variantes de link.
  // O handle vem da URL do destino OU da marca da loja (caso o destino
  // seja a rota /ig, que não contém o nome do perfil).
  const igMatch = String(destinoUrl || '').match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  const igHandle = igMatch ? igMatch[1] : ((marca.igHandle || '').replace(/^@/, '') || null);
  const igUniversal = igHandle ? `https://instagram.com/${igHandle}` : null;
  const igIntent = igHandle
    ? `intent://instagram.com/_u/${igHandle}#Intent;package=com.instagram.android;scheme=https;S.browser_fallback_url=${encodeURIComponent(destinoUrl)};end`
    : null;
  const igApp = igHandle ? `instagram://user?username=${igHandle}` : null;

  const body = `
    <div class="logo">${(logo && !logo.endsWith('/static/logo.png')) ? `<img src="${escapeAttr(logo)}" alt="${escapeAttr(nome)}">` : `<div class="logo-nome">${escapeAttr(nome)}</div>`}</div>
    <h1>✅ Internet liberada!</h1>
    <p class="sub">Aproveite. Salve nosso contato pra receber as novidades em primeira mão.</p>
    ${cupomHtml || ''}
    <a class="vcard" href="/contato.vcf" download>📇 Salvar o contato da ${escapeAttr(nome)}</a>
    <a class="igbtn" id="btnDest" style="text-decoration:none;margin-top:14px" href="${escapeAttr(destinoUrl)}">${escapeAttr(rotulo)}</a>
    <div class="hint" id="hintDest"></div>
    <div class="pby"><span>Wi-Fi por</span>
      <img src="${LOGO_CONECTAY}" alt="ConectaY" style="height:36px;object-fit:contain;opacity:.9"></div>
    <script>
    (function(){
      var destino     = ${JSON.stringify(destinoUrl)};
      var igIntent    = ${JSON.stringify(igIntent)};
      var igApp       = ${JSON.stringify(igApp)};
      var igUniversal = ${JSON.stringify(igUniversal)};
      var isAndroid = /Android/i.test(navigator.userAgent || '');
      var isIOS     = /iPhone|iPad|iPod/i.test(navigator.userAgent || '');
      var btn  = document.getElementById('btnDest');
      var hint = document.getElementById('hintDest');

      if (isAndroid && igIntent) {
        // ANDROID + INSTAGRAM: intent:// abre o app de verdade.
        btn.setAttribute('href', igIntent);
        hint.innerHTML = 'Se o Instagram não abrir sozinho, <b>toque no botão acima</b> 👆';
        // Tentativa automática (2s — dá tempo da pessoa ver que conectou).
        setTimeout(function(){ try { window.location.href = igIntent; } catch(e){} }, 2000);
        // Sem fallback web automático: abrir o site do IG no mini-navegador
        // do captive só atrapalha; o botão resolve os casos bloqueados.
      } else if (isIOS && igUniversal) {
        // iOS + INSTAGRAM: o Universal Link abre o app sozinho (não é
        // bloqueado como o instagram://). Dispara automático + botão de garantia.
        btn.setAttribute('href', igUniversal);
        hint.innerHTML = 'Se o Instagram não abrir sozinho, <b>toque no botão acima</b> 👆';
        setTimeout(function(){ try { window.location.href = igApp; } catch(e){} }, 1500);
        setTimeout(function(){ window.location.href = igUniversal; }, 2400);
      } else if (isIOS && igApp) {
        // iOS + INSTAGRAM (sem handle detectável): tenta o app, cai pro site.
        setTimeout(function(){
          window.location.href = igApp;
          setTimeout(function(){ window.location.href = destino; }, 1500);
        }, 2000);
      } else {
        // Demais destinos (WhatsApp, Google Review, desktop): comportamento original.
        setTimeout(function(){ window.location.href = destino; }, 12000);
      }
    })();
    </script>`;
  return layout({ title: `${escapeAttr(nome)} — Conectado`, body, marca });
}

// Política de privacidade (privacidade.conectay.com.br e /privacidade)
function renderPrivacidade() {
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Política de Privacidade · ConectaY</title>
<link rel="icon" type="image/png" href="https://i.postimg.cc/BQjJGBKf/logo-conectay-transparent.png">
<style>
 :root{--azul:#0ea5e9;--ciano:#22d3ee;--navy:#0a0f1e;--borda:#1e293b;--texto:#e2e8f0;--mudo:#94a3b8}
 *{box-sizing:border-box;margin:0;padding:0}
 body{background:var(--navy);color:var(--texto);font-family:system-ui,-apple-system,"Segoe UI",sans-serif;line-height:1.7}
 .wrap{max-width:760px;margin:0 auto;padding:40px 22px 70px}
 h1{font-size:1.7rem;margin-bottom:6px}
 .data{color:var(--mudo);font-size:.83rem;margin-bottom:30px}
 h2{font-size:1.05rem;margin:28px 0 10px;color:var(--ciano)}
 p,li{font-size:.93rem;margin-bottom:10px} ul{padding-left:22px} a{color:var(--ciano)}
 footer{margin-top:40px;padding-top:18px;border-top:1px solid var(--borda);color:var(--mudo);font-size:.8rem}
</style></head><body><div class="wrap">
<img src="https://i.postimg.cc/BQjJGBKf/logo-conectay-transparent.png" alt="ConectaY" style="width:64px;height:64px;object-fit:contain;margin-bottom:18px">
<h1>Política de Privacidade</h1>
<div class="data">ConectaY · última atualização: julho de 2026</div>
<p>Esta política explica como o <b>ConectaY</b> trata os dados pessoais coletados quando você se conecta ao Wi-Fi de um estabelecimento parceiro através do nosso portal.</p>
<h2>1. Quais dados coletamos</h2>
<ul>
<li><b>Informados por você:</b> nome, WhatsApp e, conforme o estabelecimento, aniversário, e-mail ou outros campos do formulário.</li>
<li><b>Técnicos da conexão:</b> endereço MAC do aparelho, endereço IP, tipo de dispositivo e sistema operacional, data e hora do acesso.</li>
</ul>
<h2>2. Para que usamos</h2>
<ul>
<li>Liberar seu acesso à internet no estabelecimento;</li>
<li>Cumprir a guarda de registros de conexão do Marco Civil da Internet (Lei 12.965/2014);</li>
<li>Permitir que o estabelecimento visitado envie comunicações e ofertas pelo WhatsApp e direcione ofertas em redes sociais, <b>somente quando você marca a caixa de consentimento</b>;</li>
<li>Reconhecer seu aparelho em visitas seguintes, para você não precisar preencher o cadastro de novo;</li>
<li>Gerar estatísticas de visitação (horários e frequência) para o estabelecimento.</li>
</ul>
<h2>3. Base legal (LGPD)</h2>
<p>Consentimento (art. 7º, I da Lei 13.709/2018) para marketing; cumprimento de obrigação legal (art. 7º, II) para os registros de conexão; e legítimo interesse (art. 7º, IX) para estatísticas de uso.</p>
<h2>4. Com quem compartilhamos</h2>
<p>Seus dados ficam visíveis apenas para o estabelecimento onde você se conectou e para o ConectaY, como operador. Não vendemos seus dados. Quando o estabelecimento usa plataformas de anúncio, o envio é criptografado, sem expor seu número.</p>
<h2>5. Por quanto tempo guardamos</h2>
<p>Registros de conexão: no mínimo 6 meses, conforme o Marco Civil. Dados de cadastro: enquanto durar o relacionamento com o estabelecimento ou até você pedir a exclusão.</p>
<h2>6. Seus direitos</h2>
<p>Você pode confirmar, acessar, corrigir, excluir seus dados ou revogar o consentimento a qualquer momento — basta responder "sair" a qualquer mensagem ou usar o contato abaixo.</p>
<h2>7. Segurança</h2>
<p>Dados armazenados em nuvem com criptografia em trânsito (HTTPS) e acesso por perfil: cada estabelecimento vê apenas os próprios clientes.</p>
<h2>8. Contato</h2>
<p>Encarregado de dados (DPO): <a href="mailto:raynoruan@icloud.com">raynoruan@icloud.com</a></p>
<footer>ConectaY · Rio de Janeiro/RJ · <a href="https://conectay.com.br">conectay.com.br</a></footer>
</div></body></html>`;
}

// vCard do contato da loja
function montarVcard(loja) {
  const tel = String(loja.vcard_telefone || '').replace(/\D/g, '');
  const nome = String(loja.vcard_nome || loja.nome || 'Contato').replace(/[\r\n]/g, ' ');
  const l = ['BEGIN:VCARD','VERSION:3.0',`N:;${nome};;;`,`FN:${nome}`,`ORG:${nome}`,`TEL;TYPE=CELL:+55${tel}`];
  if (loja.instagram) l.push(`URL:https://instagram.com/${String(loja.instagram).replace('@','')}`);
  if (loja.endereco)  l.push(`ADR;TYPE=WORK:;;${String(loja.endereco).replace(/[\r\n,]/g,' ')};;;;`);
  l.push('END:VCARD');
  return l.join('\r\n');
}

// ============================================================
// BALCÃO — tela onde o atendente valida e dá baixa nos cupons.
// Tema escuro, PIN de acesso, os 5 resultados. Tudo client-side
// falando com /api/balcao/:slug/*.
// ============================================================
function renderBalcao(loja) {
  const slug = escapeAttr(loja.slug);
  const nome = escapeAttr(loja.nome || 'Loja');
  return `<!doctype html><html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>Balcão — ${nome}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
  body{font-family:-apple-system,"Segoe UI",Roboto,Arial,sans-serif;background:#171512;color:#FAF8F5;min-height:100vh;padding:20px}
  .wrap{max-width:460px;margin:0 auto}
  .cab{display:flex;align-items:center;gap:12px;margin-bottom:20px}
  .cab .av{width:40px;height:40px;border-radius:11px;background:#FAF8F5;color:#171512;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px;overflow:hidden}
  .cab .av img{width:100%;height:100%;object-fit:cover}
  .cab h1{font-size:17px;font-weight:800}.cab .sub{font-size:12px;color:rgba(250,248,245,.5)}
  label{display:block;font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:rgba(250,248,245,.5);margin:14px 0 7px}
  input{width:100%;background:rgba(250,248,245,.06);border:1.5px solid rgba(250,248,245,.18);border-radius:12px;padding:14px;color:#FAF8F5;font-size:16px}
  input:focus{outline:none;border-color:rgba(250,248,245,.5)}
  .cod{font-family:ui-monospace,"JetBrains Mono",monospace;font-size:18px;font-weight:700;letter-spacing:.1em;text-transform:uppercase}
  .btn{width:100%;background:#FAF8F5;color:#171512;border:0;border-radius:12px;padding:15px;font-weight:800;font-size:15.5px;cursor:pointer;margin-top:12px}
  .btn:disabled{background:rgba(250,248,245,.14);color:rgba(250,248,245,.4);cursor:not-allowed}
  .btn-amber{background:oklch(.88 .11 88);color:#171512}
  .btn-line{background:transparent;border:1.5px dashed rgba(250,248,245,.3);color:#FAF8F5}
  .res{margin-top:18px;animation:rise .3s ease-out}
  @keyframes rise{from{transform:translateY(10px);opacity:0}to{transform:none;opacity:1}}
  .card{border-radius:14px;padding:16px 18px;margin-top:14px}
  .card-amber{background:oklch(.88 .11 88);color:#171512}
  .card-ok{background:oklch(.55 .11 155);color:#fff}
  .card-line{border:1.5px solid rgba(250,248,245,.18)}
  .card .big{font-size:19px;font-weight:800}.card .mid{font-size:15px;font-weight:700;margin-top:4px}
  .card .meta{font-size:12.5px;opacity:.85;margin-top:6px;line-height:1.5}
  .rodape{display:flex;gap:12px;margin-top:26px;padding-top:16px;border-top:1px solid rgba(250,248,245,.12)}
  .rodape div{flex:1;text-align:center}.rodape .n{font-size:19px;font-weight:800}.rodape .l{font-size:11px;color:rgba(250,248,245,.4)}
  .rs{display:flex;align-items:center}.rs .rr{position:relative;left:0}
  .val{display:flex;align-items:center;gap:0;margin-top:12px;background:rgba(250,248,245,.06);border:1.5px solid rgba(250,248,245,.18);border-radius:12px;overflow:hidden}
  .val span{padding:0 14px;font-weight:700;color:rgba(250,248,245,.6)}
  .val input{border:0;background:transparent;border-radius:0}
  .hide{display:none}
  .erro{color:oklch(.7 .17 27);font-size:13px;margin-top:8px}
  .pin-box{max-width:280px;margin:60px auto 0;text-align:center}
  .pin-box input{text-align:center;font-size:28px;letter-spacing:.3em;font-family:ui-monospace,monospace}
</style></head><body>
<div class="wrap">
  <!-- PIN -->
  <div id="telaPin" class="pin-box">
    <div class="cab" style="justify-content:center">
      <div class="av">${loja.logo_url ? `<img src="${escapeAttr(loja.logo_url)}">` : nome.slice(0,2).toUpperCase()}</div>
    </div>
    <h1 style="font-size:19px;margin-bottom:6px">${nome}</h1>
    <p style="color:rgba(250,248,245,.5);font-size:13px;margin-bottom:18px">Balcão — digite o PIN do atendente</p>
    <input id="pin" class="cod" inputmode="numeric" maxlength="4" placeholder="••••">
    <button class="btn" onclick="entrar()">Entrar</button>
    <div id="pinErro" class="erro"></div>
  </div>

  <!-- BALCÃO -->
  <div id="telaBalcao" class="hide">
    <div class="cab">
      <div class="av">${loja.logo_url ? `<img src="${escapeAttr(loja.logo_url)}">` : nome.slice(0,2).toUpperCase()}</div>
      <div><h1>Validar cupom</h1><div class="sub" id="subAtend">${nome}</div></div>
    </div>
    <label>Código do cupom</label>
    <input id="code" class="cod" placeholder="CY-XXXX" autocomplete="off">
    <button class="btn" onclick="consultar()">Ver cupom</button>
    <div id="resultado"></div>
    <div class="rodape">
      <div><div class="n" id="rHoje">0</div><div class="l">resgates hoje</div></div>
      <div><div class="n" id="rVal">R$ 0</div><div class="l">vendas hoje</div></div>
    </div>
  </div>
</div>
<script>
  var SLUG=${JSON.stringify(loja.slug)};
  var ATEND=null, PEDIR_VALOR=true, ATUAL=null;
  var codeUp=document.getElementById('code');
  if(codeUp) codeUp.addEventListener('input',function(){ this.value=this.value.toUpperCase(); });

  async function entrar(){
    var pin=document.getElementById('pin').value.trim();
    if(pin.length<4){ document.getElementById('pinErro').textContent='Digite os 4 dígitos.'; return; }
    var r=await fetch('/api/balcao/'+SLUG+'/pin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin:pin})});
    if(!r.ok){ document.getElementById('pinErro').textContent='PIN incorreto.'; return; }
    var d=await r.json();
    ATEND=pin; PEDIR_VALOR=!!d.loja.pedir_valor;
    try{ document.cookie='balcao_pin='+pin+';max-age=43200;path=/'; }catch(e){}
    document.getElementById('telaPin').classList.add('hide');
    document.getElementById('telaBalcao').classList.remove('hide');
    atualizarRodape();
  }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
  function ofertaTxt(k,v){ if(k==='percent')return v+'% OFF'; if(k==='amount')return 'R$ '+v+' OFF'; if(k==='gift')return 'Brinde'; if(k==='bogo')return 'Compre 1 leve 2'; return v; }
  function fmtDT(s){ if(!s)return '—'; var d=new Date(s); return d.toLocaleDateString('pt-BR')+' '+d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}); }

  async function consultar(){
    var code=document.getElementById('code').value.trim();
    if(!code){ return; }
    var box=document.getElementById('resultado'); box.innerHTML='<div class="res" style="color:rgba(250,248,245,.5);padding:14px">Buscando…</div>';
    var r=await fetch('/api/balcao/'+SLUG+'/consultar?code='+encodeURIComponent(code));
    var d=await r.json(); ATUAL=d; render(d,code);
  }
  function render(d,code){
    var box=document.getElementById('resultado'); var nome=d.lead?esc(d.lead.nome||'Cliente'):'Cliente';
    if(d.resultado==='active'){
      var valorInput = PEDIR_VALOR ? '<div class="val"><span>R$</span><input id="valor" inputmode="decimal" placeholder="0,00" oninput="chkValor()"></div>' : '';
      box.innerHTML='<div class="res"><div class="card card-amber">'
        +'<div class="big">'+ofertaTxt(d.offer_kind,d.offer_value)+'</div>'
        +'<div class="mid">'+nome+'</div>'
        +'<div class="meta">'+(d.min_purchase?('Mín. R$ '+d.min_purchase+' · '):'')+'vence '+fmtDT(d.expires_at)+'</div>'
        +'</div>'+valorInput
        +'<button id="btnBaixa" class="btn" '+(PEDIR_VALOR?'disabled':'')+' onclick="baixa(false,false)">Dar baixa no cupom</button></div>';
    } else if(d.resultado==='redeemed'){
      box.innerHTML='<div class="res"><div class="card card-line">'
        +'<div class="big">Já resgatado</div>'
        +'<div class="meta">Baixa em '+fmtDT(d.redeemed_at)+(d.redeemed_by?(' · '+esc(d.redeemed_by)):'')+(d.redeemed_amount?(' · R$ '+d.redeemed_amount):'')+'</div>'
        +'</div><button class="btn btn-line" onclick="baixa(true,false)">Liberar mesmo assim</button></div>';
    } else if(d.resultado==='expired'){
      box.innerHTML='<div class="res"><div class="card card-line">'
        +'<div class="big">Vencido</div><div class="meta">Venceu '+fmtDT(d.expires_at)+'</div>'
        +'</div><button class="btn btn-amber" onclick="baixa(false,true)">Renovar por hoje e dar baixa</button></div>';
    } else if(d.resultado==='cancelled'){
      box.innerHTML='<div class="res"><div class="card card-line"><div class="big">Cupom cancelado</div></div></div>';
    } else {
      box.innerHTML='<div class="res"><div class="card card-line"><div class="big">Não encontrado</div>'
        +'<div class="meta">Confira o código digitado.</div></div></div>';
    }
  }
  function chkValor(){ var v=document.getElementById('valor').value.replace(/[^0-9.,]/g,''); var b=document.getElementById('btnBaixa'); if(b) b.disabled = !(v && parseFloat(v.replace(',','.'))>0); }
  async function baixa(force,renew){
    var code=document.getElementById('code').value.trim();
    var amount=null; var vi=document.getElementById('valor');
    if(vi){ var v=vi.value.replace(/[^0-9.,]/g,'').replace(',','.'); amount=v?parseFloat(v):null; }
    var body={code:code,actor:'PIN '+ATEND,force:force,renew:renew,amount:amount};
    var r=await fetch('/api/balcao/'+SLUG+'/baixa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    var d=await r.json();
    var box=document.getElementById('resultado');
    if(d.ok){
      box.innerHTML='<div class="res"><div class="card card-ok"><div class="big">Baixa feita ✓</div>'
        +(amount?('<div class="meta">R$ '+amount.toFixed(2).replace(".",",")+' registrado</div>'):'')
        +'</div><button class="btn btn-line" onclick="reset()">Validar outro</button></div>';
      atualizarRodape();
    } else {
      // conflito (já resgatado por outro caixa) — re-renderiza o estado atual
      render(d,code);
    }
  }
  function reset(){ document.getElementById('code').value=''; document.getElementById('resultado').innerHTML=''; document.getElementById('code').focus(); }
  async function atualizarRodape(){
    try{
      var r=await fetch('/api/balcao/'+SLUG+'/consultar?code=__stats__'); // fallback simples: usa receita via endpoint dedicado se existir
    }catch(e){}
  }
</script>
</body></html>`;
}

// Cartão do cupom exibido no portal (passo final, dentro do renderPronto).
function renderCupomHtml(cupom, marca, t) {
  if (!cupom || !cupom.code) return '';
  const primeiro = (marca.nome || '').split(' ')[0] || 'Você';
  const oferta = cupom.offer_kind === 'percent' ? `${cupom.offer_value}% OFF`
    : cupom.offer_kind === 'amount' ? `R$ ${cupom.offer_value} OFF`
    : cupom.offer_kind === 'gift' ? 'BRINDE' : 'COMPRE 1 LEVE 2';
  const venc = cupom.expires_at ? new Date(cupom.expires_at).toLocaleDateString('pt-BR') : '';
  return `
    <div class="cupom">
      <div class="cupom-top">
        <div class="cupom-eyebrow">Seu presente</div>
        <div class="cupom-valor">${escapeAttr(oferta)}</div>
        ${cupom.min_purchase ? `<div class="cupom-cond">nas compras acima de R$ ${escapeAttr(String(cupom.min_purchase))}</div>` : ''}
      </div>
      <div class="cupom-pic"></div>
      <div class="cupom-base">
        <div class="cupom-rot">mostre no caixa</div>
        <div class="cupom-code">${escapeAttr(cupom.code)}</div>
        ${venc ? `<div class="cupom-val">válido até ${escapeAttr(venc)}</div>` : ''}
      </div>
    </div>`;
}

module.exports = { renderPortal, renderResult, renderPronto, renderPrivacidade, montarVcard, lerCampos, renderBalcao, renderCupomHtml };
