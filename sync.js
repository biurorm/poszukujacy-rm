/* Poszukujący, synchronizacja z bazą biura (Supabase, to samo konto co Zadania RM)
   Zasada: telefon zapisuje najpierw u siebie (działa bez zasięgu), a w tle:
   1) wysyła do bazy to, co zmienione lub usunięte (kolejka w localStorage),
   2) pobiera z bazy to, co zmienili inni (telefon, komputer, asystentka).
   Przy sporze wygrywa nowsza zmiana. Korzysta z db, save(), render(), show() z app.js. */

const Sync = (function () {
  const OUT = 'rm-poszukujacy-kolejka';     // { id: zmieniono } czeka na wysłanie
  const DEL = 'rm-poszukujacy-usuniete';    // { id: kiedy } usunięte, czeka na wysłanie
  const LAST = 'rm-poszukujacy-ostatnia-sync';
  const cfg = window.RM_CONFIG || {};
  let sb = null, user = null, imie = '', trwa = false, ponow = false, blad = '', czas = null;

  const get = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
  const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* pełna pamięć */ } };
  const znacznik = (k) => (k && (k.zmieniono || k.utworzono)) || '';
  const nowszy = (a, b) => new Date(a || 0).getTime() > new Date(b || 0).getTime();

  function czeka() { return Object.keys(get(OUT, {})).length + Object.keys(get(DEL, {})).length; }

  /* ---------- zgłoszenia z app.js ---------- */
  function zmiana() {
    const o = get(OUT, {});
    [].slice.call(arguments).forEach(id => {
      const k = db.filter(x => x.id === id)[0];
      if (k) o[id] = znacznik(k);
    });
    set(OUT, o);
    pokazStan();
    synchronizuj();
  }
  function usun(id) {
    const d = get(DEL, {});
    d[id] = new Date().toISOString();
    set(DEL, d);
    const o = get(OUT, {}); delete o[id]; set(OUT, o);
    pokazStan();
    synchronizuj();
  }

  /* ---------- właściwa synchronizacja ---------- */
  async function synchronizuj() {
    if (!sb || !user || !navigator.onLine) { pokazStan(); return; }
    if (trwa) { ponow = true; return; }
    trwa = true; blad = '';
    pokazStan();
    try {
      // 1. usunięte
      const del = get(DEL, {});
      const delIds = Object.keys(del);
      if (delIds.length) {
        const { error } = await sb.from('poszukujacy').upsert(
          delIds.map(id => ({ id: id, dane: {}, usuniety: true, zmieniono: del[id] })), { onConflict: 'id' });
        if (error) throw error;
        const teraz = get(DEL, {});
        delIds.forEach(id => { if (teraz[id] === del[id]) delete teraz[id]; });
        set(DEL, teraz);
      }
      // 2. zmienione i nowe
      const out = get(OUT, {});
      const outIds = Object.keys(out);
      if (outIds.length) {
        const wiersze = outIds.map(id => db.filter(k => k.id === id)[0]).filter(Boolean)
          .map(k => ({ id: k.id, dane: k, usuniety: false, zmieniono: znacznik(k) || new Date().toISOString() }));
        if (wiersze.length) {
          const { error } = await sb.from('poszukujacy').upsert(wiersze, { onConflict: 'id' });
          if (error) throw error;
        }
        const teraz = get(OUT, {});
        outIds.forEach(id => { if (teraz[id] === out[id]) delete teraz[id]; }); // zmienione w trakcie wysyłki zostają w kolejce
        set(OUT, teraz);
      }
      // 3. pobranie zmian innych
      const { data, error } = await sb.from('poszukujacy').select('id,dane,usuniety,zmieniono').limit(5000);
      if (error) throw error;
      const kolejka = get(OUT, {}), usuniete = get(DEL, {});
      const wBazie = {};
      let zmienione = false;
      data.forEach(r => {
        wBazie[r.id] = true;
        if (kolejka[r.id] || usuniete[r.id]) return; // moja nowsza zmiana jeszcze leci
        const lok = db.filter(k => k.id === r.id)[0];
        if (r.usuniety) {
          if (lok) { db = db.filter(k => k.id !== r.id); zmienione = true; }
          return;
        }
        if (!lok || nowszy(r.zmieniono, znacznik(lok))) {
          const nowy = Object.assign({}, r.dane, { zmieniono: r.zmieniono });
          if (lok) db[db.indexOf(lok)] = nowy; else db.unshift(nowy);
          zmienione = true;
        }
      });
      // kontakty z telefonu, których baza jeszcze nie zna (np. zapisane przed pierwszym logowaniem)
      const brak = db.filter(k => !wBazie[k.id] && !kolejka[k.id]);
      if (brak.length) {
        const o = get(OUT, {});
        brak.forEach(k => { o[k.id] = znacznik(k); });
        set(OUT, o);
        ponow = true;
      }
      if (zmienione) { save(); render(); }
      set(LAST, new Date().toISOString());
    } catch (e) {
      blad = (e && e.message) || String(e);
    }
    trwa = false;
    pokazStan();
    if (ponow) { ponow = false; setTimeout(synchronizuj, 300); }
  }

  /* ---------- stan w nagłówku i na ekranie synchronizacji ---------- */
  function pokazStan() {
    const btn = document.getElementById('sync-btn');
    if (!btn) return;
    if (!sb) { btn.style.display = 'none'; return; }
    btn.style.display = '';
    const n = czeka();
    let t;
    if (!user) t = '☁ Zaloguj';
    else if (!navigator.onLine) t = '📴' + (n ? ' ' + n : '');
    else if (blad) t = '⚠️';
    else if (trwa || n) t = '⏳' + (n ? ' ' + n : '');
    else t = '☁ ✓';
    btn.textContent = t;
    rysujEkran();
  }
  function rysujEkran() {
    const el = document.getElementById('sync-info');
    if (!el) return;
    const n = czeka();
    const ost = get(LAST, null);
    const kiedy = ost ? new Date(ost).toLocaleString('pl-PL', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : 'jeszcze nigdy';
    document.getElementById('sync-login').style.display = user ? 'none' : '';
    document.getElementById('sync-konto').style.display = user ? '' : 'none';
    el.innerHTML = !user
      ? 'Nie jesteś zalogowany. Kontakty zapisują się tylko w tym telefonie. Zaloguj się tym samym kontem co w Zadaniach RM, a trafią do bazy biura i będą widoczne na komputerze i u asystentki.'
      : '<b>' + (imie || user.email) + '</b><br>' +
        (!navigator.onLine ? 'Brak zasięgu. Zapisujesz normalnie, wyślę po powrocie sieci.<br>' : '') +
        (blad ? '<span style="color:#dc2626">Błąd: ' + blad.replace(/</g, '&lt;') + '</span><br>' : '') +
        (n ? 'Czeka na wysłanie: <b>' + n + '</b><br>' : 'Wszystko wysłane.<br>') +
        'Ostatnia synchronizacja: ' + kiedy;
  }

  async function zaloguj(email, haslo) {
    const { data, error } = await sb.auth.signInWithPassword({ email: email, password: haslo });
    if (error) throw error;
    user = data.user;
    await poZalogowaniu();
  }
  async function wyloguj() {
    await sb.auth.signOut();
    user = null; imie = '';
    pokazStan();
  }
  async function poZalogowaniu() {
    try {
      const { data } = await sb.from('profile').select('imie').eq('id', user.id).single();
      imie = (data && data.imie) || '';
    } catch (e) { /* bez imienia też działa */ }
    if (!czas) {
      let t = null;
      czas = sb.channel('rm-poszukujacy')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'poszukujacy' }, () => { clearTimeout(t); t = setTimeout(synchronizuj, 400); })
        .subscribe();
    }
    synchronizuj();
  }

  async function init() {
    if (!cfg.supabaseUrl || !cfg.supabaseKey || !window.supabase) return;
    sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, { auth: { persistSession: true, autoRefreshToken: true } });
    const { data } = await sb.auth.getSession();
    user = data.session ? data.session.user : null;
    sb.auth.onAuthStateChange((ev, s) => { user = s ? s.user : null; pokazStan(); });
    window.addEventListener('online', synchronizuj);
    window.addEventListener('offline', pokazStan);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) synchronizuj(); });
    setInterval(synchronizuj, 60000);

    document.getElementById('sync-btn').onclick = () => { rysujEkran(); show('sync'); };
    document.getElementById('sync-form').onsubmit = async (e) => {
      e.preventDefault();
      const m = document.getElementById('sync-msg');
      m.textContent = 'Loguję…';
      try {
        await zaloguj(document.getElementById('sync-email').value.trim(), document.getElementById('sync-haslo').value);
        m.textContent = '';
        toast('Zalogowano, wysyłam kontakty do bazy');
      } catch (err) { m.textContent = /invalid/i.test(err.message) ? 'Zły e-mail albo hasło.' : 'Nie udało się: ' + err.message; }
    };
    document.getElementById('sync-teraz').onclick = () => { synchronizuj(); toast('Synchronizuję'); };
    document.getElementById('sync-wyloguj').onclick = async () => {
      if (czeka() && !confirm('Są niewysłane zmiany (' + czeka() + '). Po wylogowaniu zostaną w telefonie i wyślą się po ponownym zalogowaniu. Wylogować?')) return;
      await wyloguj();
      toast('Wylogowano');
    };
    pokazStan();
    if (user) poZalogowaniu();
  }

  return {
    init: init, zmiana: zmiana, usun: usun, synchronizuj: synchronizuj,
    imie: () => (user ? (imie || user.email) : ''),
    zalogowany: () => !!user
  };
})();

window.Sync = Sync; // app.js sprawdza window.Sync
document.addEventListener('DOMContentLoaded', () => { Sync.init(); });
