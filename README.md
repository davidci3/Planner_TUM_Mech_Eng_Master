# Fächerübersicht M.Sc. Maschinenwesen (TUM)

Übersicht aller wählbaren Module im Master Maschinenwesen (SPO [20241]). Mit Voraussetzungen, Fokusbereichen, Studien- und Semesterplaner, Stundenplan, Präsenzpflicht-Prüfung und Prüfungsterminen.

## Online nutzen und teilen
**https://davidci3.github.io/Planner_TUM_Mech_Eng_Master/**

Den Link kannst du einfach weitergeben. Jeder plant für sich:
- Plan, Semesterauswahl, Fokusbereiche und Einstellungen liegen nur im Browser der jeweiligen Person (`localStorage`). Es gibt keinen Server und keine Anmeldung. Niemand sieht oder verändert den Plan eines anderen.
- Ohne Plan-Datei startet ein anderes Gerät oder ein anderer Browser mit einem leeren Plan, und wer die Browserdaten löscht, löscht auch den Plan. Deshalb: **Plan-Datei verwenden** (siehe unten).
- Die TUMonline-Daten (Termine und Prüfungen täglich, Studienplan und Prüfungsstatistiken montags) aktualisiert eine GitHub Action automatisch für alle (`.github/workflows/daten.yml`). Manuell startest du sie unter *Actions → Daten aktualisieren → Run workflow*.

### Plan sichern: Plan-Datei (Chrome und Edge)
Wie ein Word-Dokument, nur ohne Speichern-Drücken: Die App wird mit einer Datei verbunden und schreibt jede Änderung automatisch hinein.
1. Oben links neben den Tabs auf **„📄 Keine Plan-Datei“ → „Neue Plan-Datei…“** klicken und z. B. `OneDriveStudiumMasterplan.json` wählen.
2. Ab jetzt zeigt der Knopf „💾 Masterplan.json · gespeichert 16:42“. Jede Änderung landet nach einer halben Sekunde in der Datei.
3. Beim nächsten Öffnen fragt der Browser einmal per Klick („Masterplan.json laden“) nach Erlaubnis und lädt dann den Stand aus der Datei. Wählt man im Erlaubnis-Dialog „Bei jedem Besuch zulassen“, entfällt auch dieser Klick.
4. In einem anderen Browser, auf einem anderen PC oder in der lokalen `index.html`: einmal **„Plan-Datei öffnen…“** und dieselbe Datei wählen.

Gut zu wissen:
- Die Datei ist der maßgebliche Stand. Browserdaten löschen schadet nicht mehr. Liegt sie in OneDrive, gibt es zusätzlich Versionsverlauf und Papierkorb.
- Haben Datei und Browser unterschiedliche Stände (z. B. vor dem Laden schon etwas geändert, oder Datei gleichzeitig auf einem anderen PC geändert), fragt die App, welcher Stand bleiben soll. Es wird nie still überschrieben.
- Wird die Datei verschoben oder gelöscht, meldet die App das rot. Der Stand im Browser bleibt erhalten.
- In Chrome und Edge speichert auch **Strg+S** sofort.

### Firefox, Safari und andere Browser: Speichern-Knopf
Diese Browser erlauben Webseiten nicht, eine Datei auf dem PC zu überschreiben. Deshalb wird dort von Hand gespeichert:
- Der Knopf neben den Tabs zeigt „● Plan nicht gespeichert“, sobald es Änderungen gibt. **„Speichern“** im Menü oder **Strg+S** lädt `Masterplan.json` herunter, danach steht dort „💾 Masterplan.json · gespeichert“.
- **„Plan-Datei öffnen…“** lädt den Stand wieder, z. B. in einem anderen Browser oder auf einem anderen PC. Gibt es noch Ungespeichertes, fragt die App vorher.
- Wer schon einmal gespeichert oder geöffnet hat, wird beim Schließen oder Neuladen mit ungespeicherten Änderungen vom Browser gefragt, ob er die Seite wirklich verlassen will. Automatisch beim Schließen herunterladen geht nicht, weil Browser Downloads beim Schließen einer Seite blockieren.
- Tipp für Firefox: *Einstellungen → Allgemein → Dateien und Anwendungen → „Jedes Mal nachfragen, wo Dateien gespeichert werden sollen“*. Dann überschreibst du beim Speichern immer dieselbe Datei (z. B. in OneDrive), statt dass im Download-Ordner `Masterplan(1).json` entsteht.

**Wer darf den Code ändern?** Nur der Repo-Besitzer und ausdrücklich eingeladene Collaborators. Andere können den Code ansehen, für sich kopieren (Fork) oder Änderungen per Pull Request *vorschlagen*. Übernommen wird davon nichts ohne Zustimmung des Besitzers.

### Am Handy: Plan-Datei in Google Drive
- **„Speichern“** öffnet am Handy das Teilen-Menü statt eines Downloads. Dort wählst du **„In Drive speichern“** (Android) bzw. **„In Dateien sichern“ → Google Drive** (iPhone).
- **„Plan-Datei öffnen…“** lädt die Datei wieder, z. B. direkt aus Google Drive. Nimm dabei die neueste Datei.
- Drive legt beim Speichern vom Handy meist eine **neue** Datei an, auch bei gleichem Namen. Damit der Laptop die Handy-Änderungen bekommt, dort einmal **„Plan-Datei öffnen…“** und die neueste Datei aus dem Drive-Ordner wählen. Ab dann speichert der Laptop wie gewohnt automatisch in diese Datei.

### Einmalige Einrichtung (für den Repo-Besitzer)
1. *Settings → Pages*: Source „Deploy from a branch“, Branch `main`, Ordner `/ (root)`.
2. *Settings → Actions → General → Workflow permissions*: „Read and write permissions“, damit die Action die neuen Daten committen darf.
3. Das Repo muss öffentlich sein. GitHub Pages gibt es für private Repos nur mit einem kostenpflichtigen Plan.

## Lokal öffnen
`index.html` per Doppelklick im Browser öffnen. Der Ordner `data/` und `app.js` müssen daneben liegen. Lokal gibt es zusätzlich die Aktualisieren-Knöpfe (über den Hilfsdienst, siehe unten). Ohne Plan-Datei ist der lokale Plan getrennt vom Plan auf der Online-Seite, weil der Browser je Adresse getrennt speichert. Mit derselben Plan-Datei nutzen beide denselben Stand.

### Katalog
- Suche und Filter nach Wahlbereich, Sprache, Turnus und ECTS.
- **Fokusbereiche:** 1× klicken = Hauptfokus, 2× = Nebenfokus, 3× = aus. Die TUM-Beispielprofile markieren empfohlene Module mit ★.
- **Voraussetzungen:** Die Tags „⬑ baut auf N“ und „⇢ Grundlage für N“ zeigen die Abhängigkeiten. In den Details sind die Module verlinkt, ein Klick springt zum Modul. Zusätzliche Filter: „nur ohne Voraussetzungen“ und „nur Grundlage für andere“; Sortierung „Grundlagen zuerst“.
- **„← Zurück“ / „Vor →“:** Ein Klick auf einen Modul-Link (Voraussetzungen, „Grundlage für“, Titel in Plan oder Semester) springt zum Modul. Mit „← Zurück“ siehst du wieder genau die vorige Ansicht: Tab, Suche und Filter, aufgeklappte Module und Scrollposition. Die Zurück-Taste von Browser oder Maus und Alt+← funktionieren genauso.
- **„↻ Studienplan aktualisieren“** lädt den öffentlichen TUMonline-Studienplan und alle Modulbeschreibungen neu. Das braucht den Hilfsdienst (siehe unten) und dauert einige Minuten.
  - Danach lädt die Seite neu und zeigt neue, geänderte (z. B. ECTS oder Turnus) und entfernte Module.
  - Für neue Module werden Termine und Prüfungen gleich mitgeholt.
  - Kommen deutlich weniger Module zurück als vorher, bleibt der alte Stand, damit ein unvollständiger Abruf nichts kaputt macht.
- **Prüfungsstatistik:** Für gut 100 Module gibt es Notenverteilungen von [examstats.de](https://examstats.de). Das Etikett „📊 Ø 2,76 · 15 % durchgefallen“ zeigt Notenschnitt und Durchfallquote (über alle vorhandenen Semester). Die Details zeigen je Semester die Verteilung 1,0–5,0, den Schnitt der Bestandenen sowie Angemeldete, Angetretene und Nicht-Erschienene. Filter „nur mit Prüfungsstatistik“, Sortierung nach dem besten Notenschnitt der Bestandenen oder dem besten Notenschnitt gesamt. Die Zahlen sind von Studierenden eingesendet; bei wenigen Teilnehmenden sind sie wenig aussagekräftig.
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
- **↶ Rückgängig / ↷ Wiederholen** (auch Strg+Z / Strg+Y): Macht die letzten Änderungen am Plan rückgängig, z. B. ein versehentlich entferntes Modul, ein geändertes Semester oder „Neu erzeugen“. Gilt für Änderungen aus allen Tabs. Beim Drüberfahren steht, was zurückgenommen wird. Der Verlauf hält bis zu 100 Schritte, bis die Seite neu geladen wird.
- **Auslandssemester:** In der Karte des Auslandssemesters gibt es je einen Schieberegler für Flexibilisierung, International Experience und Überfachliche Ergänzung. Auf „auto“ stellt sich jeder Regler auf die CP, die im Bereich nach den übrigen Semestern noch fehlen. Beispiel: 5 CP Flexi schon geplant, dann stehen 10 CP im Ausland, bis max. 15 erreicht sind. Mehr als die geplanten Auslands-ECTS werden nicht verteilt. Ziehst du einen Regler von Hand, bleibt dein Wert, bis du auf „↺ auto“ klickst. „Neu erzeugen“ plant diese Bereiche dann nicht mehr zu Hause ein.
- **Regeln & Fortschritt:** Unter jedem Bereich lässt sich „N Module anzeigen“ aufklappen. Dann siehst du, welche Module aus deinem Plan dort zählen. Je Modul stehen der Turnus (WiSe/SoSe), das geplante Semester, der Status und die ECTS. Mit × nimmst du es aus dem Plan, ein Klick auf den Titel öffnet es im Katalog. Angerechnete Auslands-CP stehen mit dabei.
- **Warnungen:**
  - Turnus passt nicht zum Semester
  - Voraussetzung fehlt oder liegt zu spät
  - Semester überladen
  - CP-Regeln verletzt
  - Thesis vor 80 CP
  - APSO-Fortschrittsgrenzen
- Gespeichert wird im Browser und, wenn verbunden, automatisch in der Plan-Datei. Export und Import als JSON gibt es zusätzlich (auch alte Exporte lassen sich als Plan-Datei öffnen).

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
- Prüfungsstatistiken (`data/examstats.js`) stammen von examstats.de (`node tools/examstats.mjs data`). Zugeordnet wird über die Modulkennung, Varianten wie `ED180034D`/`ED180034E` landen beim Katalogmodul `ED180034`. Die GitHub Action lädt sie montags neu.
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
