const Jimp = require('jimp');

const MAX_VALUE = 255 * 256 * 256 - 1;

class PngDbEncodings {
    static valueToEncoded(field, value) {
        if (field.range) {
            value = value - field.range.min;//store the offset from the min value for smaller integers and also to allow signed values with the same methodology
        }
        if (field.precision) {
            value = Math.round(value * field.precision);
        } else {
            value = Math.round(value);
        }
        if (value > PngDbEncodings.MAX_VALUE) {
            console.warn(`Maximum value exceeded ${value} (TRUNCATED)`);
            value = PngDbEncodings.MAX_VALUE;
        }

        if (value < 0) {
            return Jimp.rgbaToInt(0, 0, 0, 0);
        }
        if (value > 255) {
            let r = 0;
            const b = value % 256;
            let g = Math.floor(value / 256);

            if (g > 255) {
                r = Math.floor(g / 256);
                g = g % 256;
            }
            if (r > 255) {
                console.warn('MAX VALUE VIOLATION: ' + value + ' : ' + PngDbEncodings.MAX_VALUE);
                r = 255;
            }
            return Jimp.rgbaToInt(r, g, b, 255);
        } else {
            return Jimp.rgbaToInt(0, 0, value, 255);
        }
    };

    static setPixel(field, image, x, y, value) {
        const encodedValue = PngDbEncodings.valueToEncoded(field, value);
        image.setPixelColor(encodedValue, x, y);
        return encodedValue;
    };

    static valFromPixel(field, r, g, b, a) {
        if (a === 0) return null;

        let val = r << 16 | g << 8 | b;

        if (field.uniqueValues) {
            val = field.uniqueValues[val];
        } else {
            if (field.precision) {
                val /= field.precision;
            }

            if (field.range) {
                val += field.range.min;// we store the offset from the min value for smaller integers and also to allow signed values with the same methodology
            }
        }
        return val;
    };

    static componentToHex(c) {
        const hex = c.toString(16);
        return hex.length === 1 ? "0" + hex : hex;
    }

    static rgbToHex(r, g, b) {
        return ("#" + PngDbEncodings.componentToHex(r) + PngDbEncodings.componentToHex(g) + PngDbEncodings.componentToHex(b)).toUpperCase();
    };

}

module.exports = PngDbEncodings;


