import { detect, imageCord2WorldCords } from './utils.js';
import * as tf from '@tensorflow/tfjs';

// Load and warm up the model
const MODEL_URL = 'http://127.0.0.1:8080/model.json';
const model = await tf.loadGraphModel(MODEL_URL);
const dummyInput = tf.ones(model.inputs[0].shape);
const warmupResults = model.execute(dummyInput);
tf.dispose([warmupResults, dummyInput]);
console.log('Model loaded and warmed up');

// Helper function to process a single tile
async function processTile(tile) {
    // Get tile info from tile name
    const x_tile = tile.match(/[?&]x=(\d+)/)[1];
    const y_tile = tile.match(/[?&]y=(\d+)/)[1];
    const zoom = tile.match(/[?&]z=(\d+)/)[1];

    // Fetch the image as a blob
    const response = await fetch(tile);
    const blob = await response.blob();

    // Convert the blob into ImageData
    const img = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, img.width, img.height);

    // Perform detection using the model
    const [boxes, scores, classes] = await detect(imageData, model);

    // Convert the Float32Array to regular Arrays
    const boxesArray = Array.from(boxes); // [x1, y1, x2, y2]
    const scoresArray = Array.from(scores);
    const classesArray = Array.from(classes);

    // Create instances by splitting 4 boxes, 1 score, 1 class
    const instances = classesArray.map((className, i) => [
        boxesArray.slice(i * 4, i * 4 + 4),
        scoresArray[i],
        className
    ]);

    // Convert instances to instance info
    return instances.map(instance => {
        const [box, score, className] = instance;
        const [px1, py1, px2, py2] = box;
        const cord1 = imageCord2WorldCords(px1, py1, x_tile, y_tile, zoom);
        const cord2 = imageCord2WorldCords(px2, py2, x_tile, y_tile, zoom);
        return [cord1[1], cord1[0], cord2[1], cord2[0], score, className];
    });
}

// Listen for messages from the main thread
self.onmessage = async function (event) {
    const tiles = event.data;
    const batchSize = 8;

    // Process the tiles in batches
    let stopwatch = performance.now();
    for (let i = 0; i < tiles.length; i += batchSize) {
        const batch = tiles.slice(i, i + batchSize);

        const batchPromises = batch.map(tile => processTile(tile));

        try {
            const batchResults = await Promise.all(batchPromises);
            const flattenedResults = batchResults.flat();

            // Send the cords back to the main thread
            self.postMessage({ results: flattenedResults });
        } catch (error) {
            console.error('Error processing batch:', error);
        }
    }
    console.log('Processed', tiles.length, 'tiles in', performance.now() - stopwatch, 'ms');
};
