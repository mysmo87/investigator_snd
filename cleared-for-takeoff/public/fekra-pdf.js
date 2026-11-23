/* =====================================================================
   FEKRA PDF — a downloadable, A4 PDF of an innovation proposal.

   Pages are laid out here and drawn on canvas, so the browser's own text engine shapes
   Arabic and orders right-to-left text correctly; each page is then embedded in a real
   PDF file (written below, no libraries) with clickable links for the research
   references, page numbers, the proposal reference and document metadata.
   Text in the PDF is part of the page image, so it is not selectable.

   window.FekraPDF.build(model) -> Promise<Blob>
   model = { dir: 'ltr'|'rtl', lang, title, reference, date, status, labels: {...}, logo: HTMLImageElement,
             blocks: [ { type: 'heading'|'para'|'labelled'|'bullets'|'table'|'box'|'status'|'refs'|'note', ... } ] }
   ===================================================================== */
(() => {
  const PAGE = { w: 595.28, h: 841.89 };                 // A4 in points
  const S = 2.5;                                          // canvas pixels per point (180 dpi)
  const M = { l: 54, r: 54, top: 96, bottom: 70 };
  const C = { navy: '#0B2A5B', ink: '#1C2B44', muted: '#5B6B86', gold: '#B48A35', blue: '#1F5FA8', line: '#D8E0EC', soft: '#F3F6FB', softGold: '#FBF6EA' };
  const FONT = rtl => rtl ? '"Noto Sans Arabic", "Noto Kufi Arabic", "Inter Variable", Tahoma, sans-serif' : '"Inter Variable", Inter, "Noto Sans Arabic", "Segoe UI", Arial, sans-serif';
  const TAG = { research: ['#E7F6EF', '#17694A'], user: ['#EAF1FB', '#1F5FA8'], inferred: ['#FFF3E0', '#9A5B00'], recommendation: ['#EEF0F7', '#3E4A6B'], validate: ['#FFF3E0', '#9A5B00'] };

  function layout(model) {
    const rtl = model.dir === 'rtl', ff = FONT(rtl), pages = [], links = [];
    const W = PAGE.w - M.l - M.r;
    let cv, x, y, page = -1;
    const font = (size, weight = 400) => `${weight} ${size}px ${ff}`;
    function newPage() {
      cv = document.createElement('canvas'); cv.width = Math.round(PAGE.w * S); cv.height = Math.round(PAGE.h * S);
      x = cv.getContext('2d'); x.setTransform(S, 0, 0, S, 0, 0);
      x.fillStyle = '#ffffff'; x.fillRect(0, 0, PAGE.w, PAGE.h);
      x.textBaseline = 'alphabetic'; x.direction = rtl ? 'rtl' : 'ltr';
      pages.push(cv); links.push([]); page += 1; y = M.top;
    }
    const left = () => M.l, right = () => PAGE.w - M.r;
    // x of a line start, in the reading direction
    const startX = (indent = 0) => rtl ? right() - indent : left() + indent;
    function ensure(h) { if (y + h > PAGE.h - M.bottom) { newPage(); return true; } return false; }
    function wrap(text, f, max) {
      x.font = f;
      const out = [];
      String(text || '').split(/\n/).forEach(par => {
        const words = par.split(/\s+/).filter(Boolean); let line = '';
        for (let w of words) {
          if (x.measureText(w).width > max) { // a very long word (a URL): break it
            if (line) { out.push(line); line = ''; }
            let part = '';
            for (const ch of w) { if (x.measureText(part + ch).width > max) { out.push(part); part = ch; } else part += ch; }
            line = part; continue;
          }
          const tryLine = line ? line + ' ' + w : w;
          if (x.measureText(tryLine).width <= max) line = tryLine; else { out.push(line); line = w; }
        }
        out.push(line);
      });
      return out;
    }
    function text(t, px, py, f, color, align) { x.font = f; x.fillStyle = color; x.direction = rtl ? 'rtl' : 'ltr'; x.textAlign = align || (rtl ? 'right' : 'left'); x.fillText(t, px, py); }
    function lines(ls, f, color, lh, indent = 0) { ls.forEach(l => { ensure(lh); y += lh; text(l, startX(indent), y - lh * .28, f, color); }); }
    const clean = s => String(s || '').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\[S(\d{1,2})\]/g, '[$1]').replace(/\s+\n/g, '\n').trim();
    function pill(label, colors, px, py, size = 7.5) {
      x.font = font(size, 700); const w = x.measureText(label).width + 10, h = size + 6;
      const bx = rtl ? px - w : px;
      x.fillStyle = colors[0]; roundRect(bx, py - h + 3, w, h, 3); x.fill();
      text(label, bx + w / 2, py - 1, font(size, 700), colors[1], 'center');
      return w;
    }
    function roundRect(a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }

    const R = {
      cover(b) {
        text(model.labels.kicker.toUpperCase(), startX(), y + 10, font(8.5, 700), C.gold);
        y += 22;
        const tl = wrap(model.title || model.labels.untitled, font(21, 700), W);
        lines(tl, font(21, 700), C.navy, 27);
        y += 12;
        // meta row: reference, date, status, prepared with
        const cells = b.meta, cw = W / cells.length;
        x.fillStyle = C.soft; x.fillRect(left(), y, W, 38);
        cells.forEach(([k, v], i) => {
          const cx = rtl ? right() - i * cw - 10 : left() + i * cw + 10;
          text(k.toUpperCase(), cx, y + 14, font(6.5, 700), C.muted);
          text(v, cx, y + 29, font(9, 600), C.ink);
        });
        y += 52;
      },
      heading(b, next) {
        ensure(48 + firstHeight(next)); y += 14; // a heading stays with the start of what follows it
        const num = `${b.num}`, f = font(13.5, 700);
        text(num, startX(), y + 12, font(11, 700), C.gold);
        x.font = font(11, 700); const nw = x.measureText(num).width + 8;
        text(b.text, rtl ? right() - nw : left() + nw, y + 12, f, C.navy);
        y += 19; x.fillStyle = C.gold; x.fillRect(left(), y, W, 1.2); y += 10;
      },
      para(b) { lines(wrap(clean(b.text), font(b.size || 9.5, b.weight || 400), W - (b.indent || 0)), font(b.size || 9.5, b.weight || 400), b.color || C.ink, (b.size || 9.5) * 1.55, b.indent || 0); y += b.after ?? 6; },
      labelled(b, next) {
        ensure(b.text ? 30 : 14 + firstHeight(next)); // a label without text introduces the next block: keep them together
        text(b.label.toUpperCase(), startX(), y + 9, font(7, 700), C.muted); y += 11;
        if (b.tag) { pill(b.tag[0], TAG[b.tag[1]] || TAG.recommendation, rtl ? left() + 60 : right() - 60, y - 2); }
        R.para({ text: b.text, after: 7 });
      },
      bullets(b) {
        b.items.forEach(it => {
          const f = font(9.5), ls = wrap(clean(it.text || it), f, W - 14);
          ensure(15);
          ls.forEach((l, i) => { ensure(14.7); y += 14.7; if (i === 0) { x.fillStyle = C.gold; x.fillRect(rtl ? right() - 4 : left() + 1, y - 7.5, 3.4, 3.4); } text(l, startX(12), y - 4, f, C.ink); });
          if (it.tag) { y += 2; const tags = Array.isArray(it.tag[0]) ? it.tag : [it.tag]; let off = 12; tags.forEach(tg => { ensure(14); off += pill(tg[0], TAG[tg[1]] || TAG.recommendation, startX(off) + (rtl ? 0 : 0), y + 11) + 5; }); y += 13; }
          y += 3;
        });
        y += 4;
      },
      box(b) {
        const f = font(10), ls = wrap(clean(b.text), f, W - 24), h = ls.length * 15.5 + 22 + (b.label ? 14 : 0);
        ensure(Math.min(h, PAGE.h - M.top - M.bottom));
        x.fillStyle = C.softGold; x.fillRect(left(), y, W, h); x.fillStyle = C.gold; x.fillRect(rtl ? right() - 3 : left(), y, 3, h);
        let yy = y + 10;
        if (b.label) { text(b.label.toUpperCase(), startX(12), yy + 8, font(7, 700), C.gold); yy += 14; }
        ls.forEach(l => { yy += 15.5; text(l, startX(12), yy - 4, f, C.ink); });
        y += h + 10;
      },
      status(b) {
        ensure(30); y += 4;
        const w = pill(b.label, b.colors || ['#EAF1FB', C.navy], startX(), y + 14, 9);
        if (b.note) text(b.note, rtl ? right() - w - 10 : left() + w + 10, y + 13, font(8, 400), C.muted);
        y += 26;
      },
      table(b) {
        const cols = b.cols, total = cols.reduce((s, c) => s + c.w, 0), widths = cols.map(c => c.w / total * W), pad = 6;
        const hf = font(7.5, 700), cf = font(8.5), lh = 12.5;
        const header = () => {
          const hl = cols.map((c, i) => wrap(c.title.toUpperCase(), hf, widths[i] - pad * 2)), hh = Math.max(...hl.map(l => l.length)) * 11 + pad * 2;
          x.fillStyle = C.navy; x.fillRect(left(), y, W, hh);
          let cx = rtl ? right() : left();
          hl.forEach((ls, i) => { ls.forEach((l, k) => text(l, rtl ? cx - pad : cx + pad, y + pad + 8.5 + k * 11, hf, '#ffffff')); cx += rtl ? -widths[i] : widths[i]; });
          y += hh;
        };
        // keep the header with at least the first row (no orphaned header at the foot of a page)
        const rowH = row => Math.max(...row.map((cell, i) => wrap(clean(cell), i === 0 ? font(8.5, 600) : cf, widths[i] - pad * 2).length)) * lh + pad * 2;
        ensure(34 + (b.rows.length ? Math.min(rowH(b.rows[0]), 300) : 0)); header();
        b.rows.forEach((row, ri) => {
          const cl = row.map((cell, i) => wrap(clean(cell), i === 0 ? font(8.5, 600) : cf, widths[i] - pad * 2));
          const rh = Math.max(...cl.map(l => l.length)) * lh + pad * 2;
          if (ensure(rh)) header();
          if (ri % 2) { x.fillStyle = C.soft; x.fillRect(left(), y, W, rh); }
          let cx = rtl ? right() : left();
          cl.forEach((ls, i) => { ls.forEach((l, k) => text(l, rtl ? cx - pad : cx + pad, y + pad + 9 + k * lh, i === 0 ? font(8.5, 600) : cf, C.ink)); cx += rtl ? -widths[i] : widths[i]; });
          y += rh; x.fillStyle = C.line; x.fillRect(left(), y - .6, W, .6);
        });
        y += 12;
      },
      refs(b) {
        b.items.forEach((r, i) => {
          const f = font(8.5, 600), uf = font(7.5);
          const tl = wrap(`[${i + 1}] ${r.title}`, f, W - 10), ul = wrap(r.url, uf, W - 18);
          ensure(tl.length * 12.5 + ul.length * 11 + 6);
          tl.forEach(l => { y += 12.5; text(l, startX(), y - 3, f, C.ink); });
          ul.forEach(l => {
            y += 11; x.font = uf; const w = x.measureText(l).width;
            x.save(); x.direction = 'ltr'; x.textAlign = rtl ? 'right' : 'left'; x.fillStyle = C.blue; x.fillText(l, startX(12), y - 2.5); x.restore();
            const lx = rtl ? startX(12) - w : startX(12);
            links[page].push({ x: lx, y: y - 10, w, h: 11, url: r.url });
          });
          y += 6;
        });
      },
      note(b) { R.para({ text: b.text, size: 8, color: C.muted, after: 8 }); },
      space(b) { y += b.h || 8; }
    };

    /* height of the first piece of a block, so a heading can keep with it */
    function firstHeight(b) {
      if (!b) return 0;
      if (b.type === 'table') { const cols = b.cols, total = cols.reduce((s2, c) => s2 + c.w, 0), widths = cols.map(c => c.w / total * W); const row = b.rows[0] || []; return 34 + Math.min(300, Math.max(1, ...row.map((cell, i) => wrap(clean(cell), font(8.5), widths[i] - 12).length)) * 12.5 + 12); }
      if (b.type === 'box') return Math.min(320, wrap(clean(b.text), font(10), W - 24).length * 15.5 + 36);
      if (b.type === 'labelled') return 11 + Math.min(3, wrap(clean(b.text), font(9.5), W).length) * 14.7;
      if (b.type === 'bullets') return Math.min(3, wrap(clean((b.items[0] || {}).text || b.items[0] || ''), font(9.5), W - 14).length) * 14.7 + 16;
      if (b.type === 'status') return 30;
      return 2 * 14.7;
    }
    newPage();
    model.blocks.forEach((b, i) => { const fn = R[b.type] || R.para; if (b.type === 'heading' || b.type === 'labelled') fn(b, model.blocks[i + 1]); else fn(b); });

    // header and footer on every page, now that the page count is known
    pages.forEach((p, i) => {
      x = p.getContext('2d'); x.setTransform(S, 0, 0, S, 0, 0); x.direction = rtl ? 'rtl' : 'ltr';
      const logo = model.logo;
      if (logo && logo.naturalWidth) { const lh = 34, lw = lh * logo.naturalWidth / logo.naturalHeight; x.drawImage(logo, rtl ? PAGE.w - M.r - lw : M.l, 30, lw, lh); }
      text(model.labels.kicker, rtl ? M.l : PAGE.w - M.r, 44, font(7.5, 700), C.gold, rtl ? 'left' : 'right');
      text(model.reference ? `${model.labels.reference}: ${model.reference}` : model.labels.unsaved, rtl ? M.l : PAGE.w - M.r, 57, font(7.5, 400), C.muted, rtl ? 'left' : 'right');
      x.fillStyle = C.gold; x.fillRect(M.l, 74, PAGE.w - M.l - M.r, .8);
      x.fillStyle = C.line; x.fillRect(M.l, PAGE.h - 46, PAGE.w - M.l - M.r, .6);
      text(model.labels.footer, rtl ? PAGE.w - M.r : M.l, PAGE.h - 32, font(7, 400), C.muted, rtl ? 'right' : 'left');
      text(model.labels.page(i + 1, pages.length), rtl ? M.l : PAGE.w - M.r, PAGE.h - 32, font(7, 600), C.navy, rtl ? 'left' : 'right');
    });
    return { pages, links };
  }

  /* ---------- a minimal PDF writer: one JPEG per page, link annotations, metadata ---------- */
  const enc = new TextEncoder();
  const pdfString = s => '(' + String(s).replace(/[\\()]/g, m => '\\' + m).replace(/[^\x20-\x7e]/g, '') + ')';
  const utf16 = s => { let h = 'FEFF'; for (const ch of String(s)) { const c = ch.codePointAt(0); if (c > 0xffff) { const v = c - 0x10000; h += (0xd800 + (v >> 10)).toString(16).padStart(4, '0') + (0xdc00 + (v & 0x3ff)).toString(16).padStart(4, '0'); } else h += c.toString(16).padStart(4, '0'); } return '<' + h.toUpperCase() + '>'; };
  async function jpeg(canvas) {
    const blob = await new Promise((res, rej) => canvas.toBlob(b => (b ? res(b) : rej(new Error('canvas export failed'))), 'image/jpeg', 0.92));
    return new Uint8Array(await blob.arrayBuffer());
  }
  async function writePdf(pages, links, info) {
    const parts = [], offsets = [];
    let length = 0;
    const push = data => { const b = typeof data === 'string' ? enc.encode(data) : data; parts.push(b); length += b.length; };
    const objStart = n => { offsets[n] = length; push(`${n} 0 obj\n`); };
    push('%PDF-1.4\n'); push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])); // binary marker comment
    // numbering: 1 catalog, 2 pages, 3 info, then per page: page, contents, image, link annotations
    let n = 4; const pageObjs = [];
    const plan = pages.map((p, i) => { const o = { page: n++, contents: n++, image: n++, annots: links[i].map(() => n++) }; pageObjs.push(o.page); return o; });
    objStart(1); push(`<< /Type /Catalog /Pages 2 0 R /Lang ${pdfString(info.lang)}${info.rtl ? ' /ViewerPreferences << /Direction /R2L >>' : ''} >>\nendobj\n`);
    objStart(2); push(`<< /Type /Pages /Count ${pages.length} /Kids [${pageObjs.map(k => `${k} 0 R`).join(' ')}] >>\nendobj\n`);
    const d = new Date(), pad = v => String(v).padStart(2, '0');
    objStart(3); push(`<< /Title ${utf16(info.title)} /Author ${utf16(info.author)} /Subject ${utf16(info.subject)} /Producer (Fekra - GDRFA innovation assistant) /CreationDate (D:${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z) >>\nendobj\n`);
    for (let i = 0; i < pages.length; i++) {
      const o = plan[i], img = await jpeg(pages[i]), cw = pages[i].width, ch = pages[i].height;
      objStart(o.page);
      push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE.w} ${PAGE.h}] /Resources << /XObject << /Im0 ${o.image} 0 R >> >> /Contents ${o.contents} 0 R${o.annots.length ? ` /Annots [${o.annots.map(a => `${a} 0 R`).join(' ')}]` : ''} >>\nendobj\n`);
      const stream = `q ${PAGE.w} 0 0 ${PAGE.h} 0 0 cm /Im0 Do Q\n`;
      objStart(o.contents); push(`<< /Length ${enc.encode(stream).length} >>\nstream\n${stream}endstream\nendobj\n`);
      objStart(o.image); push(`<< /Type /XObject /Subtype /Image /Width ${cw} /Height ${ch} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.length} >>\nstream\n`); push(img); push('\nendstream\nendobj\n');
      links[i].forEach((l, k) => {
        let uri; try { uri = encodeURI(decodeURI(l.url)); } catch { uri = l.url; }
        uri = uri.replace(/[^\x21-\x7e]/g, '');
        objStart(o.annots[k]); push(`<< /Type /Annot /Subtype /Link /Rect [${l.x.toFixed(2)} ${(PAGE.h - l.y - l.h).toFixed(2)} ${(l.x + l.w).toFixed(2)} ${(PAGE.h - l.y).toFixed(2)}] /Border [0 0 0] /A << /S /URI /URI ${pdfString(uri)} >> >>\nendobj\n`);
      });
    }
    const xref = length, count = n;
    let table = `xref\n0 ${count}\n0000000000 65535 f \n`;
    for (let k = 1; k < count; k++) table += `${String(offsets[k] || 0).padStart(10, '0')} 00000 n \n`;
    push(table); push(`trailer\n<< /Size ${count} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    return new Blob(parts, { type: 'application/pdf' });
  }

  async function build(model) {
    const rtl = model.dir === 'rtl';
    if (document.fonts && document.fonts.load) {
      await Promise.race([Promise.all([document.fonts.load(`400 12px ${FONT(rtl)}`, rtl ? 'مقترح' : 'Proposal'), document.fonts.load(`700 12px ${FONT(rtl)}`, rtl ? 'مقترح' : 'Proposal'), document.fonts.ready]).catch(() => {}), new Promise(r => setTimeout(r, 2500))]);
    }
    if (model.logo && model.logo.decode) await model.logo.decode().catch(() => {});
    const { pages, links } = layout(model);
    return writePdf(pages, links, { title: model.title || 'Innovation proposal', author: 'Fekra – GDRFA', subject: model.labels.kicker, lang: model.lang || 'en', rtl });
  }

  window.FekraPDF = { build, _layout: layout };
})();
