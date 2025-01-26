import yaml from 'js-yaml';
import * as tf from '@tensorflow/tfjs';
import { getCorners, imageCoord2Meters } from './utils.js';

let base_dir = null;
let batch_size = null;
let num_classes = null;
let labels = null;
let model = null;
let imgsz = null;
let task = null;
const NMS_IOU_THRESHOLD = 0.5;
const NMS_SCORE_THRESHOLD = 0.25;

async function loadModel(model_name) {
    // load model metadata
    let t0 = performance.now();
    const metadata_url = `${base_dir}/models/${model_name}/metadata.yaml`;
    const response = await fetch(metadata_url);
    const text = await response.text();
    const metadata = yaml.load(text);
    task = metadata.task;
    imgsz = metadata.imgsz;
    labels = metadata.names;
    num_classes = Object.entries(labels).length;
    batch_size = metadata.batch;
    self.postMessage({ labels: labels });
    console.log(`task: ${task}, imgsz: ${imgsz}, num_classes: ${num_classes}`)
    console.log(`batch_size: ${batch_size}, half: ${metadata.args.half}, int8: ${metadata.args.int8}`);
    console.log(`model metadata loaded in ${(performance.now() - t0) / 1000} seconds`);
    // load model
    t0 = performance.now();
    console.log(`model loading ${model_name}`);
    const model_url = `${base_dir}/models/${model_name}/model.json`;
    model = await tf.loadGraphModel(model_url);
    const dummyInput = tf.ones(model.inputs[0].shape);
    const warmupResults = model.predict(dummyInput);
    dummyInput.dispose();
    warmupResults.dispose();
    console.log(`model loaded in ${(performance.now() - t0) / 1000} seconds`);
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
function getTileCombos(tiles) {
    const combos = [];

    const urlmap = tiles.reduce((acc, obj) => {
        // Use a string representation of (x, y, z) as the key
        const key = `${obj.x},${obj.y},${obj.z}`;
        acc[key] = obj.url;
        return acc;
    }, {});

    const tileSet = new Set(tiles.map(({ x, y, z }) => `${x},${y},${z}`));
    const nx = imgsz[0] / 256
    const ny = imgsz[1] / 256
    tiles.forEach(({ x, y, z }) => {
        const combo = []
        for (let j = 0; j < ny; j++) {
            for (let i = 0; i < nx; i++) {
                if (tileSet.has(`${x + i},${y + j},${z}`)) {
                    combo.push({ x: x + i, y: y + j, z, url: urlmap[`${x + i},${y + j},${z}`] });
                }
            }
        }
        if (combo.length === nx * ny) {
            combos.push(combo)
        }
    });
    return combos;
}
async function combineImages(tiles) {
    const tileImages = await Promise.all(tiles.map(tile => fetchImage(tile.url)));
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

async function processTile(tile, isCombo = false) {

    // get image data of the combines tile or a single tile
    let imageData;
    if (isCombo) {
        imageData = await combineImages(tile);
    } else {
        const img = await fetchImage(tile.url);
        imageData = getImageData(img);
    }
    // run the detections type on the image data
    let boxes, scores, classes;
    if (task === "detect") {
        [boxes, scores, classes] = await detect(imageData);
    } else if (task === "obb") {
        [boxes, scores, classes] = await detectOBB(imageData);
    }
    return convertDetections(boxes, scores, classes, tile);
}

function convertDetections(boxes, scores, classes, tile) {
    const { x: x_tile, y: y_tile, z: zoom } = Array.isArray(tile) ? tile[0] : tile;
    const boxesArray = Array.from(boxes);
    const scoresArray = Array.from(scores);
    const classesArray = Array.from(classes);

    return classesArray.map((classIndex, i) => {
        const box = boxesArray.slice(i * (task === "detect" ? 4 : 5), (i + 1) * (task === "detect" ? 4 : 5));
        const corners = getCorners(box);
        // console.log({ box: box, corners: corners, info: [x_center, y_center, width, height], class: classIndex });
        const meters = corners.map(([x, y]) => imageCoord2Meters(x, y, x_tile, y_tile, zoom));
        return {
            corners: meters,
            classIndex: classIndex,
            label: labels[classIndex],
            score: scoresArray[i],
        };
    });
}

function getViewExtent(tiles) {
    const { x: x_tile0, y: y_tile0, z: _ } = Array.isArray(tiles) ? tiles[0] : tiles;
    const { x: x_tile1, y: y_tile1, z: zoom } = Array.isArray(tiles) ? tiles[tiles.length - 1] : tiles;
    const [mx0, my1] = imageCoord2Meters(0, 0, x_tile0, y_tile0, zoom);
    const [mx1, my0] = imageCoord2Meters(0, 0, x_tile1 + 1, y_tile1 + 1, zoom);
    return [mx0, my0, mx1, my1];
}

self.onmessage = async function (event) {
    if (event.data.tiles) {
        const t0 = performance.now();
        const tiles = Object.values(event.data.tiles);
        const viewExtent = getViewExtent(tiles);
        if (imgsz[0] === 512 && imgsz[1] === 512) {
            const combos = getTileCombos(tiles);
            for (const combo of combos) {
                try {
                    const comboResults = await processTile(combo, true);
                    self.postMessage({results: comboResults});
                } catch (error) {
                    console.log(error);
                    self.postMessage({error: 'Error processing combo', combo});
                }
            }
        }
        if (imgsz[0] === 256 && imgsz[1] === 256) {
            for (const tile of tiles) {
                try {
                    const tileResults = await processTile(tile);
                    self.postMessage({results: tileResults});
                } catch (error) {
                    console.log(error);
                    self.postMessage({error: 'Error processing tile', tile});
                }
            }
        }
        // postprocess all results (NMM, NMS, etc.)
        self.postMessage({ nmm_extent: viewExtent });
        console.log('Detection finished in :', (performance.now() - t0) / 1000, 'seconds');
    }
    if (event.data.model) {
        self.postMessage({ ready: false });
        await loadModel(event.data.model);
        self.postMessage({ ready: true });
    }
    if (event.data.url) {
        const url = event.data.url;
        if (url.endsWith('.html')) {
            const lastSlashIndex = url.lastIndexOf('/');
            base_dir = url.substring(0, lastSlashIndex);
        } else {
            base_dir = url
        }
    }
};

const preprocess = (source) => {
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
                .resizeBilinear(imgPadded, [imgsz[0], imgsz[1]])
                .div(255.0)
                .expandDims(0)
        ];
    });
};

export const detect = async (source) => {
    tf.engine().startScope();
    const [input] = preprocess(source);
    const res = model.predict(input);

    const [boxes, scores, classes] = tf.tidy(() => {
        const transRes = res.transpose([0, 2, 1]);
        const w = transRes.slice([0, 0, 2], [-1, -1, 1]);
        const h = transRes.slice([0, 0, 3], [-1, -1, 1]);
        const x1 = tf.sub(transRes.slice([0, 0, 0], [-1, -1, 1]), tf.div(w, 2));
        const y1 = tf.sub(transRes.slice([0, 0, 1], [-1, -1, 1]), tf.div(h, 2));
        const x2 = tf.add(x1, w);
        const y2 = tf.add(y1, h);
        const rawScores = transRes.slice([0, 0, 4], [-1, -1, num_classes]).squeeze(0);
        return [tf.concat([x1, y1, x2, y2], 2).squeeze(), rawScores.max(1), rawScores.argMax(1)];
    });

    const nms = await tf.image.nonMaxSuppressionAsync(boxes, scores, 500, NMS_IOU_THRESHOLD, NMS_SCORE_THRESHOLD);
    const boxes_data = boxes.gather(nms).dataSync();
    const scores_data = scores.gather(nms).dataSync();
    const classes_data = classes.gather(nms).dataSync();

    return [boxes_data, scores_data, classes_data];
};

export const detectOBB = async (source) => {
    tf.engine().startScope();
    const [input] = preprocess(source);
    const res = model.predict(input);

    const [boxes, scores, classes] = tf.tidy(() => { // x, y, width, height, c1 ... cN, rotation
        const transRes = res.transpose([0, 2, 1]);
        const w = transRes.slice([0, 0, 2], [-1, -1, 1]); // get width
        const h = transRes.slice([0, 0, 3], [-1, -1, 1]); // get height
        const x1 = tf.sub(transRes.slice([0, 0, 0], [-1, -1, 1]), tf.div(w, 2)); // x1
        const y1 = tf.sub(transRes.slice([0, 0, 1], [-1, -1, 1]), tf.div(h, 2)); // y1
        const x2 = tf.add(x1, w); // x2
        const y2 = tf.add(y1, h); // y2
        const rotation = transRes.slice([0, 0, transRes.shape[2] - 1], [-1, -1, 1]); // rotation, between -π/2 to π/2 radians
        const rawScores = transRes.slice([0, 0, 4], [-1, -1, num_classes]).squeeze(0); // #6 only squeeze axis 0 to handle only 1 class models
        return [tf.concat([x1, y1, x2, y2, rotation], 2).squeeze(), rawScores.max(1), rawScores.argMax(1)];
    });

    // subselect the first 4 values of the box (x1, y1, x2, y2) for nms
    const nmsBoxes = boxes.slice([0, 0], [-1, 4]);
    const nms = await tf.image.nonMaxSuppressionAsync(nmsBoxes, scores, 500, NMS_IOU_THRESHOLD, NMS_SCORE_THRESHOLD);
    const boxes_data = boxes.gather(nms, 0).dataSync();
    const scores_data = scores.gather(nms, 0).dataSync();
    const classes_data = classes.gather(nms, 0).dataSync();

    return [boxes_data, scores_data, classes_data];
};