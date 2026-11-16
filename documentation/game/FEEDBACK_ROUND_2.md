Bompers the Game - Ronde 2: Game Design Document & Feedback Log
Dit document compileert alle tot nu toe besproken game design specificaties, geïdentificeerde knelpunten, gerefactorde mechanieken, experimentele voorstellen en nieuwe systeemeisen voor Bompers the Game. Conform de projectafspraken wordt er strikt onderscheid gemaakt tussen vastgestelde oplossingen en openstaande knelpunten die nog technische uitwerking door de coding agents vereisen.
1. Overzicht: Knelpunten vs. Oplossingen
Onderstaande tabel geeft een gestructureerd overzicht van alle gelogde feedbackpunten, gecategoriseerd op status (Oplossing vastgelegd vs. Alleen knelpunt/experiment gelogd).
Onderdeel
	Status
	Kernbeschrijving
 
	Extra
	Agent Level-Generatie Prompt
	Oplossing vastgelegd
	Kopieerbare systeem-prompt in de app voor single-shot levelgeneratie door externe AI-agents.
	alleen de variabele settings hierin
	In-Game Pauzemenu
	Oplossing vastgelegd
	Startmenu tijdens de match voor alle spelers (audio, basisopties, terug naar hoofdmenu).
	

	Headbutt / Dash Reset Power-up
	Oplossing vastgelegd
	Mid-flight oppakbare reset waarmee de speler zonder te landen opnieuw kan headbutten/dashen.
	

	Crouch (Hurk) Mechanic
	Oplossing vastgelegd
	Vastgezet postuur bij omlaag drukken; halveert schade en biedt immuniteit tegen 1-schade aanvallen.
	

	Wall-Slide / Wall-Jump Voetoriëntatie
	Oplossing vastgelegd
	Voetjes van het karakter draaien richting de muur tijdens wall-sliden en wall-jumpen.
	

	Sprongfysica & Zwaartekracht
	Knelpunt gelogd
	Sprongen verlopen te snel om goed te coördineren bij trick jumps; balans tussen zwaartekracht en spronghoogte nodig.
	

	Voetjes Animatie & Dynamiek
	Knelpunt gelogd
	Huidige beweging (alleen op/neer) mist de rotatie, dynamiek en het game-feel gevoel van de versie vóór de restyling.
	

	Raket Terugslag (Recoil)
	Knelpunt gelogd
	Het afvuren van een raket genereert momenteel geen fysieke terugslag op de speler.
	

	Map Grenzen (Zijkanten)
	Knelpunt gelogd
	Spelers sterven onverwacht aan de zijkanten van de map; alleen de onderkant (te pletter vallen) hoort dodelijk te voelen.
	

	Uniform Materialensysteem
	Knelpunt / Architectuurvraag
	Scheiding of koppeling van fysieke eigenschappen en kleurcodering voor HTML-maps zonder materiële overdaad.
	

	Game Juice Design System
	Knelpunt / Richtlijn
	Behoefte aan een consistent subsysteem voor audio, stretch/squash en visuele constanten bij nieuwe elementen.
	

	Countdown Audio (Laatste 30s)
	Knelpunt gelogd
	Er ontbreekt een achtergrondgeluid of muziekje voor de laatste 30 seconden van de match.
	

	Audio-Wissel Experiment
	Experiment gelogd
	Testen of het omwisselen van het headbutt-muurgeluid en het sprong-landingsgeluid beter klinkt.
	

	2. Nieuwe Features & Vastgelegde Specificaties
2.1 Kopieerbare Systeem-Prompt voor Level-Generatie
Naast de bestaande level-importfunctie ('Your Level') in de applicatie moet een directe kopieerknop worden toegevoegd voor een gestandaardiseerde systeem-prompt.
* Doel: Gebruikers kunnen deze prompt met één klik kopiëren (zonder deze zelf te hoeven lezen of begrijpen) en plakken in een externe AI-agent (zoals Gemini).
* Inhoud van de prompt: Bevat alle technische specificaties waarmee een externe coding agent in één keer (single-shot) een geldig, speelbaar level kan genereren in het vereiste HTML-mapformaat, inclusief alle verplichte constanten, variabelen, entiteiten en materiaaldefinities.
2.2 In-Game Pauzemenu (Startmenu)
Tijdens een actieve wedstrijd moet een pauzemenu beschikbaar zijn dat de gameplay volledig bevriest.
* Toegankelijkheid: Alle deelnemende spelers kunnen het pauzemenu activeren.
* Functionaliteit binnen het menu:
   * Terugkeren naar het hoofdmenu.
   * Geluidseffecten (SFX) in- of uitschakelen.
   * Muziek in- of uitschakelen (voorbereiding op toekomstige muziekimplementatie).
   * Algemene spelopties aanpassen.
* Beperking: Specifieke wedstrijdinstellingen (game settings) mogen niet vanuit dit menu worden gewijzigd; deze blijven exclusief voorbehouden aan het lobby-menu.
2.3 Power-Up: Headbutt / Boost Reset
Introductie van een nieuwe mobiliteits-power-up in de levels, geïnspireerd op platformers zoals Ori and the Blind Forest.
* Werking: Wanneer een speler zijn headbutt gebruikt om door de lucht te vliegen en deze lading verbruikt is, herstelt het oppakken van (of doorheen springen van) deze power-up direct de headbutt-lading in de lucht (mid-flight).
* Gameplay-impact: Stelt spelers in staat om zonder tussentijds te landen meerdere headbutts aan elkaar te rijgen, wat nieuwe luchroutes en parkour-ketens mogelijk maakt.
2.4 Verdedigende Crouch-Mechanic (Hurken)
Wanneer de speler de besturing omlaag indrukt, gaat het karakter in een vaste hurkhouding.
* Beweging & Visueel: Het karakter staat volledig stil (kan niet lopen tijdens het hurken), zakt omlaag naar de grond en de voetjes worden vrijwel onzichtbaar.
* Schadereductie: Alle inkomende schade wordt gehalveerd tijdens het hurken.
* Immuniteit voor lichte schade: Aanvallen of gevaren die normaal gesproken 1 punt schade toebrengen, doen tijdens het hurken 0 schade.
2.5 Wall-Slide & Wall-Jump Voetoriëntatie
Visuele verfijning van muurinteracties:
* Huidige situatie: Het karakter glijdt in zijn standaard rechtopstaande houding langs de muur.
* Gewenste aanpassing: Tijdens het wall-sliden en wall-jumpen moeten de voetjes van het karakter gericht (gedraaid) zijn naar het oppervlak van de muur waartegen wordt gegleden.
3. Gelogde Knelpunten & Refactored Elementen (Zonder Vaste Oplossing)
Voor de onderstaande punten geldt het uitgangspunt dat we het onderliggende probleem en de gewenste spelervaring vastleggen, zonder alvast een harde technische implementatie voor te schrijven.
* Sprongsnelheid & Zwaartekracht-balans: De huidige sprongen gaan te snel om door een speler goed te coördineren, waardoor trick jumps onnodig moeilijk zijn. Er is behoefte aan meer traagheid/controle in de lucht (lagere zwaartekracht), wat direct in balans moet worden gebracht met een lagere spronghoogte omdat zwaartekracht invloed heeft op de maximale hoogte.
* Voetjes Animatie & Game Feel (Refactored): De eerder geopperde specifieke oplossingen (zoals hogere sprites of aangepaste collision) zijn geschrapt. Het daadwerkelijke knelpunt is dat de voetjes momenteel alleen statisch omhoog en omlaag bewegen, waardoor ze de rotatie, dynamiek en het fijne gevoel missen uit de versie van vóór de restyling.
* Ontbrekende Raket-terugslag: Het afvuren van een raket heeft momenteel geen fysieke terugslag (recoil) op het karakter, wat impact en tactische bewegingsmogelijkheden mist.
* Onintuïtieve Dodelijkheidsgrenzen aan de Zijkanten: Net als aan de bovenkant van de map worden spelers aan de zijkanten van de map te snel gedood ("vermoord door de lucht"). Alleen aan de onderkant van de map (te pletter vallen) hoort dodelijk te voelen; de zijkanten en bovenkant moeten aanvoelen als vrije ruimte.
* Ontbrekende Eindfase-Audio: Voor de laatste 30 seconden van een match ontbreekt een achtergrondgeluid of muziekje dat de spanning opbouwt.
* Audio-Experiment (Headbutt vs. Landing): Als experiment voor de coding agents: test het omwisselen van het geluidseffect van een headbutt tegen een muur met het geluidseffect van de landing na een sprong, om te beoordelen of deze omgekeerd beter passen.
4. Systeemarchitectuur & Design Language Uitdagingen
4.1 Uniform Materialensysteem voor HTML-Maps
Omdat externe agents levels genereren als HTML-documenten die de game interpreteert, moeten de materialen eenduidig worden gedefinieerd.
* Visuele uniformiteit: Verwoestbare (destructible) en onverwoestbare (indestructible) materialen moeten qua vorm en basisstructuur (gebaseerd op de huidige paarse ondergrond) gelijk zijn, maar duidelijk verschillen in kleur (bijv. een kartonachtige tint voor verwoestbaar materiaal).
* Uitbreiding & Architectuurvraag: Er is behoefte aan extra materiaaleigenschappen zoals ijs, en kleurvariaties (verschillende kleuren ijs, aarde, karton, onverwoestbaar materiaal). De ontwerpuitdaging is om te bepalen of fysiek gedrag en kleur worden losgekoppeld (zodat elke kleur op elk gedragstype kan worden toegepast zonder een explosie aan aparte materialen zoals in LittleBigPlanet), mits de speler zonder vaste kleurcodering nog steeds direct kan herkennen of een blok verwoestbaar is of glad (ijs).
4.2 Game Juice Design System
Als subcategorie van het algemene Design System moet een specifiek Game Juice Design System worden opgezet (in één of meerdere agent-skills, ter beoordeling van de coding agent).
* Doel: Omdat er aan de lopende band nieuwe game-elementen worden toegevoegd, zijn vaste constanten en richtlijnen nodig voor geluiden, squash-and-stretch animaties en visuele feedback, zodat het gehele spel één consistente stijl en feel behoudt.