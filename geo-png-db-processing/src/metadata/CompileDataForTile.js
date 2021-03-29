const async = require('async');
const PbfTiles = require('../gis/PbfTiles');
const Utils = require('../Utils');
const KeySumStore = require('./KeySumStore');
const pbfTiles = new PbfTiles();

/**
 * Creates a new instance of CompileDataForTile.
 * @class
 * @returns An instance of CompileDataForTile.
 * @example
 * var compileData = new CompileDataForTile(filer, tileDir, spannerDir);
 * compileData.deriveTotalPixels();
 */
class CompileDataForTile {

    constructor(filer, tileDir, spannerDir, tile, table) {
        this.filer = filer;
        this.tileDir = tileDir;
        this.spannerDir = spannerDir;
        this.tile = tile;
        this.keySumStore = new KeySumStore(table);
    };

    updateCount(blockId, value, tile, callback) {
        this.keySumStore.add(blockId, value, tile[0] + '_' + tile[1], callback);
    }

    processZ11Tile(tile, callback) {//meta/json/census-blocks/spans/11/100_451_11.json
        const {filer, tileDir, spannerDir} = this;
        //NOTE: tileDir is only partially processed, some tiles may not be present
        const file = tile.join('_') + '.json';
        filer.readFile(`${tileDir}${file}`, (err, data) => {
            if (err) {
                callback();
                return;
            }
            let colorLookup = JSON.parse(data);
            filer.readFile(`${spannerDir}${file}`, (err, data) => {
                if (err) {
                    callback();
                    return;
                }
                const calls = [];
                let spannerIds = JSON.parse(data);
                spannerIds.forEach((id, i) => {
                    if (colorLookup[id]) {
                        calls.push((done) => {
                            this.updateCount(id, colorLookup[id].pixelCounts, tile, done);
                        });
                    }
                });
                async.parallelLimit(calls, 4, () => {
                    // console.log('Z11 DONE ' + tile.join('_'));
                    callback('Updates: ' + calls.length);
                });
            });
        });
    }

    deriveTotalPixels(callback) {
        const zoomTiles = pbfTiles.getInnerTiles(this.tile, 11);
        const calls = [];
        let tileId = this.tile.join('_');

        const infos = [];
        infos.push(tileId);
        zoomTiles.forEach((tile, i) => {
            calls.push((done) => {
                this.processZ11Tile(tile, (info) => {
                    infos.push(info);
                    done();
                });
            })
        });

        async.parallelLimit(calls, 4, () => {
            callback(infos.join('|'));
        });
    }

}

module.exports = CompileDataForTile;