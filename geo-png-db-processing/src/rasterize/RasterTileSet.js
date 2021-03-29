const async = require('async');
const geobuf = require('geobuf');
const Pbf = require('pbf');
const PbfTiles = require('../gis/PbfTiles');
const Rasterizer = require('./Rasterizer');
const SteppedColors = require('./SteppedColors');
const RasterizeInPoly = require('./RasterizeInPoly');

/**
 * Creates a new instance of RasterTileSet.
 * @class
 * @returns An instance of RasterTileSet.
 * @example
 * var instance = new RasterTileSet();
 */
class RasterTileSet {

    constructor(filer, pbfDir, usePointInPolyRasterizer, outDir = './data/') {
        this.filer = filer;
        this.pbfDir = pbfDir;
        this.outDir = outDir;
        this.pbfTiles = new PbfTiles();

        this.unfinishedWork = [];
        this.steppedColors = new SteppedColors();

        this.usePointInPolyRasterizer = usePointInPolyRasterizer;
        this.maxTime = 20;//seconds (Note Max API Gateway timeout is 30s) we could still exceed this if z13 tiles took e.g. 10s,9s,12s
    }



    getArea(feature) {
        return feature.properties.ALAND10 + feature.properties.AWATER10;
    };

    getId(feature) {
        return feature.properties.GEOID10;
    };

    static metaDataFile(tile) {
        return `${tile.join('_')}.json`;
    }

    duration() {
        let elapsedTime = process.hrtime(this.startTime);
        const elapsedMs = elapsedTime[1] / 1000000; // divide by a million to get nano to milli
        return elapsedTime[0] + elapsedMs / 1000;
    };

    generatePalette(tile, callback) {
        const colorLookup = {};
        const colorLookup2 = {};

        const addColor = (feature) => {
            const id = this.getId(feature);
            if (!colorLookup[id]) {
                colorLookup[id] = this.steppedColors.nextColor();
                colorLookup2[colorLookup[id]] = id;
            }
        };

        let protoFile = this.pbfDir + tile.join('_') + '.proto';
        this.filer.readFile(protoFile, (err, data) => {
            if (err && err.code === 'ENOENT') {
                console.warn('MISSING proto file: ' + protoFile);
                callback({error: 'MISSING proto file: ' + protoFile});
                return;
            }
            // var ab = nb.buffer;
            const geoJson = geobuf.decode(new Pbf(data));
            if (!geoJson.features) {
                console.warn('INVALID proto file: ' + protoFile);
                callback({error: 'INVALID proto file: ' + protoFile});
                return;
            }

            geoJson.features.forEach((feature, i) => {
                addColor(feature);
            });
            if (callback) {
                callback(colorLookup);
            }
        });
    }

    rasterizeTileZ13(tileZ13, callback) {
        const tile = this.pbfTiles.getZ11(tileZ13);

        let protoFile = this.pbfDir + tile.join('_') + '.proto';
        const paletteFile = `${this.outDir}11/${tile.join('_')}_palette.json`;

        const startTimeStamp = Date.now();
        const timerLabel = tileZ13.join('_');
        console.time(timerLabel);
        const processFile = (colorLookup) => {
            this.filer.readFile(protoFile, (err, data) => {
                if (err && err.code === 'ENOENT') {
                    console.warn('MISSING proto file: ' + protoFile);
                    callback({error: 'MISSING proto file: ' + protoFile});
                    return;
                }
                // var ab = nb.buffer;
                const geoJson = geobuf.decode(new Pbf(data));
                if (!geoJson.features) {
                    console.warn('INVALID proto file: ' + protoFile);
                    callback({error: 'INVALID proto file: ' + protoFile});
                    return;
                }
                let tileGroups;
                tileGroups = this.pbfTiles.getTileGroups([tileZ13], 13, geoJson);

                const calls = [];

                const getColor = (feature) => {
                    const id = this.getId(feature);
                    return colorLookup[id];
                };

                tileGroups.forEach((tileGroup, i) => {
                    calls.push((done) => {
                        if (this.usePointInPolyRasterizer) {
                            tileGroup.rasterizer = new RasterizeInPoly(true, this.filer);
                        } else {
                            tileGroup.rasterizer = new Rasterizer(false, this.filer);
                        }

                        tileGroup.rasterizer.rasterizeFeatures(tileGroup.geoJson.features, tileGroup.tile, this.getArea, getColor, () => {
                            let pngDir = `${this.outDir}${tileGroup.tile[2]}/${tileGroup.tile[0]}`;
                            this.filer.ensureDir(pngDir, () => {
                                let pngPath = `${pngDir}/${tileGroup.tile[1]}.png`;
                                tileGroup.rasterizer.saveMetaData(pngPath + '.json', (meta) => {
                                    tileGroup.rasterizer.save(pngPath, () => {
                                        done();
                                    });
                                });

                            });
                        });

                    });
                });
                async.parallelLimit(calls, 1, () => {
                    console.timeEnd(timerLabel);
                    if (callback) callback({success: true, timeElapsed: Date.now() - startTimeStamp});
                });
            });
        };

        this.filer.readFile(paletteFile, (err, data) => {
            const colorLookup = JSON.parse(data);
            processFile(colorLookup);
        });
    }

    rasterizeTile(tile, selectZ13Tiles, onTile, callback) {
        this.startTime = process.hrtime();
        let protoFile = this.pbfDir + tile.join('_') + '.proto';
        const metaDataFile = `${this.outDir}11/${tile.join('_')}.json`;

        const startTimeStamp = Date.now();
        console.time(protoFile);
        const processFile = () => {
            this.filer.readFile(protoFile, (err, data) => {
                if (err && err.code === 'ENOENT') {
                    console.warn('MISSING proto file: ' + protoFile);
                    callback({error: 'MISSING proto file: ' + protoFile});
                    return;
                }
                // var ab = nb.buffer;
                const geoJson = geobuf.decode(new Pbf(data));
                if (!geoJson.features) {
                    console.warn('INVALID proto file: ' + protoFile);
                    callback({error: 'INVALID proto file: ' + protoFile});
                    return;
                }
                let tileGroups;
                if (selectZ13Tiles) {
                    tileGroups = this.pbfTiles.getTileGroups(selectZ13Tiles, 13, geoJson);
                } else {
                    tileGroups = this.pbfTiles.getZoomTiles(tile, 13, geoJson);
                }
                const calls = [];

                const colorLookup = {};
                const colorLookup2 = {};
                const metaData = {};

                const getMeta = (id) => {
                    if (!metaData[id]) {
                        metaData[id] = {color: '', pixelCount: 0};
                    }
                    return metaData[id];
                };

                const addMeta = (meta) => {
                    Object.keys(meta.pixelCounts).forEach((k) => {
                        let hexStr = k;
                        if (!this.usePointInPolyRasterizer) {
                            hexStr = '#' + parseInt(k).toString(16).substr(0, 6);
                        }
                        const id = colorLookup2[hexStr];
                        if (id) {
                            getMeta(id).pixelCount += meta.pixelCounts[k];
                        }
                    });
                };

                const getColor = (feature) => {
                    const id = this.getId(feature);
                    if (!colorLookup[id]) {
                        colorLookup[id] = this.steppedColors.nextColor();
                        colorLookup2[colorLookup[id]] = id;
                        getMeta(id).color = colorLookup[id];
                    }
                    return colorLookup[id];
                };

                tileGroups.forEach((tileGroup, i) => {
                    calls.push((done) => {
                        if (this.duration() > this.maxTime) {
                            this.unfinishedWork.push(tileGroup.tile);
                            done();
                            return;
                        }

                        if (this.usePointInPolyRasterizer) {
                            tileGroup.rasterizer = new RasterizeInPoly(true, this.filer);
                        } else {
                            tileGroup.rasterizer = new Rasterizer(false, this.filer);
                        }

                        tileGroup.rasterizer.rasterizeFeatures(tileGroup.geoJson.features, tileGroup.tile, this.getArea, getColor, () => {
                            let pngDir = `${this.outDir}${tileGroup.tile[2]}/${tileGroup.tile[0]}`;
                            this.filer.ensureDir(pngDir, () => {
                                let pngPath = `${pngDir}/${tileGroup.tile[1]}.png`;
                                tileGroup.rasterizer.saveMetaData(pngPath + '.json', (meta) => {
                                    addMeta(meta);
                                    tileGroup.rasterizer.save(pngPath, () => {
                                        if (onTile) onTile(pngPath);
                                        done();
                                    });
                                });

                            });
                        });

                    });
                });
                async.parallelLimit(calls, 1, () => {
                    // console.log('ALL SAVED');
                    // console.timeEnd(protoFile);
                    this.filer.writeFile(metaDataFile, JSON.stringify(metaData, null, 2), function (err) {
                        if (err) {
                            throw err;
                        } else {
                            console.log('Saved ' + metaDataFile);
                        }
                        if (callback) callback({success: true, timeElapsed: Date.now() - startTimeStamp});
                    });
                });
            });
        };

        processFile();
    };

}

module.exports = RasterTileSet;
