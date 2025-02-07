
import { Feature } from "ol";
import { Polygon } from "ol/geom";
import { meter2pixel, getCorners, WorldPixels2Meters } from "./utils";

class BoundingBox {
    constructor(box) {
        if (box[0] < 0 || box[1] < 0 || box[2] < 0 || box[3] < 0) {
            throw new Error("Box coords [minx, miny, maxx, maxy] cannot be negative");
        }
        this.minx = box[0];
        this.miny = box[1];
        this.maxx = box[2];
        this.maxy = box[3];

    }

    toVocBBox() {
        return [this.minx, this.miny, this.maxx, this.maxy];
    }

}

class Category {
    constructor(id = null, name = null) {
        if (typeof id !== 'number') {
            throw new TypeError("id should be integer");
        }
        if (typeof name !== 'string') {
            throw new TypeError("name should be string");
        }
        this.id = id;
        this.name = name;
    }
}

class Keypoints {
    constructor(keypoints = null) {
        this.keypoints = keypoints;
    }

    asArray() {
        return this.keypoints;
    }

}

class ObjectAnnotation {
    constructor({
        bbox = null,
        keypoints = null,
        category_id = null,
        category_name = null,
    } = {}) {
        if (typeof category_id !== 'number') {
            throw new Error(`category_id must be an integer, got type ${typeof category_id}`);
        }
        if (bbox === null && keypoints === null) {
            throw new Error("you must provide a bbox or keypoints");
        }
        if (bbox === null) {
            throw new Error("you must provide a bbox");
        }

        this.bbox = new BoundingBox(bbox);
        this.keypoints = new Keypoints(keypoints);
        this.category = new Category(category_id, category_name || String(category_id));
        this.merged = null;
    }
}

class PredictionScore {
    constructor(value) {
        if (typeof value === 'object' && value !== null && value.constructor.name === 'Float32Array') {
            value = Array.from(value);
        }
        this.value = value;
    }
}

class ObjectPrediction extends ObjectAnnotation {
    constructor({
        bbox = null,
        category_id = null,
        category_name = null,
        keypoints = null,
        score = 0,
    } = {}) {
        super({ bbox, category_id, category_name, keypoints });
        this.score = new PredictionScore(score);
    }
}

class ObjectPredictionList {
    constructor(list) {
        this.list = list;
    }

    get length() {
        return this.list.length;
    }

    getItem(i) {
        if (Array.isArray(i)) {
            return new ObjectPredictionList(i.map(index => this.list[index]));
        } else if (typeof i === 'number') {
            return new ObjectPredictionList([this.list[i]]);
        } else {
            throw new Error(`Unsupported index type: ${typeof i}`);
        }
    }

    setItem(i, elem) {
        if (typeof i === 'number') {
            this.list[i] = elem;
        } else if (Array.isArray(i)) {
            if (i.length !== elem.length) {
                throw new Error("Index and element length mismatch");
            }
            i.forEach((index, idx) => {
                this.list[index] = elem[idx];
            });
        } else {
            throw new Error(`Unsupported index type: ${typeof i}`);
        }
    }

    toTensor() {
        return objectPredictionListToTorch(this);
    }

    toList() {
        return this.list.length === 1 ? this.list[0] : this.list;
    }
}

function objectPredictionListToTorch(objectPredictionList) {
    const numPredictions = objectPredictionList.length;
    const torchPredictions = new Array(numPredictions).fill().map(() => new Array(6).fill(0));
    objectPredictionList.list.forEach((objectPrediction, ind) => {
        const bbox = objectPrediction.bbox.toVocBBox();
        torchPredictions[ind].splice(0, 4, ...bbox);
        torchPredictions[ind][4] = objectPrediction.score.value;
        torchPredictions[ind][5] = objectPrediction.category.id;
    });
    return torchPredictions;
}

function calculateBoxUnion(box1, box2) {
    const leftTop = [Math.min(box1[0], box2[0]), Math.min(box1[1], box2[1])];
    const rightBottom = [Math.max(box1[2], box2[2]), Math.max(box1[3], box2[3])];
    return [...leftTop, ...rightBottom];
}

function calculateArea(box) {
    return (box[2] - box[0]) * (box[3] - box[1]);
}

function calculateIntersectionArea(box1, box2) {
    const leftTop = [Math.max(box1[0], box2[0]), Math.max(box1[1], box2[1])];
    const rightBottom = [Math.min(box1[2], box2[2]), Math.min(box1[3], box2[3])];
    const widthHeight = [Math.max(0, rightBottom[0] - leftTop[0]), Math.max(0, rightBottom[1] - leftTop[1])];
    return widthHeight[0] * widthHeight[1];
}

function calculateBboxIou(pred1, pred2) {
    const box1 = pred1.bbox.toVocBBox();
    const box2 = pred2.bbox.toVocBBox();
    const area1 = calculateArea(box1);
    const area2 = calculateArea(box2);
    const intersect = calculateIntersectionArea(box1, box2);
    return intersect / (area1 + area2 - intersect);
}

function calculateBboxIos(pred1, pred2) {
    const box1 = pred1.bbox.toVocBBox();
    const box2 = pred2.bbox.toVocBBox();
    const area1 = calculateArea(box1);
    const area2 = calculateArea(box2);
    const intersect = calculateIntersectionArea(box1, box2);
    const smallerArea = Math.min(area1, area2);
    return intersect / smallerArea;
}

function hasMatch(pred1, pred2, matchType = "IOU", matchThreshold = 0.5) {
    let thresholdCondition;
    if (matchType === "IOU") {
        thresholdCondition = calculateBboxIou(pred1, pred2) > matchThreshold;
    } else if (matchType === "IOS") {
        thresholdCondition = calculateBboxIos(pred1, pred2) > matchThreshold;
    } else {
        throw new Error("Invalid match type");
    }
    return thresholdCondition;
}

function getMergedScore(pred1, pred2) {
    const scores = [pred1.score.value, pred2.score.value];
    return Math.max(...scores);
}

function getMergedBBox(pred1, pred2) {
    const box1 = pred1.bbox.toVocBBox();
    const box2 = pred2.bbox.toVocBBox();
    const bbox = new BoundingBox(calculateBoxUnion(box1, box2));
    return bbox;
}

function getMergedCategory(pred1, pred2) {
    return pred1.score.value > pred2.score.value ? pred1.category : pred2.category;
}

function getMergedKeypoints(pred1, pred2) {
    return pred1.score.value > pred2.score.value ? pred1.keypoints : pred2.keypoints;
}

function mergeObjectPredictionPair(pred1, pred2) {
    const mergedBBox = getMergedBBox(pred1, pred2);
    const mergedScore = getMergedScore(pred1, pred2);
    const mergedCategory = getMergedCategory(pred1, pred2);
    const mergedKeypoints = getMergedKeypoints(pred1, pred2);
    return new ObjectPrediction({
        bbox: mergedBBox.toVocBBox(),
        score: mergedScore,
        category_id: mergedCategory.id,
        category_name: mergedCategory.name,
        keypoints: mergedKeypoints.asArray(),
    });
}

function batchedNmm(objectPredictionsAsTensor, matchMetric = "IOU", matchThreshold = 0.5) {
    const category_ids = objectPredictionsAsTensor.map(pred => pred[5]);
    const uniquecategory_ids = [...new Set(category_ids)];
    const keepToMergeList = {};
    for (const category_id of uniquecategory_ids) {
        const currIndices = category_ids.map((id, index) => id === category_id ? index : -1).filter(index => index !== -1);
        const currKeepToMergeList = nmm(objectPredictionsAsTensor.filter((_, index) => currIndices.includes(index)), matchMetric, matchThreshold);
        for (const [currKeep, currMergeList] of Object.entries(currKeepToMergeList)) {
            const keep = currIndices[currKeep];
            const mergeList = currMergeList.map(currMergeInd => currIndices[currMergeInd]);
            keepToMergeList[keep] = mergeList;
        }
    }
    return keepToMergeList;
}

function nmm(objectPredictionsAsTensor, matchMetric = "IOU", matchThreshold = 0.5) {
    const keepToMergeList = {};
    const mergeToKeep = {};

    const x1 = objectPredictionsAsTensor.map(pred => pred[0]);
    const y1 = objectPredictionsAsTensor.map(pred => pred[1]);
    const x2 = objectPredictionsAsTensor.map(pred => pred[2]);
    const y2 = objectPredictionsAsTensor.map(pred => pred[3]);
    const scores = objectPredictionsAsTensor.map(pred => pred[4]);
    const areas = x2.map((x, i) => (x - x1[i]) * (y2[i] - y1[i]));
    const order = scores.map((score, index) => ({ score, index })).sort((a, b) => b.score - a.score).map(item => item.index);

    for (let ind = 0; ind < objectPredictionsAsTensor.length; ind++) {
        const predInd = order[ind];
        const otherPredInds = order.filter(index => index !== predInd);

        const xx1 = otherPredInds.map(index => Math.max(x1[index], x1[predInd]));
        const yy1 = otherPredInds.map(index => Math.max(y1[index], y1[predInd]));
        const xx2 = otherPredInds.map(index => Math.min(x2[index], x2[predInd]));
        const yy2 = otherPredInds.map(index => Math.min(y2[index], y2[predInd]));

        const w = xx2.map((x, i) => Math.max(0, x - xx1[i]));
        const h = yy2.map((y, i) => Math.max(0, y - yy1[i]));
        const inter = w.map((width, i) => width * h[i]);

        const remAreas = otherPredInds.map(index => areas[index]);

        let matchMetricValue;
        if (matchMetric === "IOU") {
            const union = remAreas.map((area, i) => area - inter[i] + areas[predInd]);
            matchMetricValue = inter.map((intersection, i) => intersection / union[i]);
        } else if (matchMetric === "IOS") {
            const smaller = remAreas.map((area, i) => Math.min(area, areas[predInd]));
            matchMetricValue = inter.map((intersection, i) => intersection / smaller[i]);
        } else {
            throw new Error("Invalid match metric");
        }

        const mask = matchMetricValue.map(value => value < matchThreshold);
        const matchedBoxIndices = otherPredInds.filter((_, i) => !mask[i]).reverse();

        if (!(predInd in mergeToKeep)) {
            keepToMergeList[predInd] = [];
            for (const matchedBoxInd of matchedBoxIndices) {
                if (!(matchedBoxInd in mergeToKeep)) {
                    keepToMergeList[predInd].push(matchedBoxInd);
                    mergeToKeep[matchedBoxInd] = predInd;
                }
            }
        } else {
            const keep = mergeToKeep[predInd];
            for (const matchedBoxInd of matchedBoxIndices) {
                if (!(matchedBoxInd in keepToMergeList) && !(matchedBoxInd in mergeToKeep)) {
                    keepToMergeList[keep].push(matchedBoxInd);
                    mergeToKeep[matchedBoxInd] = keep;
                }
            }
        }
    }
    return keepToMergeList;
}

class PostprocessPredictions {
    constructor(matchThreshold = 0.5, matchMetric = "IOU", classAgnostic = true) {
        this.matchThreshold = matchThreshold;
        this.classAgnostic = classAgnostic;
        this.matchMetric = matchMetric;
    }

    call(objectPredictions) {
        throw new Error("Not implemented");
    }
}

export class NMMPostprocess extends PostprocessPredictions {
    call(objectPredictions) {
        const objectPredictionList = new ObjectPredictionList(objectPredictions);
        const objectPredictionsAsTorch = objectPredictionList.toTensor();
        let keepToMergeList;
        if (this.classAgnostic) {
            keepToMergeList = nmm(objectPredictionsAsTorch, this.matchMetric, this.matchThreshold);
        } else {
            keepToMergeList = batchedNmm(objectPredictionsAsTorch, this.matchMetric, this.matchThreshold);
        }

        const selectedObjectPredictions = [];
        for (const [keepInd, mergeIndList] of Object.entries(keepToMergeList)) {
            for (const mergeInd of mergeIndList) {
                if (hasMatch(
                    objectPredictionList.getItem(+keepInd).toList(),
                    objectPredictionList.getItem(mergeInd).toList(),
                    this.matchMetric,
                    this.matchThreshold
                )) {
                    objectPredictionList.setItem(+keepInd, mergeObjectPredictionPair(
                        objectPredictionList.getItem(+keepInd).toList(),
                        objectPredictionList.getItem(mergeInd).toList()
                    ));
                }
            }
            selectedObjectPredictions.push(objectPredictionList.getItem(+keepInd).toList());
        }

        return selectedObjectPredictions;
    }
}

export function convertFCstoOPs(featureCollection, zoom, task) {
    const objectPredictions = []
    featureCollection.forEach(feature => {
        const geom = feature.getGeometry().getCoordinates();
        const [minx, miny, maxx, maxy] = feature.get('bounds')
        const [px0, py0] = meter2pixel(minx, miny, zoom);
        const [px1, py1] = meter2pixel(maxx, maxy, zoom);
        const bbox = [px0, py0, px1, py1];
        const op = new ObjectPrediction({
            bbox: bbox,
            keypoints: geom,
            category_id: feature.get('classIndex'),
            category_name: feature.get('label'),
            score: feature.get('score'),
        });
        objectPredictions.push(op);
    });
    return objectPredictions;
}
export function convertOPstoFCs(objectPredictions, zoom, task) {
    const featureCollection = []
    objectPredictions.forEach(op => {
        let geom, geometry;
        const [px0, py0, px1, py1] = op.bbox.toVocBBox();
        const [minx, miny] = WorldPixels2Meters(px0, py0, zoom);
        const [maxx, maxy] = WorldPixels2Meters(px1, py1, zoom);
        const bounds = [minx, miny, maxx, maxy];
        if (task === 'pose') {
            geom = op.keypoints.asArray();
            geometry = new Polygon(geom);
        } else if (task === 'detect') {
            const worldPixels = getCorners(op.bbox.toVocBBox());
            const meters = worldPixels.map(([x, y]) => WorldPixels2Meters(x, y, zoom));
            meters.push(meters[0]);
            geometry = new Polygon([meters]);
        }
        const feature = new Feature({
            geometry: geometry,
            bounds: bounds,
            classIndex: op.category.id,
            label: op.category.name,
            score: op.score.value,
        });
        featureCollection.push(feature);
    });
    return featureCollection;
}
