# **Game Design Document: 4-Player Arena Shooter**

Dit document bevat de creatieve en mechanische specificaties voor een snelle, op fysica en chaos gebaseerde 4-speler arena-shooter, geïnspireerd op de multiplayer-battles uit LittleBigPlanet.

## **1\. Kernconcept & Spelers**

De game is een kleine arena-shooter met platformer- en/of top-down-elementen die is ontworpen voor 2 tot 4 spelers, met ondersteuning voor een singleplayer-modus voor testdoeleinden.

> * **Spelersaantal & Modi:** Ontworpen voor 2 tot 4 spelers (competitieve multiplayer), met ondersteuning voor 1 speler (singleplayer) specifiek voor testdoeleinden.  
> * **Karakterontwerp:** Elk karakter bestaat uit een bolvormig lichaam met twee ronde voetjes en een helm.  
> * **Wapenmechaniek:** Wapens en projectielen worden afgevuurd vanuit de helm, gericht in de richting waarin de speler mikt.  
> * **Omgevingsinteractie:** Zowel wapens als spelers hebben direct effect op de arena.

## **2\. Beweging, Game Feel & Cameragedrag**

De besturing combineert lichte, fysieke blob-fysica met vloeiende momentum-mechanieken en dynamische cameravoering.

> * **Bewegingsfysica & Momentum:** Karakter voelt licht en fysiek aan als een blob (deukt in en zakt licht door de bolvormige voetjes bij landingen, geïnspireerd op LocoRoco/Fall Guys). Bewegingen volgen vloeiende, gebogen patronen met responsieve acceleratie en vertraging bij richtingswisselingen.  
> * **Sprongen & Mobiliteit:** Hoge sprongen (schaalbaar op basis van zwaartekracht per map/instelling), luchtcontrole (air steering) en ondersteuning voor wall-jumps.  
> * **Hurken (verdediging):** Omlaag ingedrukt op de grond = vaste hurkhouding: de blob staat stil (draaien, richten, vuren en springen blijven mogelijk), zakt (lijf en hoofd) naar de grond; de voetjes blijven zoals ze zijn en de helm zakt tot over ongeveer de helft van de ogen. Alle inkomende schade wordt gehalveerd en naar beneden afgerond (2 → 1, 1 → 0). In de lucht is omlaag alleen richten.  
> * **Rocket Jumping:** Spelers kunnen raketten op oppervlakken of nabij zichzelf afvuren om zichzelf met de explosiekracht door de arena te lanceren zonder zelf schade op te lopen.  
> * **Dynamische Multi-Target Camera:** Een generieke dynamische multi-target camera volgt automatisch alle actieve spelers en past het kader en de zoom aan op hun posities, voorzien van een centrale deadzone om alle spelers gelijktijdig in beeld te houden.

## **3\. Gezondheidssysteem, Wapens & Projectiel Specificaties (MVP)**

Spelers beschikken over een minimaal, gesegmenteerd gezondheidssysteem. Wapens en power-ups vallen uit de lucht in de arena; zonder wapen beschikt de speler over een fysieke aanval op dezelfde actieknop.

| Actie / Eigenschap | Specificatie   |
| :---- | :---- |
| **Gezondheidssysteem** | Minimaal gesegmenteerd systeem met 4 discrete eenheden (chunks) van gezondheid per speler. |
| **Ongewapende Aanval (Beuk)** | Geactiveerd via de schietknop wanneer ongewapend; brengt schade toe aan de gezondheidssegmenten en lanceert tegenstanders met knockback achteruit. |
| **Basiswapen (MVP)** | Raketwerper (valt uit de lucht als pickup, afgevuurd vanuit de helm). |
| **Zoekraketwerper** | Tweede wapen uit dezelfde kratten (eigenaar, 2026-11-16): 3 zoekraketten die afbuigen naar de dichtstbijzijnde tegenstander in de schietrichting, maar ontwijkbaar zijn — trager dan een raket, beperkte draaisnelheid en beperkte stuurtijd; dezelfde ontploffing. Lila raket met rood knipperend zoeklicht; krat met lila ring. |
| **Richtmechaniek** | Projectiel vliegt recht in de richting waar de speler naartoe mikt (de zoekraket buigt daarna af naar haar doel). |
| **Impact op Spelers & Omgeving** | Ontploft bij contact, verwijdert exact 1 gezondheidssegment (chunk) bij geraakte tegenstanders (elimineert bij 0 resterende chunks), doet geen schade aan de schutter zelf (maakt schade-vrije rocket jumps mogelijk) en vernietigt destructieve arena-secties. |

## **4\. Arena Ontwerp: Startmap**

De eerste en meest toegankelijke map richt zich op overzichtelijke platformactie zonder directe omgevingsgevaren zoals lava.

> * **Layout:** Minimalistisch zwevend hoofdplatform met meerdere verhoogde plateaus erboven (geïnspireerd op Super Smash Bros.-basislevels) voor snelle verticale gevechten.  
> * **Gevaren & Spawns:** Open randen aan de zijkanten van het hoofdplatform waar spelers vanaf kunnen vallen; wapens en power-ups spawnen van bovenaf.  
> * **Benodigde Levelelementen:**  
  * Spawnpunten voor spelers  
  * Drop-locaties voor wapens en power-ups  
  * Platformranden  
  * Instelbare zonegrenzen (wereldranden / out-of-bounds)

## **5\. Spelregels & Winvoorwaarden**

Een ronde draait om het verzamelen van zoveel mogelijk punten binnen de gestelde tijd.

> * **Winvoorwaarde:** De speler met de hoogste score aan het einde van de ronde wint.  
> * **Punten verdienen (Kills):** Het uitschakelen van een tegenstander levert punten op.  
> * **Punten verdienen (Omgeving):** Extra punten kunnen worden verdiend door verzamelobjecten (zoals punten die uit het dak vallen) op te pakken.

## **6\. Respawn & Spawn Protection**

Om spawnkilling te voorkomen en eerlijke herintreding te garanderen, gelden de volgende regels na uitschakeling:

> * **Dynamische Locatieselectie:** De speler spawnt op een vooraf gedefinieerd, veilig spawnpunt (niet boven gevaren zoals lava) dat op dat moment het verst verwijderd is van alle actieve tegenstanders.  
> * **Tijdelijke Onkwetsbaarheid:** Direct na het spawnen knippert het karakter en is de speler tijdelijk onkwetsbaar voor schade.  
> * **Volledige Actievrijheid:** Tijdens deze onkwetsbare fase is de speler niet geblokkeerd; hij kan vrij bewegen en direct actie ondernemen (inclusief schieten, mits in het bezit van een wapen).

## **7\. Configureerbare Instellingen**

Flexibiliteit staat centraal in het ontwerp. Spelregels en variabelen moeten aanpasbaar zijn voor de spelers.

> * **Matchduur & Zwaartekracht:** Flexibel in te stellen per wedstrijd of per map.  
> * **Overige parameters:** Verdere arena- en spelvariabelen (zoals wapenbeschikbaarheid bij spawn en omgevingsgevaren) worden modulair en instelbaar opgezet.