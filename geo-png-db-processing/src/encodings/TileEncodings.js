const Jimp = require('jimp');
const PngDbEncodings = require('./PngDbEncodings');
const Utils = require("../Utils");

/**
 * Creates a new instance of TileEncodings.
 * @class
 * @returns An instance of TileEncodings.
 * @example
 * var instance = new TileEncodings();
 */
class TileEncodings {

    constructor(filer, pixelLookup, valuesById, pixelCounts, field) {
        this.filer = filer;
        this.pixelLookup = pixelLookup;
        this.valuesById = valuesById;
        this.pixelCounts = pixelCounts;
        this.field = field//TODO use variable precision
    };

    static calcOffsetTiles(num) {
        let w, h;
        if (num === 1) {
            w = 1;
            h = 1;
        } else if (num <= 4) {
            w = 2;
            h = 2;
        } else if (num <= 16) {
            w = 4;
            h = 4;
        } else if (num <= 64) {
            w = 8;
            h = 8;
        } else {
            throw 'No support for arrays longer than 64 elements';
        }
        const offsets = [];
        for (let y = 0; y < h; y++) {//scan across then down (same as pixel order)
            for (let x = 0; x < w; x++) {
                if (offsets.length < num) {
                    offsets.push([x, y]);
                }
            }
        }
        return {
            width: w,
            height: h,
            offsets: offsets
        };

    };

    processTile(file, outDir, z, x, y, callback, errback) {
        this.filer.readImage(file, (err, tile) => {
            if (err) {
                if (errback) {
                    errback(err);
                    return;
                } else {
                    throw err;
                }
            }

            const tileOffsets = TileEncodings.calcOffsetTiles(this.field.arrayCount || 1);

            new Jimp(tile.bitmap.width * tileOffsets.width, tile.bitmap.height * tileOffsets.height, (err, image) => {
                tile.scan(0, 0, tile.bitmap.width, tile.bitmap.height, (x, y, idx) => {
                    // noinspection PointlessArithmeticExpressionJS
                    const red = tile.bitmap.data[idx + 0];
                    const green = tile.bitmap.data[idx + 1];
                    const blue = tile.bitmap.data[idx + 2];
                    // var alpha = tile.bitmap.data[ idx + 3 ];

                    const color = PngDbEncodings.rgbToHex(red, green, blue).toLowerCase();
                    const gisJoin = this.pixelLookup[color];
                    if (this.valuesById[gisJoin]) {
                        let pixelCount = this.pixelCounts[color];
                        if (pixelCount.count > 0) {
                            const vals = this.valuesById[gisJoin];
                            tileOffsets.offsets.forEach((xy, i) => {
                                if (vals[i] > 0) {
                                    const valPerPx = vals[i] / pixelCount.count;
                                    let pX = xy[0] * tile.bitmap.width + x;
                                    let pY = xy[1] * tile.bitmap.height + y;
                                    PngDbEncodings.setPixel(this.field, image, pX, pY, valPerPx);
                                }
                            });
                        }
                    }
                });

                const dir = `${outDir}${this.field.name}/${z}/${x}`;
                this.filer.ensureDir(dir, () => {
                    let outFile = `${dir}/${y}.png`;
                    this.filer.saveImage(outFile, image, (err) => {
                        if (callback) callback(outFile);
                    });
                });
            });

        });
    };
}

module.exports = TileEncodings;
