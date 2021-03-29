/**
 * Creates a new instance of SteppedColors.
 * @class
 * @returns An instance of SteppedColors.
 * @example
 * var instance = new SteppedColors();
 */
class SteppedColors {//Note: this takes a graphical approach to drawing polygons vs point-in-polygon - not currently in use

    constructor() {

        this.steppedColorOffset = 0;
        this.steppedColors = [];
        this.usedColors = {};
    }

    makeSteppedColors() {
        //we use steps of 0x11 to get colors that are easier to differentiate visually
        //but we can run out at around 4K colors. The steppedColorOffset will give us a new batch (so we get around 64K colors)
        const steppedColors = [];
        for (let r = 0; r <= 0xEE0000; r += 0x110000) {
            for (let g = 0; g <= 0xFF00; g += 0x1100) {
                for (let b = 0; b <= 0xFF; b += 0x11) {
                    let val = (r | g | b) - this.steppedColorOffset;
                    if (val <= 0) continue;//avoid pure black (or negative values)
                    steppedColors.push(val.toString(16).padStart(6, "0"));
                }
            }
        }
        return steppedColors;
    }

    fillUnusedColorSpace(maxNum) {
        const remColors = [];
        for (let c = 0x000001; c <= 0xFFFFFF; c += 1) {
            const hex = c.toString(16).padStart(6, "0");
            if (!this.usedColors['#' + hex]) {
                remColors.push(hex);
            }
            if (remColors.length >= maxNum) break;
        }
        return remColors;
    }

    nextColor() {
        // console.log('Added color: ' + ans);
        if (this.steppedColors.length === 0) {
            this.steppedColorOffset++;
            if (this.steppedColorOffset >= 0x11) {
                console.warn('COLOR THRESHOLD REACHED... backfilling 100k colors');
                this.steppedColors = this.fillUnusedColorSpace(100000);
            } else {
                this.steppedColors = this.makeSteppedColors();
            }
        }
        let color = '#' + this.steppedColors.pop();
        this.usedColors[color] = true;
        return color;
    }

}

module.exports = SteppedColors;
