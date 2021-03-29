const fs = require('fs');
const Utils = require("../Utils");

/**
 * Creates a new instance of Rasterizer.
 * @class
 * @returns An instance of Rasterizer.
 * @example
 * var instance = new Rasterizer();
 */
class Rasterizer {//Note: this takes a graphical approach to drawing polygons vs point-in-polygon - not currently in use

    constructor() {
        const PImage = require('pureimage');//Note this is inlined here because we're not using this class on Lambda (and don't want to load unneeded code)
        this.img = PImage.make(256, 256);
        this.ctx = this.img.getContext('2d');
        this.ctx.imageSmoothingEnabled = false;
    }

    fillPolygon(points, colorHex) {
        const {ctx} = this;
        ctx.fillStyle = colorHex;
        ctx.beginPath();
        points.forEach((point, i) => {
            if (i === 0) {
                ctx.moveTo(point[0], point[1]);
            } else {
                ctx.lineTo(point[0], point[1]);
            }
        });
        ctx.lineWidth = 1;
        ctx.strokeStyle = colorHex;
        ctx.stroke();//noaa for stroke???
        ctx.closePath();
        ctx.fill_noaa();
    };

    pixelCounts() {
        const bitmap = this.img;
        const pixelCounts = {};
        for (let i = 0; i < bitmap.width; i++) {
            for (let j = 0; j < bitmap.height; j++) {
                const rgba = bitmap.getPixelRGBA(i, j);
                if (!pixelCounts[rgba]) {
                    pixelCounts[rgba] = 0;
                }
                pixelCounts[rgba]++;
            }
        }
        return pixelCounts;
    }

    saveMetaData(filePath, callback) {
        const pixels = this.pixelCounts();
        const fs = require('fs');
        fs.writeFile(filePath, JSON.stringify(pixels, null, 2), function (err) {
            if (err) {
                throw err;
            } else {
                // console.log('Saved ' + filePath);
            }
            callback({pixelCounts: pixels});
        });
    }

    renderGeometry(tile, geometry, colorHex) {
        const tileZoom = tile[2];
        if (geometry.type === 'Polygon') {
            geometry.coordinates.forEach((poly, i) => {
                this.drawPoly(poly, tileZoom, tile, colorHex);
            });
        } else if (geometry.type === 'MultiPolygon') {
            geometry.coordinates.forEach((polys, i) => {
                polys.forEach((poly, i) => {
                    this.drawPoly(poly, tileZoom, tile, colorHex);
                });
            });
        } else {
            console.log('Unsupported Type: ' + geometry.type);
        }
    }

    drawPoly(poly, tileZoom, tile, colorHex) {
        const points = poly.map((p) => {
            const tileX = Utils.long2tile(p[0], tileZoom);
            const tileY = Utils.lat2tile(p[1], tileZoom);
            return [
                Math.round(256 * (tileX - tile[0])),
                Math.round(256 * (tileY - tile[1])),
            ];
        });
        this.fillPolygon(points, colorHex);
    }

    rasterizeFeatures(features, tile, getArea, getColor, callback) {
        //Sort largest to smallest so we don't overwrite smaller polys.
        features.sort((a, b) => {
            return getArea(b) - getArea(a);
        });
        features.forEach((feature, i) => {
            this.renderGeometry(tile, feature.geometry, getColor(feature));
        });
        callback();
    }

    save(path, callback) {

        // for (let i = 0; i < this.img.data.length; i += 4) {
        //     this.img.data[i + 3] = 255;
        // }
        if (path === './data/13/1888/3431.png') {
            console.log('Writing...');
        }

        const PImage = require('pureimage');
        PImage.encodePNGToStream(this.img, fs.createWriteStream(path)).then(() => {
            console.log(`saved ${path}`);
            callback(true);
        }).catch((e) => {
            console.warn(`could not save ${path}`);
            callback(false);
        });

    }
}

module.exports = Rasterizer;
