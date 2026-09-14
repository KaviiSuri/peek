# Peek icon

`peek.svg` is the Glance master, selected from the icon studies. Chrome uses the checked-in PNGs in `../icons/`. The normal build copies those PNGs and does not require SVG rendering tools.

To regenerate after editing the SVG, install librsvg and run from the repository root:

```sh
for size in 16 32 48 128; do
  rsvg-convert -w "$size" -h "$size" assets/peek.svg -o "icons/peek-$size.png"
done
```
