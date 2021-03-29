const RasterTileSet = require('../../src/rasterize/RasterTileSet');
const NodeFiler = require('../../src/filer/NodeFiler');
const filer = new NodeFiler();

process.on('message', (data) => {
    const rasterTileSet = new RasterTileSet(filer, data.pbfDir, true);
    rasterTileSet.rasterizeTile(data.tile, false, () => {
    }, () => {
        process.send({success: true});
    });
});
