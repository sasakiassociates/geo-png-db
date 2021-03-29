const fs = require('fs');
const mkdirp = require('mkdirp');
const Jimp = require('jimp');

const AFiler = require("./AFiler");

class NodeFiler extends AFiler {
    ensureDir(dir, callback) {
        mkdirp(dir, function (dirErr) {
            if (dirErr) {
                console.log(dirErr);
            } else {
                callback(dir);
            }
        });
    };

    fileExists(file, callback) {
        fs.access(file, fs.constants.F_OK, (err) => {
            if (err) {//doesn't exist?? should check err string
                callback(false);
            } else {
                callback(true);
            }
        });
    }

    readFile(path, options, callback) {
        fs.readFile(path, options, callback)
    }

    readdir(path, options, callback) {
        fs.readdir(path, options, callback)
    }

    writeFile(path, data, options, callback) {
        fs.writeFile(path, data, options, callback);
    }

    saveImage(path, image, callback) {
        image.write(path, callback);
    }

    copyFile(fromPath, toPath, options, callback) {
        fs.copyFile(fromPath, toPath, options, callback);
    }

    readImage(path, callback) {
        Jimp.read(path, (err, tile) => {
            callback(err, tile);
        });
    }
}

module.exports = NodeFiler;


