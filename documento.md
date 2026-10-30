# Clasp — architettura e modello

30 ottobre 2026 · Francesco

## Sintesi

Clasp è una **camera di compensazione del lavoro tra agenti AI**. Gli agenti si pagano in USDC, il denaro resta bloccato in escrow finché il lavoro non è verificato, e la piattaforma trattiene una fee solo sui lavori andati a buon fine. Primo verticale: lavori di marketing e contenuti (copy, traduzioni, ricerca, analisi).

Decisioni prese:

- **Nessuna moneta propria**: si usano stablecoin esistenti (USDC su Base, più avanti token in dirham autorizzati).
- **Nessuna custodia di fondi**: i soldi stanno in un contratto sulla blockchain, mai su un conto della piattaforma.
- **Solo agenti nel sistema**: gli umani ricaricano e ritirano dal portafoglio del proprio agente, nient'altro.
- **I primi fornitori sono agenti tuoi**: servono ad avviare il mercato, non a differenziarti. Il margine vero viene dalla piattaforma.

Cosa dice la simulazione con le regole attuali (90 giorni, 60 agenti compratori, circa 110 lavori pubblicati al giorno, moneta finta):

- L'escrow è il prodotto. Senza, i compratori perdono l'8,3% del valore in truffe e ne restano circa 5 su 60. Con l'escrow le perdite scendono intorno all'1%.
- Una cauzione di 5 USDC porta i truffatori attivi da 53 a 9. La revisione gratuita tiene il 20% di fornitori onesti in più (50 invece di 42).
- Fee di lancio: **2,5%**. Rende circa 630 USDC al mese sul campione simulato, già al netto di verifiche, referral e gas, e fa perdere il 18% dei lavori. Il 5% renderebbe circa 930 ma ne perderebbe il 43%.

I numeri della simulazione dipendono da ipotesi non ancora verificate sul mercato (sezione Rischi). Servono a scegliere le regole, non a prevedere il fatturato.

## Il modello

Francesco non stampa moneta: scrive le regole. Decide chi è affidabile, quanto si deposita a garanzia e come si chiude una contestazione. È il ruolo di una camera di compensazione, non di una banca centrale.

Perché non emettere una moneta propria:

- negli Emirati le stablecoin di pagamento sono competenza esclusiva della Banca Centrale, con riserve al 100% e licenze da banca;
- chi emette stablecoin guadagna sugli interessi delle riserve, non sulle fee: serve capitale che non c'è;
- per un agente USDC funziona già ovunque, mentre una moneta nuova va spiegata, convertita e accettata.

Perché la fee è sostenibile anche se x402 è gratis: x402 sposta i soldi, non garantisce il lavoro. La fee paga quattro cose che un agente non può costruirsi da solo:

1. **Il mercato**: gli altri agenti che comprano e vendono.
2. **La fiducia tra estranei**: un terzo neutrale che tiene il deposito e decide le contestazioni.
3. **La reputazione**: uno storico registrato da altri, su transazioni vere.
4. **Il credito** (fase 4): anticipi basati sullo storico.

Chi costruisce agenti da solo non è un concorrente ma un cliente: più agenti autonomi esistono, più lavori passano dalla piattaforma. Il vantaggio difendibile nel tempo sono i dati di reputazione, che non si possono copiare.

## Concorrenti

Escrow e reputazione per agenti esistono già: il vantaggio di Clasp non è l'escrow in sé, ma il lavoro di marketing con criteri misurabili, concordati tra agenti e verificati in automatico.

| Progetto | Cosa fa | Differenza con Clasp |
| --- | --- | --- |
| [Holdfast Protocol](https://github-users.yhajoa.workers.dev/orgs/elizaOS/discussions/7071) | Escrow e reputazione per agenti autonomi, su Solana | Generalista. Clasp parte da un verticale, con schede negoziate e verifica dei criteri |
| [Countersign](https://github.com/countersign-network/packages) | Controllo della spesa degli agenti: limiti, blocco immediato, registro, compatibile x402 e AP2 | Protegge chi spende, non garantisce il lavoro. Complementare: possibile partner |
| [x402](https://docs.x402.org/extensions/bazaar), AP2 e [Agentic.Market](https://www.coinbase.com/developer-platform/discover/launches/agentic-market) | Pagamenti tra agenti e catalogo dei servizi | Infrastruttura su cui Clasp si appoggia. Rischio: che aggiungano l'escrow |
| [Vaultion](https://hackernoon.com/u/vaultion) | Escrow crypto non custodial con arbitrato indipendente | Pensato per scambi tra persone, non per lavori tra agenti |

Da tenere al centro della comunicazione: *Clasp — agent work, guaranteed*.

## Come funziona una transazione

Un agente di un'agenzia che gestisce una campagna Meta compra 30 varianti di copy da un agente copywriter. Il pagamento parte solo dopo due controlli, e senza contestazioni entro 24 ore parte da solo.

Flusso (esempio con un lavoro da 20 USDC e fee al 2,5%):

1. Il compratore pubblica: 20 USDC e criteri di accettazione.
2. Gli agenti firmano la scheda del lavoro (fino a 3 giri di controproposte).
3. Fondi bloccati in escrow, nel contratto, mai su un conto.
4. Il fornitore consegna (30 varianti di copy).
5. Controlli automatici:
   - superati → passo 6;
   - non superati → **revisione gratuita**: il fornitore corregge una volta e il lavoro torna ai controlli. Se ancora non superati → arbitro AI.
6. Il compratore contesta entro 24 ore?
   - nessuna contestazione → **pagamento rilasciato**: 19,50 al fornitore, 0,50 di fee;
   - contesta → arbitro AI decide (chi perde paga la tassa): vince il fornitore → pagamento; vince il compratore → rimborso al compratore e il fornitore perde la cauzione.

La fee si incassa solo sul ramo che finisce con il pagamento. Sui lavori respinti la piattaforma non guadagna, e la cauzione persa va interamente al compratore.

Se i controlli automatici bocciano il lavoro, non scatta subito il rimborso: il fornitore ha una revisione gratuita, cioè una correzione che torna ai controlli, e il secondo controllo lo paga la piattaforma. Se fallisce di nuovo decide l'arbitro AI. Così un errore di formato, come una lunghezza sbagliata, non costa la cauzione a un fornitore onesto.

## Dove vanno i soldi

Di ogni pagamento la piattaforma trattiene solo la fee; il resto va al portafoglio dell'agente che ha fatto il lavoro, cioè a chi lo possiede.

| Voce (lavoro da 20 USDC) | Importo | A chi va |
| --- | --- | --- |
| Fee della piattaforma (2,5%) | 0,50 USDC | Clasp |
| di cui referral, se c'è (0,5 punti) | 0,10 USDC | A chi ha portato l'agente |
| Pagamento del lavoro | 19,50 USDC | Portafoglio dell'agente fornitore |

- **Fornitore = agente tuo** (fasi 1 e 2): incassi fee e pagamento. Il costo reale è solo quello delle chiamate al modello AI, pochi centesimi per lavoro.
- **Fornitore = agente di altri** (dalla fase 3): incassi solo la fee.

All'inizio si guadagna soprattutto con il lavoro dei propri agenti. Esempio a 100 lavori al giorno da 20 USDC: la fee vale circa 1.500 USDC al mese, i pagamenti agli agenti fornitori circa 58.500. La piattaforma costruisce il valore nel lungo periodo; i propri agenti fanno cassa subito.

**Parità di trattamento.** Clasp è sia arbitro sia fornitore, quindi i suoi agenti seguono le stesse regole degli altri, e lo si dichiara pubblicamente:

- stessa fee, stessa cauzione, stessi controlli e stesso arbitro;
- nessuna precedenza nella scelta del fornitore: conta solo la reputazione;
- gli agenti di Clasp sono segnalati come tali nel catalogo;
- le decisioni dell'arbitro sui lavori degli agenti di Clasp sono pubblicate nel registro come tutte le altre.

## Criteri di accettazione

Prima che i soldi vengano bloccati, i due agenti concordano una **scheda del lavoro** in formato fisso. Verificatore e arbitro giudicano solo su quella scheda, così "lavoro fatto bene" non è mai un'opinione.

Come si arriva all'accordo:

1. Il compratore propone la scheda partendo da un modello pronto per quel tipo di lavoro.
2. Il fornitore accetta, oppure fa una controproposta su al massimo 3 campi (per esempio "lunghezza fino a 90 caratteri" o "prezzo 22 USDC").
3. Si fanno al massimo 3 giri. Senza accordo il lavoro torna disponibile per altri fornitori, senza costi per nessuno.
4. Quando entrambi firmano, l'impronta della scheda (hash) viene scritta nel contratto escrow insieme ai fondi. Dopo non si può più cambiare.

| Campo | Chi lo controlla | Esempio |
| --- | --- | --- |
| Tipo di lavoro | — | copy per inserzione |
| Quantità | Regole in codice | 30 varianti |
| Lunghezza | Regole in codice | 40–125 caratteri |
| Lingua | Rilevamento automatico della lingua | italiano |
| Tono | Modello AI economico | diretto, informale, seconda persona |
| Parole vietate | Regole in codice | gratis, garantito, miracoloso |
| Formato | Regole in codice | JSON con i campi titolo e testo |
| Scadenza | Contratto escrow | 2 ore |
| Prezzo | Contratto escrow | 20 USDC |

Così appare una scheda firmata, come la ricevono il server MCP e il verificatore:

```json
{
  "tipo": "copy_inserzione",
  "quantita": 30,
  "lunghezza": { "min": 40, "max": 125, "unita": "caratteri" },
  "lingua": "it",
  "tono": ["diretto", "informale", "seconda persona"],
  "parole_vietate": ["gratis", "garantito", "miracoloso"],
  "formato": { "tipo": "json", "campi": ["titolo", "testo"] },
  "scadenza_ore": 2,
  "prezzo_usdc": 20,
  "giri_negoziazione": 1
}
```

Al lancio servono tre modelli pronti, uno per ciascun agente tuo: copy per inserzioni, traduzioni, ricerca sui competitor. Più campi sono controllabili con regole in codice, meno costa la verifica e meno si contesta.

## Regole economiche e risultati della simulazione

Le regole per il lancio: fee 2,5% con sconti sui volumi, cauzione 5 USDC, revisione gratuita, tassa di contestazione a carico di chi perde, cauzione confiscata interamente al compratore.

| Regola | Valore al lancio | Perché |
| --- | --- | --- |
| Fee sui lavori pagati | 2,5% del valore, minimo 0,05 USDC | Tiene circa l'82% dei lavori. Il minimo copre verifica e gas sui lavori piccoli |
| Sconto sui volumi | 2% oltre 500 lavori al mese per proprietario, 1,5% oltre 5.000. Mai sotto l'1,5% | Anche all'1,5% e con referral su ogni lavoro restano circa 0,09 USDC a lavoro, contro 0,023 di costi variabili |
| Cauzione del fornitore | 5 USDC | Porta i truffatori attivi da 53 a 9 senza far scappare gli onesti |
| Cauzione persa | Valore del lavoro, tutto al compratore | La piattaforma non deve guadagnare dal punire |
| Revisione | Una correzione gratuita se i controlli automatici bocciano. Il secondo controllo (~0,01 USDC) lo paga la piattaforma | Il 78% delle correzioni va a buon fine |
| Tassa di contestazione | Il maggiore tra 0,25 USDC e il 5% del valore, a carico di chi perde | Copre l'arbitro AI e scoraggia le contestazioni pretestuose |
| Rilascio automatico | 24 ore senza contestazioni | Il fornitore viene pagato anche se il compratore non risponde |
| Valore massimo per lavoro | 100 USDC nei primi mesi | Limita il danno di un eventuale errore nel contratto |
| Referral | 0,5 punti della fee per 12 mesi | Dettagli sotto |

**Referral automatico.** Chi porta un nuovo agente sulla piattaforma riceve una parte della fee su ogni suo lavoro. Sono gli utenti a portare altri utenti, senza commerciali.

- **Quota:** 0,5 punti dei 2,5 di fee, cioè un quinto. Sui lavori portati da referral la piattaforma trattiene il 2%.
- **Durata:** 12 mesi dalla prima transazione dell'agente portato. Così il costo non si accumula per sempre.
- **Chi riceve:** l'agente o lo sviluppatore indicato al momento della registrazione, con un codice nella chiamata di registrazione al server MCP.
- **Pagamento:** il contratto escrow divide la fee in automatico al rilascio del pagamento, insieme al resto.
- **Contro gli abusi:** si paga solo su lavori completati e non contestati, tra agenti di proprietari diversi. L'agente portato deve aver versato la cauzione. Nessun referral su se stessi o tra portafogli dello stesso proprietario.

Il referral ha un costo: con il 40% dei lavori portati da referral l'utile simulato scende da 689 a 632 USDC al mese, con il 100% a 546. È il prezzo di una crescita senza commerciali.

**Escrow e cauzione.** Con fee al 2,5%, su 90 giorni:

| Modello | Valore scambiato (USDC) | Perso in truffe | Compratori rimasti su 60 | Truffatori attivi | Fornitori onesti attivi |
| --- | --- | --- | --- | --- | --- |
| Paga prima (x402 senza protezione) | 47.449 | 8,3% | 5,5 | 52,2 | 62,0 |
| Escrow, senza cauzione | 84.086 | 1,1% | 48,0 | 52,8 | 55,0 |
| Escrow + cauzione 5 USDC | 85.981 | 1,0% | 49,1 | 9,2 | 50,4 |
| Escrow + cauzione 20 USDC | 84.162 | 0,9% | 48,5 | 5,4 | 43,4 |

L'escrow quasi raddoppia il valore scambiato perché i compratori restano. La cauzione da 5 USDC blocca la maggior parte dei truffatori; quella da 20 ne blocca qualcuno in più ma costa 7 fornitori onesti.

**Revisione gratuita.** Con la revisione restano attivi 50 fornitori onesti invece di 42. Il prezzo: le perdite dei compratori salgono da 0,7% a 1,0%, perché anche i truffatori hanno una seconda possibilità (9 attivi invece di 5). Riservarla a chi ha già 10 lavori riusciti abbassa le perdite allo 0,8% ma annulla il vantaggio sugli onesti: conviene darla a tutti.

**Chi incassa la cauzione persa.** Se metà andasse alla piattaforma, l'utile simulato (fee 2%, cauzione 20) salirebbe da 603 a 1.348 USDC al mese, ma il 54% dei ricavi verrebbe dal punire. È un ricavo che sparisce proprio quando il sistema funziona, e crea un incentivo a punire: escluso.

**Livello della fee** (utile mensile simulato in USDC, cauzione 5, revisione gratuita, 40% dei lavori da referral, senza netting):

| Fee | Utile al mese (USDC) | Lavori persi |
| --- | --- | --- |
| 0,5% | 114 | 0% |
| 1% | 254 | 0% |
| 2% | 509 | 14% |
| **2,5% (lancio)** | **632** | **18%** |
| 3% | 712 | 24% |
| 4% | 866 | 34% |
| 5% | 933 | 43% |
| 8% | 792 | 72% |

Il 5% è il massimo di breve periodo, ma dipende dall'ipotesi su quanto rischio percepiscono i compratori. Al lancio conta di più tenere i lavori, perché ogni lavoro aggiunge dati di reputazione. Con il 2,5% il margine è di circa 0,25 USDC a lavoro, già al netto di verifiche, referral e gas: servono circa 1.000 lavori completati al giorno per 7.600 USDC di utile al mese.

## Architettura tecnica

Otto componenti, quasi tutti su piani gratuiti: il costo cresce solo quando crescono i lavori, e ogni costo variabile è coperto dalla fee o dalla tassa di contestazione.

| Componente | Cosa fa | Tecnologia | Costo (stima) |
| --- | --- | --- | --- |
| Contratto escrow | Blocca i fondi, rilascia il pagamento, trattiene la fee, gestisce le cauzioni | Solidity su Base, il più piccolo possibile, su librerie già verificate (OpenZeppelin) | ~0,005 USDC per transazione, pagato dalla piattaforma |
| Server MCP + API | Unico ingresso per gli agenti: registrarsi, pubblicare, negoziare la scheda, prendere, consegnare, contestare | TypeScript su Cloudflare Workers | Piano gratuito all'inizio |
| Pagamenti x402 | Pagamenti e ricariche compatibili con lo standard | Libreria x402 open source | 0 |
| Verificatore | Controlla i criteri del lavoro: regole in codice, poi un modello AI economico | Regole + modello AI | ~0,003–0,03 USDC per controllo |
| Arbitro AI | Decide le contestazioni | Modello AI | ~0,03 USDC per contestazione, coperto dalla tassa (min. 0,25) |
| Registro reputazione | Storico di ogni agente | Postgres su piano gratuito (Supabase o Cloudflare D1) | 0 |
| Agenti fornitori tuoi | 10–20 agenti specializzati in marketing | Modello AI + prompt e dati tuoi | Pagati dai lavori che svolgono |
| Pannello proprietari | Ricarica, ritiro, saldo, storico: una pagina | Pagina statica | 0 |

Scelte per la facilità d'uso: un agente si collega con una sola chiamata al server MCP, non deve mai possedere ETH per il gas (lo paga la piattaforma) e riceve criteri di accettazione in un formato fisso.

Cosa **non** costruire, e perché:

- **Moneta o blockchain propria**: costi e licenze senza ricavi in più.
- **Netting** (un regolamento al giorno invece di uno per lavoro): nella simulazione fa risparmiare circa 16 USDC al mese. Si aggiunge oltre i 10.000 lavori al giorno.
- **Arbitrato umano**: l'arbitro AI basta per lavori da pochi dollari. Si aggiunge per i lavori grandi.
- **Vetrina o app per umani**: gli agenti trovano i servizi tramite i registri MCP e A2A.

## Costi e budget minimo

La fase 1 costa zero: si lavora su rete di test con moneta finta e piani gratuiti. Si spende solo quando la fase precedente ha raggiunto il suo obiettivo.

| Voce | Fase | Costo | Quando si spende |
| --- | --- | --- | --- |
| Server, database, rete di test | 1 | 0 (piani gratuiti) | Subito |
| Chiamate ai modelli AI per i tuoi agenti in test | 1 | Pochi USD al mese | Subito |
| Dominio | 2 | ~15 USD l'anno | Prima del lancio con soldi veri |
| Parere legale su VARA e Banca Centrale | 2 | Da preventivare: la voce più grande | Prima di toccare soldi veri |
| Revisione di sicurezza del contratto | 2 | Da preventivare: meno costa se il contratto è piccolo | Prima di toccare soldi veri |
| Cauzioni dei tuoi 20 agenti (5 USDC l'uno) | 2 | 100 USDC, recuperabili | Al lancio |
| Budget per comprare lavori di prova | 2 | 100–200 USDC | Al lancio |
| Gas sulla blockchain | 2 | Circa 30 USDC al mese a questa scala | Al lancio |
| Verifiche AI (controlli e revisioni) | 2 | Circa 30 USDC al mese a questa scala | Al lancio, coperte dalla fee |
| Licenza della società in free zone | 3 | Da preventivare | Quando ci sono ricavi |

I tuoi soldi a rischio prima dei primi ricavi: circa 300 USDC operativi, più parere legale e revisione del contratto. Chiedere due o tre preventivi per queste due voci è il primo compito della fase 2.

**Punto di pareggio.** Mesi per ripagare parere legale e revisione del contratto, con il margine simulato di circa 0,25 USDC a lavoro. I tre costi iniziali sono ipotesi da sostituire con i preventivi veri.

| Costo iniziale (legale + contratto) | A 100 lavori al giorno (~740 USDC/mese) | A 300 lavori al giorno (~2.260 USDC/mese) | A 1.000 lavori al giorno (~7.590 USDC/mese) |
| --- | --- | --- | --- |
| Basso: 3.000 USD | 4 mesi | 1,3 mesi | meno di 1 mese |
| Medio: 8.000 USD | 11 mesi | 3,5 mesi | 1,1 mesi |
| Alto: 15.000 USD | 20 mesi | 6,6 mesi | 2 mesi |

Il volume decide più del costo: arrivare a 300 lavori al giorno vale più che risparmiare sul preventivo.

## Roadmap

Si passa alla fase successiva solo quando la condizione è soddisfatta: così non si spende prima di avere la prova che serve. Le soglie sono obiettivi proposti, da correggere con i dati della fase 1.

| Fase | Periodo | Cosa | Condizione per passare alla successiva |
| --- | --- | --- | --- |
| 1 · Simulazione | mesi 0–2 | Escrow su rete di test, 3 agenti tuoi, 100 lavori di prova. Costo: 0 | Arbitro AI corretto ≥ 90%, parere legale positivo |
| 2 · Soldi veri | mesi 2–5 | USDC reali in piccole cifre, 20 agenti tuoi, primi 5 clienti. ~300 USDC + legale | 200 lavori al mese, contestazioni sotto il 5% |
| 3 · Apertura | mesi 5–12 | Fornitori esterni, test fee 2,5% → 3%, primo round o autofinanziamento | 1.000 lavori al giorno, clienti che tornano |
| 4 · Credito | dal mese 12 | Anticipi sullo storico, licenza ADGM o VARA, guadagno sui tassi | — |

## Come trovare i clienti

I clienti sono agenti, e gli agenti cercano i servizi da soli: quattro canali su sei funzionano senza venditori. Solo i primi 5 clienti costano qualche messaggio diretto.

| Priorità | Canale | Come funziona | Quando |
| --- | --- | --- | --- |
| 1 | Cataloghi per agenti | Ogni agente tuo pubblicato nel [Bazaar di x402](https://docs.x402.org/extensions/bazaar), su [Agentic.Market](https://www.coinbase.com/developer-platform/discover/launches/agentic-market) e nel registro ufficiale dei server MCP. Gli agenti li trovano e li pagano in automatico | Dalla fase 2, impostato una volta sola |
| 2 | Collegamento a Claude e ChatGPT | Un'agenzia collega il server MCP con un clic e ordina in chat ("30 varianti di copy per questa campagna"). Nessuna blockchain da capire | Dalla fase 2 |
| 3 | Referral automatico | Chi porta un agente riceve 0,5 punti di fee per 12 mesi. Gli utenti portano altri utenti | Dalla fase 3 |
| 4 | Sviluppatori di agenti | Fee allo 0% per i primi 3 mesi e integrazione in poche righe. Ogni fornitore porta i suoi clienti. Si trovano su GitHub, Discord e X | Dalla fase 3 |
| 5 | Contenuti | Raccontare il progetto mentre si costruisce, su LinkedIn e X: simulazione, numeri, primi lavori. Pubblicità solo quando si sa quanto vale un cliente | Da subito |
| 6 | Rete personale | Primi 5 clienti dalle agenzie e dalle persone del marketing che conosci, con un messaggio e una demo di 10 minuti | Da subito |

I canali 5 e 6 partono subito, mentre si costruisce la fase 1. I canali 1 e 2 sono quelli che scalano da soli.

## Rischi e ipotesi da verificare

Il rischio più grande è la verifica: se l'arbitro AI sbaglia spesso, la fiducia crolla e la fee non vale più nulla.

| Rischio o ipotesi | Valore usato nella simulazione | Come si verifica |
| --- | --- | --- |
| Quanto rischio percepiscono i compratori pagando direttamente | Tra 1% e 12% del valore | Test della fee al 2,5% e poi al 3% su clienti veri: quanti restano |
| Quota di lavori scadenti bloccati in automatico | 60% | Misurarla sui lavori dei tuoi agenti in fase 1 |
| Accuratezza dell'arbitro AI | 90% | 100 contestazioni di prova giudicate anche da te |
| Quota di truffatori tra i nuovi agenti | 15% | Registro degli agenti che perdono la cauzione |
| Valore medio di un lavoro | 8 USDC (mediana) | Prezzi reali dei primi 200 lavori |

Altri rischi:

- **I giganti aggiungono l'escrow** (Google, Coinbase, Stripe). Difesa: velocità nel verticale e neutralità, cioè funzionare con tutte le piattaforme.
- **Regolamentazione**: anche senza custodia, l'attività può rientrare nei servizi su asset virtuali. Va confermato con il parere legale prima della fase 2.
- **Contratto vulnerabile**: un errore nel codice può svuotare l'escrow. Difesa: contratto minimo, revisione esterna, limite massimo per lavoro (per esempio 100 USDC) nei primi mesi.
- **Agenti falsi per gonfiare la reputazione**: la cauzione e la fee rendono costoso scambiarsi lavori finti. Va monitorato chi lavora sempre con gli stessi pochi agenti.

## Prossimi passi

Il primo obiettivo su Claude Code è far girare l'escrow su rete di test con due agenti tuoi che si scambiano un lavoro vero.

Prima di scrivere codice:

- [x] Chiedere a 3–5 agenzie o persone del marketing se pagherebbero il 2,5% in più per un lavoro garantito con rimborso
- [x] Controllare il proprio contratto di lavoro sulle attività parallele
- [x] Chiedere 2–3 preventivi per il parere legale su VARA e aggiornare la tabella del punto di pareggio

Su Claude Code, fase 1:

- [ ] Creare le tre schede modello (copy per inserzioni, traduzioni, ricerca sui competitor) nel formato della sezione Criteri di accettazione
- [ ] Scrivere il contratto escrow minimo (blocca, rilascia, rimborsa, cauzione, fee, referral) con i test automatici
- [ ] Pubblicarlo sulla rete di test di Base (Base Sepolia) con moneta finta
- [ ] Costruire il server MCP con 6 azioni: registrati, pubblica, negozia, prendi, consegna, contesta
- [ ] Creare i primi 3 agenti fornitori, uno per scheda modello
- [ ] Far girare 100 lavori di prova e misurare blocchi automatici, revisioni riuscite, contestazioni e accuratezza dell'arbitro
- [ ] Aggiornare le ipotesi della simulazione (CONFIG in simulazione.py) con i valori misurati e rieseguirla

Il referral (codice alla registrazione, divisione della fee nel contratto) si costruisce insieme all'escrow: aggiungerlo dopo costerebbe una seconda revisione del contratto.
