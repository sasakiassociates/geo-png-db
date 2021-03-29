//TODO split out this module (that needs to run on Lambda from all the ShapeFileLoader dependencies -- those can be in a class that extends this one)
const tilebelt = require("@mapbox/tilebelt");
const Utils = require('../Utils');

/**
 * Creates a new instance of PbfTiles.
 * @class
 * @returns An instance of PbfTiles.
 * @example
 * var instance = new PbfTiles();
 */
class PbfTiles {

    constructor(outDir) {
        //Note some functionality similar to https://github.com/mapbox/geojson-vt
        this.outDir = outDir;
        this.memoize = {};
    };

    bboxToBounds(bbox) {
        return {
            x: {min: bbox[0], max: bbox[2]},
            y: {min: bbox[1], max: bbox[3]}
        };
    };

    intersectsBounds(bounds1, bounds2) {
        return !(
            bounds1.x.min > bounds2.x.max ||
            bounds1.x.max < bounds2.x.min ||
            bounds1.y.min > bounds2.y.max ||
            bounds1.y.max < bounds2.y.min
        );
    };

    fullyContains(parent, child) {
        return child.x.max <= parent.x.max &&
            child.x.min >= parent.x.min &&
            child.y.min >= parent.y.min &&
            child.y.max <= parent.y.max;
    };

    getOuterTile(startTile, endZoom) {
        if (startTile[2] === endZoom) return startTile;
        let parent = tilebelt.getParent(startTile);
        while (parent[2] !== endZoom) {
            parent = tilebelt.getParent(parent);
        }
        return parent;
    }

    getTopLeftPixel(tile) {
        return {x: tile[0] * 256, y: tile[1] * 256};
    }

    getZ11(tileZ13) {
        const tileZ12 = tilebelt.getParent(tileZ13);
        return tilebelt.getParent(tileZ12);
    }

    getMinMaxInnerTiles(startTile, endZoom) {
        let children = this.getInnerTiles(startTile, endZoom);

        const max = [0, 0, endZoom];
        const min = [Number.MAX_VALUE, Number.MAX_VALUE, endZoom];
        children.forEach((c, i) => {
            max[0] = Math.max(max[0], c[0]);
            max[1] = Math.max(max[1], c[1]);

            min[0] = Math.min(min[0], c[0]);
            min[1] = Math.min(min[1], c[1]);
        });
        return {min, max};
    }

    getInnerTiles(startTile, endZoom) {
        const inners = [];
        const nextLevel = (tile, level) => {
            // console.log(level, tile);
            if (level === endZoom) {
                inners.push(tile);
            } else {
                const children = tilebelt.getChildren(tile);
                children.forEach((child, i) => {
                    nextLevel(child, level + 1);
                });
            }
        };

        nextLevel(startTile, startTile[2]);
        return inners;
    };

    toLatLon(projection, pair) {
        return pair;
    }

    convertCoords(projection, coords) {
        const coordsLL = [];
        const shapeBounds = {
            x: {min: Number.MAX_VALUE, max: -Number.MAX_VALUE},
            y: {min: Number.MAX_VALUE, max: -Number.MAX_VALUE}
        };
        coords.forEach((pair, i) => {
            try {
                const latLon = this.toLatLon(projection, pair);
                shapeBounds.x.min = Math.min(latLon[0], shapeBounds.x.min);
                shapeBounds.x.max = Math.max(latLon[0], shapeBounds.x.max);
                shapeBounds.y.min = Math.min(latLon[1], shapeBounds.y.min);
                shapeBounds.y.max = Math.max(latLon[1], shapeBounds.y.max);
                coordsLL.push(latLon);
            } catch (e) {
                console.log(e);
                // console.log(JSON.stringify(geometry));
                console.log(typeof coords[0]);
                // console.log(pair);
                // console.log(feature);
            }
        });
        return {coords: coordsLL, shapeBounds: shapeBounds}
    }

    unionBounds(a, b) {
        if (a == null) return b;
        if (b == null) return a;
        return {
            x: {min: Math.min(a.x.min, b.x.min), max: Math.max(a.x.max, b.x.max)},
            y: {min: Math.min(a.y.min, b.y.min), max: Math.max(a.y.max, b.y.max)}
        }
    }

    isPairArray(arr) {
        if (arr.length === 0) return false;
        const first = arr[0];
        return first.length === 2 && typeof first[0] === 'number';
    }

    convertGeometry(projection, geometry) {
        if (geometry._processed) {
            return geometry._processed.bounds;//prevent double-processing of geometry
        }
        let boundsUnion = null;
        const processArr = (arr) => {
            arr.forEach((subArr, i) => {
                if (this.isPairArray(subArr)) {
                    const {coords, shapeBounds} = this.convertCoords(projection, subArr);
                    arr[i] = coords;
                    boundsUnion = this.unionBounds(boundsUnion, shapeBounds);
                } else {
                    processArr(subArr);
                }
            });
        };
        processArr(geometry.coordinates);
        geometry._processed = {bounds: boundsUnion};
        return boundsUnion;
    }

    tileToBounds(tile) {
        return this.bboxToBounds(tilebelt.tileToBBOX(tile));
    }

    getTileGroups(zoomTiles, tileZoom, geoJson) {
        const tileGroups = [];
        zoomTiles.forEach((tile, i) => {
            let tileBounds = this.bboxToBounds(tilebelt.tileToBBOX(tile));
            tileGroups.push({
                tile: tile,
                bounds: tileBounds,
                boundsTest: (shapeBounds) => {
                    return this.intersectsBounds(shapeBounds, tileBounds);
                },
                geoJson: Utils.makeGeoJson()
            });
        });
        geoJson.features.forEach((feature, i) => {
            const shapeBounds = this.convertGeometry(false, feature.geometry);
            tileGroups.forEach((tileGroup, i) => {
                if (tileGroup.boundsTest(shapeBounds)) {
                    tileGroup.geoJson.features.push(feature);
                }
            });
        });
        return tileGroups;
    }

    getZoomTiles(parentTile, tileZoom, geoJson) {
        const zoomTiles = this.getInnerTiles(parentTile, tileZoom);
        return this.getTileGroups(zoomTiles, tileZoom, geoJson);
    }

    findGeometriesNotFullyContained(tile, geoJson) {
        if (!geoJson.features) return [];
        let tileBounds = this.bboxToBounds(tilebelt.tileToBBOX(tile));
        return geoJson.features.filter((feature) => {
            const bounds = this.convertGeometry(false, feature.geometry);
            return !this.fullyContains(tileBounds, bounds);
        });
    }

    static getTileMetersPerPixel(zoom, latitude) {//https://github.com/mapbox/mapbox-unity-sdk/blob/ddd6cd4bece9b2a25a8e3337597cad17a65de5fd/sdkproject/Assets/Mapbox/Unity/Utilities/Conversions.cs#L223
        return 40075000 * Math.cos((Math.PI / 180) * latitude) / Math.pow(2, zoom + 8);
    }

}

module.exports = PbfTiles;
