const assert = require('assert');
const TileEncodings = require('../TileEncodings');

const rasterTileSet = new TileEncodings();

const assertEqual = (a, b) => {//replace with https://www.chaijs.com/api/bdd/ ??
    try {
        assert.deepStrictEqual(a, b);
        console.log('Passed');
    } catch (e) {
        console.log('Assert ERROR-----------------------------');
        console.log(JSON.stringify(a));
        console.log('-----------------------------------------');
        console.log(JSON.stringify(b));
        console.log('-----------------------------------------');
    }
};

assertEqual(TileEncodings.calcOffsetTiles(1), {
    width: 1,
    height: 1,
    offsets: [
        [0, 0]
    ]
});

assertEqual(TileEncodings.calcOffsetTiles(3), {
    width: 2,
    height: 2,
    offsets: [[0, 0], [1, 0], [0, 1]]
});
//
assertEqual(TileEncodings.calcOffsetTiles(7), {
    width: 4,
    height: 4,
    offsets: [
        [0, 0],
        [1, 0],
        [2, 0],
        [3, 0],
        [0, 1],
        [1, 1],
        [2, 1],
    ]
});
