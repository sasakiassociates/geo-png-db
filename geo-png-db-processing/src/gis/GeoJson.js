const fs = require("fs");

/**
 @class GeoJson
 */
const GeoJson = function () {
    const _self = this;

    //region private fields and methods
    let _filePath = '';
    let _featureList = [];
    const _uniqueLatLons = [];
    let _crs = null;

    const _init = function () {
    };

    const _addEmptyFeatures = function (geoIds) {
        geoIds.forEach(function (geoId, i) {
            _featureList.push({
                "type": "Feature",
                "properties": {
                    "geoId": geoId,
                    "label": geoId
                }
            });
        });
    };

    const _createEmptyGeoJson = function (geoIds, saveAs, callback) {
        _addEmptyFeatures(geoIds);
        _save(saveAs, callback);
    };

    const _setExtras = function (geojson) {
        if (_crs) {
            geojson.crs = {
                "type": "name",
                "properties": {
                    "name": _crs
                }
            };
        }
    };

    const _saveSample = function (saveAs, sampleSize, callback) {
        if (_featureList.length < sampleSize) {
            throw 'Cannot sample ' + sampleSize + ' features from ' + _filePath;
        }

        const geojson = {
            "type": "FeatureCollection",
            "features": []
        };

        _setExtras(geojson);

        const sampleBucket = _featureList.slice(0);//clone

        while (geojson.features.length < sampleSize) {
            const randIndex = Math.round(Math.random() * sampleBucket.length);
            geojson.features.push(sampleBucket.splice(randIndex, 1)[0]);
        }

        fs.writeFile(saveAs, JSON.stringify(geojson, null, 2), function (err) {
            if (err) {
                throw err;
            } else {
                console.log('Saved ' + saveAs);
                if (callback) callback();
            }
        });
    };

    const _savePages = function (saveAs, pageSize, callback) {
        for (let i = 0; i < _featureList.length; i += pageSize) {
            (function (i) {
                const geojson = {
                    "type": "FeatureCollection",
                    "features": []
                };
                _setExtras(geojson);

                for (let j = i; j < i + pageSize; j++) {
                    if (j < _featureList.length) {
                        geojson.features.push(_featureList[j]);
                    }
                }
                const outFile = saveAs.replace('##', `${(i + 1)}-${(i + pageSize)}`);
                fs.writeFile(outFile, JSON.stringify(geojson, null, 2), function (err) {
                    if (err) {
                        throw err;
                    } else {
                        console.log(`Saved page as ${outFile}`);
                        if (callback) callback();
                    }
                });
            })(i);
        }
    };

    const _save = function (saveAs, callback) {
        const geojson = {
            "type": "FeatureCollection",
            "features": _featureList
        };
        _setExtras(geojson);

        fs.writeFile(saveAs, JSON.stringify(geojson, null, 2), function (err) {
            if (err) {
                throw err;
            } else {
                console.log('Saved ' + saveAs);
                if (callback) callback();
            }
        });
    };

    const _removeFeatures = function (featuresToRemove) {
        _featureList = _featureList.filter(feature => featuresToRemove.indexOf(feature) < 0);
    };
    //endregion

    //region public API
    this.firstFeature = function () {
        return _featureList[0];
    };

    this.addFeature = function (feature) {
        _featureList.push(feature);
        return _self;
    };

    this.addLineFeature = function (lat1, lon1, lat2, lon2, properties) {
        _featureList.push(
            {
                "type": "Feature",
                "properties": properties,
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [
                            lon1,
                            lat1
                        ],
                        [
                            lon2,
                            lat2
                        ]
                    ]
                }
            }
        );
        return _self;
    };

    this.addTypedFeature = function (type, coordinates, properties, autoIdPrefix) {
        if (autoIdPrefix && !properties.geoId) {
            const latLonId = [lat, lon].join('_');
            if (_uniqueLatLons.indexOf(latLonId) < 0) {
                _uniqueLatLons.push(latLonId);
            }
            properties.geoId = autoIdPrefix + _uniqueLatLons.indexOf(latLonId);
        }
        _featureList.push(
            {
                "type": "Feature",
                "properties": properties,
                "geometry": {
                    "type": type,
                    "coordinates": coordinates
                }
            }
        );
        return _self;
    };

    this.addPointFeature = function (lat, lon, properties, autoIdPrefix) {
        _self.addTypedFeature('Point', [lon, lat], properties, autoIdPrefix);
        return _self;
    };

    this.addEmptyFeatures = function (geoIds) {
        _addEmptyFeatures(geoIds);
    };

    this.load = function (filePath) {
        _filePath = filePath;
        const geoJson = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        _featureList = geoJson.features;
        return _self;
    };

    this.processGiantFile = function (filePath, eachFn, callback) {
        const readable = fs.createReadStream(filePath, {
            encoding: 'utf8',
            fd: null,
        });
        let current = '';
        let featureStr = '';

        readable.on('readable', function () {
            let chunk;
            while (null !== (chunk = readable.read(1))) {
                current += chunk;
                if (chunk === '}') {
                    featureStr += current;
                    if (current === '}') {//double }} signifies end of feature...
                        if (featureStr.indexOf(',') === 0) {
                            featureStr = featureStr.substr(1);
                            const feature = JSON.parse(featureStr);
                            eachFn(feature);
                        }
                        featureStr = '';
                    }
                    current = '';
                }
            }
        }).on('end', function () {
            callback();
        })
    };

    this.featureList = function () {
        return _featureList;
    };

    this.eachFeature = function (callback) {
        const featuresToRemove = [];
        _featureList.forEach(function (feature, i) {
            if (callback(feature, i, _featureList.length) === false) {
                featuresToRemove.push(feature);
            }
        });
        _removeFeatures(featuresToRemove);
        return _self;
    };

    this.save = function (saveAs, callback) {
        _filePath = saveAs;
        _save(saveAs, callback);
        return _self;
    };

    this.createEmptyGeoJson = function (geoIds, saveAs) {
        _createEmptyGeoJson(geoIds, saveAs);
        return _self;
    };

    this.addFeatures = function (features) {
        [].push.apply(_featureList, features);
        return _self;
    };

    this.saveSample = function (saveAs, numEntries) {
        _saveSample(saveAs, numEntries);
    };

    this.savePages = function (saveAs, numEntries) {
        _savePages(saveAs, numEntries);
    };

    this.setCRS = function (crs) {
        _crs = crs;
        if (_crs && _crs.indexOf('urn:') !== 0) {
            _crs = "urn:ogc:def:crs:EPSG::" + _crs;
        }
    };

    this.mergeOnId = function (idField, averageFields) {
        const featuresToRemove = [];

        const featuresById = {};

        _featureList.forEach(function (feature, i) {
            const id = feature.properties[idField];
            if (!featuresById[id]) featuresById[id] = [];
            featuresById[id].push(feature);
        });

        Object.keys(featuresById).forEach((k) => {
            const arr = featuresById[k];
            //if there is more than one matching record, add it to a total so we can get an average across all matches and then remove all but the first
            if (arr.length > 1) {
                const totals = {};
                averageFields.forEach(function (field, i) {
                    totals[field] = 0;
                });
                for (let i = 0; i < arr.length; i++) {
                    const feature = arr[i];
                    averageFields.forEach(function (field, i) {
                        totals[field] += feature.properties[field];
                    });
                    if (i > 0) {
                        featuresToRemove.push(feature);
                    }
                }
                averageFields.forEach(function (field, i) {
                    arr[0].properties[field] = totals[field] / arr.length;
                });
            }
        });

        _removeFeatures(featuresToRemove);
        return _self;
    };
    //endregion

    _init();
};

module.exports.GeoJson = GeoJson;

