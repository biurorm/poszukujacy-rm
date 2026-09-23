# Poszukujący RM, aplikacja na telefon

Zapis kontaktu od razu po rozmowie, bez komputera. Działa offline, dane siedzą tylko w telefonie,
eksport na komputer plikiem CSV (otwiera sie w Excelu).

## Co robi

- **+** dodaje kontakt: telefon, imię, w sprawie jakiej oferty dzwonił, czego szuka, budżet, finansowanie, termin, notatka.
- **Powód kontaktu** jednym kliknięciem: oferta sprzedana, jest przedwstępna, nie mam takiej oferty, z reklamy, polecenie, wizytówka Google.
- **Oddzwonić** z szybkimi przyciskami (jutro, za 3 dni, za tydzień, za miesiąc). Kto dziś czeka na telefon, ten wchodzi na górę listy na czerwono.
- **Licznik na górze**: wszystkich, aktywnych, do oddzwonienia.
- **Szukajka i filtry**: po nazwisku, telefonie, lokalizacji, notatce; po statusie; sortowanie po budżecie.
- **Telefon i SMS** prosto z listy (jedno tapnięcie).
- **Eksport**: udostępnij CSV (mail, WhatsApp, OneDrive), pobierz CSV, skopiuj jako tekst, wyślij mailem do biura.
- **Kopia JSON** do backupu i przenoszenia na nowy telefon.

## Statusy

Nowy, Szukam, Wysłana oferta, Po prezentacji, Kupił, Odpadł.
Aktywne to pierwsze cztery, tylko one liczą się do przypomnień.

## Jak zainstalować na iPhone

1. Wejść na adres aplikacji w Safari.
2. Udostępnij, „Dodaj do ekranu początkowego".
3. Aplikacja chodzi jak zwykła, także bez zasięgu.

## Publikacja (jak przy Inwentaryzacji RM)

1. Osobne repo na GitHub, np. `biurorm/poszukujacy-rm`, Pages z gałęzi `main`.
2. Po każdej zmianie bump cache: `?v=N` w `index.html` oraz `CACHE = 'poszukujacy-rm-vN'` w `sw.js`.
3. Repo trzyma tylko kod. Żadnych danych klientów, one nigdy nie opuszczają telefonu.

## Dane i RODO

- Wszystko leży w `localStorage` telefonu, nic nie idzie na serwer.
- W formularzu jest pole zgody na kontakt z ofertami, w eksporcie osobna kolumna.
- Kopia JSON to plik z danymi osobowymi, trzymać w OneDrive, nie w repo.

## Kolumny w eksporcie CSV

Data wpisu, Imię i nazwisko, Telefon, Dzwonił w sprawie, Powód kontaktu, Szuka, Lokalizacja,
Budżet do, Metraż od, Pokoje, Uwagi do nieruchomości, Finansowanie, Termin, Musi sprzedać swoje,
Notatka, Oddzwonić, Status, Zgoda na kontakt.

Separator średnik, kodowanie UTF-8 z BOM, czyli Excel otwiera od razu poprawnie z polskimi znakami.

## Pliki

- `index.html` ekrany, `style.css` wygląd, `app.js` logika
- `manifest.json` + `sw.js` instalacja i tryb offline
- `logo.png`, `icons/` branding RM
