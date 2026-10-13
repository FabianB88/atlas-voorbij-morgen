# Atlas · Voorbij morgen

Een nieuwe Nederlandse wereldadventure over Duurzame Waarde. De speler is Jules: eerst begrijpen wat klimaatverandering is, daarna dezelfde kust in twee mogelijke versies van 2060 bezoeken, over de wereld vliegen en duurzame waarde onderzoeken.

De opbouw gebruikt acht verhaalopdrachten, meerdere loopgebieden, twee toekomstbeelden, drie NPC's en afwisselende modellen, diagnoses, ontwerpkeuzes en toepassingen. Alle basisuitleg en hints zijn vrij beschikbaar. XP geeft onderzoeksvoortgang en nuttige routehulpen, geen oordeel over de moraliteit van keuzes.

Publicatie: uitsluitend FabianB88 GitHub Pages. De bron blijft gescheiden van Business Ethics en gebruikt een eigen opslagkey `atlas-duurzame-waarde-v1`.

## Inhoud en herkomst

- `sources/core-audit.json`: selectie van 36 essentiële begrippen, 2 ondersteunende begrippen en 2 naslagonderwerpen; 23 inhoudelijke correcties en 34 primaire bronnen.
- `sources/course-reading.json`: opgeschoonde lezing van de 303 blokken in acht bronlessen plus synthese/toets/reflectie.
- `sources/provenance.json`: originele export, vastgelegde commit en studentenhandleiding.
- `dist/plan.html`: leesbaar docentendossier met inhoudsdekking, activiteiten, broncorrecties en onderzoek.
- `dist/learning-design.json`: gerichte wetenschappelijke ontwerpgrondslag en de grenzen van de claims.
- `sources/*-art.json`: herkomst van gegenereerde achtergronden en personages.

De essentiële leerstof is opnieuw geordend. Incidentele namen van aardlagen zijn naslag; ze blokkeren geen voortgang. De regio's en personages zijn fictief. De wereldkaart gebruikt Natural Earth continentvormen. De twee 2060-beelden zijn verbeeldingen, geen lokale prognose. Onderwijsmodellen beschrijven hun vereenvoudigingen bij de bediening. In het weerarchief staat echte NASA GISTEMP-data naast één fictieve lokale weersdag.

## Lokaal

Node.js 20 of nieuwer, zonder installatie van pakketten:

```text
node scripts/build-content.mjs
node scripts/test-game.mjs
node scripts/test-activities.mjs
node scripts/serve.mjs
```

Open vervolgens `http://127.0.0.1:8193/`. De build gebruikt de opgeschoonde, meegeleverde bronlezing als de lokale ruwe export ontbreekt. De ruwe export met leveranciersmetadata wordt niet gepubliceerd.

## Bewaren en docentenpreview

Voortgang en notities blijven lokaal. De speler kan zijn veldboek downloaden en importeren. De code `fabian1` opent een aparte preview waarin episodes, werkvormen en toekomstbeelden direct beschikbaar zijn. Preview wijzigt de gewone opgeslagen reis niet. Deze code is een navigatiehulp, geen beveiligingsmechanisme.

## Kwaliteitsgrenzen

Tests controleren voortgang, modelcriteria, meerdere geldige oplossingen, brondekking, bereikbaarheid en opslag. Browsercontroles omvatten de opening, beweging, toekomstovergangen, vliegen, preview en mobiel. Deze controles bewijzen geen vergelijkende leerwinst. Eigen aantekeningen worden nooit automatisch als inhoudelijk juist beoordeeld.
