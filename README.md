# Monark Lens — source v2

Repo source canonique de l'extension Chrome **Monark Lens** (réécriture v2, TypeScript strict + Vite, Manifest V3).

La source v1 ayant été perdue, le dist v1.7.39 — **non minifié, entièrement lisible** — est committé dans `legacy/v1-dist/` comme **référence ligne-à-ligne**. Il n'est jamais buildé ni shippé. `legacy/build.sh` + `legacy/publish.sh` documentent le pipeline de packaging/publication v1 (zip → `/var/www/monark-builds/`).

## Commandes

```bash
bun install        # dépendances (ou: npm install)
bun run build      # type-check (tsc --noEmit) + build Vite non-minifié → dist/
bun run dev        # build en watch
bun run zip        # package dist/ en monark-lens-v<version>.zip
```

## Layout de sortie (reproduit le v1)

`dist/{manifest.json, content/main.js, background/service-worker.js, popup/popup.{html,js,css}, assets/, chunks/}`. Le content script reste auto-suffisant (script classique MV3, pas de module) ; service-worker et popup sont des modules ES.
