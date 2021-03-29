const process = require('process');//not technically needed (always available)
const request = require('request');
const fs = require('fs');
const os = require('os');
let AWS = require('aws-sdk');
AWS.config.update({region: 'us-east-1'});
const async = require('async');

/**
 * Creates a new instance of QueueProcessor.
 * @class
 * @returns An instance of QueueProcessor.
 * @example
 * var instance = new QueueProcessor();
 */
class QueueProcessor {

    constructor(queueName, batchSize, baseInfo) {
        this.queueName = queueName;
        this.batchSize = batchSize;
        this.baseInfo = baseInfo;
        this.limitBatches = false; //false or number
    };


    processTilesToQueue(queueInfo, callback) {
        const sqs = new AWS.SQS({apiVersion: '2012-11-05'});

        const params = {
            DelaySeconds: 1,
            MessageAttributes: {},
            MessageBody: JSON.stringify(queueInfo),
            QueueUrl: "https://sqs.us-east-1.amazonaws.com/780311654181/" + this.queueName //from https://console.aws.amazon.com/sqs/home?region=us-east-1
        };

        sqs.sendMessage(params, function (err, data) {
            if (err) {
                console.log("Error", err);
            } else {
                console.log("Success", data.MessageId);
            }
            callback(err, data);
        });
    };

    validateAllTilesInABatch(tiles11, processBatches) {
        const allTiles = {};
        tiles11.forEach((tile11, i) => {
            allTiles[tile11.join('_')] = {match: false}
        });

        processBatches.forEach((batch11, i) => {
            batch11.forEach((tile11, i) => {
                allTiles[tile11.join('_')].match = true;
            });
        });

        let matchCount = 0;
        Object.keys(allTiles).forEach((k) => {
            var matchTile = allTiles[k];
            if (matchTile.match) {
                matchCount++;
            } else {
                console.log('BATCH SKIPPED ME: ' + k);
            }
        });
        console.log(`matched ${matchCount} of ${tiles11.length}`);
    }

    processZ11ToQueue(tiles11, parallelLimit, callback) {
        let progress = {done: 0, num: 0, called: 0};

        const calls = [];

        const tileBatches = [];
        let currentBatch = [];
        tileBatches.push(currentBatch);
        tiles11.forEach((tile11, i) => {
            currentBatch.push(tile11);
            if (currentBatch.length === this.batchSize) {
                currentBatch = [];
                tileBatches.push(currentBatch)
            }
        });

        let processBatches;
        if (this.limitBatches) {
            processBatches = tileBatches.slice(0, this.limitBatches);
        } else {
            processBatches = tileBatches;
        }

        // this.validateAllTilesInABatch(tiles11, processBatches);

        processBatches.forEach((batch11, i) => {
            progress.num++;
            calls.push((done) => {
                progress.called++;
                let queueInfo = JSON.parse(JSON.stringify(this.baseInfo));
                queueInfo.tiles = batch11;
                this.processTilesToQueue(queueInfo, (err, result) => {
                    progress.done++;
                    if (err) {
                        console.error(err);
                    } else {
                        if (progress.done % 10 === 0) {
                            console.log(`Pushed to queue ${progress.done} / ${progress.called}`);
                        }
                    }
                    done();
                });

            });

        });
        let timerId = calls.length + ' calls';
        console.time(timerId);
        //NOTE: for Lambda parallelLimit equates to concurrency of lambdas running in parallel
        async.parallelLimit(calls, parallelLimit, () => {
            console.log('ALL DONE');
            if (callback) callback();
        });

    }
}

module.exports = QueueProcessor;