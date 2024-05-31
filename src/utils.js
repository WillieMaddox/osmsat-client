import { Fill, Stroke, Style, Text, RegularShape, Circle as CircleStyle } from 'ol/style';
import { getArea, getLength } from 'ol/sphere';
import labels from './labels.json';

// Constants
const numClass = labels.length;
const maxResolution = 2400;

// Generate numClass random colors
const colors = Array.from({ length: numClass }, () => randomColor(0.2));

// Function to create text style
const createTextStyle = (feature, resolution) => {
    const classIndex = feature.get('classIndex');
    const score = feature.get('score');
    const className = labels[classIndex];
    let text = `${className} ${Math.round(score * 100)}%`;

    if (resolution > maxResolution) text = '';

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

// Segment style
export const segmentStyle = new Style({
    text: new Text({
        font: '12px Calibri,sans-serif',
        fill: new Fill({ color: 'rgba(255, 255, 255, 1)' }),
        backgroundFill: new Fill({ color: 'rgba(0, 0, 0, 0.4)' }),
        padding: [2, 2, 2, 2],
        textBaseline: 'bottom',
        offsetY: -12,
    }),
    image: new RegularShape({
        radius: 6,
        points: 3,
        angle: Math.PI,
        displacement: [0, 8],
        fill: new Fill({ color: 'rgba(0, 0, 0, 0.4)' }),
    }),
});
export const segmentStyles = [segmentStyle];

// Function to style polygons
export const polygonStyleFunction = (feature, resolution) => {
    const classIndex = feature.get('classIndex');
    const fillColor = colors[classIndex];

    return new Style({
        stroke: new Stroke({
            color: fillColor.slice(0, 3).concat([0.5]),
            width: 1,
        }),
        fill: new Fill({ color: fillColor }),
        text: createTextStyle(feature, resolution),
    });
};

// Additional styles
export const style = new Style({
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

export const labelStyle = new Style({
    text: new Text({
        font: '14px Calibri,sans-serif',
        fill: new Fill({ color: 'rgba(255, 255, 255, 1)' }),
        backgroundFill: new Fill({ color: 'rgba(0, 0, 0, 0.7)' }),
        padding: [3, 3, 3, 3],
        textBaseline: 'bottom',
        offsetY: -15,
    }),
    image: new RegularShape({
        radius: 8,
        points: 3,
        angle: Math.PI,
        displacement: [0, 10],
        fill: new Fill({ color: 'rgba(0, 0, 0, 0.7)' }),
    }),
});

export const tipStyle = new Style({
    text: new Text({
        font: '12px Calibri,sans-serif',
        fill: new Fill({ color: 'rgba(255, 255, 255, 1)' }),
        backgroundFill: new Fill({ color: 'rgba(0, 0, 0, 0.4)' }),
        padding: [2, 2, 2, 2],
        textAlign: 'left',
        offsetX: 15,
    }),
});

export const modifyStyle = new Style({
    image: new CircleStyle({
        radius: 5,
        stroke: new Stroke({ color: 'rgba(0, 0, 0, 0.7)' }),
        fill: new Fill({ color: 'rgba(0, 0, 0, 0.4)' }),
    }),
    text: new Text({
        text: 'Drag to modify',
        font: '12px Calibri,sans-serif',
        fill: new Fill({ color: 'rgba(255, 255, 255, 1)' }),
        backgroundFill: new Fill({ color: 'rgba(0, 0, 0, 0.7)' }),
        padding: [2, 2, 2, 2],
        textAlign: 'left',
        offsetX: 15,
    }),
});

// Utility functions
export function toRad(x) {
    return x * Math.PI / 180.0;
}

export function toInt(x) {
    return ~~x;
}

export function mod(n, m) {
    return ((n % m) + m) % m;
}

export function randomHexColor() {
    const num = Math.floor(Math.random() * 16777215).toString(16);
    return '#' + '0'.repeat(6 - num.length) + num;
}

export function convertHex(hex, opacity) {
    hex = hex.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const rgb = opacity ? [r, g, b, opacity] : [r, g, b];
    rgb[Math.floor(Math.random() * 3)] = 255;
    return rgb;
}

export function randomColor(opacity) {
    const r = Math.random() < 0.33 ? 255 : Math.floor(Math.random() * 256);
    const g = Math.random() < 0.33 ? 255 : Math.floor(Math.random() * 256);
    const b = Math.random() < 0.33 ? 255 : Math.floor(Math.random() * 256);
    return opacity ? [r, g, b, opacity] : [r, g, b];
}

export function deg2tile(lon_deg, lat_deg, zoom) {
    const lat_rad = toRad(lat_deg);
    const ztile = Math.round(zoom);
    const n = Math.pow(2, ztile);
    const xtile = toInt(mod((lon_deg + 180.0) / 360.0, 1) * n);
    const ytile = toInt((1.0 - Math.log(Math.tan(lat_rad) + (1 / Math.cos(lat_rad))) / Math.PI) / 2.0 * n);
    return [xtile, ytile, ztile];
}

export function meter2pixel(mx, my, zoom) {
    const ires = 2 * Math.PI * 6378137 / 256;
    const oshift = 2 * Math.PI * 6378137 / 2.0;
    const ztile = Math.round(zoom);
    const res = ires / Math.pow(2, ztile);
    const xpixel = toInt((mx + oshift) / res);
    const ypixel = toInt((my + oshift) / res);
    const mapsize = 256 << ztile;
    return [xpixel, mapsize - ypixel];
}

export function meter2tile(mx, my, zoom) {
    const ires = 2 * Math.PI * 6378137 / 256;
    const oshift = 2 * Math.PI * 6378137 / 2.0;
    const ztile = Math.round(zoom);
    const res = ires / Math.pow(2, ztile);
    const xpixel = toInt((mx + oshift) / res);
    const ypixel = toInt((my + oshift) / res);
    const mapsize = 256 << ztile;
    const xtile = toInt(xpixel / 256);
    const ytile = toInt((mapsize - ypixel) / 256);
    const xcol = mod(xpixel, 256);
    const yrow = mod((mapsize - ypixel), 256);
    return [xtile, ytile, ztile, xcol, yrow];
}

// Format functions
export const formatLength = line => {
    const length = getLength(line);
    return length > 100
        ? `${Math.round((length / 1000) * 100) / 100} km`
        : `${Math.round(length * 100) / 100} m`;
};

export const formatArea = polygon => {
    const area = getArea(polygon);
    return area > 10000
        ? `${Math.round((area / 1000000) * 100) / 100} km²`
        : `${Math.round(area * 100) / 100} m²`;
};

// Coordinate format functions
export const coordinateFormatPIXEL = (view, coord) => {
    const zoom = view.getZoom();
    const [x, y] = meter2pixel(coord[0], coord[1], zoom);
    return `X: ${x}   Y: ${y}`;
};

export const coordinateFormatTILE = (view, coord) => {
    const zoom = view.getZoom();
    const [xtile, ytile, ztile, xcol, yrow] = meter2tile(coord[0], coord[1], zoom);
    return `Z: ${ztile}   X: ${xtile}   Y: ${ytile}   C: ${xcol}   R: ${yrow}`;
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

export function imageCoordToWorldCoords(img_x, img_y, tile_x, tile_y, zoom) {
    // Get the starting coordinates of the tile
    const startingCoords = tileZXYToLatLon(tile_x, tile_y, zoom);
    const img_size = 640; // size of the image

    // Each tile is a part of the world map
    const worldSize = Math.pow(2, zoom); // total size of the map at the current zoom level
    const lat_deg_per_pixel = 180 / worldSize;
    const lon_deg_per_pixel = 360 / worldSize;

    const lon_deg = startingCoords.lon + (img_x / img_size) * lon_deg_per_pixel;
    const lat_deg = startingCoords.lat - (img_y / img_size) * lat_deg_per_pixel;

    return [lat_deg, lon_deg];
}

// Function to calculate the 4 corners of the rotated bounding box
export function getCorners(x_center, y_center, width, height, radians) {
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