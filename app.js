/* Poszukujący, RM Nieruchomości — aplikacja do zapisywania kontaktów po rozmowie */

// numer wersji widoczny w zielonym pasku; podbijać razem z ?v= w index.html i CACHE w sw.js
const WERSJA = 5;
document.querySelectorAll('[data-wersja]').forEach(el => { el.textContent = 'v' + WERSJA; });

const KEY = 'rm-poszukujacy-v1';
const POWODY = ['Oferta sprzedana', 'Jest przedwstępna', 'Nie mam takiej oferty', 'Z reklamy', 'Polecenie', 'Wizytówka Google'];
const TYPY = ['Mieszkanie', 'Dom', 'Działka', 'Lokal', 'Inwestycja', 'Najem'];
const FINANSOWANIE = ['Gotówka', 'Kredyt, ma zdolność', 'Kredyt, do sprawdzenia'];
const TERMINY = ['Pilnie', 'Do 3 miesięcy', 'Bada rynek'];
const ZAKRESY = ['Wszystko', 'Tylko aktywni', 'Tylko do oddzwonienia'];
const AKTYWNE = ['Nowy', 'Szukam', 'Wysłana oferta', 'Po prezentacji'];
const BUDZETY = [
  ['do 250 tys.', '250000'],
  ['do 350 tys.', '350000'],
  ['do 450 tys.', '450000'],
  ['do 600 tys.', '600000'],
  ['do 800 tys.', '800000'],
  ['do 1 mln', '1000000'],
  ['ponad 1 mln', '1500000']
];
/* lokalizacje na start, potem dopisują się te, których Rafał faktycznie używa */
const LOKALIZACJE_BAZOWE = ['Elbląg', 'Gronowo Górne', 'Pasłęk', 'Malbork', 'Nowy Dwór Gd.', 'okolice Elbląga'];

let db = [];
let zakres = 'Wszystko';

/* ---------- storage ---------- */
function load() {
  try { db = JSON.parse(localStorage.getItem(KEY)) || []; }
  catch (e) { db = []; }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch (e) { toast('Nie udało się zapisać, pamięć telefonu pełna'); }
}

/* ---------- helpers ---------- */
const $ = (id) => document.getElementById(id);

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), 2600);
}
function today() { return new Date().toISOString().slice(0, 10); }
function plusDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function liczba(v) {
  const n = String(v || '').replace(/[^0-9]/g, '');
  return n ? parseInt(n, 10) : 0;
}
function zl(n) {
  if (!n) return '';
  return n.toLocaleString('pl-PL') + ' zł';
}
function tylkoCyfry(t) { return String(t || '').replace(/[^0-9+]/g, ''); }
function klucz(t) {
  /* numer do porównań: same cyfry, bez kierunkowego 48 */
  let c = String(t || '').replace(/[^0-9]/g, '');
  if (c.length > 9 && c.indexOf('48') === 0) c = c.slice(2);
  return c.slice(-9);
}
function formatTel(t) {
  const c = klucz(t);
  if (c.length !== 9) return String(t || '').trim();
  return c.slice(0, 3) + ' ' + c.slice(3, 6) + ' ' + c.slice(6);
}
function dataPL(s) {
  if (!s) return '';
  const cz = s.split('-');
  return cz[2] + '.' + cz[1] + '.' + cz[0];
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/* ---------- ekrany ---------- */
function show(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $('screen-' + name).classList.add('active');
  $('back-btn').style.display = name === 'list' ? 'none' : 'block';
  $('fab').style.display = name === 'list' ? 'block' : 'none';
  $('header-subtitle').textContent = {
    list: 'Poszukujący', form: 'Kontakt', export: 'Eksport', backup: 'Kopia', sync: 'Synchronizacja'
  }[name] || 'Poszukujący';
  window.scrollTo(0, 0);
}

/* ---------- chipsy wyboru ---------- */
function buildChips(boxId, values, multi) {
  const box = $(boxId);
  box.innerHTML = '';
  values.forEach(v => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = v;
    b.dataset.value = v;
    b.onclick = () => {
      if (multi) {
        b.classList.toggle('on');
      } else {
        const was = b.classList.contains('on');
        box.querySelectorAll('.chip').forEach(c => c.classList.remove('on'));
        if (!was) b.classList.add('on');
      }
      if (boxId === 'chips-zakres') {
        zakres = b.classList.contains('on') ? b.dataset.value : 'Wszystko';
        refreshExport();
      }
    };
    box.appendChild(b);
  });
}
function chipsGet(boxId) {
  return [].slice.call($(boxId).querySelectorAll('.chip.on')).map(c => c.dataset.value);
}
function chipsSet(boxId, values) {
  const arr = Array.isArray(values) ? values : (values ? [values] : []);
  $(boxId).querySelectorAll('.chip').forEach(c => c.classList.toggle('on', arr.indexOf(c.dataset.value) >= 0));
}

/* chipsy, które wpisują wartość do pola tekstowego */
function buildValueChips(boxId, pairs, inputId) {
  const box = $(boxId);
  box.innerHTML = '';
  pairs.forEach(p => {
    const label = Array.isArray(p) ? p[0] : p;
    const value = Array.isArray(p) ? p[1] : p;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.textContent = label;
    b.dataset.value = value;
    b.onclick = () => {
      const was = b.classList.contains('on');
      box.querySelectorAll('.chip').forEach(c => c.classList.remove('on'));
      if (was) { $(inputId).value = ''; }
      else { b.classList.add('on'); $(inputId).value = value; }
    };
    box.appendChild(b);
  });
}
function syncValueChips(boxId, inputId) {
  const v = $(inputId).value.trim();
  $(boxId).querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c.dataset.value === v));
}

/* podpowiedzi z tego, co już wpisywał */
function historia(pole, bazowe) {
  const licznik = {};
  db.forEach(k => {
    const v = (k[pole] || '').trim();
    if (v) licznik[v] = (licznik[v] || 0) + 1;
  });
  const znane = Object.keys(licznik).sort((a, b) => licznik[b] - licznik[a]);
  const wynik = znane.slice(0, 8);
  (bazowe || []).forEach(v => { if (wynik.length < 8 && wynik.indexOf(v) < 0) wynik.push(v); });
  return wynik;
}

/* ---------- lista ---------- */
function opisSzukania(k) {
  const czesci = [];
  if (k.typ && k.typ.length) czesci.push(k.typ.join(', '));
  if (k.lokalizacja) czesci.push(k.lokalizacja);
  if (k.metraz) czesci.push('od ' + k.metraz + ' m2');
  if (k.pokoje) czesci.push(k.pokoje + ' pok.');
  return czesci.join(' · ');
}

function render() {
  const q = $('search').value.trim().toLowerCase();
  const st = $('filter-status').value;
  const sort = $('filter-sort').value;

  const lista = db.filter(k => {
    if (st && k.status !== st) return false;
    if (!q) return true;
    return JSON.stringify(k).toLowerCase().indexOf(q) >= 0;
  });

  const t = today();
  lista.sort((a, b) => {
    if (sort === 'budget') return liczba(b.budzet) - liczba(a.budzet);
    if (sort === 'name') return (a.imie || '').localeCompare(b.imie || '', 'pl');
    if (sort === 'new') return (b.utworzono || '').localeCompare(a.utworzono || '');
    const ad = a.kiedy && a.kiedy <= t && AKTYWNE.indexOf(a.status) >= 0 ? 0 : 1;
    const bd = b.kiedy && b.kiedy <= t && AKTYWNE.indexOf(b.status) >= 0 ? 0 : 1;
    if (ad !== bd) return ad - bd;
    return (a.kiedy || '9999').localeCompare(b.kiedy || '9999');
  });

  const box = $('list');
  if (!lista.length) {
    box.innerHTML = '<div class="empty">Brak kontaktów.<br>Naciśnij <b>+</b> i dopisz pierwszy, choćby w trakcie rozmowy.</div>';
  } else {
    box.innerHTML = lista.map(k => {
      const due = k.kiedy && k.kiedy <= t && AKTYWNE.indexOf(k.status) >= 0;
      const zamkniety = AKTYWNE.indexOf(k.status) < 0;
      const telefon = tylkoCyfry(k.telefon);
      return '<div class="item ' + (due ? 'due' : '') + ' ' + (zamkniety ? 'done' : '') + '">' +
        '<div class="item-top">' +
          '<div class="item-name">' + esc(k.imie || formatTel(k.telefon) || 'Bez nazwiska') + '</div>' +
          '<div class="item-budget">' + esc(zl(liczba(k.budzet))) + '</div>' +
        '</div>' +
        '<div class="item-line">' + (esc(opisSzukania(k)) || 'brak opisu poszukiwań') + '</div>' +
        '<div class="item-line">' +
          '<span class="badge status">' + esc(k.status) + '</span>' +
          (due ? '<span class="badge due">oddzwonić ' + esc(dataPL(k.kiedy)) + '</span>'
               : (k.kiedy ? '<span class="badge">telefon ' + esc(dataPL(k.kiedy)) + '</span>' : '')) +
          (k.finansowanie ? '<span class="badge">' + esc(k.finansowanie) + '</span>' : '') +
          (k.termin ? '<span class="badge">' + esc(k.termin) + '</span>' : '') +
          (k.dodal ? '<span class="badge">wpisał(a): ' + esc(k.dodal) + '</span>' : '') +
        '</div>' +
        (k.notatka ? '<div class="item-note">' + esc(k.notatka) + '</div>' : '') +
        '<div class="item-actions">' +
          (telefon ? '<a class="call" href="tel:' + esc(telefon) + '">📞 ' + esc(formatTel(k.telefon)) + '</a>' : '') +
          (telefon ? '<a href="sms:' + esc(telefon) + '">💬 SMS</a>' : '') +
          '<button onclick="edytuj(\'' + k.id + '\')">✏️ Otwórz</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  const doOddzwonienia = db.filter(k => k.kiedy && k.kiedy <= t && AKTYWNE.indexOf(k.status) >= 0).length;
  const aktywni = db.filter(k => AKTYWNE.indexOf(k.status) >= 0).length;
  $('stats').innerHTML =
    '<div class="stat"><b>' + db.length + '</b><span>wszystkich</span></div>' +
    '<div class="stat"><b>' + aktywni + '</b><span>aktywnych</span></div>' +
    '<div class="stat ' + (doOddzwonienia ? 'alert' : '') + '"><b>' + doOddzwonienia + '</b><span>oddzwonić</span></div>';
}

/* ---------- formularz ---------- */
function pusty() {
  return {
    id: 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    utworzono: new Date().toISOString(),
    telefon: '', imie: '', zrodlo: '', powod: '', typ: [], lokalizacja: '',
    budzet: '', metraz: '', pokoje: '', detale: '', finansowanie: '', termin: '',
    sprzedaje: false, notatka: '', kiedy: '', status: 'Nowy', zgoda: false
  };
}

function otworz(k) {
  $('f-id').value = k.id;
  $('f-telefon').value = k.telefon || '';
  $('f-imie').value = k.imie || '';
  $('f-zrodlo').value = k.zrodlo || '';
  $('f-lokalizacja').value = k.lokalizacja || '';
  $('f-budzet').value = k.budzet || '';
  $('f-metraz').value = k.metraz || '';
  $('f-pokoje').value = k.pokoje || '';
  $('f-detale').value = k.detale || '';
  $('f-notatka').value = k.notatka || '';
  $('f-kiedy').value = k.kiedy || '';
  $('f-status').value = k.status || 'Nowy';
  $('f-sprzedaje').checked = !!k.sprzedaje;
  $('f-zgoda').checked = !!k.zgoda;

  buildValueChips('chips-zrodlo', historia('zrodlo', []), 'f-zrodlo');
  buildValueChips('chips-lokalizacja', historia('lokalizacja', LOKALIZACJE_BAZOWE), 'f-lokalizacja');

  chipsSet('chips-powod', k.powod);
  chipsSet('chips-typ', k.typ);
  chipsSet('chips-finansowanie', k.finansowanie);
  chipsSet('chips-termin', k.termin);
  syncValueChips('chips-zrodlo', 'f-zrodlo');
  syncValueChips('chips-lokalizacja', 'f-lokalizacja');
  syncValueChips('chips-budzet', 'f-budzet');

  $('dup-box').innerHTML = '';
  $('btn-delete').style.display = db.some(x => x.id === k.id) ? 'block' : 'none';
  show('form');
}

window.edytuj = function (id) {
  const k = db.filter(x => x.id === id)[0];
  if (k) otworz(k);
};

/* czy ten numer już u nas dzwonił */
function sprawdzDuplikat() {
  const box = $('dup-box');
  const c = klucz($('f-telefon').value);
  const id = $('f-id').value;
  box.innerHTML = '';
  if (c.length < 9) return;
  const stary = db.filter(k => klucz(k.telefon) === c && k.id !== id)[0];
  if (!stary) return;
  box.innerHTML =
    '<div class="dup">' +
      '<b>Ten numer już jest w bazie.</b><br>' +
      esc(stary.imie || 'bez nazwiska') + ', ' + esc(opisSzukania(stary) || 'brak opisu') +
      ', wpis z ' + esc(dataPL((stary.utworzono || '').slice(0, 10))) +
      '<button type="button" class="dup-btn" onclick="edytuj(\'' + stary.id + '\')">Otwórz starą kartę zamiast nowej</button>' +
    '</div>';
}

function zbierz() {
  const id = $('f-id').value;
  const stary = db.filter(x => x.id === id)[0];
  const baza = stary ? Object.assign({}, stary) : pusty();
  if (!stary && !baza.dodal && window.Sync && Sync.zalogowany()) baza.dodal = Sync.imie();
  return Object.assign(baza, {
    id: id,
    telefon: formatTel($('f-telefon').value),
    imie: $('f-imie').value.trim(),
    zrodlo: $('f-zrodlo').value.trim(),
    powod: chipsGet('chips-powod')[0] || '',
    typ: chipsGet('chips-typ'),
    lokalizacja: $('f-lokalizacja').value.trim(),
    budzet: $('f-budzet').value.trim(),
    metraz: $('f-metraz').value.trim(),
    pokoje: $('f-pokoje').value.trim(),
    detale: $('f-detale').value.trim(),
    finansowanie: chipsGet('chips-finansowanie')[0] || '',
    termin: chipsGet('chips-termin')[0] || '',
    sprzedaje: $('f-sprzedaje').checked,
    notatka: $('f-notatka').value.trim(),
    kiedy: $('f-kiedy').value,
    status: $('f-status').value,
    zgoda: $('f-zgoda').checked,
    zmieniono: new Date().toISOString()
  });
}

/* ---------- eksport ---------- */
function doEksportu() {
  const t = today();
  if (zakres === 'Tylko aktywni') return db.filter(k => AKTYWNE.indexOf(k.status) >= 0);
  if (zakres === 'Tylko do oddzwonienia') return db.filter(k => k.kiedy && k.kiedy <= t && AKTYWNE.indexOf(k.status) >= 0);
  return db;
}

const KOLUMNY = [
  ['Data wpisu', k => (k.utworzono || '').slice(0, 10)],
  ['Imie i nazwisko', k => k.imie],
  ['Telefon', k => k.telefon],
  ['Dzwonil w sprawie', k => k.zrodlo],
  ['Powod kontaktu', k => k.powod],
  ['Szuka', k => (k.typ || []).join(' / ')],
  ['Lokalizacja', k => k.lokalizacja],
  ['Budzet do', k => liczba(k.budzet) || ''],
  ['Metraz od', k => k.metraz],
  ['Pokoje', k => k.pokoje],
  ['Uwagi do nieruchomosci', k => k.detale],
  ['Finansowanie', k => k.finansowanie],
  ['Termin', k => k.termin],
  ['Musi sprzedac swoje', k => k.sprzedaje ? 'TAK' : ''],
  ['Notatka', k => k.notatka],
  ['Oddzwonic', k => k.kiedy],
  ['Status', k => k.status],
  ['Zgoda na kontakt', k => k.zgoda ? 'TAK' : '']
];

function csv() {
  const sep = ';';
  const pole = (v) => {
    const s = String(v == null ? '' : v);
    return /["\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const head = KOLUMNY.map(c => pole(c[0])).join(sep);
  const rows = doEksportu().map(k => KOLUMNY.map(c => pole(c[1](k))).join(sep));
  return '﻿' + [head].concat(rows).join('\r\n');
}

function tekst() {
  return doEksportu().map(k => {
    const l = [];
    l.push((k.imie || 'Bez nazwiska') + (k.telefon ? ', tel. ' + k.telefon : ''));
    const s = opisSzukania(k);
    if (s) l.push('Szuka: ' + s);
    if (liczba(k.budzet)) l.push('Budżet: ' + zl(liczba(k.budzet)));
    if (k.finansowanie || k.termin) l.push([k.finansowanie, k.termin].filter(Boolean).join(', '));
    if (k.zrodlo || k.powod) l.push('Kontakt z: ' + [k.zrodlo, k.powod].filter(Boolean).join(', '));
    if (k.notatka) l.push('Notatka: ' + k.notatka);
    if (k.kiedy) l.push('Oddzwonić: ' + dataPL(k.kiedy));
    l.push('Status: ' + k.status);
    return l.join('\n');
  }).join('\n\n----------\n\n');
}

function plik(nazwa, tresc, typ) {
  const blob = new Blob([tresc], { type: typ });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nazwa;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
}

function nazwaPliku(ext) {
  return 'poszukujacy-RM-' + today() + '.' + ext;
}

function refreshExport() {
  $('ex-count').textContent = 'Do eksportu: ' + doEksportu().length + ' z ' + db.length + ' kontaktów.';
}

/* ---------- start ---------- */
function init() {
  load();

  buildChips('chips-powod', POWODY, false);
  buildChips('chips-typ', TYPY, true);
  buildChips('chips-finansowanie', FINANSOWANIE, false);
  buildChips('chips-termin', TERMINY, false);
  buildChips('chips-zakres', ZAKRESY, false);
  buildValueChips('chips-budzet', BUDZETY, 'f-budzet');
  buildValueChips('chips-zrodlo', [], 'f-zrodlo');
  buildValueChips('chips-lokalizacja', LOKALIZACJE_BAZOWE, 'f-lokalizacja');

  $('fab').onclick = () => otworz(pusty());
  $('back-btn').onclick = () => { render(); show('list'); };
  $('search').oninput = render;
  $('filter-status').onchange = render;
  $('filter-sort').onchange = render;

  /* numer: wklejanie ze schowka, formatowanie, kontrola duplikatu */
  $('btn-paste').onclick = () => {
    if (!navigator.clipboard || !navigator.clipboard.readText) { toast('Przytrzymaj pole i wybierz Wklej'); return; }
    navigator.clipboard.readText().then(t => {
      const c = klucz(t);
      if (!c) { toast('W schowku nie ma numeru'); return; }
      $('f-telefon').value = formatTel(c);
      sprawdzDuplikat();
      toast('Wklejony numer ' + formatTel(c));
    }).catch(() => toast('Przytrzymaj pole i wybierz Wklej'));
  };
  $('f-telefon').oninput = sprawdzDuplikat;
  $('f-telefon').onblur = () => { $('f-telefon').value = formatTel($('f-telefon').value); };

  ['f-budzet', 'f-lokalizacja', 'f-zrodlo'].forEach(id => {
    const box = 'chips-' + id.slice(2);
    $(id).oninput = () => syncValueChips(box, id);
  });

  $('form').onsubmit = (e) => {
    e.preventDefault();
    const k = zbierz();
    if (!k.telefon && !k.imie) { toast('Wpisz chociaż numer'); return; }
    let i = -1;
    for (let j = 0; j < db.length; j++) { if (db[j].id === k.id) { i = j; break; } }
    if (i >= 0) db[i] = k; else db.unshift(k);
    save();
    if (window.Sync) Sync.zmiana(k.id);
    render();
    show('list');
    toast('Zapisane');
  };

  $('btn-delete').onclick = () => {
    const id = $('f-id').value;
    if (!confirm('Usunąć ten kontakt na stałe?')) return;
    db = db.filter(x => x.id !== id);
    save();
    if (window.Sync) Sync.usun(id);
    render();
    show('list');
    toast('Usunięte');
  };

  document.querySelectorAll('.quick-dates .pill').forEach(p => {
    p.onclick = () => {
      const d = p.dataset.days;
      $('f-kiedy').value = d === '' ? '' : plusDays(parseInt(d, 10));
      document.querySelectorAll('.quick-dates .pill').forEach(x => x.classList.remove('on'));
      if (d !== '') p.classList.add('on');
    };
  });

  $('btn-export').onclick = () => { refreshExport(); show('export'); };
  $('btn-backup').onclick = () => {
    $('bk-info').textContent = 'W pamięci telefonu: ' + db.length + ' kontaktów.';
    show('backup');
  };

  $('ex-download').onclick = () => { plik(nazwaPliku('csv'), csv(), 'text/csv;charset=utf-8'); toast('Plik pobrany'); };
  $('ex-copy').onclick = () => {
    navigator.clipboard.writeText(tekst())
      .then(() => toast('Skopiowane do schowka'))
      .catch(() => toast('Nie udało się skopiować'));
  };
  $('ex-mail').onclick = () => {
    const body = encodeURIComponent(tekst().slice(0, 1800));
    location.href = 'mailto:biuro@rmnieruchomosci.pl?subject=' +
      encodeURIComponent('Poszukujacy z telefonu, ' + dataPL(today())) + '&body=' + body;
  };
  $('ex-share').onclick = () => {
    const f = new File([csv()], nazwaPliku('csv'), { type: 'text/csv' });
    if (navigator.canShare && navigator.canShare({ files: [f] })) {
      navigator.share({ files: [f], title: 'Poszukujacy RM' }).catch(() => {});
    } else {
      plik(nazwaPliku('csv'), csv(), 'text/csv;charset=utf-8');
      toast('Telefon nie obsługuje udostępniania, plik pobrany');
    }
  };

  $('bk-save').onclick = () => {
    plik('kopia-poszukujacy-' + today() + '.json', JSON.stringify(db, null, 2), 'application/json');
    toast('Kopia zapisana');
  };
  $('bk-load').onchange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const dane = JSON.parse(r.result);
        if (!Array.isArray(dane)) throw new Error('zly format');
        const znane = db.map(x => x.id);
        const nowe = dane.filter(x => x && x.id && znane.indexOf(x.id) < 0);
        db = db.concat(nowe);
        save();
        if (window.Sync && nowe.length) Sync.zmiana.apply(null, nowe.map(x => x.id));
        render();
        toast('Dopisano ' + nowe.length + ' kontaktów');
        $('bk-info').textContent = 'W pamięci telefonu: ' + db.length + ' kontaktów.';
      } catch (err) { toast('Nie udało się wczytać pliku'); }
      e.target.value = '';
    };
    r.readAsText(f);
  };
  $('bk-clear').onclick = () => {
    const wBazie = window.Sync && Sync.zalogowany();
    if (!confirm(wBazie
      ? 'Usunąć kontakty z pamięci TEGO telefonu? W bazie biura zostają i wrócą przy następnej synchronizacji.'
      : 'Usunąć WSZYSTKIE kontakty z telefonu? Tego nie da się cofnąć.')) return;
    if (!wBazie && !confirm('Na pewno? Najpierw zrób kopię JSON.')) return;
    db = [];
    save();
    render();
    toast('Wyczyszczone');
  };

  render();
  show('list');

  if ('serviceWorker' in navigator) {
    // nowa wersja przejęła aplikację: przeładuj, ale nie w trakcie wpisywania (wtedy przy następnym otwarciu)
    const byloSterowane = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!byloSterowane) return;
      const pisze = document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
      if (!pisze) { location.reload(); return; }
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') location.reload(); }, { once: true });
    });
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', init);
