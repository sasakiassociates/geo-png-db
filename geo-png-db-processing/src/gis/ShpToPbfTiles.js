var proj4 = require("proj4");
var ShapeFileLoader = require("./ShapeFileLoader");
var fs = require('fs');
const async = require('async');
const tilebelt = require("@mapbox/tilebelt");
const geobuf = require('geobuf');
var Pbf = require('pbf');
var PbfTiles = require('./PbfTiles');

/**
 * Creates a new instance of ShpToPbfTiles.
 * @class
 * @returns An instance of ShpToPbfTiles.
 * @example
 * var instance = new ShpToPbfTiles();
 */
class ShpToPbfTiles extends PbfTiles {

    constructor(outDir) {
        super(outDir);
    };

    toLatLon(projection, pair) {
        if (!projection) return pair;
        const id = pair.join('_');
        if (!this.memoize[id]) {
            this.memoize[id] = proj4(projection).inverse(pair);
        }
        return this.memoize[id];
    }

    processGeoJson(zip, tileZoom, callback) {
        this.shapeFileLoader = new ShapeFileLoader();
        const tileGroups = [];

        this.shapeFileLoader.load(zip, (shape) => {
            return this.convertGeometry(this.shapeFileLoader.projection, shape);
        }, (bbox) => {
            const bigTile = tilebelt.bboxToTile(bbox);
            const bigTileBounds = this.bboxToBounds(bbox);
            let zoomTiles;
            if (bigTile[2] === tileZoom) {
                zoomTiles = [bigTile];
            } else if (bigTile[2] > tileZoom) {
                zoomTiles = [this.getOuterTile(bigTile, tileZoom)];
            } else {
                zoomTiles = this.getInnerTiles(bigTile, tileZoom);
                zoomTiles = zoomTiles.filter((tile) => {
                    const bounds = this.bboxToBounds(tilebelt.tileToBBOX(tile));
                    return this.intersectsBounds(bounds, bigTileBounds);
                });
            }

            console.log(`# zoom tiles : ${zoomTiles.length}`);
            zoomTiles.forEach((tile, i) => {
                let tileBounds = this.bboxToBounds(tilebelt.tileToBBOX(tile));
                tileGroups.push({
                    tile: tile,
                    bounds: tileBounds,
                    boundsTest: (shapeBounds) => {
                        return this.intersectsBounds(shapeBounds, tileBounds);
                    }
                });
            });
        }, tileGroups, () => {
            const calls = [];
            tileGroups.forEach((tileGroup, i) => {
                calls.push((done) => {
                    if (!tileGroup.geoJson) {
                        done();
                        return;
                    }
                    if (tileGroup.geoJson.features.length > 0) {
                        var buffer = geobuf.encode(tileGroup.geoJson, new Pbf());
                        const filePath = `${this.outDir}/${tileGroup.tile.join('_')}.proto`;
                        // console.log(buffer.length);
                        fs.writeFile(filePath, buffer, () => {
                            console.log(`SAVED ${filePath}`);
                            done();
                        });
                    }
                });
            });
            async.parallelLimit(calls, 4, function () {
                console.log('ALL SAVED');
                callback();
            });
        });


    }
}

module.exports = ShpToPbfTiles;
