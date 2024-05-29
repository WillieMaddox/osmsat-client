import { getArea, getLength } from 'ol/sphere';
import { Fill, Stroke, Style, Text, RegularShape, Circle as CircleStyle } from 'ol/style';
import labels from "./labels.json";

const numClass = labels.length;

// generate numClass random colors
const colors = Array.from({ length: numClass }, () => randomColor(.2));

// Function to create text style with hardcoded settings
const createTextStyle = function (feature, resolution) {
    const maxResolution = 2400;
    let classIndex = feature.get('classIndex');
    let score = feature.get('score');
    let className = labels[classIndex];
    let text = `${className} ${Math.round(score * 100)}%`;
    // eval text as number and select class from labels
    if (resolution > maxResolution) { text = ''; };
    return new Text({
        textAlign: undefined,
        textBaseline: 'bottom',
        font: 'Bold 14x/1 Open Sans',
        text: text,
        fill: new Fill({ color: '#ffffff' }),
        stroke: new Stroke({ color: '#000000', width: 3 }),
        offsetX: 0,
        offsetY: 0,
        placement: 'point',
        maxAngle: 45,
        overflow: false,
        rotation: 0,
    });
};

// Function to style polygons with hardcoded settings
export const polygonStyleFunction = (feature, resolution) => {
    let classIndex = feature.get('classIndex');
    let fill_color = colors[classIndex];
    return new Style({
        stroke: new Stroke({
            color: fill_color.slice(0, 3).concat([.5]),
            width: 1,
        }),
        fill: new Fill({
            color: fill_color,
        }),
        text: createTextStyle(feature, resolution),
    });
}

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

export { style, labelStyle, tipStyle, modifyStyle, toRad, toInt, mod, randomHexColor, convertHex, randomColor, deg2tile, meter2pixel, meter2tile, formatLength, formatArea };