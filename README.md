# Forma

App per iPhone (PWA) per alimentazione e palestra: calorie e macro del giorno, pasti salvati, peso con grafico e un registro allenamenti con timer di recupero.

- **Oggi**: diario con colazione, pranzo, cena e spuntini. Alimenti da Open Food Facts (ricerca per nome e codice a barre), alimenti di base con valori medi, alimenti a mano. "Come ieri" e pasti salvati per fare prima.
- **Peso**: pesate, media a 7 giorni, ritmo settimanale, peso obiettivo con stima dei tempi.
- **Palestra**: esercizi, serie, kg e ripetizioni con i valori dell'ultima volta; il recupero parte quando segni una serie.
- **Profilo**: dati, obiettivo del periodo (dimagrire, mantenere, massa), calorie e macro calcolate (Mifflin-St Jeor) e personalizzabili, tema, backup JSON.

I dati restano sul telefono (localStorage). Nessuna build: file statici pubblicati con GitHub Pages da `main`.

**Regola di rilascio**: a ogni modifica di un file dell'app cambia `VERSION` in `sw.js`, altrimenti i telefoni tengono la versione vecchia.

Per installarla su iPhone: apri il sito in Safari, Condividi › Aggiungi a Home.
