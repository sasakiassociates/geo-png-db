/**
 * Creates a new instance of ScanLinePolygonFill.
 * @class
 * @returns An instance of ScanLinePolygonFill.
 * @example
 * var instance = new ScanLinePolygonFill();
 */
class ScanLinePolygonFill {

    constructor(width, height) {
        this.clip_rect = {x: 0, y: 0, w: width, h: height};


    };

    //also see ??? https://github.com/kpurrmann/cg/blob/master/cog1/raster.js
    //http://alienryderflex.com/polygon_fill/
    //https://bitbucket.org/pygame/pygame/src/faa5879a7e6bfe10e4e5c79d04a3d2fb65d74a62/src/draw.c?at=default#draw.c-1483

    fillPolygon(points, pixelSetter) {
        this.pixelSetter = pixelSetter;
        const vx = points.map((p) => Math.round(p.x));
        const vy = points.map((p) => Math.round(p.y));

        this.scanFillPoly(vx, vy, points.length);

    }


    scanFillPoly(vx, vy, n) {
        let i;
        let y;
        let miny, maxy;
        let x1, y1;
        let x2, y2;
        let ind1, ind2;
        let ints;
        let polyints = [];

        /* Determine Y maxima */
        miny = vy[0];
        maxy = vy[0];
        for (i = 1; (i < n); i++) {
            miny = Math.min(miny, vy[i]);
            maxy = Math.max(maxy, vy[i]);
        }

        /* Draw, scanning y */
        for (y = miny; (y <= maxy); y++) {
            ints = 0;
            polyints.length = 0;
            for (i = 0; (i < n); i++) {
                if (!i) {
                    ind1 = n - 1;
                    ind2 = 0;
                } else {
                    ind1 = i - 1;
                    ind2 = i;
                }
                y1 = vy[ind1];
                y2 = vy[ind2];
                if (y1 < y2) {
                    x1 = vx[ind1];
                    x2 = vx[ind2];
                } else if (y1 > y2) {
                    y2 = vy[ind1];
                    y1 = vy[ind2];
                    x2 = vx[ind1];
                    x1 = vx[ind2];
                } else {
                    continue;
                }
                if ((y >= y1) && (y < y2)) {
                    polyints[ints++] = Math.round((y - y1) * (x2 - x1) / (y2 - y1)) + x1;
                } else if ((y === maxy) && (y > y1) && (y <= y2)) {
                    polyints[ints++] = Math.round((y - y1) * (x2 - x1) / (y2 - y1)) + x1;
                }
            }

            // let  = (a, b) => a - b;
            polyints.sort();

            for (i = 0; (i < ints); i += 2) {
                this.drawhorzlineclip(polyints[i], y, polyints[i + 1]);
            }
        }

    }

    drawhorzlineclip(x1, y1, x2) {
        if (y1 < this.clip_rect.y || y1 >= this.clip_rect.y + this.clip_rect.h) {
            return;
        }

        if (x2 < x1) {
            let temp = x1;
            x1 = x2;
            x2 = temp;
        }

        x1 = Math.max(x1, this.clip_rect.x);
        x2 = Math.min(x2, this.clip_rect.x + this.clip_rect.w - 1);

        if (x2 < this.clip_rect.x || x1 >= this.clip_rect.x + this.clip_rect.w)
            return;

        if (x1 === x2) {
            this.set_at(x1, y1);
        } else {
            this.drawhorzline(x1, y1, x2);
        }
    }

    drawhorzline(x1, y1, x2) {
        for (let x = x1; x <= x2; x++) {
            this.set_at(x, y1);

        }
    }

    set_at(x, y) {
        this.pixelSetter(x, y);
    }

}

module.exports = ScanLinePolygonFill;
