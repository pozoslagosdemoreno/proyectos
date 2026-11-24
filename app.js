/*
 * APP PROYECTOS — Interfaz (GitHub Pages)
 * Agua Potable y Alcantarillado · Lagos de Moreno
 */
(function () {
  'use strict';
  var CDN = {
    leafletCss: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    leafletJs: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    pdfjs: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    pdfjsWorker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
    xlsx: 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
    jszip: 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js'
  };
  var CENTRO = [21.356, -101.93];
  var COLOR_SISTEMA = { 'AGUA POTABLE': '#1f6fb5', 'ALCANTARILLADO': '#8a5a2b' };
  var COLOR_OPCION = { A: '#d62828', B: '#f77f00', C: '#7b2cbf', D: '#2a9d8f', E: '#e9c46a', F: '#264653', G: '#e76f51', H: '#6a994e' };
  var ETQ_ESTADO = { 'BORRADOR': 'gris', 'PROPUESTA LISTA': 'azul', 'EN GESTIÓN': 'warn', 'FINANCIADO': 'ok', 'EN CONSTRUCCIÓN': 'nar', 'TERMINADO': 'osc', 'CANCELADO': 'err' };

  var E = {
    token: leer('pr_token'), usuario: null, cat: null, vista: 'inicio', ficha: null, tab: 'resumen',
    filtros: { sistema: '', estado: '', q: '', cancelados: false, info: '' }, videos: null, videoSel: '', mapas: {}
  };

  // ===================== UTILIDADES =====================
  function leer(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function guardar(k, v) { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) {} }
  function h(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function $(sel, raiz) { return (raiz || document).querySelector(sel); }
  function $$(sel, raiz) { return Array.prototype.slice.call((raiz || document).querySelectorAll(sel)); }
  function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase(); }
  function n(v) { var x = Number(v); return v === '' || v == null || !isFinite(x) ? null : x; }
  function fmtNum(v, dec) { var x = n(v); return x == null ? '—' : x.toLocaleString('es-MX', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec || 0 }); }
  function fmtMoneda(v) { var x = n(v); return x == null ? '—' : '$' + x.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function fmtMillones(v) { var x = n(v); return x == null ? '—' : '$' + (x / 1e6).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' M'; }
  function fmtTam(b) { b = Number(b) || 0; return b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'; }
  function fmtFecha(iso) { var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '/' + m[2] + '/' + m[1] : (iso || '—'); }
  function aviso(msg, ms) { var a = $('#aviso'); a.textContent = msg; a.classList.add('ver'); clearTimeout(aviso.t); aviso.t = setTimeout(function () { a.classList.remove('ver'); }, ms || 3500); }
  function cargarScript(url) {
    return new Promise(function (ok, mal) {
      if ($('script[src="' + url + '"]')) return ok();
      var s = document.createElement('script'); s.src = url; s.onload = function () { ok(); }; s.onerror = function () { mal(new Error('No se pudo cargar ' + url)); };
      document.head.appendChild(s);
    });
  }
  function cargarCss(url) { if (!$('link[href="' + url + '"]')) { var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = url; document.head.appendChild(l); } }
  function cargarLeaflet() { cargarCss(CDN.leafletCss); return cargarScript(CDN.leafletJs); }
  function descargar(blob, nombre) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nombre;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }
  function b64aBlob(b64, mime) { var bin = atob(b64), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type: mime || 'application/octet-stream' }); }
  function rol() { return (E.usuario || {}).rol || 'CONSULTA'; }
  function esAdmin() { return rol() === 'ADMIN'; }
  function puedeEditar(p) { return esAdmin() || (rol() === 'PROYECTISTA' && ['TERMINADO', 'CANCELADO'].indexOf(p.estado) === -1); }
  function chipEstado(e) { return '<span class="chip ' + (ETQ_ESTADO[e] || 'gris') + '">' + h(e || 'BORRADOR') + '</span>'; }
  function chipSistema(s) { return '<span class="chip sis" style="--c:' + (COLOR_SISTEMA[s] || '#666') + '">' + h(s === 'ALCANTARILLADO' ? 'Alcantarillado' : 'Agua potable') + '</span>'; }
  /** Opción que representa al proyecto en indicadores: la elegida o, si no hay, la primera */
  function altRep(p) { return (p.alternativas || []).find(function (a) { return a.id === p.elegida; }) || (p.alternativas || [])[0] || {}; }
  function esTerminado(p) { return p.estado === 'TERMINADO'; }
  function esParcial(p) { return p.informacion === 'PARCIAL'; }
  function rangoTxt(a, b) { return n(a) == null ? '—' : (Math.round(n(a)) === Math.round(n(b)) ? fmtMoneda(a) : fmtMoneda(a) + ' – ' + fmtMoneda(b)); }
  function rangoMillones(a, b) { return Math.abs(a - b) < 1 ? fmtMillones(a) : fmtMillones(a) + ' – ' + fmtMillones(b); }
  /** Inversión estimada del proyecto: {etiqueta, html, min, max} */
  function inversion(p) {
    var a = altRep(p);
    if (esParcial(p)) return { tipo: 'REF', min: n(a.estMinTotal) || 0, max: n(a.estMaxTotal) || 0, texto: rangoTxt(a.estMinTotal, a.estMaxTotal) };
    return { tipo: 'PAR', min: n(a.total) || 0, max: n(a.total) || 0, texto: fmtMoneda(a.total) };
  }
  function chipInv(tipo) {
    return tipo === 'REF' ? '<span class="chip inv-ref" title="Estimado de referencia con datos parciales">⚪ Referencia — datos parciales</span>'
      : '<span class="chip inv-par" title="Estimado paramétrico del departamento">🟠 Estimado paramétrico</span>';
  }
  function avisoGeneral() { return '<p class="aviso-general">' + h((E.cat && E.cat.textos && E.cat.textos.aviso) || '') + '</p>'; }
  function coloniaDe(nombre) {
    var q = norm(nombre).trim(); if (!q || !E.cat || !E.cat.colonias) return null;
    return E.cat.colonias.find(function (c) { return norm(c.n).trim() === q; }) || E.cat.colonias.find(function (c) { var t = norm(c.n); return t.indexOf(q) !== -1 || q.indexOf(t) !== -1; }) || null;
  }

  var OJO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  var OJO_NO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.9 17.9A10.8 10.8 0 0 1 12 19c-7 0-11-7-11-7a19.8 19.8 0 0 1 5.1-5.9M9.9 4.2A10.4 10.4 0 0 1 12 4c7 0 11 7 11 7a19.9 19.9 0 0 1-2.2 3.3M14.1 14.1a3 3 0 1 1-4.2-4.2"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
  function campoClave(id, atributos) {
    return '<span class="clave"><input type="password" id="' + id + '" ' + (atributos || '') + '><button type="button" data-ojo="' + id + '" aria-label="Mostrar contraseña" aria-pressed="false">' + OJO + '</button></span>';
  }
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest && ev.target.closest('[data-ojo]');
    if (!b) return;
    var inp = document.getElementById(b.getAttribute('data-ojo')); if (!inp) return;
    var ver = inp.type === 'password';
    inp.type = ver ? 'text' : 'password';
    b.innerHTML = ver ? OJO_NO : OJO;
    b.setAttribute('aria-label', ver ? 'Ocultar contraseña' : 'Mostrar contraseña');
    b.setAttribute('aria-pressed', ver ? 'true' : 'false');
    inp.focus();
  });

  // ===================== UTM (para la tabla de vértices) =====================
  function aUtm(lat, lon) {
    var a = 6378137, f = 1 / 298.257223563, k0 = 0.9996, e2 = f * (2 - f), ep2 = e2 / (1 - e2);
    var zona = Math.floor((lon + 180) / 6) + 1, lon0 = ((zona - 1) * 6 - 180 + 3) * Math.PI / 180;
    var phi = lat * Math.PI / 180, lam = lon * Math.PI / 180;
    var N = a / Math.sqrt(1 - e2 * Math.sin(phi) * Math.sin(phi)), T = Math.tan(phi) * Math.tan(phi), C = ep2 * Math.cos(phi) * Math.cos(phi), A = Math.cos(phi) * (lam - lon0);
    var M = a * ((1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 * e2 * e2 / 256) * phi - (3 * e2 / 8 + 3 * e2 * e2 / 32 + 45 * e2 * e2 * e2 / 1024) * Math.sin(2 * phi) + (15 * e2 * e2 / 256 + 45 * e2 * e2 * e2 / 1024) * Math.sin(4 * phi) - (35 * e2 * e2 * e2 / 3072) * Math.sin(6 * phi));
    var x = k0 * N * (A + (1 - T + C) * Math.pow(A, 3) / 6 + (5 - 18 * T + T * T + 72 * C - 58 * ep2) * Math.pow(A, 5) / 120) + 500000;
    var y = k0 * (M + N * Math.tan(phi) * (A * A / 2 + (5 - T + 9 * C + 4 * C * C) * Math.pow(A, 4) / 24 + (61 - 58 * T + T * T + 600 * C - 330 * ep2) * Math.pow(A, 6) / 720));
    if (lat < 0) y += 10000000;
    return { x: x, y: y, zona: zona };
  }
  window._aUtm = aUtm;   // usado en pruebas

  // ===================== API =====================
  function api(accion) {
    var args = Array.prototype.slice.call(arguments, 1);
    var url = (window.APP_CONFIG || {}).API_URL;
    if (!url || /PEGAR/.test(url)) return Promise.reject(new Error('Falta la URL del motor en config.js.'));
    var conToken = accion !== 'login';
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ accion: accion, args: conToken ? [E.token].concat(args) : args }) })
      .then(function (r) { if (!r.ok) throw new Error('El motor respondió ' + r.status + '.'); return r.json(); })
      .then(function (j) {
        if (j.error) {
          if (j.error === 'SESION_EXPIRADA') { salirLocal(); throw new Error('La sesión terminó. Vuelve a entrar.'); }
          throw new Error(j.error);
        }
        return j.data;
      });
  }
  function fallo(e) { aviso(e.message || String(e), 6000); console.error(e); }
  function resultado(r, msgOk) { if (r && r.ok === false) { aviso(r.mensaje, 6000); return false; } if (msgOk) aviso(msgOk); return true; }

  // ===================== INICIO / ACCESO =====================
  function iniciar() {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () {});
    if (!E.token) return pantallaLogin();
    api('estado').then(function (u) { E.usuario = u; if (u.debeCambiar) return pantallaCambiarClave(true); entrar(); })
      .catch(function () { pantallaLogin(); });
  }
  function salirLocal() { E.token = ''; guardar('pr_token', ''); E.usuario = null; E.cat = null; pantallaLogin(); }

  function pantallaLogin(msg) {
    $('#app').innerHTML = '<div class="login"><form class="tarjeta" id="fLogin">' +
      '<img src="logo.jpg" alt="Agua Potable Lagos de Moreno">' +
      '<div style="text-align:center"><b>AGUA POTABLE Y ALCANTARILLADO</b><br><span class="muted">CARTERA DE PROYECTOS</span></div>' +
      '<label class="col"><span class="etq">USUARIO</span><input type="text" id="lU" autocomplete="username" autocapitalize="none" required></label>' +
      '<label class="col"><span class="etq">CONTRASEÑA</span>' + campoClave('lC', 'autocomplete="current-password" required') + '</label>' +
      '<div class="error" id="lE">' + h(msg || '') + '</div>' +
      '<button class="btn pri" type="submit">Entrar</button></form></div>';
    $('#fLogin').onsubmit = function (ev) {
      ev.preventDefault();
      var b = $('#fLogin button[type=submit]'); b.disabled = true; $('#lE').textContent = '';
      api('login', $('#lU').value, $('#lC').value).then(function (r) {
        if (!r.ok) { $('#lE').textContent = r.mensaje; b.disabled = false; return; }
        E.token = r.token; guardar('pr_token', r.token); E.usuario = r;
        if (r.debeCambiar) pantallaCambiarClave(true); else entrar();
      }).catch(function (e) { $('#lE').textContent = e.message; b.disabled = false; });
    };
  }

  function pantallaCambiarClave(obligatorio) {
    var html = '<form class="col" id="fClave">' +
      '<h2 style="margin:0">' + (obligatorio ? 'Crea tu contraseña' : 'Cambiar contraseña') + '</h2>' +
      (obligatorio ? '<p class="muted" style="margin:0">Es tu primer acceso o se restableció tu contraseña. Escribe la temporal y una nueva de al menos 8 caracteres.</p>' : '') +
      '<label class="col"><span class="etq">CONTRASEÑA ACTUAL</span>' + campoClave('cA', 'required autocomplete="current-password"') + '</label>' +
      '<label class="col"><span class="etq">NUEVA CONTRASEÑA</span>' + campoClave('cN', 'minlength="8" required autocomplete="new-password"') + '</label>' +
      '<label class="col"><span class="etq">REPITE LA NUEVA</span>' + campoClave('cR', 'minlength="8" required autocomplete="new-password"') + '</label>' +
      '<div class="error" id="cE"></div><div class="fila"><button class="btn pri" type="submit">Guardar</button>' + (obligatorio ? '' : '<button class="btn" type="button" id="cX">Cancelar</button>') + '</div></form>';
    if (obligatorio) $('#app').innerHTML = '<div class="login"><div class="tarjeta">' + html + '</div></div>';
    else abrirModal(html);
    if ($('#cX')) $('#cX').onclick = cerrarModal;
    $('#fClave').onsubmit = function (ev) {
      ev.preventDefault();
      if ($('#cN').value !== $('#cR').value) { $('#cE').textContent = 'Las contraseñas nuevas no coinciden.'; return; }
      api('cambiarClave', $('#cA').value, $('#cN').value).then(function (r) {
        if (!r.ok) { $('#cE').textContent = r.mensaje; return; }
        aviso('Contraseña guardada.'); if (obligatorio) { E.usuario.debeCambiar = false; entrar(); } else cerrarModal();
      }).catch(function (e) { $('#cE').textContent = e.message; });
    };
  }

  function entrar() {
    marco('<div class="muted">Cargando proyectos…</div>');
    recargarCatalogo().then(function () { ir(E.vista === 'ficha' ? 'inicio' : E.vista); }).catch(fallo);
  }
  function recargarCatalogo() { return api('catalogo').then(function (c) { E.cat = c; return c; }); }

  function marco(contenido) {
    var u = E.usuario || {};
    var nav = [['inicio', 'Inicio'], ['nuevos', 'Proyectos nuevos'], ['terminados', 'Proyectos terminados'], ['videos', 'Videos']];
    if (esAdmin()) { nav.push(['precios', 'Precios']); nav.push(['usuarios', 'Usuarios']); }
    var activa = E.vista === 'ficha' ? (E.ficha && esTerminado(E.ficha) ? 'terminados' : 'nuevos') : E.vista;
    Object.keys(E.mapas).forEach(function (k) { try { E.mapas[k].remove(); } catch (e) {} delete E.mapas[k]; });
    $('#app').innerHTML = '<header class="enc"><div class="enc-marca"><img src="logo.jpg" alt=""><div class="enc-tit"><b>AGUA POTABLE Y ALCANTARILLADO</b><span>CARTERA DE PROYECTOS</span></div></div>' +
      '<nav aria-label="Menú">' + nav.map(function (x) { return '<button data-ir="' + x[0] + '" class="' + (activa === x[0] ? 'activo' : '') + '">' + x[1] + '</button>'; }).join('') +
      '<span class="usuario">' + h(u.nombre || '') + ' · ' + h(rol()) + '</span><button data-accion="clave" title="Cambiar contraseña">Contraseña</button><button data-accion="salir">Salir</button></nav></header>' +
      '<main class="contenedor" id="main">' + contenido + '</main>';
    $$('[data-ir]').forEach(function (b) { b.onclick = function () { ir(b.getAttribute('data-ir')); }; });
    $('[data-accion=salir]').onclick = function () { api('logout').catch(function () {}); salirLocal(); };
    $('[data-accion=clave]').onclick = function () { pantallaCambiarClave(false); };
  }

  function ir(vista) {
    E.vista = vista;
    window.scrollTo(0, 0);
    if (vista === 'inicio') return vistaInicio();
    if (vista === 'nuevos') return vistaLista(false);
    if (vista === 'terminados') return vistaLista(true);
    if (vista === 'videos') return vistaVideos();
    if (vista === 'usuarios') return vistaUsuarios();
    if (vista === 'precios') return vistaPrecios();
  }

  // ===================== FILTROS =====================
  function filtrar(lista) {
    var f = E.filtros, q = norm(f.q).trim();
    return lista.filter(function (p) {
      if (f.sistema && p.sistema !== f.sistema) return false;
      if (f.estado && p.estado !== f.estado) return false;
      if (f.info && (p.informacion || 'COMPLETA') !== f.info) return false;
      if (q) { var t = norm([p.id, p.clave, p.nombre, p.colonia, p.calles, p.diametro].join(' ')); if (!q.split(/\s+/).every(function (w) { return t.indexOf(w) !== -1; })) return false; }
      return true;
    });
  }
  function barraFiltros(conEstado, extra) {
    var L = E.cat.listas, f = E.filtros;
    return '<section class="fila filtros">' +
      '<label class="col"><span class="etq">SISTEMA</span><select id="fSis"><option value="">Todos</option>' + L.sistemas.map(function (s) { return '<option' + (f.sistema === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></label>' +
      (conEstado ? '<label class="col"><span class="etq">ESTADO</span><select id="fEst"><option value="">Todos</option>' + L.estados.filter(function (e) { return conEstado === 'todos' || e !== 'TERMINADO'; }).map(function (e) { return '<option' + (f.estado === e ? ' selected' : '') + '>' + e + '</option>'; }).join('') + '</select></label>' : '') +
      '<label class="col" style="flex:1;min-width:220px"><span class="etq">BUSCAR</span><input type="text" id="fQ" value="' + h(f.q) + '" placeholder="Nombre, colonia, calle, clave o diámetro"></label>' +
      (extra || '') + '</section>';
  }
  function enlazarFiltros(repintar) {
    if ($('#fSis')) $('#fSis').onchange = function () { E.filtros.sistema = this.value; repintar(); };
    if ($('#fEst')) $('#fEst').onchange = function () { E.filtros.estado = this.value; repintar(); };
    if ($('#fCan')) $('#fCan').onchange = function () { E.filtros.cancelados = this.checked; repintar(); };
    if ($('#fInf')) $('#fInf').onchange = function () { E.filtros.info = this.value; repintar(); };
    if ($('#fQ')) $('#fQ').oninput = function () { var v = this.value; clearTimeout(enlazarFiltros.t); enlazarFiltros.t = setTimeout(function () { E.filtros.q = v; repintar(true); }, 300); };
  }

  // ===================== INICIO =====================
  function vistaInicio() {
    var ps = E.cat.proyectos;
    var nuevos = ps.filter(function (p) { return !esTerminado(p) && p.estado !== 'CANCELADO'; }), term = ps.filter(esTerminado);
    var termC = term.filter(function (p) { return !esParcial(p); }), termP = term.filter(esParcial);
    var suma = function (l, fn) { return l.reduce(function (a, p) { return a + (n(fn(p)) || 0); }, 0); };
    var kmN = suma(nuevos, function (p) { return altRep(p).longitud; }) / 1000, kmT = suma(term, function (p) { return altRep(p).longitud; }) / 1000;
    var invN = suma(nuevos, function (p) { return altRep(p).total; }), invT = suma(termC, function (p) { return altRep(p).total; });
    var refMin = suma(termP, function (p) { return altRep(p).estMinTotal; }), refMax = suma(termP, function (p) { return altRep(p).estMaxTotal; });
    var porSis = function (l, s) { return l.filter(function (p) { return p.sistema === s; }).length; };
    marco('<section class="grid3">' +
      kpi('Proyectos nuevos', nuevos.length, porSis(nuevos, 'AGUA POTABLE') + ' agua potable · ' + porSis(nuevos, 'ALCANTARILLADO') + ' alcantarillado') +
      kpi('Obras terminadas', term.length, termC.length + ' con información completa · ' + termP.length + ' con datos parciales') +
      kpi('Km propuestos / construidos', fmtNum(kmN, 2) + ' / ' + fmtNum(kmT, 2), 'Longitud de la opción elegida (o la A)') +
      '</section><section class="grid3">' +
      kpi('Inversión estimada — proyectos nuevos', fmtMillones(invN), '🟠 Estimado paramétrico, con IVA') +
      kpi('Inversión estimada — obras terminadas', fmtMillones(invT), '🟠 Estimado paramétrico, con IVA') +
      kpi('Inversión de referencia — datos parciales', termP.length ? rangoMillones(refMin, refMax) : '—', '⚪ Rango con IVA') +
      '</section><p class="muted" style="margin:-6px 0 0">Estimaciones de preinversión; no son montos contratados ni ejercidos. Las cifras de cada tipo no se suman entre sí.</p>' +
      barraFiltros('todos') +
      '<section class="tarjeta" style="padding:0;overflow:hidden"><div id="mapaInicio" class="mapa grande"></div>' +
      '<div class="leyenda"><span><i style="background:' + COLOR_SISTEMA['AGUA POTABLE'] + '"></i>Agua potable</span><span><i style="background:' + COLOR_SISTEMA.ALCANTARILLADO + '"></i>Alcantarillado</span>' +
      '<span><i class="punteada"></i>Nuevo (punteado)</span><span><i class="continua"></i>Terminado (continuo)</span><span><b class="pt"></b>Obra sin traza (centro de su colonia)</span><span class="muted">Toca una línea o punto para ver el proyecto.</span></div></section>' +
      '<div id="sinTraza"></div>' + avisoGeneral());
    enlazarFiltros(function (soloTexto) { if (soloTexto) pintarMapaInicio(); else vistaInicio(); });
    pintarMapaInicio();
  }

  function kpi(t, v, sub) { return '<div class="kpi"><span>' + h(t) + '</span><b>' + h(v) + '</b>' + (sub ? '<small>' + h(sub) + '</small>' : '') + '</div>'; }

  function pintarMapaInicio() {
    var lista = filtrar(E.cat.proyectos).filter(function (p) { return p.estado !== 'CANCELADO' || E.filtros.estado === 'CANCELADO'; });
    cargarLeaflet().then(function () {
      var m = mapaBase('mapaInicio'); if (!m) return;
      if (m._capaProy) m.removeLayer(m._capaProy);
      var capa = L.featureGroup(), sin = [];
      lista.forEach(function (p) {
        var alts = p.elegida ? p.alternativas.filter(function (a) { return a.id === p.elegida; }) : p.alternativas;
        var dibujo = false, inv = inversion(p);
        var popup = function (a) {
          return '<b>' + h(p.nombre) + '</b><br>' + h(p.id) + (a && alts.length > 1 ? ' · Opción ' + a.letra : '') + '<br>' + h(p.estado) + (a ? ' · ' + fmtNum(a.longitud || a.longitudTraza) + ' m' : '') +
            '<br>' + (inv.tipo === 'REF' ? '⚪ ' : '🟠 ') + h(inv.texto) + '<br><button class="btn chico" data-abrir="' + h(p.id) + '" style="margin-top:6px">Abrir ficha</button>';
        };
        alts.forEach(function (a) {
          ((a.traza && a.traza.lineas) || []).filter(function (l) { return !l.e; }).forEach(function (l) {
            var linea = L.polyline(l.p, { color: COLOR_SISTEMA[p.sistema] || '#555', weight: 5, opacity: p.elegida || alts.length === 1 ? 0.95 : 0.7, dashArray: esTerminado(p) ? null : '10 8' });
            linea.bindPopup(popup(a));
            capa.addLayer(linea); dibujo = true;
          });
        });
        if (!dibujo && esParcial(p)) {
          var c = coloniaDe(p.colonia);
          if (c) { L.circleMarker([c.lat, c.lng], { radius: 8, color: '#fff', weight: 2, fillColor: COLOR_SISTEMA[p.sistema] || '#555', fillOpacity: 0.95 }).bindPopup(popup(altRep(p))).addTo(capa); dibujo = true; }
        }
        if (!dibujo) sin.push(p);
      });
      capa.addTo(m); m._capaProy = capa;
      if (capa.getLayers().length) m.fitBounds(capa.getBounds(), { padding: [30, 30], maxZoom: 16 });
      $('#sinTraza').innerHTML = sin.length ? '<section class="tarjeta"><h3>Sin ubicación en el mapa (' + sin.length + ')</h3><p class="muted">Proyectos sin traza cargada u obras con datos parciales sin colonia reconocida. Para la traza, deja el KMZ en su carpeta de Drive y usa "Actualizar archivos" en la ficha.</p><div class="fila">' +
        sin.map(function (p) { return '<button class="btn chico" data-abrir="' + h(p.id) + '">' + h(p.id) + ' · ' + h(p.nombre) + '</button>'; }).join('') + '</div></section>' : '';
      enlazarAbrir();
    }).catch(fallo);
  }

  function mapaBase(id) {
    var cont = document.getElementById(id); if (!cont) return null;
    if (E.mapas[id]) return E.mapas[id];
    var sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Imagen © Esri' });
    var etiquetas = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 });
    var calles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' });
    var m = L.map(cont, { layers: [sat, etiquetas] }).setView(CENTRO, 13);
    L.control.layers({ 'Satélite': L.layerGroup([sat, etiquetas]), 'Calles': calles }, null, { position: 'topright' }).addTo(m);
    L.control.scale({ imperial: false }).addTo(m);
    m.on('popupopen', enlazarAbrir);
    E.mapas[id] = m;
    return m;
  }

  function enlazarAbrir() { $$('[data-abrir]').forEach(function (b) { b.onclick = function () { abrirFicha(b.getAttribute('data-abrir')); }; }); }

  // ===================== LISTAS (NUEVOS / TERMINADOS) =====================
  function vistaLista(terminados) {
    var titulo = terminados ? 'Proyectos terminados' : 'Proyectos nuevos';
    var pintar = function () {
      var lista = filtrar(E.cat.proyectos).filter(function (p) { return terminados ? esTerminado(p) : (!esTerminado(p) && (p.estado !== 'CANCELADO' || E.filtros.cancelados || E.filtros.estado === 'CANCELADO')); });
      lista.sort(function (a, b) { return a.id.localeCompare(b.id); });
      $('#lista').innerHTML = lista.length ? lista.map(tarjetaProyecto).join('') : '<div class="tarjeta muted">No hay proyectos con estos filtros.</div>';
      $('#cuenta').textContent = lista.length + ' proyecto(s)';
      enlazarAbrir();
    };
    var puedeCrear = esAdmin() || rol() === 'PROYECTISTA';
    if (!terminados && E.filtros.info) E.filtros.info = '';
    var botones = terminados
      ? (esAdmin() ? '<div class="fila"><button class="btn" id="bParcial">+ Registrar obra con datos parciales</button><button class="btn pri" id="bNuevo">+ Registrar proyecto terminado</button></div>' : '')
      : (puedeCrear ? '<button class="btn pri" id="bNuevo">+ Nuevo proyecto</button>' : '');
    var extra = terminados
      ? '<label class="col"><span class="etq">INFORMACIÓN</span><select id="fInf"><option value="">Todas</option><option value="COMPLETA"' + (E.filtros.info === 'COMPLETA' ? ' selected' : '') + '>Completa (documentos)</option><option value="PARCIAL"' + (E.filtros.info === 'PARCIAL' ? ' selected' : '') + '>Datos parciales</option></select></label>'
      : '<label class="fila" style="gap:8px;align-self:flex-end;min-height:44px"><input type="checkbox" id="fCan"' + (E.filtros.cancelados ? ' checked' : '') + '> Ver cancelados</label>';
    marco('<section class="fila entre"><div><h1 class="titulo">' + titulo + '</h1><span class="muted" id="cuenta"></span></div>' + botones + '</section>' +
      barraFiltros(terminados ? false : 'nuevos', extra) +
      '<section class="tarjetas" id="lista"></section>' + avisoGeneral());
    if ($('#bNuevo')) $('#bNuevo').onclick = function () { formProyecto(null, terminados); };
    if ($('#bParcial')) $('#bParcial').onclick = function () { formObraParcial(null); };
    enlazarFiltros(pintar);
    pintar();
  }

  function tarjetaProyecto(p) {
    var alts = p.alternativas || [], inv = inversion(p);
    var cuerpo = esParcial(p)
      ? '<table class="mini"><tbody><tr><td>Longitud</td><td colspan="2">' + fmtNum(altRep(p).longitud) + ' m</td></tr><tr><td>Inversión estimada</td><td colspan="2">' + h(inv.texto) + '</td></tr></tbody></table>'
      : '<table class="mini"><tbody>' + alts.map(function (a) {
        return '<tr><td>' + (alts.length > 1 ? '<i class="punto" style="background:' + COLOR_OPCION[a.letra] + '"></i>Opción ' + h(a.letra) + (p.elegida === a.id ? ' <b class="ok-txt">✓</b>' : '') : 'Inversión estimada') + '</td><td>' + fmtNum(a.longitud) + ' m</td><td>' + fmtMoneda(a.total) + '</td></tr>';
      }).join('') + '</tbody></table>';
    return '<article class="tarjeta proy" data-abrir="' + h(p.id) + '" tabindex="0" role="button" aria-label="Abrir ' + h(p.nombre) + '">' +
      '<div class="fila entre" style="gap:6px"><span class="clave-p">' + h(p.id) + (p.clave ? ' · ' + h(p.clave) : '') + '</span>' + chipEstado(p.estado) + '</div>' +
      '<h3>' + h(p.nombre) + '</h3>' +
      '<div class="fila" style="gap:6px">' + chipSistema(p.sistema) + (p.diametro ? '<span class="chip gris">Ø ' + h(p.diametro) + '"</span>' : '') + (p.colonia ? '<span class="muted">' + h(p.colonia) + '</span>' : '') + '</div>' +
      cuerpo + '<div>' + chipInv(inv.tipo) + '</div>' +
      '<div class="muted">' + p.nDocs + ' documento(s) · ' + p.nVideos + ' video(s)' + (esParcial(p) && p.anio ? ' · Año ' + h(p.anio) : '') + (esTerminado(p) && p.termino ? ' · Terminado ' + fmtFecha(p.termino) : '') + '</div></article>';
  }

  // ===================== FICHA =====================
  function abrirFicha(id, tab) {
    E.vista = 'ficha'; E.tab = tab || 'resumen';
    cerrarModal();
    marco('<div class="muted">Abriendo proyecto…</div>');
    api('proyecto', id).then(function (p) { E.ficha = p; pintarFicha(); window.scrollTo(0, 0); }).catch(function (e) { fallo(e); ir('inicio'); });
  }
  function recargarFicha(tab) {
    return Promise.all([api('proyecto', E.ficha.id), recargarCatalogo()]).then(function (r) { E.ficha = r[0]; if (tab) E.tab = tab; pintarFicha(); });
  }

  function pintarFicha() {
    var p = E.ficha, editar = puedeEditar(p);
    var tabs = [['resumen', 'Resumen'], ['traza', 'Traza'], ['documentos', 'Documentos (' + p.documentos.length + ')'], ['videos', 'Videos (' + p.videos.length + ')'], ['historial', 'Historial']];
    marco('<section class="fila entre"><button class="btn chico" id="fVolver">‹ ' + (esTerminado(p) ? 'Proyectos terminados' : 'Proyectos nuevos') + '</button>' +
      '<div class="fila">' + (editar ? '<button class="btn" id="fEditar">Editar datos</button>' : '') + (esAdmin() ? '<button class="btn" id="fEstado">Cambiar estado</button>' : '') + '</div></section>' +
      '<section class="tarjeta"><div class="fila" style="gap:8px"><span class="clave-p">' + h(p.id) + (p.clave ? ' · Documentos ' + h(p.clave) : '') + '</span>' + chipSistema(p.sistema) + chipEstado(p.estado) + '</div>' +
      '<h1 class="titulo" style="margin:8px 0 0">' + h(p.nombre) + '</h1></section>' +
      '<div class="tabs" role="tablist">' + tabs.map(function (t) { return '<button role="tab" data-tab="' + t[0] + '" class="' + (E.tab === t[0] ? 'activo' : '') + '">' + h(t[1]) + '</button>'; }).join('') + '</div>' +
      '<label class="tabs-movil col"><span class="etq">SECCIÓN</span><select id="fTabM">' + tabs.map(function (t) { return '<option value="' + t[0] + '"' + (E.tab === t[0] ? ' selected' : '') + '>' + h(t[1]) + '</option>'; }).join('') + '</select></label>' +
      '<div id="fCont"></div>' + avisoGeneral());
    $('#fVolver').onclick = function () { ir(esTerminado(p) ? 'terminados' : 'nuevos'); };
    if ($('#fEditar')) $('#fEditar').onclick = function () { if (esParcial(p)) formObraParcial(p); else formProyecto(p); };
    if ($('#fEstado')) $('#fEstado').onclick = function () { formEstado(p); };
    $$('[data-tab]').forEach(function (b) { b.onclick = function () { E.tab = b.getAttribute('data-tab'); pintarFicha(); }; });
    $('#fTabM').onchange = function () { E.tab = this.value; pintarFicha(); };
    ({ resumen: tabResumen, traza: tabTraza, documentos: tabDocumentos, videos: tabVideos, historial: tabHistorial })[E.tab]();
  }

  function dato(etq, v) { return '<div class="dato"><span class="etq">' + h(etq) + '</span><span>' + (v == null || v === '' ? '<span class="muted">—</span>' : v) + '</span></div>'; }

  function tabResumen() {
    var p = E.ficha, alts = p.alternativas, editar = puedeEditar(p), term = esTerminado(p);
    if (esParcial(p)) return tabResumenParcial();
    var html = '<section class="tarjeta"><h2>Ficha técnica</h2><div class="datos">' +
      dato('Tipo de obra', h(p.tipoObra)) + dato('Diámetro', p.diametro ? h(p.diametro) + ' pulg' : '') + dato('Material', h(p.material)) +
      dato('Colonia', h(p.colonia)) + dato('Calles', h(p.calles)) + dato('Fuente de financiamiento', h(p.fuente)) +
      (term || p.inicio ? dato('Inicio de obra', fmtFecha(p.inicio)) : '') + (term || p.termino ? dato('Término de obra', fmtFecha(p.termino)) : '') +
      (term || p.montoEjercido ? dato('Monto ejercido', p.montoEjercido ? fmtMoneda(p.montoEjercido) : '') : '') +
      '</div>' + (p.obs ? '<p style="margin:12px 0 0;white-space:pre-wrap">' + h(p.obs) + '</p>' : '') + '</section>';

    var filas = [
      ['Descripción del trazo', function (a) { return h(a.descripcion) || '<span class="muted">—</span>'; }],
      ['Longitud', function (a) { return fmtNum(a.longitud) + ' m'; }],
      ['Longitud medida en la traza', function (a) { return a.longitudTraza ? fmtNum(a.longitudTraza) + ' m' : '<span class="muted">Sin traza</span>'; }],
      ['Población beneficiada', function (a) { return fmtNum(a.poblacion) + ' hab.'; }],
      ['A · Movimiento de tierras', function (a) { return fmtMoneda(a.subA); }],
      ['B · Suministro e instalación de tubería', function (a) { return fmtMoneda(a.subB); }],
      ['C · Piezas especiales y válvulas', function (a) { return fmtMoneda(a.subC); }],
      ['D · Estructuras', function (a) { return fmtMoneda(a.subD); }],
      ['E · Hincado de tubería', function (a) { return fmtMoneda(a.subE); }],
      ['Subtotal sin IVA', function (a) { return fmtMoneda(a.sinIva); }],
      ['IVA 16%', function (a) { return fmtMoneda(a.iva); }],
      ['Inversión estimada total (con IVA)', function (a) { return '<b>' + fmtMoneda(a.total) + '</b>'; }],
      ['Duración de obra', function (a) { return a.duracion ? fmtNum(a.duracion) + ' días hábiles' : '—'; }]
    ];
    var marca = function (a) { return p.elegida === a.id ? '<span class="chip ok">' + (term ? 'Construida' : 'Elegida') + '</span>' : ''; };
    html += '<section class="tarjeta"><div class="fila entre"><h2 style="margin:0">' + (alts.length > 1 ? 'Comparación de opciones de trazo' : 'Datos del proyecto') + '</h2>' +
      (editar ? '<button class="btn chico" id="bAddAlt">+ Agregar opción</button>' : '') + '</div>' +
      '<div class="fila" style="margin-top:8px;gap:8px">' + chipInv('PAR') + '<span class="muted">Inversión estimada según los documentos entregados' + (term ? ' (resumen ejecutivo)' : '') + '.</span></div>' +
      '<div class="tabla-caja" style="margin-top:10px"><table class="t comp"><thead><tr><th style="text-align:left">Concepto</th>' +
      alts.map(function (a) { return '<th>' + (alts.length > 1 ? '<i class="punto" style="background:' + COLOR_OPCION[a.letra] + '"></i>Opción ' + h(a.letra) : 'Valor') + ' ' + marca(a) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      filas.map(function (f) { return '<tr><td>' + h(f[0]) + '</td>' + alts.map(function (a) { return '<td class="c">' + f[1](a) + '</td>'; }).join('') + '</tr>'; }).join('') +
      (editar || esAdmin() ? '<tr class="acciones"><td></td>' + alts.map(function (a) {
        return '<td class="c"><div class="fila" style="justify-content:center;gap:6px">' +
          (editar ? '<button class="btn chico" data-edalt="' + h(a.id) + '">Editar</button>' : '') +
          (esAdmin() && !term && alts.length > 1 ? '<button class="btn chico" data-elegir="' + h(a.id) + '">' + (p.elegida === a.id ? 'Quitar elección' : 'Elegir esta') + '</button>' : '') +
          (editar && alts.length > 1 ? '<button class="btn chico peligro" data-delalt="' + h(a.id) + '">Eliminar</button>' : '') + '</div></td>';
      }).join('') + '</tr>' : '') +
      '</tbody></table></div></section>';
    if (esAdmin()) html += '<section class="fila" style="justify-content:flex-end"><button class="btn chico peligro" id="bDelProy">Eliminar proyecto</button></section>';
    $('#fCont').innerHTML = html;
    if ($('#bAddAlt')) $('#bAddAlt').onclick = function () { formAlternativa(p, null); };
    $$('[data-edalt]').forEach(function (b) { b.onclick = function () { formAlternativa(p, alts.find(function (a) { return a.id === b.getAttribute('data-edalt'); })); }; });
    $$('[data-elegir]').forEach(function (b) {
      b.onclick = function () { var id = b.getAttribute('data-elegir'); api('elegirAlternativa', p.id, p.elegida === id ? '' : id).then(function (r) { if (resultado(r, 'Guardado.')) recargarFicha(); }).catch(fallo); };
    });
    $$('[data-delalt]').forEach(function (b) {
      b.onclick = function () {
        var a = alts.find(function (x) { return x.id === b.getAttribute('data-delalt'); });
        if (!confirm('¿Eliminar la opción ' + a.letra + '? Sus archivos no se borran: pasan a la carpeta del proyecto.')) return;
        api('eliminarAlternativa', p.id, a.id).then(function (r) { if (resultado(r, 'Opción eliminada.')) recargarFicha(); }).catch(fallo);
      };
    });
    if ($('#bDelProy')) $('#bDelProy').onclick = function () {
      var conf = prompt('Esto quita el proyecto de la app y manda su carpeta a la papelera de Drive (se puede recuperar 30 días).\n\nPara confirmar, escribe la clave: ' + p.id);
      if (conf == null) return;
      api('eliminarProyecto', p.id, conf).then(function (r) { if (resultado(r, 'Proyecto eliminado.')) recargarCatalogo().then(function () { ir(esTerminado(p) ? 'terminados' : 'nuevos'); }); }).catch(fallo);
    };
  }

  function tabTraza() {
    var p = E.ficha, alts = p.alternativas;
    var hay = alts.some(function (a) { return a.traza; }) || p.traza;
    $('#fCont').innerHTML = '<section class="tarjeta" style="padding:0;overflow:hidden">' + (hay ? '<div id="mapaFicha" class="mapa"></div><div class="leyenda" id="leyFicha"></div>' :
      '<div style="padding:18px"><h2>Sin traza</h2><p class="muted">Deja el KMZ o KML en la carpeta de Drive del proyecto (o de cada opción) y toca "Actualizar archivos" en la pestaña Documentos.</p></div>') + '</section>' +
      '<section class="tarjeta" id="vertices"></section>';
    if (!hay) { $('#vertices').remove(); return; }
    cargarLeaflet().then(function () {
      var m = mapaBase('mapaFicha'), capa = L.featureGroup(), ley = [], verts = [];
      var agregar = function (traza, letra, varias) {
        if (!traza) return;
        (traza.lineas || []).forEach(function (l) {
          var color = l.e ? (l.c || '#3a5bd9') : (letra && varias ? COLOR_OPCION[letra] : (l.c || COLOR_OPCION.A));
          L.polyline(l.p, { color: color, weight: l.e ? 3 : 5, opacity: 0.95, dashArray: l.e ? '8 6' : null })
            .bindTooltip((letra && varias ? 'Opción ' + letra + ' · ' : '') + (l.n || 'Línea') + ' · ' + fmtNum(l.l) + ' m', { sticky: true }).addTo(capa);
          var et = (l.e ? '' : (letra && varias ? 'Opción ' + letra + ': ' : '')) + (l.n || 'Línea');
          if (!ley.some(function (x) { return x.t === et; })) ley.push({ t: et, c: color, e: l.e });
          if (!l.e) verts.push({ titulo: (letra && varias ? 'Opción ' + letra + ' · ' : '') + (l.n || 'Línea'), p: l.p });
        });
        (traza.puntos || []).forEach(function (x) { L.circleMarker(x.p, { radius: 7, color: '#fff', weight: 2, fillColor: '#0b3954', fillOpacity: 1 }).bindTooltip(x.n || 'Punto').addTo(capa); });
      };
      agregar(p.traza, '', false);
      alts.forEach(function (a) { agregar(a.traza, a.letra, alts.length > 1); });
      capa.addTo(m);
      if (capa.getLayers().length) m.fitBounds(capa.getBounds(), { padding: [30, 30], maxZoom: 17 });
      $('#leyFicha').innerHTML = ley.map(function (x) { return '<span><i class="' + (x.e ? 'punteada' : '') + '" style="' + (x.e ? 'border-color:' : 'background:') + x.c + '"></i>' + h(x.t) + '</span>'; }).join('');
      $('#vertices').innerHTML = '<h2>Vértices (UTM, WGS84)</h2><p class="muted" style="margin-top:0">De la traza simplificada; los puntos casi alineados se omiten.</p>' + verts.map(function (v) {
        return '<h3 style="margin-top:14px">' + h(v.titulo) + '</h3><div class="tabla-caja"><table class="t" style="max-width:560px"><thead><tr><th>Vértice</th><th>X (Este)</th><th>Y (Norte)</th><th>Zona</th></tr></thead><tbody>' +
          v.p.map(function (q, i) { var u = aUtm(q[0], q[1]); return '<tr><td class="c">' + (i + 1) + '</td><td class="c">' + fmtNum(u.x, 2) + '</td><td class="c">' + fmtNum(u.y, 2) + '</td><td class="c">' + u.zona + 'Q</td></tr>'; }).join('') + '</tbody></table></div>';
      }).join('');
    }).catch(fallo);
  }

  function tabDocumentos() {
    var p = E.ficha, editar = puedeEditar(p), alts = p.alternativas, tipos = E.cat.listas.tiposDoc;
    var grupos = [{ id: '', titulo: alts.length > 1 ? 'Comunes a todas las opciones' : 'Documentos' }].concat(alts.length > 1 ? alts.map(function (a) { return { id: a.id, titulo: 'Opción ' + a.letra, letra: a.letra }; }) : []);
    var docsDe = function (g) { return p.documentos.filter(function (d) { return alts.length > 1 ? d.alternativa === g.id : true; }); };
    var html = '<section class="tarjeta"><div class="fila entre"><h2 style="margin:0">Documentos</h2>' +
      (editar ? '<div class="fila">' + (esAdmin() && p.carpeta ? '<a class="btn chico" href="https://drive.google.com/drive/folders/' + h(p.carpeta) + '" target="_blank" rel="noopener">Abrir carpeta en Drive</a>' : '') + '<button class="btn pri" id="bAct">Actualizar archivos</button></div>' : '') + '</div>' +
      (editar ? '<p class="muted">Para agregar archivos, déjalos en Drive dentro de <b>APP_PROYECTOS › PROYECTOS › ' + h(p.id) + '_…</b>' + (alts.length > 1 ? ' (en la carpeta <b>Opcion_A</b>, <b>Opcion_B</b>… si son de una sola opción; en la carpeta del proyecto si son comunes)' : '') + ' y toca <b>Actualizar archivos</b>. Los videos se pasan solos a la carpeta VIDEOS.</p>' : '') +
      '</section>';
    grupos.forEach(function (g) {
      var docs = docsDe(g);
      if (!docs.length && g.id === '' && alts.length > 1 && !p.documentos.some(function (d) { return !d.alternativa; })) return;
      html += '<section class="tarjeta"><h3>' + (g.letra ? '<i class="punto" style="background:' + COLOR_OPCION[g.letra] + '"></i>' : '') + h(g.titulo) + ' <span class="muted">(' + docs.length + ')</span></h3>' +
        (docs.length ? '<div class="tabla-caja"><table class="t"><thead><tr><th style="text-align:left">Tipo</th><th style="text-align:left">Archivo</th><th>Rev.</th><th>Tamaño</th><th>Fecha</th><th></th></tr></thead><tbody>' +
          docs.map(function (d) {
            var ver = /pdf|image\//i.test(d.mime) || /^application\/vnd\.google-apps\./.test(d.mime);
            return '<tr><td><b>' + h(tipos[d.tipo] || d.tipo) + '</b></td><td style="word-break:break-word">' + h(d.nombre) + '</td><td class="c">' + h(d.revision || '') + '</td><td class="c">' + fmtTam(d.tamano) + '</td><td class="c">' + fmtFecha(d.fecha) + '</td>' +
              '<td class="c"><div class="fila" style="justify-content:center;gap:6px;flex-wrap:nowrap">' + (ver ? '<button class="btn chico" data-ver="' + h(d.id) + '">Ver</button>' : '') + '<button class="btn chico" data-bajar="' + h(d.id) + '">Descargar</button>' +
              (editar ? '<button class="btn chico" data-corr="' + h(d.id) + '" title="Corregir tipo u opción">Corregir</button>' : '') + '</div></td></tr>';
          }).join('') + '</tbody></table></div>' : '<p class="muted">Sin documentos.</p>') + '</section>';
    });
    $('#fCont').innerHTML = html;
    if ($('#bAct')) $('#bAct').onclick = function () {
      var b = this; b.disabled = true; b.textContent = 'Revisando la carpeta…';
      api('actualizarArchivos', p.id).then(function (r) {
        if (resultado(r)) { aviso('Archivos: ' + r.resumen + (r.avisos && r.avisos.length ? '. ' + r.avisos.join(' ') : ''), 8000); recargarFicha(); }
        else { b.disabled = false; b.textContent = 'Actualizar archivos'; }
      }).catch(function (e) { fallo(e); b.disabled = false; b.textContent = 'Actualizar archivos'; });
    };
    $$('[data-ver]').forEach(function (b) { b.onclick = function () { abrirDocumento(b.getAttribute('data-ver'), true); }; });
    $$('[data-bajar]').forEach(function (b) { b.onclick = function () { abrirDocumento(b.getAttribute('data-bajar'), false); }; });
    $$('[data-corr]').forEach(function (b) { b.onclick = function () { formCorregirDoc(p.documentos.find(function (d) { return d.id === b.getAttribute('data-corr'); })); }; });
  }

  function abrirDocumento(id, ver) {
    var ventana = ver ? window.open('', '_blank') : null;   // se abre antes para que el navegador no la bloquee
    if (ventana) ventana.document.write('<p style="font-family:sans-serif;padding:20px">Cargando documento…</p>');
    aviso('Descargando documento…', 30000);
    api('documento', id).then(function (r) {
      var blob = b64aBlob(r.b64, r.mime);
      aviso('Listo.');
      if (ventana) ventana.location.href = URL.createObjectURL(blob);
      else descargar(blob, r.nombre);
    }).catch(function (e) { if (ventana) ventana.close(); fallo(e); });
  }

  function formCorregirDoc(d) {
    var p = E.ficha, tipos = E.cat.listas.tiposDoc;
    abrirModal('<h2 style="margin:0">Corregir documento</h2><p class="muted" style="margin:0;word-break:break-word">' + h(d.nombre) + '</p>' +
      '<label class="col"><span class="etq">TIPO</span><select id="cdT">' + Object.keys(tipos).map(function (k) { return '<option value="' + k + '"' + (d.tipo === k ? ' selected' : '') + '>' + h(tipos[k]) + '</option>'; }).join('') + '</select></label>' +
      (p.alternativas.length > 1 ? '<label class="col"><span class="etq">OPCIÓN</span><select id="cdA"><option value="">Común a todas</option>' + p.alternativas.map(function (a) { return '<option value="' + a.id + '"' + (d.alternativa === a.id ? ' selected' : '') + '>Opción ' + a.letra + '</option>'; }).join('') + '</select><span class="muted">Si cambias la opción, el archivo se mueve a esa carpeta en Drive.</span></label>' : '') +
      '<div class="fila" style="justify-content:flex-end"><button class="btn" id="cdX">Cancelar</button><button class="btn pri" id="cdOk">Guardar</button></div>');
    $('#cdX').onclick = cerrarModal;
    $('#cdOk').onclick = function () {
      api('corregirDocumento', d.id, $('#cdT').value, $('#cdA') ? $('#cdA').value : null).then(function (r) { if (resultado(r, 'Guardado.')) { cerrarModal(); recargarFicha(); } }).catch(fallo);
    };
  }

  function reproductor(v) {
    return '<div class="video"><iframe src="https://drive.google.com/file/d/' + encodeURIComponent(v.id) + '/preview" allow="autoplay; fullscreen" allowfullscreen title="' + h(v.titulo) + '"></iframe></div>';
  }

  function tabVideos() {
    var p = E.ficha;
    $('#fCont').innerHTML = p.videos.length ? p.videos.map(function (v) {
      var otros = v.proyectos.filter(function (x) { return x.id !== p.id; });
      return '<section class="tarjeta"><h3>' + h(v.titulo) + '</h3>' + reproductor(v) +
        (otros.length ? '<p class="muted">Este video también muestra: ' + otros.map(function (x) { return '<a href="#" data-abrir="' + h(x.id) + '">' + h(x.nombre) + '</a>'; }).join(', ') + '</p>' : '') + '</section>';
    }).join('') : '<section class="tarjeta"><h2>Sin videos</h2><p class="muted">' + (esAdmin() ? 'Sube el video a la carpeta VIDEOS de Drive y lígalo con este proyecto desde la sección Videos.' : 'Aún no hay videos ligados a este proyecto.') + '</p></section>';
    $$('[data-abrir]').forEach(function (a) { a.onclick = function (ev) { ev.preventDefault(); abrirFicha(a.getAttribute('data-abrir'), 'videos'); }; });
  }

  function tabHistorial() {
    var l = E.ficha.historial;
    $('#fCont').innerHTML = '<section class="tarjeta"><h2>Historial</h2>' + (l.length ? '<div class="tabla-caja"><table class="t"><thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th style="text-align:left">Detalle</th></tr></thead><tbody>' +
      l.map(function (x) { return '<tr><td class="c">' + h(x.fecha) + '</td><td class="c">' + h(x.usuario) + '</td><td class="c">' + h(String(x.accion).replace(/_/g, ' ').toLowerCase()) + '</td><td>' + h(x.detalle) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="muted">Sin movimientos.</p>') + '</section>';
  }

  // ===================== FORMULARIOS =====================
  function opciones(lista, actual, vacio) { return (vacio != null ? '<option value="">' + h(vacio) + '</option>' : '') + lista.map(function (x) { return '<option' + (norm(actual) === norm(x) ? ' selected' : '') + '>' + h(x) + '</option>'; }).join(''); }

  function formProyecto(p, comoTerminado) {
    var L = E.cat.listas, nuevo = !p;
    p = p || { sistema: '', estado: comoTerminado ? 'TERMINADO' : 'BORRADOR' };
    var term = nuevo ? comoTerminado : esTerminado(p);
    abrirModal('<h2 style="margin:0">' + (nuevo ? (comoTerminado ? 'Registrar proyecto terminado' : 'Nuevo proyecto') : 'Editar ' + h(p.id)) + '</h2>' +
      '<label class="col"><span class="etq">NOMBRE DEL PROYECTO *</span><input type="text" id="pNom" value="' + h(p.nombre || '') + '" placeholder="Ej. Sustitución línea de agua potable 3 in – Colonia Las Ceibas"></label>' +
      '<div class="grid2">' +
      '<label class="col"><span class="etq">SISTEMA *</span><select id="pSis"' + (nuevo ? '' : ' disabled') + '>' + opciones(L.sistemas, p.sistema, 'Elige…') + '</select></label>' +
      '<label class="col"><span class="etq">CLAVE DE SUS DOCUMENTOS</span><input type="text" id="pCla" value="' + h(p.clave || '') + '" placeholder="Ej. DAP26-LC-0301"></label>' +
      '<label class="col"><span class="etq">TIPO DE OBRA</span><select id="pTip">' + opciones(L.tiposObra, p.tipoObra, '—') + '</select></label>' +
      '<label class="col"><span class="etq">FUENTE DE FINANCIAMIENTO</span><select id="pFue">' + opciones(L.fuentes, p.fuente, '—') + '</select></label>' +
      '<label class="col"><span class="etq">DIÁMETRO (PULG)</span><input type="text" id="pDia" value="' + h(p.diametro || '') + '" inputmode="decimal"></label>' +
      '<label class="col"><span class="etq">MATERIAL</span><input type="text" id="pMat" value="' + h(p.material || '') + '" placeholder="Ej. PVC RD-25"></label>' +
      '<label class="col"><span class="etq">COLONIA</span><input type="text" id="pCol" value="' + h(p.colonia || '') + '"></label>' +
      '<label class="col"><span class="etq">CALLES / TRAMO</span><input type="text" id="pCal" value="' + h(p.calles || '') + '"></label>' +
      (term || p.inicio ? '<label class="col"><span class="etq">INICIO DE OBRA</span><input type="date" id="pIni" value="' + h(p.inicio || '') + '"></label>' : '') +
      (term || p.termino ? '<label class="col"><span class="etq">TÉRMINO DE OBRA</span><input type="date" id="pTer" value="' + h(p.termino || '') + '"></label>' : '') +
      (term || p.montoEjercido ? '<label class="col"><span class="etq">MONTO EJERCIDO (OPCIONAL)</span><input type="number" step="0.01" id="pMon" value="' + h(p.montoEjercido || '') + '"></label>' : '') +
      (nuevo && esAdmin() ? '<label class="col"><span class="etq">ESTADO INICIAL</span><select id="pEst">' + opciones(L.estados, p.estado) + '</select></label>' : '') +
      (nuevo && !comoTerminado ? '<label class="col"><span class="etq">OPCIONES DE TRAZO</span><select id="pOpc"><option value="1">1 opción</option><option value="2" selected>2 opciones (A y B)</option></select></label>' : '') +
      '</div>' +
      '<label class="col"><span class="etq">OBSERVACIONES</span><textarea id="pObs">' + h(p.obs || '') + '</textarea></label>' +
      (nuevo ? '<p class="muted" style="margin:0">Al guardar se crea su carpeta en Drive (APP_PROYECTOS › PROYECTOS) con una subcarpeta por opción. Después captura los datos de cada opción en la ficha.</p>' : '') +
      '<div class="fila" style="justify-content:flex-end"><button class="btn" id="pX">Cancelar</button><button class="btn pri" id="pOk">Guardar</button></div>');
    $('#pX').onclick = cerrarModal;
    $('#pOk').onclick = function () {
      var v = function (id) { var el = $('#' + id); return el ? el.value : ''; };
      var d = { id: p.id || '', nombre: v('pNom'), sistema: nuevo ? v('pSis') : p.sistema, clave: v('pCla'), tipoObra: v('pTip'), fuente: v('pFue'), diametro: v('pDia'), material: v('pMat'),
        colonia: v('pCol'), calles: v('pCal'), inicio: $('#pIni') ? v('pIni') : (p.inicio || ''), termino: $('#pTer') ? v('pTer') : (p.termino || ''), montoEjercido: $('#pMon') ? v('pMon') : (p.montoEjercido || ''),
        obs: v('pObs'), estado: v('pEst'), opciones: $('#pOpc') ? Number(v('pOpc')) : 1 };
      var b = this; b.disabled = true; b.textContent = 'Guardando…';
      api('guardarProyecto', d).then(function (r) {
        if (!resultado(r, 'Proyecto guardado.')) { b.disabled = false; b.textContent = 'Guardar'; return; }
        cerrarModal();
        recargarCatalogo().then(function () { abrirFicha(r.id); });
      }).catch(function (e) { fallo(e); b.disabled = false; b.textContent = 'Guardar'; });
    };
  }

  function formAlternativa(p, a) {
    var nueva = !a; a = a || {};
    var campo = function (id, etq, val, extra) { return '<label class="col"><span class="etq">' + etq + '</span><input type="number" step="0.01" id="' + id + '" value="' + h(val || '') + '" ' + (extra || '') + '></label>'; };
    abrirModal('<h2 style="margin:0">' + (nueva ? 'Agregar opción' : (p.alternativas.length > 1 ? 'Opción ' + h(a.letra) : 'Datos del proyecto')) + ' · ' + h(p.id) + '</h2>' +
      (esTerminado(p) ? '<p class="muted" style="margin:0">Captura los datos tal como vienen en el resumen ejecutivo.</p>' : '') +
      (!nueva ? '<div class="fila"><button class="btn" type="button" id="aLeer">📄 Leer datos de los documentos</button><span class="muted">Llena el formulario con el resumen ejecutivo, el presupuesto o la memoria registrados. Revisa antes de guardar.</span></div><div id="aLeido"></div>' : '') +
      '<label class="col"><span class="etq">DESCRIPCIÓN DEL TRAZO</span><input type="text" id="aDes" value="' + h(a.descripcion || '') + '" placeholder="Por dónde va esta opción"></label>' +
      '<div class="grid3">' + campo('aLon', 'LONGITUD (M)', a.longitud) + campo('aPob', 'POBLACIÓN BENEFICIADA', a.poblacion, 'step="1"') + campo('aDur', 'DURACIÓN (DÍAS HÁBILES)', a.duracion, 'step="1"') + '</div>' +
      '<fieldset class="caja"><legend class="etq">INVERSIÓN ($ M.N.)</legend><div class="grid3">' +
      campo('aSA', 'A · MOVIMIENTO DE TIERRAS', a.subA) + campo('aSB', 'B · TUBERÍA', a.subB) + campo('aSC', 'C · PIEZAS ESPECIALES Y VÁLVULAS', a.subC) +
      campo('aSD', 'D · ESTRUCTURAS', a.subD) + campo('aSE', 'E · HINCADO', a.subE) + '<div></div>' +
      campo('aSin', 'SUBTOTAL SIN IVA', a.sinIva) + campo('aIva', 'IVA 16%', a.iva) + campo('aTot', 'TOTAL CON IVA', a.total) + '</div>' +
      '<div class="fila" style="margin-top:8px"><button class="btn chico" type="button" id="aSumar">Calcular subtotal, IVA y total desde A–E</button><span class="muted" id="aCuadre"></span></div></fieldset>' +
      '<div class="fila" style="justify-content:flex-end"><button class="btn" id="aX">Cancelar</button><button class="btn pri" id="aOk">Guardar</button></div>');
    var val = function (id) { return $('#' + id).value; };
    var cuadre = function () {
      var s = ['aSA', 'aSB', 'aSC', 'aSD', 'aSE'].reduce(function (t, id) { return t + (Number(val(id)) || 0); }, 0), sin = Number(val('aSin')) || 0;
      $('#aCuadre').textContent = s && sin ? (Math.abs(s - sin) < 1 ? '✓ Los subtotales A–E suman el subtotal sin IVA.' : '⚠ A–E suman ' + fmtMoneda(s) + ', distinto del subtotal sin IVA.') : '';
    };
    $$('.modal input[type=number]').forEach(function (i) { i.addEventListener('input', cuadre); }); cuadre();
    $('#aSumar').onclick = function () {
      var s = ['aSA', 'aSB', 'aSC', 'aSD', 'aSE'].reduce(function (t, id) { return t + (Number(val(id)) || 0); }, 0);
      if (!s) return aviso('Captura primero los subtotales A–E.');
      var iva = Math.round(s * 16) / 100;
      $('#aSin').value = s.toFixed(2); $('#aIva').value = iva.toFixed(2); $('#aTot').value = (s + iva).toFixed(2); cuadre();
    };
    if ($('#aLeer')) $('#aLeer').onclick = function () {
      var b = this; b.disabled = true; b.textContent = 'Leyendo documentos…';
      leerDocumentos(p, a).then(function (c) {
        b.disabled = false; b.textContent = '📄 Volver a leer';
        var mapa = { longitud: 'aLon', poblacion: 'aPob', duracion: 'aDur', subA: 'aSA', subB: 'aSB', subC: 'aSC', subD: 'aSD', subE: 'aSE', sinIva: 'aSin', iva: 'aIva', total: 'aTot' };
        var filas = [];
        Object.keys(mapa).forEach(function (k) {
          var v = c.valores[k]; if (!v) return;
          var inp = $('#' + mapa[k]); inp.value = v.valor; inp.classList.add('leido'); inp.title = 'Leído de ' + v.fuente;
          filas.push('<tr><td>' + h(window.Extraccion.ETIQUETAS[k]) + '</td><td class="c">' + h(typeof v.valor === 'number' ? fmtNum(v.valor, k === 'longitud' || k.indexOf('sub') === 0 || k === 'sinIva' || k === 'iva' || k === 'total' ? 2 : 0) : v.valor) + '</td><td>' + h(v.fuente) + '</td></tr>');
        });
        var sug = [];
        if (c.valores.diametro && String(c.valores.diametro.valor) !== String(p.diametro || '')) sug.push('Diámetro en documentos: ' + c.valores.diametro.valor + '" (ficha: ' + (p.diametro || '—') + ')');
        if (c.valores.material && norm(c.valores.material.valor) !== norm(p.material || '')) sug.push('Material en documentos: ' + c.valores.material.valor + ' (ficha: ' + (p.material || '—') + ')');
        cuadre();
        $('#aLeido').innerHTML = '<div class="leido-caja">' +
          (filas.length ? '<b>Datos encontrados (' + filas.length + ')</b><div class="tabla-caja"><table class="t"><thead><tr><th style="text-align:left">Dato</th><th>Valor</th><th style="text-align:left">Archivo</th></tr></thead><tbody>' + filas.join('') + '</tbody></table></div>' : '<b>No se encontraron datos en los documentos.</b>') +
          (c.avisos.length ? '<div class="avisos-lect"><b>Diferencias entre documentos</b><ul>' + c.avisos.map(function (t) { return '<li>' + h(t) + '</li>'; }).join('') + '</ul></div>' : '') +
          (sug.length ? '<div class="avisos-lect"><b>Datos del proyecto</b> (se corrigen con "Editar datos")<ul>' + sug.map(function (t) { return '<li>' + h(t) + '</li>'; }).join('') + '</ul></div>' : '') +
          '<p class="muted" style="margin:6px 0 0">Archivos revisados: ' + c.leidos.map(function (x) { return h(x.nombre) + (x.error ? ' (no se pudo leer: ' + h(x.error) + ')' : ' (' + x.n + ' dato[s])'); }).join(' · ') + '. Prioridad: resumen ejecutivo → presupuesto PDF → presupuesto Excel → memoria.</p></div>';
      }).catch(function (e) { b.disabled = false; b.textContent = '📄 Leer datos de los documentos'; fallo(e); });
    };
    $('#aX').onclick = cerrarModal;
    $('#aOk').onclick = function () {
      var d = { idProyecto: p.id, id: a.id || '', descripcion: val('aDes'), longitud: val('aLon'), poblacion: val('aPob'), duracion: val('aDur'),
        subA: val('aSA'), subB: val('aSB'), subC: val('aSC'), subD: val('aSD'), subE: val('aSE'), sinIva: val('aSin'), iva: val('aIva'), total: val('aTot') };
      var b = this; b.disabled = true;
      api('guardarAlternativa', d).then(function (r) { if (resultado(r, 'Guardado.')) { cerrarModal(); recargarFicha('resumen'); } else b.disabled = false; }).catch(function (e) { fallo(e); b.disabled = false; });
    };
  }

  function formEstado(p) {
    var L = E.cat.listas, alts = p.alternativas;
    abrirModal('<h2 style="margin:0">Cambiar estado · ' + h(p.id) + '</h2><p class="muted" style="margin:0">Estado actual: ' + chipEstado(p.estado) + '</p>' +
      '<label class="col"><span class="etq">NUEVO ESTADO</span><select id="eEst">' + opciones(L.estados, p.estado) + '</select></label>' +
      '<div id="eTerm" class="col" hidden>' +
      (alts.length > 1 ? '<label class="col"><span class="etq">OPCIÓN CONSTRUIDA *</span><select id="eAlt"><option value="">Elige…</option>' + alts.map(function (a) { return '<option value="' + a.id + '"' + (p.elegida === a.id ? ' selected' : '') + '>Opción ' + a.letra + '</option>'; }).join('') + '</select></label>' : '') +
      '<div class="grid2"><label class="col"><span class="etq">INICIO DE OBRA</span><input type="date" id="eIni" value="' + h(p.inicio || '') + '"></label><label class="col"><span class="etq">TÉRMINO DE OBRA</span><input type="date" id="eTer" value="' + h(p.termino || '') + '"></label></div>' +
      '<p class="muted" style="margin:0">Al guardar, el proyecto pasa a PROYECTOS TERMINADOS con toda su información.</p></div>' +
      '<label class="col"><span class="etq">NOTA (OPCIONAL, QUEDA EN EL HISTORIAL)</span><input type="text" id="eNota" maxlength="300"></label>' +
      '<div class="fila" style="justify-content:flex-end"><button class="btn" id="eX">Cancelar</button><button class="btn pri" id="eOk">Guardar</button></div>');
    var ver = function () { $('#eTerm').hidden = $('#eEst').value !== 'TERMINADO'; };
    $('#eEst').onchange = ver; ver();
    $('#eX').onclick = cerrarModal;
    $('#eOk').onclick = function () {
      var extra = { nota: $('#eNota').value, alternativa: $('#eAlt') ? $('#eAlt').value : '', inicio: $('#eIni').value, termino: $('#eTer').value };
      api('cambiarEstado', p.id, $('#eEst').value, extra).then(function (r) { if (resultado(r, 'Estado actualizado.')) { cerrarModal(); recargarFicha(); } }).catch(fallo);
    };
  }

  // ===================== VIDEOS =====================
  function vistaVideos() {
    marco('<div class="muted">Cargando videos…</div>');
    api('videos').then(function (l) { E.videos = l; pintarVideos(); }).catch(fallo);
  }

  function pintarVideos() {
    var l = E.videos, sel = l.find(function (v) { return v.id === E.videoSel; }) || l[0];
    var grupos = [['AGUA POTABLE', 'Agua potable'], ['ALCANTARILLADO', 'Alcantarillado']];
    var opts = grupos.map(function (g) {
      var vs = l.filter(function (v) { return v.proyectos.some(function (p) { return p.sistema === g[0]; }); });
      return vs.length ? '<optgroup label="' + g[1] + '">' + vs.map(function (v) { return '<option value="' + h(v.id) + '"' + (sel && sel.id === v.id ? ' selected' : '') + '>' + h(v.titulo) + '</option>'; }).join('') + '</optgroup>' : '';
    }).join('');
    var sinLigar = l.filter(function (v) { return !v.proyectos.length; });
    if (sinLigar.length) opts += '<optgroup label="Sin ligar a un proyecto">' + sinLigar.map(function (v) { return '<option value="' + h(v.id) + '"' + (sel && sel.id === v.id ? ' selected' : '') + '>' + h(v.titulo) + '</option>'; }).join('') + '</optgroup>';
    marco('<section class="fila entre"><h1 class="titulo">Videos</h1>' + (esAdmin() ? '<div class="fila"><button class="btn" id="vAct">Actualizar videos</button></div>' : '') + '</section>' +
      (l.length ? '<section class="tarjeta"><label class="col"><span class="etq">VIDEO</span><select id="vSel">' + opts + '</select></label>' +
        (sel ? '<div style="margin-top:14px">' + reproductor(sel) + '</div>' +
          '<div class="fila entre" style="margin-top:12px"><div><b>' + h(sel.titulo) + '</b><div class="muted">' + fmtFecha(sel.fecha) + ' · ' + fmtTam(sel.tamano) + '</div></div>' +
          (esAdmin() ? '<button class="btn chico" id="vLigar">Editar título y proyectos</button>' : '') + '</div>' +
          '<div class="fila" style="margin-top:10px">' + (sel.proyectos.length ? '<span class="etq">PROYECTOS EN ESTE VIDEO:</span>' + sel.proyectos.map(function (p) { return '<button class="btn chico" data-abrir="' + h(p.id) + '">' + h(p.id) + ' · ' + h(p.nombre) + '</button>'; }).join('') : '<span class="chip warn">Sin ligar a un proyecto</span>') + '</div>' : '') +
        '</section>' : '<section class="tarjeta"><h2>Aún no hay videos</h2><p class="muted">' + (esAdmin() ? 'Sube los videos a la carpeta APP_PROYECTOS › VIDEOS de Drive y toca "Actualizar videos".' : 'El administrador todavía no ha cargado videos.') + '</p></section>') +
      (esAdmin() && sinLigar.length ? '<section class="tarjeta" style="background:var(--warn-bg)"><b>' + sinLigar.length + ' video(s) sin ligar a un proyecto.</b> Elígelos en la lista y usa "Editar título y proyectos".</section>' : ''));
    if ($('#vSel')) $('#vSel').onchange = function () { E.videoSel = this.value; pintarVideos(); };
    if ($('#vAct')) $('#vAct').onclick = function () {
      var b = this; b.disabled = true; b.textContent = 'Revisando la carpeta VIDEOS…';
      api('actualizarVideos').then(function (r) { aviso('Videos: ' + r.resumen, 6000); vistaVideos(); }).catch(function (e) { fallo(e); b.disabled = false; b.textContent = 'Actualizar videos'; });
    };
    if ($('#vLigar')) $('#vLigar').onclick = function () { formLigarVideo(sel); };
    enlazarAbrir();
  }

  function formLigarVideo(v) {
    var ps = E.cat.proyectos.slice().sort(function (a, b) { return a.id.localeCompare(b.id); });
    var ids = v.proyectos.map(function (p) { return p.id; });
    abrirModal('<h2 style="margin:0">Video: título y proyectos</h2>' +
      '<label class="col"><span class="etq">TÍTULO</span><input type="text" id="lvT" value="' + h(v.titulo) + '" maxlength="150"></label>' +
      '<fieldset class="caja"><legend class="etq">PROYECTOS QUE APARECEN EN EL VIDEO (PUEDEN SER VARIOS)</legend><input type="text" id="lvQ" placeholder="Filtrar" style="width:100%;margin-bottom:8px"><div class="lista-check" id="lvL">' +
      ps.map(function (p) { return '<label class="fila" style="gap:8px;min-height:36px" data-txt="' + h(norm(p.id + ' ' + p.nombre + ' ' + p.colonia)) + '"><input type="checkbox" value="' + h(p.id) + '"' + (ids.indexOf(p.id) !== -1 ? ' checked' : '') + '><span><b>' + h(p.id) + '</b> · ' + h(p.nombre) + ' <span class="muted">' + h(p.estado) + '</span></span></label>'; }).join('') +
      '</div></fieldset><div class="fila" style="justify-content:flex-end"><button class="btn" id="lvX">Cancelar</button><button class="btn pri" id="lvOk">Guardar</button></div>');
    $('#lvQ').oninput = function () { var q = norm(this.value); $$('#lvL label').forEach(function (l) { l.hidden = q && l.getAttribute('data-txt').indexOf(q) === -1; }); };
    $('#lvX').onclick = cerrarModal;
    $('#lvOk').onclick = function () {
      var sel = $$('#lvL input:checked').map(function (i) { return i.value; });
      api('ligarVideo', v.id, sel, $('#lvT').value).then(function (r) { if (resultado(r, 'Video guardado.')) { cerrarModal(); E.videoSel = v.id; recargarCatalogo().then(vistaVideos); } }).catch(fallo);
    };
  }

  // ===================== USUARIOS (ADMIN) =====================
  function vistaUsuarios(sub) {
    sub = sub || vistaUsuarios.sub || 'usuarios'; vistaUsuarios.sub = sub;
    marco('<div class="tabs siempre"><button data-sub="usuarios" class="' + (sub === 'usuarios' ? 'activo' : '') + '">Usuarios</button><button data-sub="bitacora" class="' + (sub === 'bitacora' ? 'activo' : '') + '">Bitácora</button></div><div id="uCont"><div class="muted">Cargando…</div></div>');
    $$('[data-sub]').forEach(function (b) { b.onclick = function () { vistaUsuarios(b.getAttribute('data-sub')); }; });
    if (sub === 'bitacora') return api('bitacora', 300).then(function (l) {
      $('#uCont').innerHTML = '<section class="tarjeta"><h2>Bitácora (últimos 300 movimientos)</h2><div class="tabla-caja"><table class="t"><thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Proyecto</th><th style="text-align:left">Detalle</th></tr></thead><tbody>' +
        l.map(function (x) { return '<tr><td class="c">' + h(x.fecha) + '</td><td class="c">' + h(x.usuario) + '</td><td class="c">' + h(String(x.accion).replace(/_/g, ' ').toLowerCase()) + '</td><td class="c">' + h(x.proyecto) + '</td><td>' + h(x.detalle) + '</td></tr>'; }).join('') + '</tbody></table></div></section>';
    }).catch(fallo);
    api('listarUsuarios').then(function (l) {
      var selRol = function (u) { return '<select data-rol="' + h(u.usuario) + '" aria-label="Rol de ' + h(u.usuario) + '">' + ['ADMIN', 'PROYECTISTA', 'CONSULTA'].map(function (r) { return '<option' + (u.rol === r ? ' selected' : '') + '>' + r + '</option>'; }).join('') + '</select>'; };
      $('#uCont').innerHTML = '<section class="tarjeta"><h2>Usuarios</h2>' +
        '<p class="muted"><b>PROYECTISTA:</b> ve y descarga todo; crea y edita proyectos nuevos. <b>CONSULTA:</b> ve y descarga todo. <b>ADMIN:</b> además cambia estados, registra terminados, liga videos y administra usuarios.</p>' +
        '<form class="fila" id="uNuevo"><input type="text" id="uU" placeholder="Usuario (sin espacios)" required><input type="text" id="uN" placeholder="Nombre completo" required style="width:240px"><select id="uR"><option>CONSULTA</option><option>PROYECTISTA</option><option>ADMIN</option></select><button class="btn pri" type="submit">Crear usuario</button></form>' +
        '<div class="tabla-caja" style="margin-top:12px"><table class="t"><thead><tr><th style="text-align:left">Usuario</th><th style="text-align:left">Nombre</th><th>Rol</th><th>Activo</th><th>Último acceso</th><th></th></tr></thead><tbody>' +
        l.map(function (u) {
          return '<tr><td>' + h(u.usuario) + '</td><td>' + h(u.nombre) + '</td><td class="c">' + selRol(u) + '</td><td class="c">' + (u.activo ? 'Sí' : 'No') + '</td><td class="c">' + h(u.ultimo || '') + '</td>' +
            '<td class="c"><div class="fila" style="justify-content:center"><button class="btn chico" data-act="' + h(u.usuario) + '" data-v="' + (u.activo ? 0 : 1) + '">' + (u.activo ? 'Desactivar' : 'Activar') + '</button><button class="btn chico" data-rest="' + h(u.usuario) + '">Nueva contraseña</button></div></td></tr>';
        }).join('') + '</tbody></table></div></section>';
      $('#uNuevo').onsubmit = function (ev) {
        ev.preventDefault();
        var usuario = $('#uU').value.toLowerCase();
        api('crearUsuario', $('#uU').value, $('#uN').value, $('#uR').value).then(function (r) {
          if (!r.ok) return aviso(r.mensaje);
          abrirModal('<h2 style="margin:0">Usuario creado</h2><p>Usuario: <b>' + h(usuario) + '</b><br>Contraseña temporal: <b style="font-size:20px">' + h(r.clave) + '</b></p><p class="muted">Compártela con la persona. Al entrar por primera vez se le pedirá cambiarla.</p><div class="fila" style="justify-content:flex-end"><button class="btn pri" id="mOk">Listo</button></div>');
          $('#mOk').onclick = function () { cerrarModal(); vistaUsuarios('usuarios'); };
        }).catch(fallo);
      };
      $$('[data-rol]').forEach(function (s) { s.onchange = function () { api('cambiarRolUsuario', s.getAttribute('data-rol'), s.value).then(function (r) { resultado(r, 'Rol cambiado. La persona deberá volver a entrar.'); vistaUsuarios('usuarios'); }).catch(fallo); }; });
      $$('[data-act]').forEach(function (b) { b.onclick = function () { api('activarUsuario', b.getAttribute('data-act'), b.getAttribute('data-v') === '1').then(function (r) { resultado(r); vistaUsuarios('usuarios'); }).catch(fallo); }; });
      $$('[data-rest]').forEach(function (b) {
        b.onclick = function () {
          if (!confirm('¿Crear una contraseña temporal nueva para ' + b.getAttribute('data-rest') + '?')) return;
          api('restablecerClave', b.getAttribute('data-rest')).then(function (r) { abrirModal('<h2 style="margin:0">Contraseña temporal</h2><p style="font-size:20px"><b>' + h(r.clave) + '</b></p><div class="fila" style="justify-content:flex-end"><button class="btn pri" id="mOk">Listo</button></div>'); $('#mOk').onclick = cerrarModal; }).catch(fallo);
        };
      });
    }).catch(fallo);
  }

  // ===================== OBRAS CON DATOS PARCIALES =====================
  function tablaLineas(lineas) {
    return '<div class="tabla-caja"><table class="t"><thead><tr><th style="text-align:left">Concepto</th><th>Clave</th><th>Unidad</th><th>Cantidad</th><th>P.U.</th><th>Importe</th></tr></thead><tbody>' +
      lineas.map(function (l) { return '<tr><td>' + h(l.concepto) + '</td><td class="c">' + h(l.clave || '') + '</td><td class="c">' + h(l.unidad) + '</td><td class="c">' + fmtNum(l.cantidad, 2) + '</td><td class="c">' + fmtMoneda(l.pu) + '</td><td class="c">' + fmtMoneda(l.importe) + '</td></tr>'; }).join('') +
      '</tbody></table></div>';
  }

  function tabResumenParcial() {
    var p = E.ficha, a = p.alternativas[0] || {}, det = a.estDetalle || {}, iva = 0.16;
    var desactualizada = esAdmin() && a.estVersion && p.versionPrecios && String(a.estVersion) !== String(p.versionPrecios);
    var mismo = Math.round(n(a.estMinTotal)) === Math.round(n(a.estMaxTotal));
    var html = '<section class="tarjeta"><h2>Datos de la obra</h2><div class="datos">' +
      dato('Sistema', h(p.sistema)) + dato('Diámetro', p.diametro ? h(p.diametro) + ' pulg' : '') + dato('Longitud', fmtNum(a.longitud) + ' m') +
      dato('Año de la obra', h(p.anio)) + dato('Colonia', h(p.colonia)) + dato('Calles', h(p.calles)) +
      dato('Superficie', h(String(a.superficie || 'DESCONOCIDA').toLowerCase())) + dato('¿Se cuenta con la traza?', a.tieneTraza ? 'Sí' : 'No') +
      (n(a.hincado) ? dato('Hincado', fmtNum(a.hincado) + ' m') : '') + '</div>' +
      (p.obs ? '<p style="margin:12px 0 0;white-space:pre-wrap">' + h(p.obs) + '</p>' : '') + '</section>' +
      '<section class="tarjeta inv-bloque"><div class="fila entre"><h2 style="margin:0">Inversión estimada</h2>' + chipInv('REF') + '</div>' +
      '<div class="inv-cifra">' + h(rangoTxt(a.estMinTotal, a.estMaxTotal)) + ' <span class="muted">con IVA</span></div>' +
      '<p class="muted" style="margin:0">' + (mismo ? 'Sin IVA: ' + fmtMoneda(a.estMin) : 'Sin IVA: ' + fmtMoneda(a.estMin) + ' – ' + fmtMoneda(a.estMax)) + ' · Calculado con catálogo CEA Jalisco 2022 + 23 % · ' +
      (a.superficie === 'DESCONOCIDA' || !a.superficie ? 'superficie desconocida' : 'superficie: ' + h(String(a.superficie).toLowerCase())) + ' · ' + (a.tieneTraza ? 'con traza' : 'sin traza: incluye ' + h(a.pctPiezas || 3) + ' % de piezas especiales') + '</p>' +
      '<p class="leyenda-doc">' + h(E.cat.textos.leyenda) + '</p>' +
      (det.lineasMin ? '<details class="como"><summary>¿Cómo se calculó?</summary><ul>' + (det.supuestos || []).map(function (t) { return '<li>' + h(t) + '</li>'; }).join('') + '</ul>' +
        '<h3>' + (mismo ? 'Conceptos' : 'Mínimo (' + h(String(det.supMin || '').toLowerCase()) + ')') + '</h3>' + tablaLineas(det.lineasMin) +
        (mismo ? '' : '<h3 style="margin-top:12px">Máximo (' + h(String(det.supMax || '').toLowerCase()) + ')</h3>' + tablaLineas(det.lineasMax)) +
        '<p class="muted">Calculado el ' + h(a.estFecha || '') + ' con la versión ' + h(a.estVersion || '') + ' de la tabla de precios.</p></details>' : '') +
      (desactualizada ? '<div class="fila" style="margin-top:10px"><span class="chip warn">La tabla de precios cambió (versión ' + h(a.estVersion) + ' → ' + h(p.versionPrecios) + ')</span><button class="btn chico" id="bRecalc">Recalcular con precios vigentes</button></div>' : '') +
      '</section>';
    if (esAdmin()) html += '<section class="fila" style="justify-content:flex-end"><button class="btn chico peligro" id="bDelProy">Eliminar obra</button></section>';
    $('#fCont').innerHTML = html;
    if ($('#bRecalc')) $('#bRecalc').onclick = function () { api('recalcularEstimacion', p.id).then(function (r) { if (resultado(r, 'Recalculado.')) recargarFicha(); }).catch(fallo); };
    if ($('#bDelProy')) $('#bDelProy').onclick = function () {
      var conf = prompt('Esto quita la obra de la app y manda su carpeta a la papelera de Drive.\n\nPara confirmar, escribe la clave: ' + p.id);
      if (conf == null) return;
      api('eliminarProyecto', p.id, conf).then(function (r) { if (resultado(r, 'Obra eliminada.')) recargarCatalogo().then(function () { ir('terminados'); }); }).catch(fallo);
    };
  }

  function formObraParcial(p) {
    var L = E.cat.listas, nueva = !p, a = p ? (p.alternativas[0] || {}) : {};
    p = p || {};
    var dia = function (sis, sel) { return (L.diametros[sis] || []).map(function (d) { return '<option value="' + d + '"' + (String(sel) === String(d) ? ' selected' : '') + '>' + d + '"</option>'; }).join(''); };
    var sis0 = p.sistema || 'AGUA POTABLE';
    abrirModal('<h2 style="margin:0">' + (nueva ? 'Registrar obra con datos parciales' : 'Editar obra ' + h(p.id)) + '</h2>' +
      '<p class="muted" style="margin:0">Para obras terminadas de las que solo se conoce sistema, diámetro, longitud y año. La app calcula un rango de referencia con la tabla de precios vigente.</p>' +
      '<div class="grid2">' +
      '<label class="col"><span class="etq">SISTEMA *</span><select id="oSis"' + (nueva ? '' : ' disabled') + '>' + L.sistemas.map(function (x) { return '<option' + (x === sis0 ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></label>' +
      '<label class="col"><span class="etq">DIÁMETRO *</span><select id="oDia">' + dia(sis0, p.diametro) + '</select></label>' +
      '<label class="col"><span class="etq">LONGITUD (M) *</span><input type="number" id="oLon" min="1" step="0.01" value="' + h(a.longitud || '') + '"></label>' +
      '<label class="col"><span class="etq">AÑO DE LA OBRA</span><input type="number" id="oAnio" min="1990" max="2100" value="' + h(p.anio || '') + '"></label>' +
      '<label class="col"><span class="etq">COLONIA</span><input type="text" id="oCol" list="dlCol" value="' + h(p.colonia || '') + '"><datalist id="dlCol">' + (E.cat.colonias || []).map(function (c) { return '<option value="' + h(c.n) + '">'; }).join('') + '</datalist></label>' +
      '<label class="col"><span class="etq">CALLES / TRAMO</span><input type="text" id="oCal" value="' + h(p.calles || '') + '"></label>' +
      '<label class="col"><span class="etq">SUPERFICIE PREDOMINANTE</span><select id="oSup">' + L.superficies.map(function (x) { return '<option value="' + x + '"' + ((a.superficie || 'DESCONOCIDA') === x ? ' selected' : '') + '>' + (x === 'DESCONOCIDA' ? 'Desconocida (da un rango)' : x.charAt(0) + x.slice(1).toLowerCase()) + '</option>'; }).join('') + '</select></label>' +
      '<label class="col"><span class="etq">¿SE CUENTA CON LA TRAZA?</span><select id="oTra"><option value="NO">No (se agrega ' + h(E.cat.textos.pctPiezas || 3) + ' % de piezas especiales)</option><option value="SI"' + (a.tieneTraza ? ' selected' : '') + '>Sí (el KMZ va en su carpeta de Drive)</option></select></label>' +
      '<label class="col"><span class="etq">HINCADO / CRUCE (M, OPCIONAL)</span><input type="number" id="oHin" min="0" step="0.1" value="' + h(a.hincado || '') + '"></label>' +
      '<label class="col"><span class="etq">NOMBRE (SE PROPONE SOLO)</span><input type="text" id="oNom" value="' + h(p.nombre || '') + '" placeholder="Línea de agua potable 10 in – Colonia (año)"></label>' +
      '</div><label class="col"><span class="etq">OBSERVACIONES</span><textarea id="oObs">' + h(p.obs || '') + '</textarea></label>' +
      '<div id="oPrev" class="prev"></div>' +
      '<div class="fila" style="justify-content:flex-end"><button class="btn" id="oX">Cancelar</button><button class="btn" id="oCalc">Calcular</button><button class="btn pri" id="oOk">Guardar</button></div>');
    var datos = function () {
      return { id: p.id || '', sistema: $('#oSis').value, diametro: $('#oDia').value, longitud: $('#oLon').value, anio: $('#oAnio').value, colonia: $('#oCol').value, calles: $('#oCal').value,
        superficie: $('#oSup').value, tieneTraza: $('#oTra').value === 'SI', hincado: $('#oHin').value, nombre: $('#oNom').value, obs: $('#oObs').value };
    };
    $('#oSis').onchange = function () { $('#oDia').innerHTML = dia(this.value, ''); $('#oPrev').innerHTML = ''; };
    $('#oX').onclick = cerrarModal;
    $('#oCalc').onclick = function () {
      $('#oPrev').innerHTML = '<span class="muted">Calculando…</span>';
      api('previsualizarEstimacion', datos()).then(function (r) {
        $('#oPrev').innerHTML = '<div class="inv-cifra" style="font-size:20px">' + h(rangoTxt(r.minTotal, r.maxTotal)) + ' <span class="muted">con IVA</span></div><ul class="muted" style="margin:6px 0 0">' + r.supuestos.map(function (t) { return '<li>' + h(t) + '</li>'; }).join('') + '</ul>';
      }).catch(function (e) { $('#oPrev').innerHTML = '<span class="error">' + h(e.message) + '</span>'; });
    };
    $('#oOk').onclick = function () {
      var b = this; b.disabled = true; b.textContent = 'Guardando…';
      api('guardarObraParcial', datos()).then(function (r) {
        if (!resultado(r, 'Obra guardada.')) { b.disabled = false; b.textContent = 'Guardar'; return; }
        cerrarModal(); recargarCatalogo().then(function () { abrirFicha(r.id); });
      }).catch(function (e) { fallo(e); b.disabled = false; b.textContent = 'Guardar'; });
    };
  }

  // ===================== TABLA DE PRECIOS (ADMIN) =====================
  function vistaPrecios() {
    marco('<div class="muted">Cargando tabla de precios…</div>');
    api('tablaPrecios').then(function (t) {
      var version = (t.parametros.find(function (x) { return x.clave === 'VERSION_PRECIOS'; }) || {}).valor;
      marco('<section class="fila entre"><div><h1 class="titulo">Tabla de precios</h1><span class="muted">Versión ' + h(version) + ' · Solo visible para el administrador. Se usa en las obras con datos parciales.</span></div></section>' +
        '<section class="tarjeta"><h2>Precios unitarios (sin IVA)</h2><p class="muted">CATÁLOGO: base 2022 × factor. ESTIMADO: tubería de agua potable de 10", 12" y 14" a partir de 8". COTIZACIÓN: precio directo. La columna CONAGUA 2025 es solo referencia.</p>' +
        '<div class="tabla-caja"><table class="t precios"><thead><tr><th style="text-align:left">Concepto</th><th>Unidad</th><th>Clave CEA</th><th>Fuente</th><th>Base 2022</th><th>Cotización</th><th>Aplicado</th><th>CONAGUA 2025</th><th style="text-align:left">Nota</th><th></th></tr></thead><tbody>' +
        t.precios.map(function (o) {
          return '<tr data-id="' + h(o.id) + '"><td>' + h(o.descripcion) + '</td><td class="c">' + h(o.unidad) + '</td><td class="c"><input type="text" data-k="clave" value="' + h(o.clave || '') + '" style="width:110px"></td>' +
            '<td class="c"><select data-k="fuente">' + t.fuentes.map(function (f) { return '<option' + (f === o.fuente ? ' selected' : '') + '>' + f + '</option>'; }).join('') + '</select></td>' +
            '<td class="c"><input type="number" step="0.01" data-k="base" value="' + h(o.base || '') + '" style="width:110px"></td>' +
            '<td class="c"><input type="number" step="0.01" data-k="directo" value="' + h(o.directo || '') + '" style="width:110px"></td>' +
            '<td class="c"><b>' + fmtMoneda(o.pu) + '</b></td><td class="c"><input type="number" step="0.01" data-k="conagua" value="' + h(o.conagua || '') + '" style="width:100px"></td>' +
            '<td><input type="text" data-k="nota" value="' + h(o.nota || '') + '" style="width:220px"></td><td class="c"><button class="btn chico" data-gp="' + h(o.id) + '">Guardar</button></td></tr>';
        }).join('') + '</tbody></table></div></section>' +
        '<section class="tarjeta"><h2>Parámetros</h2><div class="tabla-caja"><table class="t"><thead><tr><th style="text-align:left">Parámetro</th><th style="text-align:left">Valor</th><th></th></tr></thead><tbody>' +
        t.parametros.filter(function (x) { return x.clave !== 'VERSION_PRECIOS'; }).map(function (x) {
          var largo = x.clave === 'LEYENDA' || x.clave === 'AVISO';
          return '<tr><td><b>' + h(x.clave) + '</b><br><span class="muted">' + h(x.descripcion) + '</span></td><td>' + (largo ? '<textarea data-par="' + h(x.clave) + '" style="min-height:70px">' + h(x.valor) + '</textarea>' : '<input type="text" data-par="' + h(x.clave) + '" value="' + h(x.valor) + '" style="width:120px">') + '</td>' +
            '<td class="c"><button class="btn chico" data-gpar="' + h(x.clave) + '">Guardar</button></td></tr>';
        }).join('') + '</tbody></table></div><p class="muted">Cambiar un precio o un parámetro numérico sube la versión de la tabla. Las obras ya calculadas conservan su cifra hasta que uses "Recalcular con precios vigentes" en su ficha.</p></section>');
      $$('[data-gp]').forEach(function (b) {
        b.onclick = function () {
          var tr = b.closest('tr'), d = {};
          $$('[data-k]', tr).forEach(function (i) { d[i.getAttribute('data-k')] = i.value; });
          api('guardarPrecio', b.getAttribute('data-gp'), d).then(function (r) { if (resultado(r, 'Precio guardado (versión ' + (r && r.version) + ').')) vistaPrecios(); }).catch(fallo);
        };
      });
      $$('[data-gpar]').forEach(function (b) {
        b.onclick = function () {
          var k = b.getAttribute('data-gpar');
          api('guardarParametroEst', k, $('[data-par="' + k + '"]').value).then(function (r) { if (resultado(r, 'Parámetro guardado.')) recargarCatalogo().then(vistaPrecios); }).catch(fallo);
        };
      });
    }).catch(fallo);
  }

  // ===================== LECTURA DE DATOS DE LOS DOCUMENTOS =====================
  function bytesDe(b64) { var bin = atob(b64), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }

  /** Lee los documentos de la opción (y los comunes) y devuelve {valores, avisos, leidos}. */
  function leerDocumentos(p, a) {
    var X = window.Extraccion;
    var docs = p.documentos.filter(function (d) {
      var deLaOpcion = p.alternativas.length === 1 || !d.alternativa || d.alternativa === a.id;
      return deLaOpcion && ['REJ', 'PPT', 'MD'].indexOf(d.tipo) !== -1 && /\.(pdf|xlsx|xls|docx)$/i.test(d.nombre);
    });
    if (!docs.length) return Promise.reject(new Error('No hay resumen ejecutivo, presupuesto ni memoria (PDF, Excel o Word) registrados para esta opción. Usa "Actualizar archivos" en Documentos.'));
    var libs = [];
    if (docs.some(function (d) { return /\.pdf$/i.test(d.nombre); })) libs.push(cargarScript(CDN.pdfjs).then(function () { window.pdfjsLib.GlobalWorkerOptions.workerSrc = CDN.pdfjsWorker; }));
    if (docs.some(function (d) { return /\.xlsx?$/i.test(d.nombre); })) libs.push(cargarScript(CDN.xlsx));
    if (docs.some(function (d) { return /\.docx$/i.test(d.nombre); })) libs.push(cargarScript(CDN.jszip));
    var resultados = [], leidos = [];
    return Promise.all(libs).then(function () {
      return docs.reduce(function (prom, d, i) {
        return prom.then(function () {
          aviso('Leyendo ' + (i + 1) + ' de ' + docs.length + ': ' + d.nombre, 60000);
          return api('documento', d.id).then(function (r) {
            var b = bytesDe(r.b64);
            if (/\.pdf$/i.test(d.nombre)) return X.filasPdf(window.pdfjsLib, b);
            if (/\.xlsx?$/i.test(d.nombre)) return X.filasXlsx(window.XLSX, b);
            return X.filasDocx(window.JSZip, b);
          }).then(function (filas) {
            var datos = X.extraer(filas);
            resultados.push({ nombre: d.nombre, prioridad: X.prioridad(d.tipo, d.nombre), datos: datos });
            leidos.push({ nombre: d.nombre, n: Object.keys(datos).length });
          }).catch(function (e) { leidos.push({ nombre: d.nombre, error: e.message }); });
        });
      }, Promise.resolve());
    }).then(function () {
      aviso('Lectura terminada.');
      var c = X.combinar(resultados); c.leidos = leidos; return c;
    });
  }

  // ===================== MODAL =====================
  function abrirModal(html) { var m = $('#modal'); m.innerHTML = '<div class="modal-caja" role="dialog" aria-modal="true">' + html + '</div>'; m.hidden = false; var f = m.querySelector('input:not([disabled]),select:not([disabled]),textarea,button'); if (f) f.focus(); }
  function cerrarModal() { var m = $('#modal'); if (!m) return; m.hidden = true; m.innerHTML = ''; }
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && !$('#modal').hidden) cerrarModal();
    if (ev.key === 'Enter' && ev.target.classList && ev.target.classList.contains('proy')) ev.target.click();
  });

  iniciar();
})();
