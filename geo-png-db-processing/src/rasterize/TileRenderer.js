const Utils = require("../Utils");
const os = require('os');

/**
 * Creates a new instance of TileRenderer.
 * @class
 * @returns An instance of TileRenderer.
 * @example
 * var instance = new TileRenderer();
 */
class TileRenderer {

    constructor(saveWithWorldFile, filer) {
        this.filer = filer;
        this.pixelCounts = {};
        this.saveWithWorldFile = saveWithWorldFile;
    };

    setColor(bitmap, idx, colorHex) {
        if (!this.colorCache) {
            this.colorCache = {};
        }
        if (!this.colorCache[colorHex]) {
            this.colorCache[colorHex] = Utils.hexToRgb(colorHex);
        }
        const color = this.colorCache[colorHex];
        bitmap.data[idx + 0] = color.r;
        bitmap.data[idx + 1] = color.g;
        bitmap.data[idx + 2] = color.b;
        bitmap.data[idx + 3] = 255;
        if (!this.pixelCounts[colorHex]) this.pixelCounts[colorHex] = 0;
        this.pixelCounts[colorHex]++;
    };

    saveMetaData(filePath, callback) {
        const pixels = this.pixelCounts;
        this.filer.writeFile(filePath, JSON.stringify(pixels, null, 2), function (err) {
            if (err) {
                throw err;
            } else {
                // console.log('Saved ' + filePath);
            }
            callback({pixelCounts: pixels})
        });
    }

    save(path, callback) {
        this.filer.saveImage(path, this.image, () => {
            // console.log('Wrote ' + path);
            if (this.saveWithWorldFile) {
                this.saveWorldFile(path, callback);
            } else {
                if (callback) callback();
            }
        });
    }

    saveWorldFile(path, callback) {
        const {tile} = this;
        const latLonTL = Utils.toLatLon(tile, 0, 0);
        const latLonBR = Utils.toLatLon(tile, 1, 1);
        const xSize = (latLonBR.x - latLonTL.x) / 256;
        const ySize = (latLonBR.y - latLonTL.y) / 256;
        const params = [xSize, 0, 0, ySize, latLonTL.x + xSize / 2, latLonTL.y + ySize / 2];
        const pgwFile = path.replace('.png', '.pgw');
        this.filer.writeFile(pgwFile, params.join(os.EOL), function (err) {
            if (err) {
                throw err;
            } else {
                // console.log('Saved ' + pgwFile);
                if (callback) callback();
            }
        });
    }
}

module.exports = TileRenderer;