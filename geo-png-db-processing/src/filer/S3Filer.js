let AWS = require('aws-sdk');
let s3 = new AWS.S3();
const AFiler = require("./AFiler");
const Jimp = require('jimp');

class S3Filer extends AFiler {
    constructor(bucket) {
        super();
        this.bucket = bucket;
    }

    ensureDir(dir, callback) {
        callback();//Note: S3 doesn't need to create a dir
    }

    fileExists(file, callback) {
        const params = {Bucket: this.bucket, Key: file};
        s3.headObject(params).on('success', function (response) {
            callback(true);
        }).on('error', function (error) {
            //error return a object with status code 404
            callback(false);
        }).send();
    }

    fileLastModified(file, callback) {
        const params = {Bucket: this.bucket, Key: file};
        s3.headObject(params).on('success', function (response) {
            callback(null, response);
        }).on('error', function (error) {
            //error return a object with status code 404
            callback(error);
        }).send();
    }

    interpretParams(options, callback) {
        if (!callback) {
            callback = options;
            options = {};
        }
        return {options, callback};
    }

    writeFile(path, data, o, c) {
        const {options, callback} = this.interpretParams(o, c);
        const contentType = options.contentType || "application/json";
        const s3Params = {
            Bucket: this.bucket,
            Key: path,
            Body: data,
            ContentType: contentType
        };
        try {
            s3.putObject(s3Params, function (err, data) {
                if (err) {
                    console.log('ERR: S3 putobject...');
                    console.log(JSON.stringify(err), err.stack);
                    callback(err);
                } else {
                    // console.log('SUCCESS S3 putobject...' + s3Params.Bucket + '/' + s3Params.Key);
                    callback(null);
                }
            });
        } catch (e) {
            callback(e);
        }
    }

    copyFile(fromPath, toPath, o, c) {
        const {options, callback} = this.interpretParams(o, c);

        const params = {
            Bucket: this.bucket,
            CopySource: fromPath,
            Key: toPath
        };
        try {
            s3.copyObject(params,
                function (err, data) {
                    if (err) {
                        // console.log(err, err.stack); //--this may be common for ENOENTs
                        callback(err, null);
                    } else {
                        callback(null, data);

                    }
                });
        } catch (e) {
            callback(e, null);
        }
    }

    readFile(path, o, c) {
        const {options, callback} = this.interpretParams(o, c);
        const params = {
            Bucket: this.bucket,
            Key: path
        };
        try {
            s3.getObject(params,
                function (err, data) {
                    if (err) {
                        // console.log(err, err.stack); //--this may be common for ENOENTs
                        callback(err, null);
                    } else {
                        callback(null, data.Body);

                    }
                });
        } catch (e) {
            callback(e, null);
        }
    }

    loadFilesFromS3(items, path, marker, callback) {
        const params = {
            Bucket: this.bucket,
            Prefix: path
        };

        // are we paging from a specific point?
        if (marker) {
            params.StartAfter = marker;
        }

        const pathBits = path.split('/');

        s3.listObjectsV2(params, (err, data) => {
            if (err) {
                console.error('Problem listing objects for ' + path + ': ' + err);
                if (err.code === 'AccessDenied') {
                    console.log('Note that "ListBucket" permission is required');
                }
                callback(err);
                return;
            }
            const pageItems = data.Contents.map((file) => {
                const keyBits = file.Key.split('/');
                //include the full path within the dir 'path' that is passed in (use ${path}${file} to get full path)
                //this replicates Node behavior (except that it's a 'deep' search)
                keyBits.splice(0, pathBits.length);
                return keyBits.join('/');
            });
            [].push.apply(items, pageItems);
            console.log('Found objects: ' + items.length);

            // are we paging?
            if (data.IsTruncated) {
                const length = data.Contents.length;
                const marker = data.Contents[length - 1].Key;
                this.loadFilesFromS3(items, path, marker, callback);
            } else {
                callback(null, items);
            }

        });
    }

    readdir(path, o, c) {
        const {options, callback} = this.interpretParams(o, c);
        const params = {
            Bucket: this.bucket,
            Prefix: path
        };
        if (options.limit) {
            params.MaxKeys = options.limit
        }
        const items = [];
        this.loadFilesFromS3(items, path, null, (err, items) => {
            callback(err, items);
        });
    }

    saveImage(path, image, callback) {
        image.getBufferAsync(Jimp.MIME_PNG).then((buffer) => {
            this.writeFile(path, buffer, {contentType: 'image/png'}, callback);
        });
    }

    readImage(path, callback) {
        this.readFile(path, (err, buffer) => {
            if (err) {
                callback(err);
                return;
            }
            Jimp.read(buffer)
                .then(image => {
                    callback(null, image);
                })
                .catch(err => {
                    callback(err, null);
                });
        });

    }


}

module.exports = S3Filer;


