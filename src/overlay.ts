import { installPaletteRuntime } from "./palette";
import { createIframePaletteController } from "./iframe-palette";

installPaletteRuntime(undefined, undefined, true, createIframePaletteController);
