const fs = require('fs');
const async = require('async');
const {fork} = require('child_process');

//similar idea here: http://ngageoint.github.io/geopackage-js/jsdoc/tiles_features_index.js.html

const pbfDir = '../vector_tiles/data/';

let progress = {done: 0, num: 0};
fs.readdir(pbfDir, function (err, items) {
    const calls = [];

    for (let i = 0; i < items.length; i++) {
        let file = items[i];
        const bits = file.split('.');
        if (bits[bits.length - 1] === 'geojson') {
            continue;
        }
        const tileId = bits[0];
        const tile = tileId.split('_').map((v) => parseInt(v));

        progress.num++;
        calls.push((done) => {
            const forked = fork('processVector.js');
            forked.on('message', (msg) => {
                if (msg.success) {
                    progress.done++;
                    console.log('--------------------------------------------------------- ' + progress.done + '/' + progress.num);
                    done();
                }
                forked.kill();
            });
            forked.send({pbfDir: pbfDir, tile: tile});
        });
    }

    let timerId = calls.length + ' calls';
    console.time(timerId);
    async.parallelLimit(calls, 4, function () {
        console.log('ALL DONE');
        console.timeEnd(timerId);
    });

});






