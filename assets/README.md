# Peek icon

`peek.svg` is the Glance master, selected from the icon studies. Chrome uses the checked-in PNGs in `../icons/`. The normal build copies those PNGs and does not require SVG rendering tools.

To regenerate after editing the SVG, install librsvg and run from the repository root:

```sh
for size in 16 32 48; do
  rsvg-convert -w "$size" -h "$size" assets/peek.svg -o "icons/peek-$size.png"
done
# Chrome Web Store requests96px artwork with16px transparent padding.
rsvg-convert -w 96 -h 96 --page-width 128 --page-height 128 --left 16 --top 16 assets/peek.svg -o icons/peek-128.png
```
