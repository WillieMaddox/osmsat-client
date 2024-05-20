import * as tf from '@tensorflow/tfjs';
import labels from "./labels.json";

const numClass = labels.length;
let BASE_DIR = null;
let model = null;
let type = null;
const NMS_IOU_THRESHOLD = 0.5;
const NMS_SCORE_THRESHOLD = 0.5;

// Load and warm up the model
async function loadModel(MODEL_NAME) {
    const MODEL_URL = `${BASE_DIR}/models/${MODEL_NAME}/model.json`;
    const model = await tf.loadGraphModel(MODEL_URL);
    const dummyInput = tf.ones(model.inputs[0].shape);
    const warmupResults = model.predict(dummyInput);
    tf.dispose([warmupResults, dummyInput]);
    self.postMessage({ ready: true });
    return model;
}

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
    const imageData = ctx.getImageData(0, 0, img.width, img.height, { colorSpace: 'srgb' });

    // Perform detection using the model
    let boxes, scores, classes;
    if (type == "hbb") {
        [boxes, scores, classes] = await detect(imageData, model);
        // Convert the Float32Array to regular Arrays
        const boxesArray = Array.from(boxes); // [y1, x1, y2, x2]
        const scoresArray = Array.from(scores);
        const classesArray = Array.from(classes);
        // Create instances by splitting 4 boxes, 1 score, 1 class
        const instances = classesArray.map((className, i) => [
            boxesArray.slice(i * 4, (i + 1) * 4),
            scoresArray[i],
            className
        ]);
        // Convert instances to instance info
        let detections = instances.map(instance => {
            const [box, score, classIndex] = instance;
            const [y1, x1, y2, x2] = box; // [x1, y1, x2, y2]
            const corners = getCorners(x1, y1, x2 - x1, y2 - y1, 0);
            const worldCorners = corners.map(([x, y]) => imageCord2WorldCords(x, y, x_tile, y_tile, zoom));
            return {
                corners: worldCorners,
                score: score,
                className: classIndex
            };
        });
        return detections;
    }
    else if (type == "obb") {
        [boxes, scores, classes] = await detect_obb(imageData, model);
        // Convert the Float32Array to regular Arrays
        const boxesArray = Array.from(boxes); // y1 x1 y2 x2 rotation
        const scoresArray = Array.from(scores);
        const classesArray = Array.from(classes);
        // Create instances by splitting 5 values for boxes, 1 score, 1 class
        const instances = classesArray.map((className, i) => [
            boxesArray.slice(i * 5, (i + 1) * 5),
            scoresArray[i],
            className
        ]);
        // Convert instances to instance info
        let detections = instances.map(instance => {
            const [box, score, classIndex] = instance;
            const [y1, x1, y2, x2, angle] = box; // y1 x1 y2 x2 rotation
            // get x_center, y_center, width, height, angle from these values
            const x_center = (x1 + x2) / 2;
            const y_center = (y1 + y2) / 2;
            const width = x2 - x1;
            const height = y2 - y1;
            const corners = getCorners(x_center, y_center, width, height, angle);
            const worldCorners = corners.map(([x, y]) => imageCord2WorldCords(x, y, x_tile, y_tile, zoom));
            return {
                corners: worldCorners,
                score: score,
                className: classIndex
            };
        });
        return detections;
    }
}

// Listen for messages from the main thread
self.onmessage = async function (event) {

    const tiles = event.data;

    // Process each tile separately
    for (let i = 0; i < tiles.length; i++) {
        const tile = tiles[i];
        try {
            console.log('Processing tile:', tile);
            const tileResults = await processTile(tile);
            // Send the results back to the main thread after processing each tile
            self.postMessage({ results: tileResults });
        } catch (error) {
            console.error('Error processing tile:', error);
            // Send an error message back to the main thread
            self.postMessage({ error: 'Error processing tile', tile });
        }
    }

    // Check if event.model exists and update the model name
    if (event.data.model) {
        self.postMessage({ ready: false });
        model = await loadModel(event.data.model);
        type = event.data.type;
        self.postMessage({ ready: true });
    }

    // if we get a event.data.url we can update the window.location.href
    if (event.data.url) {
        BASE_DIR = event.data.url;
    };
};

/**
 * Preprocess image / frame before forwarded into the model
 * @param {HTMLVideoElement|HTMLImageElement} source
 * @param {Number} modelWidth
 * @param {Number} modelHeight
 * @returns input tensor, xRatio and yRatio
 */
const preprocess = (source, modelWidth, modelHeight) => {

    const input = tf.tidy(() => {
        const img = tf.browser.fromPixels(source);

        // padding image to square => [n, m] to [n, n], n > m
        const [h, w] = img.shape.slice(0, 2); // get source width and height
        const maxSize = Math.max(w, h); // get max size
        const imgPadded = img.pad([
            [0, maxSize - h], // padding y [bottom only]
            [0, maxSize - w], // padding x [right only]
            [0, 0],
        ]);

        return tf.image
            .resizeBilinear(imgPadded, [modelWidth, modelHeight]) // resize frame
            .div(255.0) // normalize
            .expandDims(0); // add batch
    });

    return [input];
};

/**
 * Function run inference and do detection from source.
 * @param {HTMLImageElement|HTMLVideoElement} source
 * @param {tf.GraphModel} model loaded YOLOv8 tensorflow.js model
 */
export const detect = async (source, model) => {

    tf.engine().startScope(); // start scoping tf engine
    const [input] = preprocess(source, 640, 640); // preprocess image

    const res = model.predict(input); // inference model
    // console.log(res.shape);

    const transRes = res.transpose([0, 2, 1]); // transpose result [b, det, n] => [b, n, det]
    // console.log(transRes.shape);
    // console.log(transRes.arraySync()[0][0].slice(0, 4)); // [x, y, w, h, class_scores]

    const boxes = tf.tidy(() => {
        const w = transRes.slice([0, 0, 2], [-1, -1, 1]); // get width
        const h = transRes.slice([0, 0, 3], [-1, -1, 1]); // get height
        const x1 = tf.sub(transRes.slice([0, 0, 0], [-1, -1, 1]), tf.div(w, 2)); // x1
        const y1 = tf.sub(transRes.slice([0, 0, 1], [-1, -1, 1]), tf.div(h, 2)); // y1
        const x2 = tf.add(x1, w); // x2
        const y2 = tf.add(y1, h); // y2
        const boxes = tf.concat([y1, x1, y2, x2], 2).squeeze();
        return boxes;
    });

    const [scores, classes] = tf.tidy(() => {
        // class scores
        const rawScores = transRes.slice([0, 0, 4], [-1, -1, numClass]).squeeze(0); // #6 only squeeze axis 0 to handle only 1 class models
        return [rawScores.max(1), rawScores.argMax(1)];
    }); // get max scores and classes index

    const nms = await tf.image.nonMaxSuppressionAsync(boxes, scores, 500, NMS_IOU_THRESHOLD, NMS_SCORE_THRESHOLD); // NMS to filter boxes
    // console.log(nms.dataSync());

    const boxes_data = boxes.gather(nms, 0).dataSync(); // indexing boxes by nms index
    const scores_data = scores.gather(nms, 0).dataSync(); // indexing scores by nms index
    const classes_data = classes.gather(nms, 0).dataSync(); // indexing classes by nms index
    // console.log(boxes_data, scores_data, classes_data);

    return [boxes_data, scores_data, classes_data];
};

/**
 * Function run inference and do detection from source.
 * @param {HTMLImageElement|HTMLVideoElement} source
 * @param {tf.GraphModel} model loaded YOLOv8 tensorflow.js model
 */
export const detect_obb = async (source, model) => {

    tf.engine().startScope(); // start scoping tf engine
    const [input] = preprocess(source, 640, 640); // preprocess image

    const res = model.predict(input); // inference model
    // console.log(res.shape);

    const transRes = res.transpose([0, 2, 1]); // transpose result [b, det, n] => [b, n, det]
    // console.log(transRes.shape);
    // console.log(transRes.arraySync()[0][0].slice(0, 4)); // [x, y, w, h, class_scores]

    const boxes = tf.tidy(() => { // x, y, width, height, c1 ... cN, rotation
        const w = transRes.slice([0, 0, 2], [-1, -1, 1]); // get width
        const h = transRes.slice([0, 0, 3], [-1, -1, 1]); // get height
        const x1 = tf.sub(transRes.slice([0, 0, 0], [-1, -1, 1]), tf.div(w, 2)); // x1
        const y1 = tf.sub(transRes.slice([0, 0, 1], [-1, -1, 1]), tf.div(h, 2)); // y1
        const x2 = tf.add(x1, w); // x2
        const y2 = tf.add(y1, h); // y2
        const rotation = transRes.slice([0, 0, transRes.shape[2] - 1], [-1, -1, 1]); // rotation, between -π/2 to π/2 radians 
        const boxes = tf.concat([y1, x1, y2, x2, rotation], 2).squeeze(); // y1 x1 y2 x2 rotation
        return boxes;
    });

    // console.log(boxes.shape); // [8400,5]

    const [scores, classes] = tf.tidy(() => {
        // class scores
        const rawScores = transRes.slice([0, 0, 4], [-1, -1, numClass]).squeeze(0); // #6 only squeeze axis 0 to handle only 1 class models
        return [rawScores.max(1), rawScores.argMax(1)];
    }); // get max scores and classes index

    // grab the first 4 columns of boxes () exlcuding the rotation for nms, go from [8400, 5] to [8400, 4]
    const boxesForNMS = boxes.slice([0, 0], [-1, 4]);

    // nms
    const nms = await tf.image.nonMaxSuppressionAsync(boxesForNMS, scores, 500, NMS_IOU_THRESHOLD, NMS_SCORE_THRESHOLD); // NMS to filter boxes
    // console.log(nms.dataSync());

    const boxes_data = boxes.gather(nms, 0).dataSync(); // indexing boxes by nms index
    const scores_data = scores.gather(nms, 0).dataSync(); // indexing scores by nms index
    const classes_data = classes.gather(nms, 0).dataSync(); // indexing classes by nms index
    // console.log(boxes_data, scores_data, classes_data);

    return [boxes_data, scores_data, classes_data];
};

function tileZXYToLatLon(x, y, zoomLevel) {
    // EPSG:3857
    const z = Math.trunc(zoomLevel);
    const maxXY = (1 << z) - 1;
    if (x < 0 || x > maxXY || y < 0 || y > maxXY) {
        throw new Error(`Tile coordinates are out of range [0,${maxXY}]`);
    }
    const lon = (x / (1 << z)) * 360 - 180;
    const n = Math.PI - (2 * Math.PI * y) / (1 << z);
    const lat = (180 / Math.PI) * Math.atan(Math.sinh(n));
    return { lat, lon };
}

export function imageCord2WorldCords(img_x, img_y, tile_x, tile_y, zoom) {
    // Get the starting coordinates of the tile
    const startingCoords = tileZXYToLatLon(tile_x, tile_y, zoom);
    const img_size = 640; // size of the image

    // Each tile is a part of the world map
    const worldSize = Math.pow(2, zoom); // total size of the map at the current zoom level
    const lat_deg_per_pixel = 360 / worldSize;
    const lon_deg_per_pixel = 360 / worldSize;

    const lon_deg = startingCoords.lon + (img_x / img_size) * lon_deg_per_pixel;
    const lat_deg = startingCoords.lat - (img_y / img_size) * lat_deg_per_pixel;

    return [lat_deg, lon_deg];
}

// Function to calculate the 4 corners of the rotated bounding box
function getCorners(x_center, y_center, width, height, radians) {
    // angle goes from -pi/2 to pi/2 with 0 being the horizontal axis in radians
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);

    // Half dimensions
    const halfWidth = width / 2;
    const halfHeight = height / 2;

    // Corners relative to the center
    const corners = [
        [-halfWidth, -halfHeight],
        [halfWidth, -halfHeight],
        [halfWidth, halfHeight],
        [-halfWidth, halfHeight]
    ];

    // Calculate rotated corners
    return corners.map(([dx, dy]) => {
        const x = x_center + dx * cos - dy * sin;
        const y = y_center + dx * sin + dy * cos;
        return [x, y];
    });
}
