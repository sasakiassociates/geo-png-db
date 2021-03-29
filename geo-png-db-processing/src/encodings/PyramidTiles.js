const fs = require('fs');
const async = require('async');
const Jimp = require('jimp');
const PngDbEncodings = require('./PngDbEncodings');
const Utils = require("../Utils");
const TileEncodings = require("./TileEncodings");

/**
 * Creates a new instance of PyramidTiles.
 * @class
 * @returns An instance of PyramidTiles.
 * @example
 * var instance = new PyramidTiles();
 */
class PyramidTiles {

    constructor(filer, zoom = 13, steps = 4, outDir = './data/', field) {
        this.filer = filer;
        this.tileSize = 256;
        this.zoom = zoom;
        this.steps = steps;
        this.outDir = outDir;
        this.field = field || {precision: 1000, name: 'TODO'};
        this.field.arrayCount = this.field.keys ? this.field.keys.length : 1;
        this.field.basePrecision = this.field.precision;//used for variablePrecision

        this.overwrite = true;
        this.useWalkFilesMethod = false;
    }

    getValueSums(tile) {
        const {steps, field} = this;

        const sums = {};
        for (let i = 0; i < steps; i++) {
            sums[i] = {};
        }
        tile.scan(0, 0, tile.bitmap.width, tile.bitmap.height, (x, y, idx) => {
            // x, y is the position of this pixel on the image (starting at 0)
            // idx is the position start position of this rgba tuple in the bitmap Buffer
            // this is the image

            // noinspection PointlessArithmeticExpressionJS
            const red = tile.bitmap.data[idx + 0];
            const green = tile.bitmap.data[idx + 1];
            const blue = tile.bitmap.data[idx + 2];
            const alpha = tile.bitmap.data[idx + 3];

            const val = PngDbEncodings.valFromPixel({precision:field.basePrecision}, red, green, blue, alpha);
            if (val > 0) {
                let px4 = x;
                let py4 = y;
                for (let i = 0; i < steps; i++) {
                    px4 = Math.floor(px4 / 2);
                    py4 = Math.floor(py4 / 2);
                    let pos = px4 + '_' + py4;
                    if (!sums[i][pos]) sums[i][pos] = 0;
                    sums[i][pos] += val;
                }
            }
        });
        return sums;
    }

    getValueByMax(tile) {
        const {steps, zoom, outDir, field, overwrite} = this;

        const max = {};
        for (let i = 0; i < steps; i++) {
            max[i] = {};
        }

        tile.scan(0, 0, tile.bitmap.width, tile.bitmap.height, (x, y, idx) => {
            // x, y is the position of this pixel on the image (starting at 0)
            // idx is the position start position of this rgba tuple in the bitmap Buffer
            // this is the image

            // noinspection PointlessArithmeticExpressionJS
            const red = tile.bitmap.data[idx + 0];
            const green = tile.bitmap.data[idx + 1];
            const blue = tile.bitmap.data[idx + 2];
            const alpha = tile.bitmap.data[idx + 3];

            const rgbStr = `${red}_${green}_${blue}`;
            if (alpha > 0) {
                let px4 = x;
                let py4 = y;
                for (let i = 0; i < steps; i++) {//steps = 1 per zoom level change
                    px4 = Math.floor(px4 / 2);
                    py4 = Math.floor(py4 / 2);
                    let pos = px4 + '_' + py4;
                    if (!max[i][pos]) {
                        max[i][pos] = {counts: {}, max: 0, hex: 0};
                    }
                    if (!max[i][pos].counts[rgbStr]) max[i][pos].counts[rgbStr] = 0;
                    max[i][pos].counts[rgbStr]++;
                    if (max[i][pos].counts[rgbStr] > max[i][pos].max) {
                        max[i][pos].max = max[i][pos].counts[rgbStr];
                        max[i][pos].hex = Jimp.rgbaToInt(red, green, blue, alpha);
                    }
                }
            }
        });
        return max;
    }

    makePyramidTiles(dirName, file, tz, tx, ty, callback) {
        const {steps, zoom, outDir, field, overwrite} = this;
        this.filer.readImage(file, (err, tile) => {
            if (err) throw err;

            let values;
            if (this.field.categorical) {
                values = this.getValueByMax(tile);
            } else {
                values = this.getValueSums(tile);
            }

            let pWidth4 = tile.bitmap.width;
            let pHeight4 = tile.bitmap.height;

            let tileNum = 1;
            let precision = field.basePrecision;
            const calls = [];

            const addJob = (dir, outFile, width, height, values, precision) => {
                calls.push((done) => {
                    new Jimp(width, height, (err, image) => {
                        for (let y = 0; y < height; y++) {
                            for (let x = 0; x < width; x++) {
                                let val = values[x + '_' + y];
                                if (field.categorical) {
                                    if (val && val.hex) {
                                        image.setPixelColor(val.hex, x, y);
                                    }
                                } else {
                                    if (val > 0) {
                                        PngDbEncodings.setPixel({precision:precision}, image, x, y, val);
                                    }
                                }
                            }
                        }

                        this.filer.ensureDir(dir, () => {
                            // console.log(`Writing : ${dir}/${pos.x}_${pos.y}.png`);
                            // done();
                            this.filer.saveImage(outFile, image, (err) => {
                                done();
                            });
                        });
                    });
                });
            };
            for (let i = 0; i < steps; i++) {
                tileNum *= 2;
                precision /= field.variablePrecision;
                pWidth4 = pWidth4 / 2;
                pHeight4 = pHeight4 / 2;

                const z = zoom - (i + 1);
                const ox = Math.floor(tx / tileNum);
                const oy = Math.floor(ty / tileNum);

                let dir = dirName ? `${outDir}${dirName}/` : outDir;
                dir = `${dir}${z}/${ox}/${oy}`;
                const pos = {
                    x: tx - ox * tileNum,
                    y: ty - oy * tileNum,
                };
                let outFile = `${dir}/${pos.x}_${pos.y}.png`;

                if (overwrite || !fs.existsSync(outFile)) {//NOTE: only supported for NodeFiler - S3 should always use overwrite
                    // console.log(pWidth4, tileNum, precision);
                    addJob(dir, outFile, pWidth4, pHeight4, values[i], precision);
                }
            }

            if (calls.length === 0) {
                if (callback) callback();
            } else {
                async.parallelLimit(calls, 8, function () {
                    // console.log(`DONE ${tx} ${ty}`);
                    if (callback) callback();
                });
            }


        });

    };

    processImageFiles(dir, filter, fn, callback) {
        //NOTE this is a bit of a mess dealing with Node and S3 filers based on how each reads recursively
        //for now useWalkFilesMethod should be used if specifying NodeFiler, but we should find a more elegant solution
        if (!this.useWalkFilesMethod) {
            this.filer.readdir(`${dir}/${this.zoom}`, (err, files) => {
                const num = files.length;
                let cnt = 0;
                const calls = [];
                files.forEach((file, i) => {
                    calls.push((done) => {
                        const filePath = `${dir}/${this.zoom}/${file}`;
                        const tile_addr_bits = filePath.split('/');
                        let fileNameArr = tile_addr_bits.pop().split('.');
                        const tile_addr_y = fileNameArr[0];
                        const ext = fileNameArr[fileNameArr.length - 1];
                        if (ext !== 'png') {
                            setTimeout(done, 10);
                            return;
                        }
                        const tile_addr_x = tile_addr_bits.pop();
                        const zoomDir = tile_addr_bits.pop();
                        if (zoomDir !== '' + this.zoom) {
                            // console.log('Skipping: ' + file.fullName);
                            setTimeout(done, 10);
                            return;
                        }
                        if (filter && !filter(+tile_addr_x, +tile_addr_y)) {
                            console.log('Skipping: ' + file);
                            setTimeout(done, 10);
                            return;
                        }

                        const dirName = this.field.name;// tile_addr_bits.pop();
                        fn(dirName, filePath, +tile_addr_x, +tile_addr_y, ()=> {
                            cnt++;
                            console.log(`${cnt}/${num} ${Math.round(1000 * cnt / num) / 10}%`);
                            done();
                        });
                    });
                });

                async.parallelLimit(calls, 8, function () {
                    // console.log(`DONE ${tx} ${ty}`);
                    if (callback) callback();
                });
            });
        } else {
            Utils.walkFiles(`${dir}/${this.zoom}`, true, (file, done, cnt, num) => {
                if (file.extension !== '.png') {
                    setTimeout(done, 10);
                    return;
                }

                const filePath = file.fullName;
                const tile_addr_bits = filePath.split('\\');
                let fileNameArr = tile_addr_bits.pop().split('.');
                const ext = fileNameArr[fileNameArr.length - 1];
                const tile_addr_x = tile_addr_bits.pop();
                const tile_addr_y = fileNameArr[0];
                const zoomDir = tile_addr_bits.pop();
                if (zoomDir !== '' + this.zoom) {
                    // console.log('Skipping: ' + file.fullName);
                    setTimeout(done, 10);
                    return;
                }
                if (filter && !filter(+tile_addr_x, +tile_addr_y)) {
                    console.log('Skipping: ' + file);
                    setTimeout(done, 10);
                    return;
                }
                const dirName = this.field.name;
                fn(dirName, filePath, +tile_addr_x, +tile_addr_y, ()=> {
                    console.log(`${cnt}/${num} ${Math.round(1000 * cnt / num) / 10}%`);
                    done();
                });
            }, 8).then(()=> {
                if (callback) callback();
            });
        }
    }

    processDir(dir, callback, filter) {
        // console.log('Process tile ' + file.fullName);
        this.processImageFiles(dir, filter, (dirName, filePath, tile_addr_x, tile_addr_y, done) => {
            this.makePyramidTiles(dirName, filePath, this.zoom, +tile_addr_x, +tile_addr_y, () => {
                done();
            });
        }, ()=> {
            if (callback) callback();
        });
    }

    findPyramidTiles(tilesToGenerate, dirName, file, tz, tx, ty, callback) {
        const {zoom, tileSize, steps, outDir} = this;

        let tileNumCounter = 1;
        for (let i = 0; i < steps; i++) {
            tileNumCounter *= 2;
            const tileNum = tileNumCounter;
            const miniTileSize = tileSize / tileNum;
            const z = zoom - (i + 1);
            const ox = Math.floor(tx / tileNum);
            const oy = Math.floor(ty / tileNum);

            const pDir = dirName ? `${outDir}${dirName}/` : outDir;

            const dir = `${pDir}${z}/${ox}/${oy}`;

            if (!tilesToGenerate[dir]) {
                tilesToGenerate[dir] = {
                    fileName: `${dir}.png`,
                    z: z,
                    x: ox,
                    y: oy,
                    num: tileNum,
                    size: miniTileSize,
                    tiles: []
                };
                for (let x = 0; x < tileNum; x++) {
                    for (let y = 0; y < tileNum; y++) {
                        tilesToGenerate[dir].tiles.push({x: x, y: y, file: `${dir}/${x}_${y}.png`});
                    }
                }
            }
        }
        if (callback) callback();

    };

    makeTile(tileData, allCalls) {
        const {zoom, tileSize, filer} = this;

        let missingImageCounter = 0;
        allCalls.push((done) => {
            const tileOffsets = TileEncodings.calcOffsetTiles(this.field.arrayCount || 1);
            new Jimp(tileSize * tileOffsets.width, tileSize * tileOffsets.height, (err, image) => {
                const calls = [];

                tileData.tiles.forEach((tile, i) => {
                    calls.push((done) => {
                        // console.log(tile.x + ',' + tile.y);
                        filer.readImage(tile.file, function (err, mini) {
                            if (err) {
                                if (err.code === 'ENOENT' || err.code === 'NoSuchKey') {
                                    missingImageCounter++;
                                } else {
                                    console.log(err);
                                }
                            } else {
                                tileOffsets.offsets.forEach((xy, i) => {
                                    const miniSlice = {
                                        width: mini.bitmap.width / tileOffsets.width,
                                        height: mini.bitmap.height / tileOffsets.height,
                                    };
                                    const srcX = xy[0] * miniSlice.width;
                                    const srcY = xy[1] * miniSlice.height;
                                    const srcW = miniSlice.width;
                                    const srcH = miniSlice.height;
                                    let x = miniSlice.width * tile.x + xy[0] * miniSlice.width * tileData.num;
                                    let y = miniSlice.height * tile.y + xy[1] * miniSlice.height * tileData.num;

                                    // console.log(`tile:${tile.x},${tile.y}; offset:${xy.join(',')}; blit@:${x},${y}`);

                                    image.blit(mini, x, y, srcX, srcY, srcW, srcH);
                                });
                            }
                            done();
                        });
                    });
                });

                async.parallelLimit(calls, 8, function () {
                    filer.saveImage(`${tileData.fileName}`, image, function () {
                        console.log(`Wrote ${tileData.fileName}, missing ${missingImageCounter}`);
                        done();
                    });
                });
            });

        });

    };

    stitchMiniTiles(dir, filter) {
        const {zoom, outDir} = this;
        const tilesToGenerate = {};

        this.processImageFiles(dir, filter, (dirName, filePath, tile_addr_x, tile_addr_y, done) => {
            this.findPyramidTiles(tilesToGenerate, dirName, filePath, zoom, +tile_addr_x, +tile_addr_y, () => {
                done();
            });
        }, ()=> {
            const allCalls = [];
            Object.keys(tilesToGenerate).forEach((k) => {
                this.makeTile(tilesToGenerate[k], allCalls);
            });
            console.log('Total calls: ' + allCalls.length);
            async.parallelLimit(allCalls, 8, function () {
                console.log('DONE');
            });
        });
    }
}

module.exports = PyramidTiles;
