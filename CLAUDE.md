# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Asteroids clone built with plain HTML5 Canvas and vanilla JavaScript (ES6+). No dependencies, no bundler, no build step, no tests. The entire game logic lives in a single file, `game.js`, loaded directly by `index.html`.

## Running the game

Open `index.html` directly in a browser, or serve it locally:

```bash
npx serve .
```

There is no build, lint, or test tooling in this repo — changes to `game.js` or `index.html` take effect on page reload.

## Architecture

Everything is in `game.js`, structured as a set of small classes plus a global mutable game state, run through a single `requestAnimationFrame` loop:

- **Entities** (`Bullet`, `Asteroid`, `Ship`, `Particle`): each has its own `update(dt)` and `draw()` method. Positions wrap toroidally around the canvas via the `wrap()` util (space has no edges).
- **Global mutable state**: `ship`, `bullets`, `asteroids`, `particles`, `score`, `lives`, `level`, `state` (`'playing' | 'dead' | 'gameover'`) are module-level `let` bindings reassigned by `initGame()` / `nextLevel()`, not encapsulated in a class or store.
- **Game loop**: `loop(ts)` computes `dt` (clamped to 0.05s), calls `update(dt)` then `draw()`, and re-schedules itself via `requestAnimationFrame`.
- **`update(dt)`**: branches on `state` first (handles `gameover`/`dead` pauses and respawn timers), then otherwise advances all entities, does bullet-vs-asteroid and ship-vs-asteroid collision checks (simple distance-based circle collision), splits destroyed asteroids via `Asteroid.split()`, and calls `nextLevel()` when `asteroids.length === 0`.
- **`draw()`**: clears the canvas and renders particles → asteroids → bullets → ship → HUD, in that z-order, plus a game-over overlay when applicable.
- **Input**: raw keydown/keyup state is tracked in `keys` (held) and `justPressed` (edge-triggered, consumed via `pressed(code)`) — used for shooting and restart so a single keypress fires once.

Sizing/tuning constants (asteroid radii/speeds/points per size, ship thrust/rotation/drag, bullet speed) are defined as local consts near their relevant class or function rather than centralized.

Canvas is a fixed 800×600 (`W`, `H` constants); there is no responsive resizing.
