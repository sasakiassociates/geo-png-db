const async = require('async');

/**
 * Creates a new instance of CompileData.
 * @class
 * @returns An instance of CompileData.
 * @example
 * var compileData = new CompileData(filer, tileDir, spannerDir);
 * compileData.deriveTotalPixels();
 */
class CompileData {

    constructor(filer, tileDir, spannerDir, outDir) {
        this.filer = filer;
        this.tileDir = tileDir;
        this.spannerDir = spannerDir;
        this.outDir = outDir;
    };

    processSpannerFiles(callback) {
        const {filer, spannerDir} = this;
        const compiledBlocks = {};
        filer.readdir(spannerDir, function (err, items) {
            const calls = [];

            //TODO grab spanner ids and set count to 0
            for (let i = 0; i < items.length; i++) {
                let file = items[i];
                const bits = file.split('.');
                if (bits[bits.length - 1] === 'json') {
                    calls.push((done) => {
                        filer.readFile(`${spannerDir}${file}`, (err, data) => {
                            if (err) throw err;
                            let spannerIds = JSON.parse(data);
                            spannerIds.forEach((id, i) => {
                                compiledBlocks[id] = 0;//Note this may be set multiple times for same ID
                            });
                            done();
                        });
                    });
                }
            }

            console.log('Compiling data for ' + calls.length);
            let timerId = calls.length + ' calls';
            console.time(timerId);
            async.parallelLimit(calls, 4, function () {
                console.log('ALL DONE');
                console.timeEnd(timerId);
                callback(compiledBlocks);
            });

        });
    };

    updateJsonFiles(compiledBlocks, callback) {
        const {filer, tileDir} = this;
        filer.readdir(tileDir, function (err, items) {
            const calls = [];

            for (let i = 0; i < items.length; i++) {
                let file = items[i];
                const bits = file.split('.');
                if (bits[bits.length - 1] === 'json') {
                    calls.push((done) => {
                        filer.readFile(`${tileDir}${file}`, (err, data) => {
                            if (err) throw err;
                            let colorLookup = JSON.parse(data);
                            let hasUpdates = false;
                            Object.keys(colorLookup).forEach((k) => {
                                if (compiledBlocks[k] > 0) {
                                    colorLookup[k].totalPixels = compiledBlocks[k];
                                    hasUpdates = true;
                                }
                            });
                            if (hasUpdates) {
                                const filePath = `${tileDir}${file}`;
                                filer.writeFile(filePath, JSON.stringify(colorLookup, null, 2), function (err) {
                                    if (err) {
                                        throw err;
                                    } else {
                                        // console.log('Saved ' + filePath);
                                    }
                                    done();
                                });
                            } else {
                                done();
                            }
                        });
                    });
                }
            }

            console.log('updateJsonFiles for ' + calls.length);
            let timerId = calls.length + ' updateJsonFiles calls';
            console.time(timerId);
            async.parallelLimit(calls, 4, function () {
                console.log('updateJsonFiles ALL DONE');
                console.timeEnd(timerId);
                if (callback) callback();
            });

        });
    };

    sumPixelsByBlock(compiledBlocks, callback) {
        const {filer, tileDir} = this;
        filer.readdir(tileDir, function (err, items) {
            const calls = [];

            let matchCount = 0;

            for (let i = 0; i < items.length; i++) {
                let file = items[i];
                const bits = file.split('.');
                if (bits[bits.length - 1] === 'json') {
                    calls.push((done) => {
                        filer.readFile(`${tileDir}${file}`, (err, data) => {
                            if (err) throw err;
                            let colorLookup = JSON.parse(data);
                            Object.keys(colorLookup).forEach((k) => {
                                if (compiledBlocks.hasOwnProperty(k)) {
                                    matchCount++;
                                    compiledBlocks[k] += colorLookup[k].pixelCount;
                                }
                            });
                            done();
                        });
                    });
                }
            }

            console.log('Compiling data for ' + calls.length);
            let timerId = calls.length + ' calls';
            console.time(timerId);
            async.parallelLimit(calls, 4, function () {
                console.log('ALL DONE');
                console.log('matchCount', matchCount);
                console.timeEnd(timerId);
                callback();
            });

        });
    };

    deriveTotalPixels(callback) {
        this.processSpannerFiles((compiledBlocks) => {
            this.sumPixelsByBlock(compiledBlocks, () => {
                this.updateJsonFiles(compiledBlocks, callback);
            });
        });
    }

}

module.exports = CompileData;