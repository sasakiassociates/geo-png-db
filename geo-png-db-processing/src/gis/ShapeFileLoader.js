var fs = require("fs");
var path = require('path');
var unzipper = require("unzipper");
var shapefile = require("shapefile");
var Utils = require("../Utils");

/**
 * Creates a new instance of ShapeFileLoader.
 * @class
 * @returns An instance of ShapeFileLoader.
 * @example
 * var instance = new ShapeFileLoader();
 */
class ShapeFileLoader {

    constructor() {
    };

    addFeature(geoJson, properties, geometry) {
        geoJson.features.push({
            "type": "Feature",
            "properties": properties,
            "geometry": geometry
        });
    };

    loadZip(zip, onLoad, onBoundingBox) {
        const shpFileData = {shp: [], dbf: [], prj: ''};
        const process = (shpFileData) => {
            if (!shpFileData.dbf || shpFileData.dbf.length === 0) return;
            if (!shpFileData.shp || shpFileData.shp.length === 0) return;
            if (!shpFileData.prj || shpFileData.prj.length === 0) return;
            this.projection = shpFileData.prj;

            onLoad(shpFileData);
        };

        fs.createReadStream(zip)
            .pipe(unzipper.Parse())
            .on('entry', function (entry) {
                var fileName = entry.path;
                const ext = path.extname(fileName).substr(1);
                console.log('ENTRY: ' + ext);
                var type = entry.type; // 'Directory' or 'File'
                var size = entry.size;
                if (ext === "shp") {
                    console.time('load shp ' + fileName);
                    shapefile.openShp(entry).then((source) => {
                        this.bbox = source.bbox;
                        if (onBoundingBox) onBoundingBox(source.bbox);
                        source.read()
                            .then(function log(result) {
                                if (result.done) {
                                    console.timeEnd('load shp ' + fileName);
                                    process(shpFileData);
                                    return;
                                }
                                shpFileData.shp.push(result.value);
                                return source.read().then(log);
                            })
                    }).catch((error) => {
                        console.error('PROBLEM WITH ZIP: ' + fileName)
                        console.error(error.stack)
                    });

                } else if (ext === "dbf") {
                    console.time('load dbf ' + fileName);
                    shapefile.openDbf(entry).then((source) => {
                        source.read()
                            .then(function log(result) {
                                if (result.done) {
                                    console.timeEnd('load dbf ' + fileName);
                                    process(shpFileData);
                                    return;
                                } else {
                                    shpFileData.dbf.push(result.value);
                                }
                                return source.read().then(log);
                            })
                    }).catch((error) => {
                        console.error('PROBLEM WITH ZIP: ' + fileName);
                        console.error(error.stack);
                    });
                } else if (ext === "prj") {
                    let content = '';
                    entry.on('data', function (buf) {
                        content += buf.toString();
                    });
                    entry.on('end', function () {
                        shpFileData.prj = content;
                        process(shpFileData);
                        // console.log(content);
                    });
                    entry.read();
                } else {
                    entry.autodrain();
                }
                // if (shpFile.dbf && shpFile.shp) {
                //     processShapefile(shpFile);
                // }
            });
    }

    loadZipToGeoJson(zip, callback) {
        this.loadZip(zip, (shpFileData) => {
            const geoJson = Utils.makeGeoJson();
            shpFileData.shp.forEach((shp, i) => {
                // const converted = converter(shp);
                const record = shpFileData.dbf[i];
                this.addFeature(geoJson, record, shp);
                if (i % 500 === 0) console.log(`Processed shape: ${i} of ${shpFileData.shp.length} --> ${Math.round(100 * i / shpFileData.shp.length)}%`);
            });

            console.log(`DONE processing shapefile (${shpFileData.shp.length} shapes)`);
            callback(geoJson);
        });
    }

    load(zip, converter, onBoundingBox, batches, callback) {
        const process = (shpFileData) => {
            shpFileData.shp.forEach((shp, i) => {
                const converted = converter(shp);
                batches.forEach((batch, j) => {
                    if (!batch.boundsTest(converted)) return;
                    const record = shpFileData.dbf[i];
                    if (!batch.geoJson) {
                        batch.geoJson = Utils.makeGeoJson();
                    }
                    this.addFeature(batch.geoJson, record, shp);
                });
                if (i % 500 === 0) console.log(`Processed shape: ${i} of ${shpFileData.shp.length} --> ${Math.round(100 * i / shpFileData.shp.length)}%`);
            });

            console.log(`DONE processing shapefile (${shpFileData.shp.length} shapes)`);
            callback();
        };

        this.loadZip(zip, process, onBoundingBox);
    }
}

module.exports = ShapeFileLoader;
