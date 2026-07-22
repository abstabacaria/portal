// ============================================================
// CONECTAY — server.js (Railway, porta 8080)
// Rotas:
//   GET  /          portal da loja (resolvida pelo Host ou ?loja=slug)
//   POST /lead      grava lead (modo formulario) -> sucesso -> destino
//   POST /conectar  modo instagram: registra acesso -> sucesso -> destino
//   GET  /auth      fluxo do AP (?code=&mac=&s=AP_SECRET)
//   GET  /ig        redireciona pro Instagram da loja certa
//   GET  /health    status + últimos logs
// ============================================================

const express = require('express');
const { resolverLoja, registrarAcesso, registrarLead, visitaDispositivo, marcarCadastrado } = require('./lojas');
const { validateCode, validateApSecret, accessLog, getLog, AUTO_CODE } = require('./db');
const views = require('./views');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set('trust proxy', true);

const PORT = process.env.PORT || 8080;

function ctx(req) {
  return {
    host: req.headers['x-forwarded-host'] || req.headers.host || '',
    ip: req.ip,
    userAgent: req.headers['user-agent'] || '',
    mac: (req.query.mac || req.body?.mac || '').toString().slice(0, 32),
    continueUrl: (req.query.continue || req.body?.continue || '').toString().slice(0, 500)
  };
}

async function lojaDoRequest(req) {
  const c = ctx(req);
  return resolverLoja(c.host, (req.query.loja || '').toString() || null);
}

// ---------- Portal ----------
app.get('/', async (req, res) => {
  try {
    const c = ctx(req);
    const loja = await lojaDoRequest(req);
    if (!loja) return res.status(404).send(views.telaErro('Portal não encontrado para este endereço.'));
    // portal inteligente: reconhece o aparelho e escolhe a tela
    let destino = loja.destino_tipo, info = null;
    if (loja.rotacao_ativa) {
      info = await visitaDispositivo(loja.id, c.mac);
      if (info && info.destino) destino = info.destino;
    }
    accessLog('portal_view', { loja: loja.slug, mac: c.mac, destino,
                               motivo: info && info.motivo, visitas: info && info.visitas });

    const lojaTela = Object.assign({}, loja, { destino_tipo: destino });
    const tela = (destino === 'formulario')
      ? views.telaFormulario(lojaTela, { mac: c.mac, continueUrl: c.continueUrl })
      : views.telaBotao(lojaTela, { mac: c.mac, continueUrl: c.continueUrl,
          voltou: !!(info && info.conhecido) });
    res.send(tela);
  } catch (e) {
    console.error(e);
    res.status(500).send(views.telaErro('Erro interno. Tente novamente.'));
  }
});

// ---------- Lead (modo formulário) ----------
app.post('/lead', async (req, res) => {
  try {
    const c = ctx(req);
    const loja = await lojaDoRequest(req);
    if (!loja) return res.status(404).send(views.telaErro('Portal não encontrado.'));

    const telefone = String(req.body.telefone || '').replace(/\D/g, '');
    if (telefone.length < 10) {
      return res.send(views.telaFormulario(loja, { erro: 'Informe um WhatsApp válido com DDD.', mac: c.mac, continueUrl: c.continueUrl }));
    }
    if (!req.body.optin) {
      return res.send(views.telaFormulario(loja, { erro: 'É preciso aceitar a política de privacidade para conectar.', mac: c.mac, continueUrl: c.continueUrl }));
    }

    const extras = {};
    for (const cp of views.lerCampos(loja.form_campos)) {
      if (['nome','telefone'].includes(cp.campo)) continue;
      const v = req.body[cp.campo];
      if (v) extras[cp.campo] = String(v).slice(0, 200);
    }
    await registrarLead(loja.id, {
      nome: String(req.body.nome || '').slice(0, 120),
      telefone,
      aniversario: /^\d{4}-\d{2}-\d{2}$/.test(req.body.aniversario || '') ? req.body.aniversario : null,
      extras,
      mac: c.mac,
      userAgent: c.userAgent,
      optin: true,
      optinTexto: `Aceito receber novidades da ${loja.nome} no WhatsApp + Política de Privacidade (conectay.com.br/privacidade)`
    });
    await registrarAcesso(loja.id, { mac: c.mac, ip: c.ip, userAgent: c.userAgent });
    await marcarCadastrado(loja.id, c.mac, telefone);
    accessLog('lead', { loja: loja.slug, telefone: telefone.slice(-4) });
    res.send(views.telaSucesso(loja));
  } catch (e) {
    console.error(e);
    res.status(500).send(views.telaErro('Não foi possível concluir o cadastro. Tente de novo.'));
  }
});

// ---------- Conectar (modo instagram) ----------
app.post('/conectar', async (req, res) => {
  try {
    const c = ctx(req);
    const loja = await lojaDoRequest(req);
    if (!loja) return res.status(404).send(views.telaErro('Portal não encontrado.'));
    await registrarAcesso(loja.id, { mac: c.mac, ip: c.ip, userAgent: c.userAgent });
    let destino = loja.destino_tipo;
    if (loja.rotacao_ativa) {
      const info = await visitaDispositivo(loja.id, c.mac);
      if (info && info.destino && info.destino !== 'formulario') destino = info.destino;
    }
    accessLog('conectar', { loja: loja.slug, mac: c.mac, destino });
    res.send(views.telaSucesso(Object.assign({}, loja, { destino_tipo: destino })));
  } catch (e) {
    console.error(e);
    res.status(500).send(views.telaErro('Erro ao conectar. Tente de novo.'));
  }
});

// ---------- Fluxo do AP (liberação por código) ----------
app.get('/auth', async (req, res) => {
  const c = ctx(req);
  if (!validateApSecret(String(req.query.s || ''))) {
    accessLog('auth_negado', { motivo: 'secret', ip: c.ip });
    return res.status(403).json({ ok: false, erro: 'não autorizado' });
  }
  const ok = validateCode(String(req.query.code || AUTO_CODE));
  if (ok) {
    const loja = await lojaDoRequest(req).catch(() => null);
    if (loja) await registrarAcesso(loja.id, { mac: c.mac, ip: c.ip, userAgent: c.userAgent });
    accessLog('auth_ok', { mac: c.mac });
    return res.json({ ok: true });
  }
  accessLog('auth_negado', { motivo: 'code', mac: c.mac });
  res.status(401).json({ ok: false });
});

// ---------- Cartão de contato (.vcf) ----------
app.get('/contato.vcf', async (req, res) => {
  try {
    const loja = await lojaDoRequest(req);
    if (!loja || !loja.vcard_ativo || !loja.vcard_telefone) {
      return res.status(404).send('Contato não disponível.');
    }
    const nome = (loja.vcard_nome || loja.nome || 'contato').replace(/[^\w\s-]/g, '').trim();
    res.setHeader('Content-Type', 'text/vcard; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${nome}.vcf"`);
    accessLog('vcard', { loja: loja.slug });
    res.send(views.montarVcard(loja));
  } catch (e) {
    console.error(e);
    res.status(500).send('Erro ao gerar contato.');
  }
});

// ---------- Instagram da loja certa ----------
app.get('/ig', async (req, res) => {
  const loja = await lojaDoRequest(req).catch(() => null);
  const user = (loja?.instagram || 'conectaywifi').replace('@', '');
  res.redirect(`https://instagram.com/${user}`);
});

// ---------- Health ----------
app.get('/health', (req, res) => {
  res.json({ ok: true, servico: 'conectay-portal', versao: '2.0.0', log: getLog() });
});

app.listen(PORT, () => console.log(`ConectaY portal na porta ${PORT}`));
