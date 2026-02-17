# EXHAUSTO - Storyblok CMS & NextPage PIM Implementation

**Project ID:** 806515
**Status:** active
**Description:** Migration fra Ibexa DXP til Storyblok CMS og opsætning af NextPage PIM integration for EXHAUSTO A/S. Projektet inkluderer kloning af eksisterende content, design, arkitektur og integrationer. Frontend udvikles i Next.js med Claude Code, inklusiv custom AI integration til StoryBlok API for content management. Projektperiode: 3. januar - 15. april 2026. Total projektværdi: 784.400 DKK.

---

## Summary

- **Total Tasks:** 158
- **Completed:** 8
- **Active:** 150
- **Tasklists:** 8

---

## General tasks

**Tasklist ID:** 2039115
**Tasks:** 1

- [ ] **Meetings and alignment with 3C** *(ID: 26789979)*

---

## Project Kickoff & Setup

**Tasklist ID:** 2039116
**Description:** Projektopstart, opsætning af værktøjer, afklaring af specifikationer og teknisk setup. Deadline: 10. januar 2026
**Tasks:** 6

- [x] **Kick-off meeting med projektteam** [HIGH] *(ID: 26781919)* | Due: 2026-01-05T00:00:00Z
  > Opstartsmøde med EXHAUSTO's projektteam (Lone Lindberg, Line D. Michelsen) og Fellow. Gennemgang af projektplan, roller og ansvar.
  - [x] **Forbered kick-off præsentation** *(ID: 26781920)*
  - [x] **Opsæt projekt tracking tool (Teamwork) + SharePoint mappe inkl delt mappe** *(ID: 26781921)*
  - [x] **Dokumentér mødereferat og action points** *(ID: 26781922)*
- [ ] **Afklaring af API integration til PIM** [HIGH] *(ID: 26781923)* | Due: 2026-01-10T00:00:00Z
  > Teknisk afklaring af API integration mellem Storyblok og NextPage PIM. Dokumentation af endpoints, dataformater og synkroniseringslogik.
  - [x] **Gennemgang af eksisterende NextPage API dokumentation** *(ID: 26781924)*
  - [ ] **Mapping af datamodeller mellem systemer** *(ID: 26781925)*
  - [ ] **Dokumentér integrations-specifikation** *(ID: 26781926)*
- [ ] **Adgang til Ibexa DXP og eksisterende data** [HIGH] *(ID: 26781927)* | Due: 2026-01-10T00:00:00Z
  > Koordinering med Aldes (tidligere ejer) for at sikre adgang til nuværende CMS, dokumentation, data, content og integrationer.
  - [x] **Kontakt Aldes IT-afdeling** *(ID: 26781928)* | Due: 2026-01-10T00:00:00Z
  - [x] **Indhent adgangsoplysninger og dokumentation** [HIGH] *(ID: 26781929)* | Due: 2026-01-10T00:00:00Z
  - [ ] **Verificér dataadgang og komplethed** *(ID: 26781930)* | Due: 2026-01-10T00:00:00Z
- [ ] **Specificering af MediaLibrary behov og omkostninger** [MED] *(ID: 26781931)* | Due: 2026-01-10T00:00:00Z
  > Afklaring af krav til MediaLibrary løsning sammen med EXHAUSTO. Vurdering af løsninger og estimering af omkostninger.
  - [ ] **Analyse af eksisterende media assets** *(ID: 26781932)*
  - [ ] **Evaluering af MediaLibrary løsninger** *(ID: 26781933)*
  - [ ] **Udarbejd omkostningsestimat** *(ID: 26781934)*
- [ ] **Opsætning af udviklingsmiljø** [HIGH] *(ID: 26781935)* | Due: 2026-01-18T00:00:00Z
  > Opsætning af Git repository, CI/CD pipeline, staging miljø og lokalt udviklingsmiljø for Next.js projektet.
  - [ ] **Opret GitLab repository med branching strategi** *(ID: 26781936)* | Due: 2026-01-18T00:00:00Z
  - [ ] **Opsæt CI/CD pipeline** *(ID: 26781937)* | Due: 2026-01-18T00:00:00Z
  - [ ] **Konfigurer staging og production miljøer** *(ID: 26781938)* | Due: 2026-01-18T00:00:00Z
  - [ ] **Dokumentér udviklingsworkflow** *(ID: 26781939)* | Due: 2026-01-18T00:00:00Z
- [ ] **Ugentlige styregruppemøder** [HIGH] *(ID: 26781940)* | Due: 2026-04-15T00:00:00Z
  > Facilitering af ugentlige styregruppemøder med Senior Director Mette N. Aagaard og Partner Marco B. Jensen.
  - [x] **Forbered og afhold januar** *(ID: 26781941)* | Due: 2026-01-30T00:00:00Z
    > Fredag den 16 januar\
    > Fredag den 23 januar\
    > Fredag den 30 januar
    > 
  - [ ] **Forbered og afhold april** *(ID: 26781944)* | Due: 2026-02-06T00:00:00Z
    > Fredag den 3 april\
    > \*Fredag den 10 april - Sidste møde inden launch den 15 april
    > 
  - [ ] **Forbered og afhold februar** *(ID: 26781942)* | Due: 2026-02-27T00:00:00Z
    > Fredag den 6 februar\
    > \*Fredag den 13 januar TBC - Vinterferie
    > 
    > Fredag den 20 januar\
    > Fredag den 27 januar
    > 
  - [ ] **Forbered og afhold marts** *(ID: 26781943)* | Due: 2026-03-27T00:00:00Z
    > Fredag den 6 marts
    > 
    > Fredag den 13 marts
    > 
    > Fredag den 20 marts
    > 
    > Fredag den 27 marts
    > 

---

## NextPage PIM Integration (Storyblok)

**Tasklist ID:** 2039119
**Description:** Opsætning og integration af NextPage PIM med Storyblok CMS. Kan starte tidligt da PIM integrerer direkte med Storyblok. Deadline: 10. februar 2026
**Tasks:** 4

- [ ] **NextPage PIM kopi og opsætning** [HIGH] *(ID: 26781996)* | Due: 2026-02-18T00:00:00Z
  > Kopiering af eksisterende NextPage PIM løsning til ny instans. Koordinering med 3C Evolution.
  - [ ] **Koordinér med 3C Evolution om setup, inkl. aftale om licens** *(ID: 26781997)* | Due: 2026-01-29T00:00:00Z
  - [ ] **Kopi af EXHAUSTO's database (Owner: 3C Evolution)** *(ID: 26785670)* | Due: 2026-02-18T00:00:00Z
  - [ ] **Eksporter eksisterende PIM data** *(ID: 26781998)* | Due: 2026-02-18T00:00:00Z
  - [ ] **Oprydning af data med Guillaume fra Aldes (Owner: 3C Evolution)** [HIGH] *(ID: 26785671)* | Due: 2026-02-18T00:00:00Z
  - [ ] **Konfigurer ny NextPage instans** *(ID: 26781999)* | Due: 2026-02-18T00:00:00Z
  - [ ] **Importér og validér produktdata** *(ID: 26782000)* | Due: 2026-03-06T00:00:00Z
  - [ ] **Dokumentér PIM struktur** *(ID: 26782001)* | Due: 2026-03-12T00:00:00Z
- [ ] **Admin training** *(ID: 26785668)* | Due: 2026-03-06T00:00:00Z
  > Ifølge aftale afholdes Admin training den 2. og 6. marts om morgenen og varer ca. 3 timer pr. session. Nextpage udsender invitationer.
  > 
- [ ] **NextPage PIM integration i Storyblok** [HIGH] *(ID: 26782002)* | Due: 2026-03-12T00:00:00Z
  > Integration af NextPage PIM med Storyblok CMS. Opsætning af produktblokke i Storyblok der henter data fra PIM API, inkl. produktvisning, søgning og filtrering. Kan køres parallelt med frontend udvikling da PIM integrerer direkte med Storyblok.
  - [ ] **Implementér PIM API client til Storyblok** *(ID: 26782003)* | Due: 2026-03-12T00:00:00Z
  - [ ] **Udvikl produktblok komponenter i Storyblok** *(ID: 26782004)* | Due: 2026-03-12T00:00:00Z
  - [ ] **Udvikl produktdetalje blok i Storyblok** *(ID: 26782005)* | Due: 2026-03-12T00:00:00Z
  - [ ] **Implementér søgning og filtrering i Storyblok** *(ID: 26782006)* | Due: 2026-03-12T00:00:00Z
  - [ ] **Caching af produktdata** *(ID: 26782007)* | Due: 2026-03-12T00:00:00Z
- [ ] **Go-live (Owner: 3C Evolution)** [HIGH] *(ID: 26785669)* | Due: 2026-03-12T00:00:00Z

---

## Storyblok CMS Development

**Tasklist ID:** 2039117
**Description:** Opsætning af Storyblok framework, content modeling, komponent-udvikling og migration fra Ibexa DXP. Deadline: 15. februar 2026
**Tasks:** 4

- [ ] **Opsætning af Storyblok Space** [HIGH] *(ID: 26781945)* | Due: 2026-01-10T00:00:00Z
  > Initial opsætning af Storyblok space med korrekte indstillinger, sprog (alle eksisterende sprog) og brugeradgange.
  - [ ] **Opret Storyblok space og konfigurer grundindstillinger** *(ID: 26781946)*
  - [ ] **Opsæt sprogversioner (multi-language)** *(ID: 26781947)*
  - [ ] **Konfigurer brugerroller og adgange** *(ID: 26781948)*
- [ ] **Content modeling og komponent-struktur** [HIGH] *(ID: 26781949)* | Due: 2026-01-20T00:00:00Z
  > Design og implementering af content model baseret på eksisterende Ibexa DXP struktur. Definition af blokke, komponenter og content types.
  - [ ] **Analyse af eksisterende content struktur i Ibexa** *(ID: 26781950)*
    - [ ] **Design tjek inden opstart, jf. opgaver under EXHAUSTO development (2025)** *(ID: 26785677)* | Due: 2026-01-28T00:00:00Z
  - [ ] **Design Storyblok content model** *(ID: 26781951)*
  - [ ] **Opret content types og blokke** *(ID: 26781952)*
  - [ ] **Validér model med EXHAUSTO team** *(ID: 26781953)*
- [ ] **Content migration fra Ibexa DXP** [HIGH] *(ID: 26781954)* | Due: 2026-02-13T00:00:00Z
  > Migration af alt eksisterende content fra Ibexa DXP til Storyblok. Inkluderer tekst, billeder, dokumenter og metadata på tværs af alle sprog.
  - [ ] **Udvikl migration scripts** *(ID: 26781955)* | Due: 2026-02-13T00:00:00Z
  - [ ] **Eksporter content fra Ibexa DXP** *(ID: 26781956)* | Due: 2026-02-13T00:00:00Z
  - [ ] **Transform og importér til Storyblok** *(ID: 26781957)* | Due: 2026-02-13T00:00:00Z
  - [ ] **Validér migreret content** *(ID: 26781958)* | Due: 2026-02-13T00:00:00Z
    - [ ] **Involver editors fra SE, NO, EN & DE** *(ID: 26785676)* | Due: 2026-02-09T00:00:00Z
  - [ ] **Håndtér edge cases og fejlrettelser** *(ID: 26781959)* | Due: 2026-02-13T00:00:00Z
- [ ] **AI Integration til StoryBlok API** [HIGH] *(ID: 26781960)* | Due: 2026-02-15T00:00:00Z
  > Udvikling af custom AI integration til StoryBlok API for at assistere med content indsættelse og management. Bygges med Claude API.
  - [ ] **Design AI integration arkitektur** *(ID: 26781961)*
  - [ ] **Implementér Claude API integration** *(ID: 26781962)*
  - [ ] **Udvikl StoryBlok Management API wrapper** *(ID: 26781963)*
  - [ ] **Byg AI-assisteret content creation flow** *(ID: 26781964)*
  - [ ] **Test og optimér AI funktionalitet** *(ID: 26781965)*

---

## Next.js Frontend Development

**Tasklist ID:** 2039118
**Description:** Frontend udvikling i Next.js med Claude Code, inklusiv AI integration til StoryBlok API for content management. Kører efter PIM integration er etableret i Storyblok.
**Tasks:** 5

- [ ] **Next.js projekt setup** [HIGH] *(ID: 26781966)* | Due: 2026-02-15T00:00:00Z
  > Initialisering af Next.js projekt med korrekt konfiguration, TypeScript, styling setup og Storyblok SDK integration.
  - [ ] **Initialiser Next.js projekt med TypeScript** *(ID: 26781967)*
  - [ ] **Konfigurer styling (CSS/Tailwind)** *(ID: 26781968)*
  - [ ] **Integrér Storyblok SDK (@storyblok/react)** *(ID: 26781969)*
  - [ ] **Opsæt preview mode og live editing** *(ID: 26781970)*
  - [ ] **Konfigurer ISR/SSG strategi** *(ID: 26781971)*
- [ ] **Routing og sidestruktur** [HIGH] *(ID: 26781979)* | Due: 2026-02-20T00:00:00Z
  > Implementering af dynamisk routing baseret på Storyblok content struktur. Håndtering af multi-language URLs og redirects.
  - [ ] **Implementér dynamic routes ([...slug])** *(ID: 26781980)*
  - [ ] **Opsæt multi-language routing** *(ID: 26781981)*
  - [ ] **Konfigurer redirects fra gamle URLs** *(ID: 26781982)*
  - [ ] **Implementér 404 og error pages** *(ID: 26781983)*
- [ ] **Komponent-bibliotek udvikling** [HIGH] *(ID: 26781972)* | Due: 2026-02-25T00:00:00Z
  > Udvikling af React komponenter til alle Storyblok blokke. Pixel-perfect matching af eksisterende design fra Ibexa site.
  - [ ] **Audit eksisterende design komponenter** *(ID: 26781973)*
  - [ ] **Udvikl base UI komponenter** *(ID: 26781974)*
  - [ ] **Udvikl content blok komponenter** *(ID: 26781975)*
  - [ ] **Udvikl layout komponenter (header, footer, navigation)** *(ID: 26781976)*
  - [ ] **Implementér responsive design** *(ID: 26781977)*
  - [ ] **Cross-browser testing og fixes** *(ID: 26781978)*
- [ ] **SEO og metadata implementering** [MED] *(ID: 26781984)* | Due: 2026-02-28T00:00:00Z
  > Implementering af SEO funktionalitet inklusiv meta tags, Open Graph, structured data og sitemap generering.
  - [ ] **Implementér dynamic meta tags** *(ID: 26781985)*
  - [ ] **Opsæt Open Graph og Twitter cards** *(ID: 26781986)*
  - [ ] **Implementér JSON-LD structured data** *(ID: 26781987)*
  - [ ] **Konfigurer automatisk sitemap generering** *(ID: 26781988)*
  - [ ] **Opsæt robots.txt** *(ID: 26781989)*
- [ ] **Performance optimering** [MED] *(ID: 26781990)* | Due: 2026-02-28T00:00:00Z
  > Optimering af Next.js applikation for hastighed og Core Web Vitals. Image optimization, code splitting og caching.
  - [ ] **Implementér Next.js Image optimization** *(ID: 26781991)*
  - [ ] **Konfigurer code splitting og lazy loading** *(ID: 26781992)*
  - [ ] **Optimér bundle size** *(ID: 26781993)*
  - [ ] **Opsæt caching strategi** *(ID: 26781994)*
  - [ ] **Validér Core Web Vitals** *(ID: 26781995)*

---

## Integration & MediaLibrary

**Tasklist ID:** 2039120
**Description:** Integration mellem CMS og PIM samt opsætning af MediaLibrary løsning. Deadline: 15. marts 2026
**Tasks:** 3

- [ ] **CMS og PIM integration** [HIGH] *(ID: 26782008)* | Due: 2026-03-10T00:00:00Z
  > Integration mellem Storyblok CMS og NextPage PIM. Produktblokke i CMS der henter fra PIM, synkronisering af data. Bemærk: PIM integrerer med Storyblok (ikke Next.js), så denne opgave kan påbegyndes tidligere og køres parallelt med frontend udvikling.
  - [ ] **Design integrations-arkitektur** *(ID: 26782009)*
  - [ ] **Implementér produkt-blokke i Storyblok** *(ID: 26782010)*
  - [ ] **Udvikl data sync mellem systemer** *(ID: 26782011)*
  - [ ] **Test integration flows** *(ID: 26782012)*
- [ ] **MediaLibrary opsætning** [MED] *(ID: 26782013)* | Due: 2026-03-15T00:00:00Z
  > Implementering af valgt MediaLibrary løsning. Integration med Storyblok og migration af eksisterende media assets.
  - [ ] **Konfigurer MediaLibrary løsning** *(ID: 26782014)*
  - [ ] **Integrér med Storyblok** *(ID: 26782015)*
  - [ ] **Migrér eksisterende media assets** *(ID: 26782016)*
  - [ ] **Validér og test media håndtering** *(ID: 26782017)*
- [ ] **AI-assisteret oversættelse setup** [MED] *(ID: 26782018)* | Due: 2026-03-15T00:00:00Z
  > Opsætning af AI-baseret oversættelsesflow i Storyblok for multi-language content management.
  - [ ] **Evaluer og vælg AI oversættelsesløsning** *(ID: 26782019)*
  - [ ] **Integrér med Storyblok workflow** *(ID: 26782020)*
  - [ ] **Konfigurer sprogpar og kvalitetsregler** *(ID: 26782021)*
  - [ ] **Test oversættelseskvalitet** *(ID: 26782022)*

---

## Testing & Validation

**Tasklist ID:** 2039121
**Description:** Test og validering af data, design, integrationer og produktdata. Deadline: 2. april 2026
**Tasks:** 5

- [ ] **Funktionel test af CMS** [HIGH] *(ID: 26782023)* | Due: 2026-03-20T00:00:00Z
  > Omfattende test af alle CMS funktioner inklusiv content editing, preview, publicering og multi-language.
  - [ ] **Test content creation og editing** *(ID: 26782024)*
  - [ ] **Test preview og live editing** *(ID: 26782025)*
  - [ ] **Test publicerings workflow** *(ID: 26782026)*
  - [ ] **Test multi-language funktionalitet** *(ID: 26782027)*
  - [ ] **Dokumentér og ret fundne fejl** *(ID: 26782028)*
- [ ] **Test af PIM integration** [HIGH] *(ID: 26782029)* | Due: 2026-03-20T00:00:00Z
  > Validering af produktdata, PIM funktioner og integration med frontend. Test af søgning, filtrering og produktvisning.
  - [ ] **Validér produktdata komplethed** *(ID: 26782030)*
  - [ ] **Test produktsøgning og filtrering** *(ID: 26782031)*
  - [ ] **Test produktvisning på frontend** *(ID: 26782032)*
  - [ ] **Dokumentér og ret fundne fejl** *(ID: 26782033)*
- [ ] **Design og UI validering** [HIGH] *(ID: 26782034)* | Due: 2026-03-25T00:00:00Z
  > Validering af at frontend matcher eksisterende design pixel-perfect. Review med EXHAUSTO team.
  - [ ] **Sammenlign med eksisterende site** *(ID: 26782035)*
  - [ ] **Review med EXHAUSTO team** *(ID: 26782036)*
  - [ ] **Implementér feedback og rettelser** *(ID: 26782037)*
- [ ] **Performance og sikkerhedstest** [MED] *(ID: 26782038)* | Due: 2026-03-28T00:00:00Z
  > Test af website performance, sikkerhed og stabilitet. Load testing og penetration testing.
  - [ ] **Kør performance benchmark** *(ID: 26782039)*
  - [ ] **Sikkerhedsgennemgang** *(ID: 26782040)*
  - [ ] **Load testing** *(ID: 26782041)*
  - [ ] **Optimér baseret på resultater** *(ID: 26782042)*
- [ ] **Final test og sign-off** [HIGH] *(ID: 26782043)* | Due: 2026-04-02T00:00:00Z
  > Afsluttende test af hele løsningen. Gennemgang med EXHAUSTO og formel accept.
  - [ ] **End-to-end test af alle funktioner** *(ID: 26782044)*
  - [ ] **UAT med EXHAUSTO team** *(ID: 26782045)*
  - [ ] **Dokumentér og adressér sidste issues** *(ID: 26782046)*
  - [ ] **Indhent formel accept** *(ID: 26782047)*

---

## Launch & Training

**Tasklist ID:** 2039122
**Description:** Go-live forberedelse, lancering og træning af webmasters. Deadline: 15. april 2026
**Tasks:** 4

- [ ] **Go-live forberedelse** [HIGH] *(ID: 26782048)* | Due: 2026-04-10T00:00:00Z
  > Forberedelse til lancering inklusiv DNS opsætning, SSL certifikater, monitoring og backup procedures.
  - [ ] **Konfigurer production miljø** *(ID: 26782049)*
  - [ ] **Opsæt DNS og SSL** *(ID: 26782050)*
  - [ ] **Konfigurer monitoring og alerting** *(ID: 26782051)*
  - [ ] **Dokumentér backup og recovery procedures** *(ID: 26782052)*
  - [ ] **Lav go-live checkliste** *(ID: 26782053)*
  - [ ] **Planlæg rollback strategi** *(ID: 26782054)*
- [ ] **Lancering** [HIGH] *(ID: 26782055)* | Due: 2026-04-15T00:00:00Z
  > Go-live af den nye løsning. DNS switch, smoke testing og overvågning af første timer.
  - [ ] **Udfør DNS cutover** *(ID: 26782056)*
  - [ ] **Smoke test alle kritiske funktioner** *(ID: 26782057)*
  - [ ] **Overvåg performance og fejl** *(ID: 26782058)*
  - [ ] **Kommuniker succesfuld lancering** *(ID: 26782059)*
- [ ] **Træning af webmasters** [HIGH] *(ID: 26782060)* | Due: 2026-04-15T00:00:00Z
  > Træning af 5 webmasters i Storyblok CMS. Hands-on sessions og dokumentation.
  - [ ] **Forbered træningsmateriale** *(ID: 26782061)*
  - [ ] **Afhold træningssession 1: Grundlæggende** *(ID: 26782062)*
  - [ ] **Afhold træningssession 2: Avanceret** *(ID: 26782063)*
  - [ ] **Udlever dokumentation og guides** *(ID: 26782064)*
  - [ ] **Q&A og opfølgning** *(ID: 26782065)*
- [ ] **Dokumentation og overdragelse** [MED] *(ID: 26782066)* | Due: 2026-04-15T00:00:00Z
  > Komplet teknisk dokumentation og overdragelse til drift. Inkluderer arkitektur, procedures og kontaktinfo.
  - [ ] **Dokumentér systemarkitektur** *(ID: 26782067)*
  - [ ] **Dokumentér drift og vedligeholdelse** *(ID: 26782068)*
  - [ ] **Afslut projekt og luk tracking** *(ID: 26782069)*

---

