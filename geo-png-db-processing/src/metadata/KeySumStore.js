const AWS = require('aws-sdk');
// Set the region
AWS.config.update({region: 'us-east-1'});

const apiVersion = '2012-08-10';
const ddb = new AWS.DynamoDB({apiVersion: apiVersion});
const documentClient = new AWS.DynamoDB.DocumentClient({});


/**
 * Creates a new instance of KeySumStore.
 * @class
 * @returns An instance of KeySumStore.
 * @example
 * const keySumStore = new KeySumStore(table);
 * keySumStore.iterateAll(...);
 */
class KeySumStore {
    constructor(table) {
        this.table = table;
    };

    queryTile(tileXY) {

        const params = {
            TableName: this.table,
            FilterExpression: "contains(#Tiles, :Tile)",
            ExpressionAttributeNames: {"#Tiles": "TILES"},
            ExpressionAttributeValues: {":Tile": tileXY}
        };
        //TODO
    }

    add(blockId, value, tileXY, callback) {
        const params = {
            TableName: this.table,
            Key: {
                'BLOCK_ID': blockId,
            },
            UpdateExpression: 'ADD #TotalPixels :Pixels  SET #Tiles = list_append(if_not_exists(#Tiles, :empty_list), :Tile)',
            ExpressionAttributeNames: {
                '#TotalPixels': 'TOTAL_PIXELS',
                '#Tiles': 'TILES',
            },
            ExpressionAttributeValues: {
                ':Pixels': value,
                ':Tile': [tileXY],
                ":empty_list": []
            },
        };

        this.updatePersistently(10, 1000, params, callback);
    }

    updatePersistently(numTries, timeout, params, callback) {
        if (numTries === 0) {
            console.log(`FATAL Error ${params.Key.BLOCK_ID} : Could not update (given up)`);
            callback();
            return;
        }
        documentClient.update(params, (err, data) => {
            if (err) {
                if (err.code === 'ThrottlingException') {
                    console.log(`ThrottlingException... ${params.Key.BLOCK_ID} trying again (${numTries} left) in 1000ms`);
                    setTimeout(() => {
                        this.updatePersistently(numTries - 1, timeout, params, callback);
                    }, timeout);
                    return;
                }
                console.log("Error", err);
            } else {
                // console.log("Success", data);
            }
            if (callback) callback();
        });
    }

    iterateAll(callback) {
        const scanDb = (items, exclusiveStartKey) => {
            const params = {
                TableName: this.table,
            };
            if (exclusiveStartKey) {
                params.ExclusiveStartKey = exclusiveStartKey;
            }

            documentClient.scan(params, function (err, data) {
                if (err) {
                    console.error("Unable to query. Error:", JSON.stringify(err, null, 2));
                } else {
                    console.log("Scan succeeded: " + data.Count + ' / ' + data.ScannedCount);
                    data.Items.forEach(function (item) {
                        items.push(item);

                    });
                    if (data.LastEvaluatedKey) {
                        scanDb(items, data.LastEvaluatedKey);
                    } else {
                        if (callback) callback(items);
                    }
                }
            });
        };
        scanDb([], null);
    }
}

module.exports = KeySumStore;