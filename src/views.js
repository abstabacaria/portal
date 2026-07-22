// Páginas HTML renderizadas pelo servidor (sem framework de template para
// manter zero dependências extras).
// A identidade visual agora vem DA LOJA (cores, fundo, logo). O texto se
// ajusta sozinho ao contraste do cartão, então nenhuma combinação de cores
// deixa o portal ilegível.

const LOGO = '/static/logo.png';
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
  .hint b{ color:var(--brand-2) }
  .foot{ text-align:center; color:var(--muted); font-size:11px; margin-top:20px; letter-spacing:.3px }
  .foot a{ color:inherit; text-decoration:underline }
  .fld-form{width:100%;box-sizing:border-box;padding:14px 16px;margin:0 0 10px;border:1.5px solid ${t.linha};border-radius:12px;font-size:16px;background:${t.campoBg};color:${t.campoTx}}
  .fld-form:focus{outline:none;border-color:${t.cor}}
  .form-titulo{font-weight:800;font-size:17px;margin:4px 0 14px;color:var(--text)}
  .optin{display:flex;gap:9px;align-items:flex-start;margin:2px 2px 6px;font-size:12.5px;color:var(--muted);line-height:1.45;cursor:pointer}
  .optin input{flex:0 0 18px;width:18px;height:18px;margin-top:1px;accent-color:${t.cor};cursor:pointer}
  .optin a{color:${t.cor2};text-decoration:underline}
  .pby{text-align:center;margin-top:18px;padding-top:14px;border-top:1px solid var(--line);display:flex;align-items:center;justify-content:center;gap:7px}
  .pby span{font-size:10px;color:var(--muted);opacity:.7;letter-spacing:.5px}
  .logo-nome{font-size:26px;font-weight:900;background:linear-gradient(135deg,${t.cor},${t.cor2});-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;padding:8px 0}
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
  return ['continue','ip','ap_mac','mac','radio','ssid','ts','redirect_uri','user_hash','loja']
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

  const tiposInput = { nome:'text', telefone:'tel', whatsapp:'tel', email:'email', aniversario:'date', nascimento:'date', cpf:'text', cep:'text', bairro:'text' };
  const camposHtml = ehForm ? campos.map(c =>
    `<input class="fld-form" type="${tiposInput[c.campo]||'text'}" name="lead_${escapeAttr(c.campo)}" placeholder="${escapeAttr(c.label)}${c.obrigatorio?' *':''}" ${c.obrigatorio?'required':''}>`
  ).join('') : '';
  const formTitulo = marca.formTitulo || 'Cadastre-se para usar o Wi-Fi';
  const go = ehForm ? 'form' : destino;

  const body = `
    <div class="logo">${(logo && !logo.endsWith('/static/logo.png')) ? `<img src="${escapeAttr(logo)}" alt="${escapeAttr(nome)}">` : `<div class="logo-nome">${escapeAttr(nome)}</div>`}</div>
    <h1>${marca.voltou ? 'Que bom te ver de novo!' : 'Wi-Fi liberado'}</h1>
    <p class="sub">${subTxt}</p>

    ${error ? `<div class="err">${escapeAttr(error)}</div>` : ''}
    <form method="post" action="/auth" id="f">
      ${hidden(ap)}
      <input type="hidden" name="code" value="${escapeAttr(autoCode || '')}">
      <input type="hidden" name="go" value="${escapeAttr(go)}">
      ${ehForm ? `<div class="form-titulo">${escapeAttr(formTitulo)}</div>${camposHtml}
      <label class="optin">
        <input type="checkbox" name="lead_optin" value="sim" required>
        <span>Aceito receber novidades e ofertas no WhatsApp e nas redes sociais, e concordo com a <a href="${escapeAttr(PRIVACIDADE_URL)}" target="_blank" rel="noopener">Política de Privacidade</a>.</span>
      </label>` : ''}
      <button type="submit" class="igbtn" id="btn">
        <span class="spin" aria-hidden="true"></span>
        <span class="lbl">${btnLabel}</span>
      </button>
    </form>
    <div class="hint" id="hint">${hintTxt}</div>

    <div class="foot">Ao conectar você concorda com nossos <a href="${escapeAttr(PRIVACIDADE_URL)}" target="_blank" rel="noopener">termos e política de privacidade</a>.</div>
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
        setTimeout(function(){ if(ls)ls.textContent=${JSON.stringify(ehWpp?'Quase lá… o grupo abre em seguida.':ehGoogle?'Quase lá… a avaliação abre em seguida.':'Quase lá… o Instagram abre em seguida.')}; },2500);
        setTimeout(function(){ if(ls)ls.innerHTML='Tá demorando mais que o normal. Se não abrir, <b>toque no botão de novo</b>.'; liberar(); },9000);
      });
      function liberar(){
        enviando=false; b.disabled=false; b.classList.remove('carregando');
        b.querySelector('.lbl').textContent=${JSON.stringify(btnLabel)};
        ld.classList.remove('on');
      }
      window.addEventListener('pageshow',function(ev){ if(ev.persisted)liberar(); });
    })();
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
function renderPronto({ marca, destinoUrl, rotulo }) {
  marca = marca || {};
  const logo = marca.logo || LOGO;
  const nome = marca.nome || 'Wi-Fi';
  const body = `
    <div class="logo">${(logo && !logo.endsWith('/static/logo.png')) ? `<img src="${escapeAttr(logo)}" alt="${escapeAttr(nome)}">` : `<div class="logo-nome">${escapeAttr(nome)}</div>`}</div>
    <h1>✅ Internet liberada!</h1>
    <p class="sub">Aproveite. Salve nosso contato pra receber as novidades em primeira mão.</p>
    <a class="vcard" href="/contato.vcf" download>📇 Salvar o contato da ${escapeAttr(nome)}</a>
    <a class="igbtn" style="text-decoration:none;margin-top:14px" href="${escapeAttr(destinoUrl)}">${escapeAttr(rotulo)}</a>
    <div class="pby"><span>Wi-Fi por</span>
      <img src="https://i.postimg.cc/BQjJGBKf/logo-conectay-transparent.png" alt="ConectaY" style="height:36px;object-fit:contain;opacity:.9"></div>
    <script>setTimeout(function(){ location.href=${JSON.stringify(destinoUrl)}; }, 12000);</script>`;
  return layout({ title: `${escapeAttr(nome)} — Conectado`, body, marca });
}

// Política de privacidade (privacidade.conectay.com.br e /privacidade)
function renderPrivacidade() {
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Política de Privacidade · ConectaY</title>
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

module.exports = { renderPortal, renderResult, renderPronto, renderPrivacidade, montarVcard, lerCampos };
