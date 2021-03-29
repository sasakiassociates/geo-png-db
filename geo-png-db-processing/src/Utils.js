const fs = require('fs');
const path = require('path');
const async = require('async');
const mkdirp = require('mkdirp');

/**
 * Creates a new instance of Utils.
 * @class
 * @returns An instance of Utils.
 * @example
 * var instance = new Utils();
 */
class Utils {

    static ensureDir(dir, callback) {
        mkdirp(dir, function (dirErr) {
            if (dirErr) {
                console.log(dirErr);
            } else {
                callback(dir);
            }
        });
    };

    static getFilesDeep(dir, callback) {
        const walk = function (dir, done) {
            let results = [];
            fs.readdir(dir, function (err, list) {
                if (err) return done(err);
                let pending = list.length;
                if (!pending) return done(null, results);
                list.forEach(function (file) {
                    file = path.resolve(dir, file);
                    fs.stat(file, function (err, stat) {
                        if (stat && stat.isDirectory()) {
                            walk(file, function (err, res) {
                                results = results.concat(res);
                                if (!--pending) done(null, results);
                            });
                        } else {
                            results.push(file);
                            if (!--pending) done(null, results);
                        }
                    });
                });
            });
        };
        walk(dir, callback);
    };

    static makeGeoJson() {
        return {
            "crs": {
                "type": "name",
                "properties": {
                    "name": "urn:ogc:def:crs:EPSG::4326"
                }
            },
            "type": "FeatureCollection",
            "features": []
        };
    };

    static getFiles(dir, deep, callback) {
        if (deep) {
            Utils.getFilesDeep(dir, callback);
        } else {
            fs.readdir(dir, function (err, filenames) {
                callback(err, filenames.map((filename) => {
                    return path.join(dir, filename)
                }));
            });
        }
    };

    static walkFiles(dir, deep, eachFile, parallelLimit) {
        return new Promise(function (resolve, reject) {
            let cnt = 0;
            Utils.getFiles(dir, deep, function (err, filenames) {
                if (err) {
                    reject(err);
                    return;
                }
                const fileFn = function (filename, done) {
                    eachFile({
                        fullName: filename,
                        name: path.basename(filename),
                        extension: path.extname(filename)
                    }, done, cnt++, filenames.length);
                };
                const doneFn = function (err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(filenames.length);
                    }
                };
                if (parallelLimit > 0) {
                    const calls = [];
                    filenames.forEach(function (filename, i) {
                        calls.push(function (done) {
                            fileFn(filename, done);
                        });
                    });
                    async.parallelLimit(calls, parallelLimit, doneFn);
                } else {
                    async.each(filenames, fileFn, doneFn);
                }
            });
        });
    };

    static long2tile(lon, zoom) {
        return (lon + 180) / 360 * Math.pow(2, zoom);
    }

    static lat2tile(lat, zoom) {
        return (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom);
    }

    static tile2long(x, z) {
        return (x / Math.pow(2, z) * 360 - 180);
    }

    static tile2lat(y, z) {
        const n = Math.PI - 2 * Math.PI * y / Math.pow(2, z);
        return (180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))));
    }

    static toLatLon(tile, x, y) {
        const z = tile[2];
        return {
            x: Utils.tile2long(tile[0] + x, z),
            y: Utils.tile2lat(tile[1] + y, z)
        }
    }

    static latLonToTile(lat, lon, zoom) {
        const tileX = Utils.long2tile(lon, zoom);
        const tileY = Utils.lat2tile(lat, zoom);
        return [Math.floor(tileX), Math.floor(tileY), zoom]
    }

    static containsPoint(parent, point) {
        return point.x <= parent.x.max &&
            point.x >= parent.x.min &&
            point.y >= parent.y.min &&
            point.y <= parent.y.max;
    };

    static hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    static padLeft(str, num) {
        return str.padStart(num, '0');
    };

    static toGID(numericStr) {//converts to the G.... ID format used by IPUMS for data tables from numeric id
        // 250277613003016 (numericStr)
        //G25002707613003016

        // 25| 027| 761300|3016
        //G25|0027|0761300|3016

        const state = numericStr.substr(0, 2);
        const county = numericStr.substr(2, 3);
        const tract = numericStr.substr(5, 6);
        const block = numericStr.substr(11, 4);

        return `G${state}0${county}0${tract}${block}`;
    }

    static fromGID(gID) {//converts from G... id to the numeric ID used by Census GIS shapefiles
        //000|0000|0001111|1111
        //012|3456|7890123|4567
        //1,2| 4,3| 8,6   |14,4
        //G25|0027|0761300|3016
        // 25| 027| 761300|3016
        return gID.substr(1, 2) + gID.substr(4, 3) + gID.substr(8, 6) + gID.substr(14, 4)
    }

}

module.exports = Utils;