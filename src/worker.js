import yaml from 'js-yaml';
import * as tf from '@tensorflow/tfjs';
import { imageCoord2Meters, getCorners, getKeypointsScore } from './utils.js';

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
    console.log(`LOADING MODEL ${model_name}`);
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
    console.log(`  task: ${task}, imgsz: ${imgsz}, num_classes: ${num_classes}`)
    console.log(`  batch_size: ${batch_size}, half: ${metadata.args.half}, int8: ${metadata.args.int8}`);
    console.log(`  metadata loaded in ${(performance.now() - t0) / 1000} seconds`);
    // load model
    t0 = performance.now();
    const model_url = `${base_dir}/models/${model_name}/model.json`;
    model = await tf.loadGraphModel(model_url);
    const dummyInput = tf.ones(model.inputs[0].shape);
    const warmupResults = model.predict(dummyInput);
    dummyInput.dispose();
    warmupResults.dispose();
    console.log(`  model loaded in ${(performance.now() - t0) / 1000} seconds`);
}
async function fetchImage(url) {
    const response = await fetch(url);
    const blob = await response.blob();
    return createImageBitmap(blob);
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

async function preprocessTiles(tiles) {
    const combos = getTileCombos(tiles);
    let chunks = [];
    for (let i = 0; i < combos.length; i += batch_size) {
        const batch = combos.slice(i, i + batch_size);
        chunks.push(batch);
    }
    return [combos, chunks];
}
async function constructImages(tiles) {
    const tileImages = await Promise.all(tiles.map(tile => fetchImage(tile.url)));
    const tileWidth = tileImages[0].width;
    const tileHeight = tileImages[0].height;
    const nx = imgsz[0] / tileWidth;
    const ny = imgsz[1] / tileHeight;
    const canvas = new OffscreenCanvas(imgsz[0], imgsz[1]);
    const ctx = canvas.getContext('2d');

    for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
            ctx.drawImage(tileImages[j * nx + i], tileWidth * i, tileHeight * j);
        }
    }
    return ctx.getImageData(0, 0, imgsz[0], imgsz[1], { colorSpace: 'srgb' });
}
function convertDetections(geometry, bounds, scores, classes, chunk) {
    const geometry_meters = convertCorners2Meters(geometry, chunk);
    const bounds_meters = convertBounds2Meters(bounds, chunk);
    const geometryArray = Array.from(geometry_meters);
    const boundsArray = Array.from(bounds_meters);
    const scoresArray = Array.from(scores);
    const classesArray = Array.from(classes);

    return classesArray.map((classIndex, i) => {
        return {
            geometry: geometryArray[i],
            bounds: boundsArray[i],
            classIndex: classIndex,
            label: labels[classIndex],
            score: scoresArray[i],
        };
    });
}
function bounds2meters(bounds, tile) {
    const { x: x_tile, y: y_tile, z: zoom } = Array.isArray(tile) ? tile[0] : tile;
    const [mx0, my0] = imageCoord2Meters(bounds[0], bounds[1], x_tile, y_tile, zoom);
    const [mx1, my1] = imageCoord2Meters(bounds[2], bounds[3], x_tile, y_tile, zoom);
    return [mx0, my0, mx1, my1]
}
function convertBounds2Meters(boxes, combos) {
    let meters = [];
    boxes.map((bounds, i) => {
        const tile = combos[i];
        bounds.forEach((bound) => {
            meters.push(bounds2meters(bound, tile));
        })
    });
    return meters;
}
function corners2meters(corners, tile) {
    const { x: x_tile, y: y_tile, z: zoom } = Array.isArray(tile) ? tile[0] : tile;
    return corners.map(([x, y]) => imageCoord2Meters(x, y, x_tile, y_tile, zoom));
}
function convertCorners2Meters(boxes, combos) {
    let meters = [];
    boxes.map((corners_list, i) => {
        const tile = combos[i];
        corners_list.forEach((corners) => {
            meters.push(corners2meters(corners, tile));
        })
    });
    return meters;
}

function getViewExtent(tiles) {
    const { x: x_tile0, y: y_tile0, z: _ } = Array.isArray(tiles) ? tiles[0] : tiles;
    const { x: x_tile1, y: y_tile1, z: zoom } = Array.isArray(tiles) ? tiles[tiles.length - 1] : tiles;
    const [mx0, my1] = imageCoord2Meters(0, 0, x_tile0, y_tile0, zoom);
    const [mx1, my0] = imageCoord2Meters(0, 0, x_tile1 + 1, y_tile1 + 1, zoom);
    return [mx0, my0, mx1, my1];
}
async function processTiles(tiles) {
    let t0;
    const [combos, chunks] = await preprocessTiles(tiles);
    console.log('preprocessTiles:', tiles.length, 'tiles', combos.length, 'images', chunks.length, 'batches');
    let geometry, bounds, scores, classes;
    for (const chunk of chunks) {
        t0 = performance.now();
        let images = [];
        for (const combo of chunk) {
            const imageData = await constructImages(combo);
            images.push(tf.browser.fromPixels(imageData).div(255.0));
        }
        if (task === "detect") {
            [geometry, bounds, scores, classes] = await detect(images);
        } else if (task === "obb") {
            [geometry, bounds, scores, classes] = await detectOBB(images);
        } else if (task === "pose") {
            [geometry, bounds, scores, classes] = await pose(images);
        }
        const results = convertDetections(geometry, bounds, scores.flat(), classes.flat(), chunk);
        self.postMessage({results: results});
    }
}

self.onmessage = async function (event) {
    if (event.data.tiles) {
        const t0 = performance.now();
        const tiles = Object.values(event.data.tiles);
        const viewExtent = getViewExtent(tiles);
        tf.engine().startScope();
        await processTiles(tiles);
        tf.engine().endScope();
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

export const detect = async (images) => {
    let bounds_data = [];
    let scores_data = [];
    let classes_data = [];
    let res, bounds, scores, classes;

    const batch = tf.stack(images);

    if (batch.shape[0] === batch_size) {
        res = model.predict(batch);
    } else {
        res = tf.tidy(() => {
            let last_batch = tf.slice(tf.concat([batch, tf.zeros(model.inputs[0].shape)]), 0, batch_size)
            let tempRes = model.predict(last_batch);
            return tf.slice(tempRes, 0, batch.shape[0]);
        });
    }
    [bounds, scores, classes] = tf.tidy(() => {
        const transRes = res.transpose([0, 2, 1]);
        const w = transRes.slice([0, 0, 2], [-1, -1, 1]);
        const h = transRes.slice([0, 0, 3], [-1, -1, 1]);
        const x1 = tf.sub(transRes.slice([0, 0, 0], [-1, -1, 1]), tf.div(w, 2));
        const y1 = tf.sub(transRes.slice([0, 0, 1], [-1, -1, 1]), tf.div(h, 2));
        const x2 = tf.add(x1, w);
        const y2 = tf.add(y1, h);
        const rawScores = transRes.slice([0, 0, 4], [-1, -1, num_classes]);
        return [tf.concat([x1, y1, x2, y2], 2), rawScores.max(2), rawScores.argMax(2)];
    });
    bounds_data.push(bounds);
    scores_data.push(scores);
    classes_data.push(classes);
    res.dispose();

    const bounds_tensor = tf.concat(bounds_data).unstack()
    const scores_tensor = tf.concat(scores_data).unstack()
    const classes_tensor = tf.concat(classes_data).unstack()

    let boxes_list = [];
    let bounds_list = [];
    let scores_list = [];
    let classes_list = [];
    let bounds_array, scores_array, classes_array;

    for (let i = 0; i < scores_tensor.length; i++) {
        bounds = bounds_tensor[i];
        scores = scores_tensor[i];
        classes = classes_tensor[i];

        const nms = await tf.image.nonMaxSuppressionAsync(bounds, scores, 500, NMS_IOU_THRESHOLD, NMS_SCORE_THRESHOLD);
        bounds_array = await bounds.gather(nms).array();
        scores_array = await scores.gather(nms).array();
        classes_array = await classes.gather(nms).array();

        boxes_list.push(bounds_array.map(box => getCorners(box)));
        bounds_list.push(bounds_array);
        scores_list.push(scores_array);
        classes_list.push(classes_array);

        bounds.dispose();
        scores.dispose();
        classes.dispose();
        nms.dispose();
    }
    return [boxes_list, bounds_list, scores_list, classes_list];
};

export const detectOBB = async (images) => {
    let bounds_data = [];
    let scores_data = [];
    let classes_data = [];
    let res, bounds, scores, classes;

    const batch = tf.stack(images);

    if (batch.shape[0] === batch_size) {
        res = model.predict(batch);
    } else {
        res = tf.tidy(() => {
            let last_batch = tf.slice(tf.concat([batch, tf.zeros(model.inputs[0].shape)]), 0, batch_size)
            let tempRes = model.predict(last_batch);
            return tf.slice(tempRes, 0, batch.shape[0]);
        });
    }
    [bounds, scores, classes] = tf.tidy(() => { // x, y, width, height, c1 ... cN, rotation
        const transRes = res.transpose([0, 2, 1]);
        const w = transRes.slice([0, 0, 2], [-1, -1, 1]); // get width
        const h = transRes.slice([0, 0, 3], [-1, -1, 1]); // get height
        const x1 = tf.sub(transRes.slice([0, 0, 0], [-1, -1, 1]), tf.div(w, 2)); // x1
        const y1 = tf.sub(transRes.slice([0, 0, 1], [-1, -1, 1]), tf.div(h, 2)); // y1
        const x2 = tf.add(x1, w); // x2
        const y2 = tf.add(y1, h); // y2
        const rotation = transRes.slice([0, 0, transRes.shape[2] - 1], [-1, -1, 1]); // rotation, between -π/2 to π/2 radians
        const rawScores = transRes.slice([0, 0, 4], [-1, -1, num_classes]);
        return [tf.concat([x1, y1, x2, y2, rotation], 2), rawScores.max(2), rawScores.argMax(2)];
    });
    bounds_data.push(bounds);
    scores_data.push(scores);
    classes_data.push(classes);
    res.dispose();

    const bounds_tensor = tf.concat(bounds_data).unstack()
    const scores_tensor = tf.concat(scores_data).unstack()
    const classes_tensor = tf.concat(classes_data).unstack()

    let boxes_list = [];
    let bounds_list = [];
    let scores_list = [];
    let classes_list = [];
    let bounds_array, scores_array, classes_array;

    for (let i = 0; i < scores_tensor.length; i++) {
        bounds = bounds_tensor[i];
        scores = scores_tensor[i];
        classes = classes_tensor[i];

    // subselect the first 4 values of the box (x1, y1, x2, y2) for nms
        const nmsBounds = bounds.slice([0, 0], [-1, 4]);
        const nms = await tf.image.nonMaxSuppressionAsync(nmsBounds, scores, 500, NMS_IOU_THRESHOLD, NMS_SCORE_THRESHOLD);
        bounds_array = await bounds.gather(nms).array();
        scores_array = await scores.gather(nms).array();
        classes_array = await classes.gather(nms).array();

        boxes_list.push(bounds_array.map((box) => getCorners(box)));
        bounds_list.push(bounds_array);
        scores_list.push(scores_array);
        classes_list.push(classes_array);

        bounds.dispose();
        scores.dispose();
        classes.dispose();
        nms.dispose();
    }
    return [boxes_list, bounds_list, scores_list, classes_list];
};

export const pose = async (images) => {
    let keypoints_data = [];
    let bounds_data = [];
    let bounds_scores_data = [];
    let classes_data = [];
    let res, keypoints, bounds, bounds_scores, classes;

    const batch = tf.stack(images);

    if (batch.shape[0] === batch_size) {
        res = model.predict(batch);
    } else {
        res = tf.tidy(() => {
            let last_batch = tf.slice(tf.concat([batch, tf.zeros(model.inputs[0].shape)]), 0, batch_size)
            let tempRes = model.predict(last_batch);
            return tf.slice(tempRes, 0, batch.shape[0]);
        });
    }
    [keypoints, bounds, bounds_scores, classes] = tf.tidy(() => {
        const transRes = res.transpose([0, 2, 1]);
        const w = transRes.slice([0, 0, 2], [-1, -1, 1]);
        const h = transRes.slice([0, 0, 3], [-1, -1, 1]);
        const x1 = tf.sub(transRes.slice([0, 0, 0], [-1, -1, 1]), tf.div(w, 2));
        const y1 = tf.sub(transRes.slice([0, 0, 1], [-1, -1, 1]), tf.div(h, 2));
        const x2 = tf.add(x1, w);
        const y2 = tf.add(y1, h);
        const rawScores = transRes.slice([0, 0, 4], [-1, -1, num_classes]);
        const kp1 = transRes.slice([0, 0, 4 + num_classes], [-1, -1, 2]);
        const kp2 = transRes.slice([0, 0, 6 + num_classes], [-1, -1, 2]);
        const kp3 = transRes.slice([0, 0, 8 + num_classes], [-1, -1, 2]);
        const kp4 = transRes.slice([0, 0, 10 + num_classes], [-1, -1, 2]);
        const kpts = tf.stack([kp1, kp2, kp3, kp4], 2);
        return [kpts, tf.concat([x1, y1, x2, y2], 2), rawScores.max(2), rawScores.argMax(2)];
    });
    keypoints_data.push(keypoints);
    bounds_data.push(bounds);
    bounds_scores_data.push(bounds_scores);
    classes_data.push(classes);
    res.dispose();

    const keypoints_tensor = tf.concat(keypoints_data).unstack()
    const bounds_tensor = tf.concat(bounds_data).unstack()
    const bounds_scores_tensor = tf.concat(bounds_scores_data).unstack()
    const classes_tensor = tf.concat(classes_data).unstack()

    let keypoints_list = [];
    let bounds_list = [];
    let scores_list = [];
    let classes_list = [];
    let keypoints_array, bounds_array, scores_array, classes_array;

    for (let i = 0; i < bounds_tensor.length; i++) {
        keypoints = keypoints_tensor[i].arraySync();
        bounds = bounds_tensor[i].arraySync();
        bounds_scores = bounds_scores_tensor[i].arraySync();
        classes = classes_tensor[i].arraySync();

        const lowScoresIdxs = bounds_scores.map((s, idx) => s > 0.8 ? idx : -1).filter(idx => idx !== -1);
        keypoints = lowScoresIdxs.map(idx => keypoints[idx]);
        bounds = lowScoresIdxs.map(idx => bounds[idx]);
        bounds_scores = lowScoresIdxs.map(idx => bounds_scores[idx]);
        classes = lowScoresIdxs.map(idx => classes[idx]);

        const keypointsScores = keypoints.map(kpts => getKeypointsScore(kpts));
        const scores = bounds_scores.map((score, idx) => (score + keypointsScores[idx]) / 2);
        const highScoresIdxs = scores.map((s, idx) => s > 0.9 ? idx : -1).filter(idx => idx !== -1);

        const filteredKeypoints = highScoresIdxs.map(idx => keypoints[idx]);
        const filteredBounds = highScoresIdxs.map(idx => bounds[idx]);
        const filteredScores = highScoresIdxs.map(idx => scores[idx]);
        const filteredClasses = highScoresIdxs.map(idx => classes[idx]);

        const keypointsTensor = tf.tensor3d(filteredKeypoints, [highScoresIdxs.length, 4, 2]);
        const boundsTensor = tf.tensor2d(filteredBounds, [highScoresIdxs.length, 4]);
        const scoresTensor = tf.tensor1d(filteredScores);
        const classesTensor = tf.tensor1d(filteredClasses, 'int32')

        const nms = await tf.image.nonMaxSuppressionAsync(boundsTensor, scoresTensor, 500, NMS_IOU_THRESHOLD, NMS_SCORE_THRESHOLD);
        keypoints_array = await keypointsTensor.gather(nms).array();
        bounds_array = await boundsTensor.gather(nms).array();
        scores_array = await scoresTensor.gather(nms).array();
        classes_array = await classesTensor.gather(nms).array();

        keypoints_list.push(keypoints_array);
        bounds_list.push(bounds_array);
        scores_list.push(scores_array);
        classes_list.push(classes_array);

        keypointsTensor.dispose();
        boundsTensor.dispose();
        scoresTensor.dispose();
        classesTensor.dispose();
        nms.dispose();
    }
    return [keypoints_list, bounds_list, scores_list, classes_list];
};

