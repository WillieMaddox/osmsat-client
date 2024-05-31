import { getCorners, tilePixelToWorld } from './utils.js';
import * as tf from '@tensorflow/tfjs';
import labels from "./labels.json";

let base_dir = null;
let model = null;
let type = null;
const numClass = labels.length;
const NMS_IOU_THRESHOLD = 0.5;
const NMS_SCORE_THRESHOLD = 0.25;

async function loadModel(MODEL_NAME) {
    const MODEL_URL = `${base_dir}/models/${MODEL_NAME}/model.json`;
    model = await tf.loadGraphModel(MODEL_URL);
    const dummyInput = tf.ones(model.inputs[0].shape);
    const warmupResults = model.predict(dummyInput);
    tf.dispose([warmupResults, dummyInput]);
    self.postMessage({ ready: true });
}

function genGoogleUrl(x, y, z) {
    const randomSuffix = Math.floor(Math.random() * 4);
    return `https://mt${randomSuffix}.google.com/vt/lyrs=s&x=${x}&y=${y}&z=${z}`;
}

async function fetchImage(url) {
    const response = await fetch(url);
    const blob = await response.blob();
    return createImageBitmap(blob);
}

function getImageData(img) {
    const canvas = new OffscreenCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    return ctx.getImageData(0, 0, img.width, img.height, { colorSpace: 'srgb' });
}

async function combineImages(tiles) {
    const tileImages = await Promise.all(tiles.map(tile => fetchImage(genGoogleUrl(tile.x, tile.y, tile.z))));
    const tileWidth = tileImages[0].width;
    const tileHeight = tileImages[0].height;
    const canvas = new OffscreenCanvas(2 * tileWidth, 2 * tileHeight);
    const ctx = canvas.getContext('2d');

    ctx.drawImage(tileImages[0], 0, 0);
    ctx.drawImage(tileImages[1], tileWidth, 0);
    ctx.drawImage(tileImages[2], 0, tileHeight);
    ctx.drawImage(tileImages[3], tileWidth, tileHeight);

    return ctx.getImageData(0, 0, 2 * tileWidth, 2 * tileHeight, { colorSpace: 'srgb' });
}

async function debugTile(tile) {
    const { x, y, z } = tile;
    const url = genGoogleUrl(x, y, z);
    const img = await fetchImage(url);
    const imageData = getImageData(img);
    const [boxes, scores, classes] = await detect(imageData, model);
    const detections = convertDetections(boxes, scores, classes, tile);
    return detections;
}

async function processTile(tile, isCombo = false) {

    // get image data of the combines tile or a single tile
    let imageData;
    let size = 640;
    if (isCombo) {
        imageData = await combineImages(tile);
        size = 320; // double the scaling when converting 4 tiles to 1
    } else {
        const { x, y, z } = tile;
        const url = genGoogleUrl(x, y, z);
        const img = await fetchImage(url);
        imageData = getImageData(img);
    }

    // run the detections type on the image data
    let boxes, scores, classes;
    if (type === "hbb") {
        [boxes, scores, classes] = await detect(imageData, model);
    } else if (type === "obb") {
        [boxes, scores, classes] = await detectOBB(imageData, model);
    }

    return convertDetections(boxes, scores, classes, tile, size);
}

function convertDetections(boxes, scores, classes, tile, size = 640) {
    const { x: x_tile, y: y_tile, z: zoom } = Array.isArray(tile) ? tile[0] : tile;
    const boxesArray = Array.from(boxes);
    const scoresArray = Array.from(scores);
    const classesArray = Array.from(classes);

    return classesArray.map((classIndex, i) => {
        const box = boxesArray.slice(i * (type === "hbb" ? 4 : 5), (i + 1) * (type === "hbb" ? 4 : 5));
        const [x1, y1, x2, y2, angle] = box;
        const x_center = (x1 + x2) / 2;
        const y_center = (y1 + y2) / 2;
        const width = x2 - x1;
        const height = y2 - y1;
        const corners = getCorners(x_center, y_center, width, height, angle || 0);
        // console.log({ box: box, corners: corners, info: [x_center, y_center, width, height], class: classIndex });
        const worldCorners = corners.map(([x, y]) => tilePixelToWorld(x, y, size, x_tile, y_tile, zoom));
        return {
            corners: worldCorners,
            score: scoresArray[i],
            className: classIndex
        };
    });
}

function checkAdjacentTiles(tiles) {
    const tileCoords = tiles.map(({ x, y, z }) => ({ x, y, z }));
    const tileSet = new Set(tileCoords.map(({ x, y, z }) => `${x},${y},${z}`));

    const combos = [];
    tileCoords.forEach(({ x, y, z }) => {
        if (
            tileSet.has(`${x},${y},${z}`) &&
            tileSet.has(`${x + 1},${y},${z}`) &&
            tileSet.has(`${x},${y + 1},${z}`) &&
            tileSet.has(`${x + 1},${y + 1},${z}`)
        ) {
            combos.push([
                { x, y, z },
                { x: x + 1, y, z },
                { x, y: y + 1, z },
                { x: x + 1, y: y + 1, z }
            ]);
            tileSet.delete(`${x},${y},${z}`);
            tileSet.delete(`${x + 1},${y},${z}`);
            tileSet.delete(`${x},${y + 1},${z}`);
            tileSet.delete(`${x + 1},${y + 1},${z}`);
        }
    });

    const comboTilesSet = new Set(combos.flat().map(({ x, y, z }) => `${x},${y},${z}`));
    const extraTiles = tiles.filter(({ x, y, z }) => !comboTilesSet.has(`${x},${y},${z}`));

    return { combos, extraTiles };
}

self.onmessage = async function (event) {
    if (event.data.tiles) {
        const tiles = Object.values(event.data.tiles);
        const { combos, extraTiles } = checkAdjacentTiles(tiles);

        for (const combo of combos) {
            try {
                const comboResults = await processTile(combo, true);
                self.postMessage({ results: comboResults });
            } catch (error) {
                console.log(error);
                self.postMessage({ error: 'Error processing combo', combo });
            }
        }

        for (const tile of extraTiles) {
            try {
                const tileResults = await processTile(tile);
                self.postMessage({ results: tileResults });
            } catch (error) {
                console.log(error);
                self.postMessage({ error: 'Error processing tile', tile });
            }
        }
    }

    if (event.data.model) {
        self.postMessage({ ready: false });
        await loadModel(event.data.model);
        type = event.data.type;
        self.postMessage({ ready: true });
    }

    if (event.data.url) { // initialize base_dir
        base_dir = event.data.url;
    }

    if (event.data.debugTile) { // hardcorded debug tile
        const tile = event.data.debugTile;
        const debugResults = await debugTile(tile);
        self.postMessage({ results: debugResults });
    }
};

const preprocess = (source, modelWidth, modelHeight) => {
    return tf.tidy(() => {
        const img = tf.browser.fromPixels(source);
        const [h, w] = img.shape.slice(0, 2);
        const maxSize = Math.max(w, h);
        const imgPadded = img.pad([
            [0, maxSize - h],
            [0, maxSize - w],
            [0, 0]
        ]);

        return [
            tf.image
                .resizeBilinear(imgPadded, [modelWidth, modelHeight])
                .div(255.0)
                .expandDims(0)
        ];
    });
};

export const detect = async (source, model) => {
    tf.engine().startScope();
    const [input] = preprocess(source, 640, 640);
    const res = model.predict(input);
    const transRes = res.transpose([0, 2, 1]);

    const boxes = tf.tidy(() => {
        const w = transRes.slice([0, 0, 2], [-1, -1, 1]);
        const h = transRes.slice([0, 0, 3], [-1, -1, 1]);
        const x1 = tf.sub(transRes.slice([0, 0, 0], [-1, -1, 1]), tf.div(w, 2));
        const y1 = tf.sub(transRes.slice([0, 0, 1], [-1, -1, 1]), tf.div(h, 2));
        const x2 = tf.add(x1, w);
        const y2 = tf.add(y1, h);
        return tf.concat([x1, y1, x2, y2], 2).squeeze();
    });

    const [scores, classes] = tf.tidy(() => {
        const rawScores = transRes.slice([0, 0, 4], [-1, -1, numClass]).squeeze(0);
        return [rawScores.max(1), rawScores.argMax(1)];
    });

    const nms = await tf.image.nonMaxSuppressionAsync(boxes, scores, 500, NMS_IOU_THRESHOLD, NMS_SCORE_THRESHOLD);
    const boxes_data = boxes.gather(nms, 0).dataSync();
    const scores_data = scores.gather(nms, 0).dataSync();
    const classes_data = classes.gather(nms, 0).dataSync();

    return [boxes_data, scores_data, classes_data];
};

export const detectOBB = async (source, model) => {
    tf.engine().startScope();
    const [input] = preprocess(source, 640, 640);
    const res = model.predict(input);
    const transRes = res.transpose([0, 2, 1]);

    const boxes = tf.tidy(() => { // x, y, width, height, c1 ... cN, rotation
        const w = transRes.slice([0, 0, 2], [-1, -1, 1]); // get width
        const h = transRes.slice([0, 0, 3], [-1, -1, 1]); // get height
        const x1 = tf.sub(transRes.slice([0, 0, 0], [-1, -1, 1]), tf.div(w, 2)); // x1
        const y1 = tf.sub(transRes.slice([0, 0, 1], [-1, -1, 1]), tf.div(h, 2)); // y1
        const x2 = tf.add(x1, w); // x2
        const y2 = tf.add(y1, h); // y2
        const rotation = transRes.slice([0, 0, transRes.shape[2] - 1], [-1, -1, 1]); // rotation, between -π/2 to π/2 radians 
        const boxes = tf.concat([x1, y1, x2, y2, rotation], 2).squeeze(); // y1 x1 y2 x2 rotation
        return boxes;
    });

    const [scores, classes] = tf.tidy(() => {
        const rawScores = transRes.slice([0, 0, 4], [-1, -1, numClass]).squeeze(0); // #6 only squeeze axis 0 to handle only 1 class models
        return [rawScores.max(1), rawScores.argMax(1)];
    });

    // subselect the first 4 values of the box (x1, y1, x2, y2) for nms
    const nmsBoxes = boxes.slice([0, 0], [-1, 4]);
    const nms = await tf.image.nonMaxSuppressionAsync(nmsBoxes, scores, 500, NMS_IOU_THRESHOLD, NMS_SCORE_THRESHOLD);
    const boxes_data = boxes.gather(nms, 0).dataSync();
    const scores_data = scores.gather(nms, 0).dataSync();
    const classes_data = classes.gather(nms, 0).dataSync();

    return [boxes_data, scores_data, classes_data];
};
