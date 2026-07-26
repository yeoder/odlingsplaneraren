# 🌱 Odlingsplaneraren

Ett webbprogram för att planera sin köksträdgård: rita upp odlingen i verkliga mått,
placera odlingsboxar och plantrader med korrekta växtavstånd, få varningar om trängsel,
dåliga grannar och skugga — och ett årsschema för sådd, utplantering och skörd.

**Ingen AI, ingen server, inga konton.** Din trädgård sparas i din egen webbläsare.

👉 **Live:** https://yeoder.github.io/odlingsplaneraren/

## Status
Under utveckling — se [PLAN.md](PLAN.md) för grundplan och milstolpar.
En tidig prototyp (ren HTML) finns i [prototype/](prototype/).

## Utveckling
```bash
npm install
npm run dev      # dev-server på http://localhost:5173
npm run build    # produktionsbygge till dist/
```

Teknik: Svelte + TypeScript + Vite, Konva.js för ritytan. Deploy till GitHub Pages sker
automatiskt vid push till `main`.
