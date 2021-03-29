const fs = require('fs');
const os = require('os');
const Jimp = require('jimp');
const PbfTiles = require('../gis/PbfTiles');
const TileRenderer = require('./TileRenderer');
const Utils = require("../Utils");
const pointsWithinPolygon = require('@turf/points-within-polygon').default;

/**
 * Creates a new instance of RasterizeInPoly.
 * @class
 * @returns An instance of RasterizeInPoly.
 * @example
 * var instance = new RasterizeInPoly();
 */
class RasterizeInPoly extends TileRenderer {

    constructor(saveWithWorldFile, filer, verbose) {
        super(saveWithWorldFile, filer);
        this.pbfTiles = new PbfTiles();
        this.verbose = verbose;
    }

    rasterizeFeatures(features, tile, getArea, getColor, callback) {
        this.tile = tile;
        //this may be a slower, but more solid way of rendering than the canvas-based tool
        //we first grab the bounds for every polygon, then use point in polygon to find which poly to render at that pixel

        let tileBounds = this.pbfTiles.tileToBounds(tile);
        const inTileBounds = (bounds) => {
            return this.pbfTiles.intersectsBounds(tileBounds, bounds)
        };

        //a possible optimization would be to use a quad-tree structure to more quickly identify which bounds intercept which pixels
        const boundingBoxes = [];
        features.forEach((feature, i) => {
            const bounds = this.pbfTiles.convertGeometry(false, feature.geometry);
            if (inTileBounds(bounds)) {
                boundingBoxes.push({bounds: bounds, feature: feature});
            }
        });

        const matchBounds = (point) => {
            return boundingBoxes.filter((box, i) => {
                return Utils.containsPoint(box.bounds, point);
            });
        };


        const getFeature = (x, y) => {
            //grab lat lon in center of pixel
            const latLon = Utils.toLatLon(tile, (x + 0.5) / 256, (y + 0.5) / 256);
            const point = {
                type: "Feature",
                properties: {},
                geometry: {
                    type: "Point",
                    coordinates: [latLon.x, latLon.y]
                }
            };

            const shapes = matchBounds(latLon);
            const matchingShape = shapes.find((shape, i) => {
                const ans = pointsWithinPolygon(point, shape.feature);
                pipTests++;
                return ans.features.length > 0;
            });
            return matchingShape;
        };

        let pipTests = 0;

        new Jimp(256, 256, (err, image) => {
            this.image = image;
            // console.time('rasterizeFeatures');
            image.scan(0, 0, 256, 256, (x, y, idx) => {
                const matchingShape = getFeature(x, y);
                if (matchingShape) {
                    this.setColor(image.bitmap, idx, getColor(matchingShape.feature));
                }
                if (this.verbose) {
                    if ((idx / 4) % 20000 === 0) {
                        console.log('progress ' + (idx / 4) + ' / ' + (256 * 256));
                    }
                }
            });
            callback();
            // console.timeEnd('rasterizeFeatures');
            // console.log(`pip tests: ${pipTests} ${pipTests / (256 * 256)}`);
        });
    }

}

module.exports = RasterizeInPoly;
