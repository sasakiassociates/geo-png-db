/**
 * Creates a new instance of StatusTiles.
 * @class
 * @returns An instance of StatusTiles.
 * @example
 * var instance = new StatusTiles();
 */
const TileRenderer = require('./TileRenderer');

class StatusTiles extends TileRenderer{

    constructor(saveWithWorldFile, filer, tile) {
        super(saveWithWorldFile, filer);
        this.tile = tile;
    }
}

module.exports = StatusTiles;