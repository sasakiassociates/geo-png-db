const RasterTileSet = require('../RasterTileSet');

const rasterTileSet = new RasterTileSet();

const colors = [];

for (let i = 0; i < 64000; i++) {
    const color = rasterTileSet.nextColor();
    if (colors.indexOf(color) >= 0) {
        throw 'DUPLICATE ' + color;
    }
    if (!/^#[0-9A-F]{6}$/i.test(color)) {
        throw 'INVALID ' + color;
    }
    colors.push(color);
}
console.log(colors);
