import { getArea, getLength } from 'ol/sphere';
import { Fill, Stroke, Style, Text, RegularShape, Circle as CircleStyle } from 'ol/style';
import * as tf from "@tensorflow/tfjs";
import labels from "./labels.json";

const numClass = labels.length;


const style = new Style({
    fill: new Fill({
        color: 'rgba(255, 255, 255, 0.2)',
    }),
    stroke: new Stroke({
        color: 'rgba(0, 0, 0, 0.5)',
        lineDash: [10, 10],
        width: 2,
    }),
    image: new CircleStyle({
        radius: 5,
        stroke: new Stroke({
            color: 'rgba(0, 0, 0, 0.7)',
        }),
        fill: new Fill({
            color: 'rgba(255, 255, 255, 0.2)',
        }),
    }),
});
const labelStyle = new Style({
    text: new Text({
        font: '14px Calibri,sans-serif',
        fill: new Fill({
            color: 'rgba(255, 255, 255, 1)',
        }),
        backgroundFill: new Fill({
            color: 'rgba(0, 0, 0, 0.7)',
        }),
        padding: [3, 3, 3, 3],
        textBaseline: 'bottom',
        offsetY: -15,
    }),
    image: new RegularShape({
        radius: 8,
        points: 3,
        angle: Math.PI,
        displacement: [0, 10],
        fill: new Fill({
            color: 'rgba(0, 0, 0, 0.7)',
        }),
    }),
});
const tipStyle = new Style({
    text: new Text({
        font: '12px Calibri,sans-serif',
        fill: new Fill({
            color: 'rgba(255, 255, 255, 1)',
        }),
        backgroundFill: new Fill({
            color: 'rgba(0, 0, 0, 0.4)',
        }),
        padding: [2, 2, 2, 2],
        textAlign: 'left',
        offsetX: 15,
    }),
});
const modifyStyle = new Style({
    image: new CircleStyle({
        radius: 5,
        stroke: new Stroke({
            color: 'rgba(0, 0, 0, 0.7)',
        }),
        fill: new Fill({
            color: 'rgba(0, 0, 0, 0.4)',
        }),
    }),
    text: new Text({
        text: 'Drag to modify',
        font: '12px Calibri,sans-serif',
        fill: new Fill({
            color: 'rgba(255, 255, 255, 1)',
        }),
        backgroundFill: new Fill({
            color: 'rgba(0, 0, 0, 0.7)',
        }),
        padding: [2, 2, 2, 2],
        textAlign: 'left',
        offsetX: 15,
    }),
});

function toRad(x) {
    return x * Math.PI / 180.0
}
function toInt(x) {
    return ~~x
}
function mod(n, m) {
    return ((n % m) + m) % m
}
function randomHexColor() {
    const num = Math.floor(Math.random() * 16777215).toString(16)
    return '#' + String.prototype.repeat.call('0', 6 - num.length) + num
}
function convertHex(hex, opacity) {
    let rgb;
    hex = hex.replace('#', '');
    const idx = toInt(Math.floor(Math.random() * 3))
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    if (opacity) {
        rgb = [r, g, b, opacity]
    } else {
        rgb = [r, g, b]
    }
    rgb[idx] = 255
    return rgb
}
function randomColor(opacity) {
    const idx = toInt(Math.floor(Math.random() * 3));
    const r = idx === 0 ? 255 : toInt(Math.floor(Math.random() * 256));
    const g = idx === 1 ? 255 : toInt(Math.floor(Math.random() * 256));
    const b = idx === 2 ? 255 : toInt(Math.floor(Math.random() * 256));
    if (opacity) {
        return [r, g, b, opacity]
    } else {
        return [r, g, b]
    }
}
function deg2tile(lon_deg, lat_deg, zoom) {
    const lat_rad = toRad(lat_deg)
    const ztile = Math.round(zoom)
    const n = Math.pow(2, ztile)
    const xtile = toInt(mod((lon_deg + 180.0) / 360.0, 1) * n)
    const ytile = toInt((1.0 - Math.log(Math.tan(lat_rad) + (1 / Math.cos(lat_rad))) / Math.PI) / 2.0 * n)
    return [xtile, ytile, ztile]
}
function meter2pixel(mx, my, zoom) {
    let ires = 2 * Math.PI * 6378137 / 256
    let oshift = 2 * Math.PI * 6378137 / 2.0
    let ztile = Math.round(zoom)
    let res = ires / Math.pow(2, ztile)
    let xpixel = toInt((mx + oshift) / res)
    let ypixel = toInt((my + oshift) / res)
    let mapsize = 256 << ztile
    ypixel = mapsize - ypixel
    return [xpixel, ypixel]
}
function meter2tile(mx, my, zoom) {
    let ires = 2 * Math.PI * 6378137 / 256
    let oshift = 2 * Math.PI * 6378137 / 2.0
    let ztile = Math.round(zoom)
    let res = ires / Math.pow(2, ztile)
    let xpixel = toInt((mx + oshift) / res)
    let ypixel = toInt((my + oshift) / res)
    let mapsize = 256 << ztile
    ypixel = mapsize - ypixel
    let xtile = toInt(xpixel / 256)
    let ytile = toInt(ypixel / 256)
    let xcol = mod(xpixel, 256)
    let yrow = mod(ypixel, 256)
    return [xtile, ytile, ztile, xcol, yrow]
}

const formatLength = function (line) {
    const length = getLength(line);
    let output;
    if (length > 100) {
        output = Math.round((length / 1000) * 100) / 100 + ' km';
    } else {
        output = Math.round(length * 100) / 100 + ' m';
    }
    return output;
};
const formatArea = function (polygon) {
    const area = getArea(polygon);
    let output;
    if (area > 10000) {
        output = Math.round((area / 1000000) * 100) / 100 + ' km\xB2';
    } else {
        output = Math.round(area * 100) / 100 + ' m\xB2';
    }
    return output;
};

/**
 * Preprocess image / frame before forwarded into the model
 * @param {HTMLVideoElement|HTMLImageElement} source
 * @param {Number} modelWidth
 * @param {Number} modelHeight
 * @returns input tensor, xRatio and yRatio
 */
const preprocess = (source, modelWidth, modelHeight) => {
    let xRatio, yRatio; // ratios for boxes

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

        xRatio = maxSize / w; // update xRatio
        yRatio = maxSize / h; // update yRatio

        return tf.image
            .resizeBilinear(imgPadded, [modelWidth, modelHeight]) // resize frame
            .div(255.0) // normalize
            .expandDims(0); // add batch
    });

    return [input, xRatio, yRatio];
};

/**
 * Function run inference and do detection from source.
 * @param {HTMLImageElement|HTMLVideoElement} source
 * @param {tf.GraphModel} model loaded YOLOv8 tensorflow.js model
 */
export const detect = async (source, model) => {

    tf.engine().startScope(); // start scoping tf engine
    const [input, xRatio, yRatio] = preprocess(source, 640, 640); // preprocess image

    const res = model.predict(input); // inference model
    const transRes = res.transpose([0, 2, 1]); // transpose result [b, det, n] => [b, n, det]
    const boxes = tf.tidy(() => {
        const w = transRes.slice([0, 0, 2], [-1, -1, 1]); // get width
        const h = transRes.slice([0, 0, 3], [-1, -1, 1]); // get height
        const x1 = tf.sub(transRes.slice([0, 0, 0], [-1, -1, 1]), tf.div(w, 2)); // x1
        const y1 = tf.sub(transRes.slice([0, 0, 1], [-1, -1, 1]), tf.div(h, 2)); // y1
        return tf
            .concat(
                [
                    y1,
                    x1,
                    tf.add(y1, h), //y2
                    tf.add(x1, w), //x2
                ],
                2
            )
            .squeeze();
    }); // process boxes [y1, x1, y2, x2]

    const [scores, classes] = tf.tidy(() => {
        // class scores
        const rawScores = transRes.slice([0, 0, 4], [-1, -1, numClass]).squeeze(0); // #6 only squeeze axis 0 to handle only 1 class models
        return [rawScores.max(1), rawScores.argMax(1)];
    }); // get max scores and classes index

    const nms = await tf.image.nonMaxSuppressionAsync(boxes, scores, 500, 0.45, 0.2); // NMS to filter boxes

    const boxes_data = boxes.gather(nms, 0).dataSync(); // indexing boxes by nms index
    const scores_data = scores.gather(nms, 0).dataSync(); // indexing scores by nms index
    const classes_data = classes.gather(nms, 0).dataSync(); // indexing classes by nms index

    return [boxes_data, scores_data, classes_data];
};

export function imageCord2WorldCords(img_x, img_y, tile_x, tile_y, zoom) {
    // Convert tile coordinates to latitude and longitude
    function tileZXYToLatLon(x, y, zoomLevel) {
        const MIN_ZOOM_LEVEL = 0;
        const MAX_ZOOM_LEVEL = 22;
        if (zoomLevel < MIN_ZOOM_LEVEL || zoomLevel > MAX_ZOOM_LEVEL) {
            throw new Error(`Zoom level value is out of range [${MIN_ZOOM_LEVEL},${MAX_ZOOM_LEVEL}]`);
        }

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

export { style, labelStyle, tipStyle, modifyStyle, toRad, toInt, mod, randomHexColor, convertHex, randomColor, deg2tile, meter2pixel, meter2tile, formatLength, formatArea };