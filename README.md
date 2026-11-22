# Forma

App per iPhone (PWA) per alimentazione e palestra: calorie e macro del giorno, pasti salvati, peso con grafico e un registro allenamenti con timer di recupero.

- **Oggi**: diario con pranzo, merenda, cena e pre nanna. Alimenti da Open Food Facts (ricerca per nome e codice a barre), alimenti di base con valori medi, alimenti a mano. "Come ieri" e pasti salvati per fare prima.
- **Piano alimentare** (`plan.js`): giorni di allenamento, riposo e ricarica scelti ogni giorno, con obiettivi diversi; pasti del piano che riempiono il diario; tasto Sostituisci che propone alternative e ricalcola i grammi per avere calorie e macro uguali; ricarica ogni 2-4 settimane compensata nella settimana; acqua; consigli dal ritmo del peso.
- **Peso**: pesate, media a 7 giorni, ritmo settimanale, peso obiettivo con stima dei tempi.
- **Palestra** (`gym.js`): split con un gruppo muscolare per sessione (petto, schiena, gambe, spalle, braccia), prossimo gruppo e giorni di recupero; schede modificabili con superserie; sessione a tempo con orario di fine (05:45), stima di quando chiudi e avviso se sfori; recupero per blocco (1:30-2:30); carichi dell'ultima volta e suggerimento di quando salire di peso; scheda di ogni esercizio con muscoli ed esecuzione.
- **Metodo** (`coach.js`): ciclo di 4-6 settimane (base, carico, intenso, picco, scarico) con RIR e tempo di esecuzione, scarico allineato alla ricarica alimentare, varianti alternate sui principali, riscaldamento a rampa, record (massimale stimato) con grafici, serie settimanali per gruppo, avvisi su stalli e recupero.
- **Animazioni** (`anim.js`): figura a linee per ogni esercizio, offline.
- **Profilo**: dati, obiettivo del periodo (dimagrire, mantenere, massa), calorie e macro calcolate (Mifflin-St Jeor) e personalizzabili, tema, backup JSON.

I dati restano sul telefono (localStorage). Nessuna build: file statici pubblicati con GitHub Pages da `main`.

**Regola di rilascio**: a ogni modifica di un file dell'app cambia `VERSION` in `sw.js`, altrimenti i telefoni tengono la versione vecchia.

Per installarla su iPhone: apri il sito in Safari, Condividi › Aggiungi a Home.
