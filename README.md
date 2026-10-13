# Fächerübersicht M.Sc. Maschinenwesen (TUM)

Übersicht aller wählbaren Module im Master Maschinenwesen (SPO [20241]). Mit Voraussetzungen, Fokusbereichen, Studien- und Semesterplaner, Stundenplan, Präsenzpflicht-Prüfung und Prüfungsterminen.

## Online nutzen und teilen
**https://davidci3.github.io/Planner_TUM_Mech_Eng_Master/**

Den Link kannst du einfach weitergeben. Jeder plant für sich:
- Plan, Semesterauswahl, Fokusbereiche und Einstellungen liegen nur im Browser der jeweiligen Person (`localStorage`). Es gibt keinen Server und keine Anmeldung. Niemand sieht oder verändert den Plan eines anderen.
- Ein anderes Gerät oder ein anderer Browser startet mit einem leeren Plan. Zum Übertragen oder Sichern: „Mein Plan“ → „Plan exportieren“ bzw. „Plan importieren“.
- Wer die Browserdaten der Seite löscht, löscht auch den Plan. Vorher exportieren!
- Die TUMonline-Daten (Termine und Prüfungen täglich, Studienplan montags) aktualisiert eine GitHub Action automatisch für alle (`.github/workflows/daten.yml`). Manuell startest du sie unter *Actions → Daten aktualisieren → Run workflow*.

**Wer darf den Code ändern?** Nur der Repo-Besitzer und ausdrücklich eingeladene Collaborators. Andere können den Code ansehen, für sich kopieren (Fork) oder Änderungen per Pull Request *vorschlagen*. Übernommen wird davon nichts ohne Zustimmung des Besitzers.

### Einmalige Einrichtung (für den Repo-Besitzer)
1. *Settings → Pages*: Source „Deploy from a branch“, Branch `main`, Ordner `/ (root)`.
2. *Settings → Actions → General → Workflow permissions*: „Read and write permissions“, damit die Action die neuen Daten committen darf.
3. Das Repo muss öffentlich sein. GitHub Pages gibt es für private Repos nur mit einem kostenpflichtigen Plan.

## Lokal öffnen
`index.html` per Doppelklick im Browser öffnen. Der Ordner `data/` und `app.js` müssen daneben liegen. Lokal gibt es zusätzlich die Aktualisieren-Knöpfe (über den Hilfsdienst, siehe unten). Der lokale Plan ist getrennt vom Plan auf der Online-Seite, weil der Browser je Adresse getrennt speichert. Übertragen geht per Export/Import.

### Katalog
- Suche und Filter nach Wahlbereich, Sprache, Turnus und ECTS.
- **Fokusbereiche:** 1× klicken = Hauptfokus, 2× = Nebenfokus, 3× = aus. Die TUM-Beispielprofile markieren empfohlene Module mit ★.
- **Voraussetzungen:** Die Tags „⬑ baut auf N“ und „⇢ Grundlage für N“ zeigen die Abhängigkeiten. In den Details sind die Module verlinkt, ein Klick springt zum Modul. Zusätzliche Filter: „nur ohne Voraussetzungen“ und „nur Grundlage für andere“; Sortierung „Grundlagen zuerst“.
- **„← Zurück“ / „Vor →“:** Ein Klick auf einen Modul-Link (Voraussetzungen, „Grundlage für“, Titel in Plan oder Semester) springt zum Modul. Mit „← Zurück“ siehst du wieder genau die vorige Ansicht: Tab, Suche und Filter, aufgeklappte Module und Scrollposition. Die Zurück-Taste von Browser oder Maus und Alt+← funktionieren genauso.
- **„↻ Studienplan aktualisieren“** lädt den öffentlichen TUMonline-Studienplan und alle Modulbeschreibungen neu. Das braucht den Hilfsdienst (siehe unten) und dauert einige Minuten.
  - Danach lädt die Seite neu und zeigt neue, geänderte (z. B. ECTS oder Turnus) und entfernte Module.
  - Für neue Module werden Termine und Prüfungen gleich mitgeholt.
  - Kommen deutlich weniger Module zurück als vorher, bleibt der alte Stand, damit ein unvollständiger Abruf nichts kaputt macht.
- Module per „+ Plan“ einplanen oder mit „✓ bestanden“ als erledigt markieren. Der Status ist geplant, belegt oder bestanden.

### Planer-Assistent
Sieben Schritte:
1. Studienbeginn, Semesteranzahl, aktuelles Semester und CP pro Semester
2. Bestandene und belegte Module, Auflagen
3. Auslandssemester: Semester, ECTS und auf welche Bereiche sie angerechnet werden
4. Fokusbereiche und Sprache
5. Verteilung der 60 CP Mastermodule (Bereiche auf 0 = leer lassen)
6. Forschungspraxis, Thesis und Praktika-Semester
7. Weitere Wünsche (max. Module pro Semester, Voraussetzungen beachten, ausgeschlossene Module)

Danach erzeugt der Assistent einen Plan-Vorschlag. Er beachtet Turnus (WiSe/SoSe), Voraussetzungen (Grundlagen kommen vorher), CP-Ziele und alle Regeln der Studiengangsdokumentation.

### Mein Plan
- Eine Spalte pro Semester. Je Modul: Semester ändern, Status ändern, 🔒 sperren, ↻ Alternative, ⛔ nie vorschlagen, × entfernen.
- „Neu erzeugen“ behält bestandene, belegte und gesperrte Module.
- **Warnungen:**
  - Turnus passt nicht zum Semester
  - Voraussetzung fehlt oder liegt zu spät
  - Semester überladen
  - CP-Regeln verletzt
  - Thesis vor 80 CP
  - APSO-Fortschrittsgrenzen
- Gespeichert wird lokal im Browser. Zum Sichern gibt es Export und Import als JSON.

### Aktuelles Semester (Tab „WiSe 26/27“)
Für das laufende Semester sind alle Lehrveranstaltungen mit Terminen und alle bereits eingetragenen Prüfungstermine aus TUMonline hinterlegt.
- **Katalog:** Module mit Terminen bekommen den Knopf „+ WiSe 26/27“ und das Etikett „📅 WiSe 26/27: VO·UE“. Dazu kommen „Präsenzpflicht“ und, falls schon bekannt, „✎ Prüfung TT.MM.JJJJ“. Die Details zeigen alle Kurse mit Zeiten. Filter: „nur im WiSe 26/27 angeboten“.
- **Mein Plan:** Module im aktuellen Semester zeigen ihren Prüfungstermin.
- **Auswahl:** Enthält die Module aus „Mein Plan“, die in diesem Semester liegen, und alles, was du zusätzlich ausgewählt hast. Über die Suche fügst du Fächer direkt hinzu. Je Kurs gibt es:
  - die Wahl der Übungsgruppe („auto“ nimmt die Gruppe mit den wenigsten Überschneidungen)
  - die Präsenz-Einstufung, per Klick änderbar
  - „besuchen“: abwählen, wenn du nur die Prüfung schreibst
- **Stundenplan:** Wochenansicht mit den echten Terminen, also mit Feiertagen, Block- und Einzelterminen. ● = Präsenzpflicht, gepunktet = ohne Pflicht. Darunter steht die Liste **„Noch nicht bekannte Termine“**:
  - Module ohne Lehrveranstaltungen
  - Kurse ganz ohne Termine
  - Übungsgruppen ohne Termine
  - Kurse mit erst 1–2 Terminen, z. B. nur der Vorbesprechung
  - Module, bei denen bisher nur die Vorlesung eingetragen ist
  - Rot umrandet: Zwei Pflichttermine überschneiden sich. Das steht oben auch als Warnung.
  - Gelb gestrichelt: Ein Pflichttermin überschneidet sich mit einem Termin, dessen Pflicht unklar ist.
- **Prüfungen:** Monatskalender und Liste mit Uhrzeit, Anmeldezeitraum und Prüfer. Module ohne veröffentlichten Termin stehen mit „kein Termin bekannt“ in der Liste. Gewarnt wird bei zwei Prüfungen am selben Tag bzw. bei zeitlicher Überschneidung.
- **Aktualisieren & Änderungen:**
  - „↻ Prüfungstermine aktualisieren“ (unter „Prüfungen“) und „↻ Termine aktualisieren“ (im Stundenplan, nur für deine Module) holen den aktuellen Stand aus TUMonline. Danach siehst du die Änderungen oder „Keine Änderungen“.
  - Alles, was sich seit deinem letzten Stand geändert hat, ist mit ✦ markiert und oben zusammengefasst. Das gilt auch für Änderungen, die die Automatik im Hintergrund geholt hat. Neu sind etwa neue oder verschobene Prüfungen sowie neue oder geänderte Termine.
  - „Als gesehen markieren“ setzt den Stand zurück.
- **Hinzufügen:** Fächer kommen über die Suche im Tab „WiSe 26/27“ oder im Katalog über „+ WiSe 26/27“ in die Semesterplanung. Mehr als die üblichen 30 CP sind hier in Ordnung: Man meldet sich zu mehr an und entscheidet in den ersten Wochen.

**Präsenzpflicht** führt TUMonline nicht als eigenes Feld. Sie wird so abgeleitet:
1. Beschreibungstext des Kurses („Anwesenheitspflicht“, „Teilnahme ist verpflichtend“, „attendance is mandatory“ …). Bezieht sich der Text nur auf den ersten Termin oder die Vorbesprechung, wird nur dieser Termin als Pflicht gewertet.
2. Sonst der Kurstyp:
   - Praktikum, Seminar, Workshop, Exkursion, Projekt: Pflicht
   - Vorlesung: keine Pflicht
   - Übung und Tutorium: unklar

Die Einstufung kannst du je Kurs selbst ändern.

## Daten
- Module, ECTS und Bereiche stammen aus dem öffentlichen TUMonline-Studienplan (`pStpStpNr=5343`, Studienjahr 2026/27).
- Kurse, Termine und Prüfungstermine (`data/semester.js`) stammen aus den öffentlichen TUMonline-Schnittstellen. Dazu gehören die Moduldetails (`courseGroupings`), die Kursgruppen (`firstGroups`/`remainingGroups`) und die öffentliche Prüfungsterminliste (`slc.xm.exd/exExamOffer`). Aktualisiert werden sie automatisch über den Hilfsdienst (siehe unten).
- Details (Turnus, Sprache, Inhalt, Voraussetzungstext) stammen aus den öffentlichen TUMonline-Modulbeschreibungen.
- Die Regeln und die 8 Forschungsbereiche stammen aus der Studiengangsdokumentation M.Sc. MW (Stand 23.10.2025).
- **Voraussetzungen** werden automatisch erkannt: Modultitel und Kennungen im Voraussetzungstext. Sie sind meist nur *empfohlen*. Bachelor-Fächer wie „Fluidmechanik I“ stehen nur im Text, weil sie nicht im Katalog sind.
- Die **Fokus-Zuordnung** ist eine Heuristik über Lehrstuhl und Titel, keine offizielle TUM-Einteilung.

Verbindlich sind immer TUMonline und die FPSO.

## Daten aktualisieren
Voraussetzung ist Node.js 18 oder neuer:
```
node tools/crawl.mjs raw-tree.json
node tools/details.mjs raw-tree.json raw-details.json
node tools/build.mjs raw-tree.json raw-details.json data
```
Für ein neues Studienjahr in `tools/crawl.mjs` und `tools/details.mjs` den Wert `SJ`/`study-year` (aktuell 1623) anpassen.

### Termine und Prüfungen des Semesters: automatisch
Die App selbst darf TUMonline nicht abfragen, weil TUMonline keine Abfragen von fremden Seiten zulässt (CORS). Das übernimmt der kleine Hilfsdienst `tools/server.mjs`. Er lauscht nur auf `127.0.0.1:8765` und schreibt nur `data/semester.js`.
- **Einrichten:** Doppelklick auf `tools/autostart-einrichten.bat`. Der Dienst startet dann sofort und bei jeder Windows-Anmeldung unsichtbar (Verknüpfung im Autostart-Ordner, keine Adminrechte nötig). **Entfernen:** `tools/autostart-entfernen.bat`.
- **Automatik:** Beim Start (wenn der letzte Gesamtlauf älter als 20 h ist) und danach alle 24 h holt er zuerst alle Prüfungstermine (wenige Sekunden) und dann alle Lehrveranstaltungen mit Terminen (ca. 5 Minuten). Beim nächsten Öffnen von `index.html` ist der neue Stand da.
- **Knöpfe in der App:** „↻ Studienplan aktualisieren“ (Katalog), „↻ Prüfungstermine aktualisieren“ und „↻ Termine aktualisieren“ (Tab WiSe 26/27) fragen über den Dienst sofort neu ab. Läuft der Dienst nicht, sagt die App, wie man ihn startet.
- Das Protokoll steht in `server.log`.

Von Hand geht es auch:
```
node tools/semester.mjs                               # alles (ca. 5 Minuten)
node tools/semester.mjs auto data --nur-pruefungen   # nur Prüfungstermine (wenige Sekunden)
node tools/server.mjs                               # Hilfsdienst im Vordergrund starten
```
Ohne Angabe (bzw. mit `auto`) nimmt das Skript das laufende Semester, ab 6 Wochen vor Vorlesungsbeginn schon das nächste. Feste IDs gehen auch: `207` steht für das WiSe 2026/27, `208` für das SoSe 2027. Die IDs liefert `https://campus.tum.de/tumonline/ee/rest/slc.lib.tm/semesters/student`. Mit `--cache datei.json` lässt sich ein abgebrochener Gesamtlauf fortsetzen. Ohne diese Option wird immer frisch abgefragt.

Beim **Semesterwechsel** schalten Hilfsdienst und GitHub Action von selbst um. Auch das Studienjahr für den Studienplan wird automatisch bestimmt, oder per Umgebungsvariable `SJ`. Den Studienplan lädst du von Hand mit `node tools/katalog.mjs`.
