import "./styles.css";
import { Game } from "./game/game";

const canvas = document.querySelector<HTMLCanvasElement>("#game");
const status = document.querySelector<HTMLElement>("#status");

if (!canvas) {
  throw new Error("Game canvas is missing");
}

const game = new Game(canvas, status ?? undefined);
void game.boot();
