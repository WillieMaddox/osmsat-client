import { getArea, getLength } from 'ol/sphere';
import { Fill, Stroke, Style, Text, RegularShape, Circle as CircleStyle } from 'ol/style';

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

export function imageCord2WorldCords(img_x, img_y, tile_x, tile_y, zoom) {
    // img_x is 0 to 1 of the tile size
    // img_y is 0 to 1 of the tile size
    // tile_x is the x index of the tile
    // tile_y is the y index of the tile
    // zoom is the zoom level
    function getTileCoords(tileX, tileY, zoom) {
        const n = Math.pow(2, zoom);
        const lon_deg = tileX / n * 360.0 - 180.0;
        const lat_rad = Math.atan(Math.sinh(Math.PI * (1 - 2 * tileY / n)));
        const lat_deg = lat_rad * (180.0 / Math.PI);
        return { lat: lat_deg, lon: lon_deg };
    }
    const startingCoords = getTileCoords(tile_x, tile_y, zoom);
    const n = Math.pow(2, zoom);
    const lon_deg = startingCoords.lon + img_x / n * 360.0;
    const lat_deg = startingCoords.lat + img_y / n * 180.0;
    return [lat_deg, lon_deg];
}

export { style, labelStyle, tipStyle, modifyStyle, toRad, toInt, mod, randomHexColor, convertHex, randomColor, deg2tile, meter2pixel, meter2tile, formatLength, formatArea };