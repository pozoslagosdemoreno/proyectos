/*
 * APP PROYECTOS — Lectura de datos de documentos (PDF, Excel, Word) en el navegador.
 * Convierte cada documento en filas de celdas y busca los datos por sus etiquetas
 * (plantillas del departamento: resumen ejecutivo, presupuesto y memoria descriptiva).
 */
(function (raiz) {
  'use strict';

  // ===================== DOCUMENTOS → FILAS =====================
  /** PDF: agrupa el texto por renglón (posición vertical) y lo separa en celdas por los huecos horizontales. */
  function filasPdf(pdfjsLib, bytes) {
    return pdfjsLib.getDocument({ data: bytes }).promise.then(function (doc) {
      var paginas = [];
      for (var i = 1; i <= doc.numPages; i++) paginas.push(i);
      return paginas.reduce(function (prom, n) {
        return prom.then(function (filas) {
          return doc.getPage(n).then(function (pg) { return pg.getTextContent(); }).then(function (tc) {
            var items = tc.items.filter(function (it) { return it.str && it.str.trim(); }).map(function (it) {
              return { s: it.str, x: it.transform[4], y: it.transform[5], w: it.width || it.str.length * 4, h: Math.abs(it.transform[3]) || 8 };
            });
            items.sort(function (a, b) { return b.y - a.y || a.x - b.x; });
            var renglones = [];
            items.forEach(function (it) {
              var r = renglones.length ? renglones[renglones.length - 1] : null;
              if (r && Math.abs(r.y - it.y) <= Math.max(2, it.h * 0.35)) r.items.push(it);
              else renglones.push({ y: it.y, items: [it] });
            });
            renglones.forEach(function (r) {
              r.items.sort(function (a, b) { return a.x - b.x; });
              var celdas = [], actual = '', finAnterior = null;
              r.items.forEach(function (it) {
                var hueco = finAnterior == null ? 0 : it.x - finAnterior;
                if (finAnterior != null && hueco > Math.max(12, it.h * 1.2)) { celdas.push(actual.trim()); actual = ''; }
                else if (finAnterior != null && hueco > 0.5) actual += ' ';
                actual += it.s; finAnterior = it.x + it.w;
              });
              if (actual.trim()) celdas.push(actual.trim());
              filas.push(celdas);
            });
            return filas;
          });
        });
      }, Promise.resolve([]));
    });
  }

  /** Excel: todas las hojas, renglón por renglón. */
  function filasXlsx(XLSX, bytes) {
    var wb = XLSX.read(bytes, { type: 'array' });
    var filas = [];
    wb.SheetNames.forEach(function (n) {
      XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' }).forEach(function (r) {
        var celdas = r.filter(function (c) { return c !== '' && c != null; });
        if (celdas.length) filas.push(celdas);
      });
    });
    return Promise.resolve(filas);
  }

  /** Word: párrafos como renglones de una celda y tablas renglón por renglón. */
  function filasDocx(JSZip, bytes) {
    return JSZip.loadAsync(bytes).then(function (zip) {
      var f = zip.file('word/document.xml');
      if (!f) throw new Error('El archivo Word no tiene contenido legible.');
      return f.async('string');
    }).then(function (xml) {
      var dec = function (s) { return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&'); };
      var textoDe = function (frag) { return dec((frag.match(/<w:t[^>]*>[\s\S]*?<\/w:t>|<w:tab\/>/g) || []).map(function (t) { return t === '<w:tab/>' ? ' ' : t.replace(/<[^>]+>/g, ''); }).join('')).trim(); };
      var filas = [];
      var cuerpo = xml.replace(/<w:tbl>[\s\S]*?<\/w:tbl>/g, function (tbl) {
        (tbl.match(/<w:tr[\s>][\s\S]*?<\/w:tr>/g) || []).forEach(function (tr) {
          var celdas = (tr.match(/<w:tc>[\s\S]*?<\/w:tc>/g) || []).map(textoDe).filter(Boolean);
          if (celdas.length) filas.push(celdas);
        });
        return '';
      });
      (cuerpo.match(/<w:p[\s>][\s\S]*?<\/w:p>/g) || []).forEach(function (p) { var t = textoDe(p); if (t) filas.push([t]); });
      return filas;
    });
  }

  // ===================== BÚSQUEDA DE DATOS =====================
  function norm(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase(); }

  /** Primer número de un texto ("$ 1,463,466.97", "582 m", "3 pulgadas") o null. */
  function numero(v) {
    if (typeof v === 'number') return isFinite(v) ? v : null;
    var m = String(v == null ? '' : v).match(/-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d+(?:\.\d+)?/);
    return m ? Number(m[0].replace(/,/g, '')) : null;
  }

  var CAMPOS = [
    { c: 'longitud', re: /LONGITUD (TOTAL )?(DE LA LINEA|DE LA RED|TOTAL)|LONGITUD DE LA LINEA/, no: /SUPERFICIE|TERRACER|ASFALTO|EMPEDRADO|ADOQU|CONCRETO|HINCAD|PROMEDIO|CONEXION|SUMA/, tipo: 'num', min: 1 },
    { c: 'diametro', re: /DIAMETRO NOMINAL|DIAMETRO DE (LA )?TUBERIA/, no: /ENCAMISADO|HINCAD/, tipo: 'num', min: 1, max: 60 },
    { c: 'material', re: /MATERIAL PROPUESTO|MATERIAL DE (LA )?TUBERIA/, tipo: 'texto' },
    { c: 'poblacion', re: /POBLACION BENEFICIADA/, tipo: 'num', min: 1 },
    { c: 'subA', re: /SUBTOTAL\s*A\b/, tipo: 'num' },
    { c: 'subB', re: /SUBTOTAL\s*B\b/, tipo: 'num' },
    { c: 'subC', re: /SUBTOTAL\s*C\b/, tipo: 'num' },
    { c: 'subD', re: /SUBTOTAL\s*D\b/, tipo: 'num' },
    { c: 'subE', re: /SUBTOTAL\s*E\b/, tipo: 'num' },
    { c: 'sinIva', re: /SUBTOTAL SIN I\.?\s*V\.?\s*A/, tipo: 'num', min: 1 },
    { c: 'iva', re: /16\s*%\s*(DE\s*)?I\.?\s*V\.?\s*A/, no: /INCLUID|INCLUYE/, tipo: 'num', min: 1 },
    { c: 'total', re: /GRAN TOTAL/, tipo: 'num', min: 1 },
    { c: 'total', re: /INVERSION ESTIMADA\s*:/, tipo: 'num', min: 1, respaldo: true }
  ];
  var ETIQUETAS = { longitud: 'Longitud (m)', diametro: 'Diámetro (pulg)', material: 'Material', poblacion: 'Población beneficiada', subA: 'Subtotal A', subB: 'Subtotal B', subC: 'Subtotal C', subD: 'Subtotal D', subE: 'Subtotal E', sinIva: 'Subtotal sin IVA', iva: 'IVA', total: 'Total con IVA', duracion: 'Duración (días hábiles)' };

  /** Busca los datos en las filas de un documento. Devuelve {campo: valor}. */
  function extraer(filas) {
    var datos = {};
    var limpias = filas.filter(function (r) { return !/\.{5,}/.test(r.join(' ')); });   // fuera índices
    CAMPOS.forEach(function (def) {
      if (datos[def.c] != null) return;
      for (var i = 0; i < limpias.length; i++) {
        var r = limpias[i];
        for (var j = 0; j < r.length; j++) {
          var celda = norm(r[j]);
          var m = celda.match(def.re);
          if (!m || (def.no && def.no.test(celda))) continue;
          var resto = String(r[j]).slice(m.index + m[0].length);
          var valor = null;
          if (def.tipo === 'texto') {
            if (m.index > 3) continue;   // la etiqueta debe iniciar la celda (no un texto corrido)
            var t = resto.replace(/^[\s:.\-–—]+/, '').trim();
            valor = t || (r[j + 1] != null ? String(r[j + 1]).trim() : null);
            if (!valor || !/[A-Za-z]{2}/.test(valor) || valor.length > 40) valor = null;
          } else {
            valor = numero(resto.replace(/^[\s:.\-–—]+/, '').replace(/^(DE LA (LINEA|TUBERIA)|DE LA RED)/i, ''));
            for (var k = j + 1; valor == null && k < r.length; k++) valor = numero(r[k]);
            if (valor != null && ((def.min != null && valor < def.min) || (def.max != null && valor > def.max))) valor = null;
          }
          if (valor != null && valor !== '') { datos[def.c] = typeof valor === 'number' ? Math.round(valor * 100) / 100 : valor; return; }
        }
      }
    });
    // Longitud en texto corrido ("…de 1,230 m de longitud", "longitud aproximada de 582 m")
    if (datos.longitud == null) {
      var todo = limpias.map(function (r) { return r.join(' '); }).join(' ');
      var m1 = todo.match(/([\d,\.]+)\s*(?:m|mts?\.?|metros)\s+de\s+longitud/i) || todo.match(/longitud\s+(?:aproximada|total)?\s*de\s+([\d,\.]+)\s*(?:m|mts?|metros)\b/i);
      if (m1) { var v = numero(m1[1]); if (v > 1) datos.longitud = v; }
    }
    // Duración: renglón "DURACIÓN TOTAL DEL PROYECTO" y los siguientes
    for (var i2 = 0; i2 < limpias.length && datos.duracion == null; i2++) {
      if (!/DURACION TOTAL/.test(norm(limpias[i2].join(' ')))) continue;
      var ventana = limpias.slice(Math.max(0, i2 - 1), i2 + 4).map(function (r) { return r.join(' '); }).join(' ');
      if (!/HABILES/.test(norm(ventana))) continue;
      var m2 = ventana.match(/h[aá]biles\s*:?\s*(\d{1,4})\b/i);
      if (m2) { datos.duracion = Number(m2[1]); break; }
      // El número puede quedar en el mismo renglón que "DURACIÓN TOTAL" (sin contar las fechas)
      var nums = limpias[i2].join(' ').replace(/\d{1,2}\/\d{1,2}\/\d{2,4}/g, ' ').match(/\b\d{1,4}\b/g);
      if (nums) datos.duracion = Number(nums[nums.length - 1]);
    }
    return datos;
  }

  var PRIORIDAD = { REJ: 1, PPT: 2, MD: 4, OTRO: 5 };

  /** Une los datos de varios documentos según la prioridad (resumen ejecutivo > presupuesto PDF > presupuesto Excel > memoria). */
  function combinar(resultados) {
    var orden = resultados.slice().sort(function (a, b) { return a.prioridad - b.prioridad; });
    var valores = {}, avisos = [];
    Object.keys(ETIQUETAS).forEach(function (c) {
      var con = orden.filter(function (r) { return r.datos[c] != null && r.datos[c] !== ''; });
      if (!con.length) return;
      valores[c] = { valor: con[0].datos[c], fuente: con[0].nombre };
      con.slice(1).forEach(function (r) {
        var a = con[0].datos[c], b = r.datos[c];
        var distinto = typeof a === 'number' ? Math.abs(a - b) > Math.max(0.5, Math.abs(a) * 0.005) : norm(a) !== norm(b);
        if (distinto) avisos.push(ETIQUETAS[c] + ': ' + formato(b) + ' en "' + r.nombre + '"; se usó ' + formato(a) + ' de "' + con[0].nombre + '".');
      });
    });
    var subs = ['subA', 'subB', 'subC', 'subD', 'subE'].filter(function (c) { return valores[c]; });
    if (subs.length && valores.sinIva) {
      var suma = subs.reduce(function (t, c) { return t + valores[c].valor; }, 0);
      if (Math.abs(suma - valores.sinIva.valor) > 1) avisos.push('Los subtotales A–E suman ' + formato(suma) + ' y el subtotal sin IVA dice ' + formato(valores.sinIva.valor) + '.');
    }
    return { valores: valores, avisos: avisos };
  }

  function formato(v) { return typeof v === 'number' ? v.toLocaleString('es-MX', { maximumFractionDigits: 2 }) : '"' + v + '"'; }

  /** Prioridad de un documento por su tipo y formato. */
  function prioridad(tipo, nombre) {
    var p = PRIORIDAD[tipo] || PRIORIDAD.OTRO;
    if (tipo === 'PPT' && /\.xlsx?$/i.test(nombre)) p = 3;
    return p;
  }

  var api = { filasPdf: filasPdf, filasXlsx: filasXlsx, filasDocx: filasDocx, extraer: extraer, combinar: combinar, prioridad: prioridad, numero: numero, ETIQUETAS: ETIQUETAS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.Extraccion = api;
})(this);
