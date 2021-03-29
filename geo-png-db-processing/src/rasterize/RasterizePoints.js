const fs = require('fs');
const os = require('os');
const Jimp = require('jimp');
const PbfTiles = require('../gis/PbfTiles');
const PngDbEncodings = require('../encodings/PngDbEncodings');
const TileEncodings = require('../../modules/encodings/TileEncodings');
const Utils = require("../Utils");
const pointsWithinPolygon = require('@turf/points-within-polygon').default;

/**
 * Creates a new instance of RasterizePoints.
 * @class
 * @returns An instance of RasterizePoints.
 * @example
 * var instance = new RasterizePoints();
 */
class RasterizePoints {

    constructor(saveWithWorldFile, filer) {
        this.pbfTiles = new PbfTiles();
        this.filer = filer;
        this.pixelCounts = {};
        this.saveWithWorldFile = saveWithWorldFile;
    }

    saveMetaData(filePath, callback) {
        const pixels = this.pixelCounts;
        this.filer.writeFile(filePath, JSON.stringify(pixels, null, 2), function (err) {
            if (err) {
                throw err;
            } else {
                // console.log('Saved ' + filePath);
            }
            callback({pixelCounts: pixels})
        });
    }

    static getTiles(features) {
        console.log('Calculating Tiles from Features');
        const tiles = {};
        features.forEach((feature, i) => {
            const point = feature.geometry.coordinates;
            const tile = Utils.latLonToTile(point[1], point[0], 13);
            const tileId = tile.join('_');
            if (!tiles[tileId]) {
                tiles[tileId] = {tile: tile, features: []};
            }
            if (tile[0] < 2000) {
                console.log(JSON.stringify(feature));
                return;
            }
            tiles[tileId].features.push(feature);
            if (i % 1000 === 0) {
                console.log(Math.round(1000 * i / features.length) / 10 + '%');
            }
        });
        return Object.keys(tiles).map((k) => tiles[k]);
    }

    rasterizeFeatures(features, tile, field, getValue, callback) {
        this.tile = tile;
        const tileZoom = tile[2];

        const setColor = (bitmap, idx, colorHex) => {
            if (!this.colorCache) {
                this.colorCache = {};
            }
            if (!this.colorCache[colorHex]) {
                this.colorCache[colorHex] = Utils.hexToRgb(colorHex);
            }
            const color = this.colorCache[colorHex];
            bitmap.data[idx + 0] = color.r;
            bitmap.data[idx + 1] = color.g;
            bitmap.data[idx + 2] = color.b;
            bitmap.data[idx + 3] = 255;
        };

        const getPos = (p) => {
            const tileX = Utils.long2tile(p[0], tileZoom);
            const tileY = Utils.lat2tile(p[1], tileZoom);
            return [
                Math.round(256 * (tileX - tile[0])),
                Math.round(256 * (tileY - tile[1])),
            ];
        };

        const featuresByXY = {};
        features.forEach((feature, i) => {
            const p = getPos(feature.geometry.coordinates);
            let id = p.join('_');
            if (!featuresByXY[id]) {
                featuresByXY[id] = [];
            }
            featuresByXY[id].push(feature);
        });

        const width = 256;
        const height = 256;
        const tileOffsets = TileEncodings.calcOffsetTiles(field.arrayCount || 1);
        new Jimp(width * tileOffsets.width, height * tileOffsets.height, (err, image) => {
            this.image = image;
            console.time('rasterizeFeatures');
            image.scan(0, 0, width, height, function (x, y, idx) {
                const id = x + '_' + y;
                const features = featuresByXY[id];
                if (features && features.length > 0) {
                    let valuesArr = getValue(features);
                    tileOffsets.offsets.forEach((xy, i) => {
                        if (valuesArr[i] > 0) {
                            const valPerPx = valuesArr[i];
                            let pX = xy[0] * width + x;
                            let pY = xy[1] * height + y;
                            PngDbEncodings.setPixel(field, image, pX, pY, valPerPx);
                        }
                    });
                }
            });
            callback();
            console.timeEnd('rasterizeFeatures');
        });
    }

    save(path, callback) {
        this.filer.saveImage(path, this.image, () => {
            console.log('Wrote ' + path);
            if (this.saveWithWorldFile) {
                this.saveWorldFile(path, callback);
            } else {
                if (callback) callback();
            }
        });
    }

    saveWorldFile(path, callback) {
        const {tile} = this;
        const latLonTL = Utils.toLatLon(tile, 0, 0);
        const latLonBR = Utils.toLatLon(tile, 1, 1);
        const xSize = (latLonBR.x - latLonTL.x) / 256;
        const ySize = (latLonBR.y - latLonTL.y) / 256;
        const params = [xSize, 0, 0, ySize, latLonTL.x + xSize / 2, latLonTL.y + ySize / 2];
        const pgwFile = path.replace('.png', '.pgw');
        this.filer.writeFile(pgwFile, params.join(os.EOL), function (err) {
            if (err) {
                throw err;
            } else {
                console.log('Saved ' + pgwFile);
                if (callback) callback();
            }
        });
    }
}

module.exports = RasterizePoints;
