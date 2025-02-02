
// Constants
const RE = 6378137; // Earth radius

function toRad(x) {
    return x * Math.PI / 180.0
}
export function toInt(x) {
    return ~~x
}
export function mod(n, m) {
    return ((n % m) + m) % m
}
export function randomHexColor() {
    const num = Math.floor(Math.random() * 16777215).toString(16)
    return '#' + String.prototype.repeat.call('0', 6 - num.length) + num
}
export function convertHex(hex, opacity) {
    hex = hex.replace('#', '');
    const idx = toInt(Math.floor(Math.random() * 3))
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const rgb = opacity ? [r, g, b, opacity] : [r, g, b];
    rgb[idx] = 255
    return rgb
}
export function randomColor(opacity) {
    const idx = toInt(Math.floor(Math.random() * 3));
    const r = idx === 0 ? 255 : toInt(Math.floor(Math.random() * 256));
    const g = idx === 1 ? 255 : toInt(Math.floor(Math.random() * 256));
    const b = idx === 2 ? 255 : toInt(Math.floor(Math.random() * 256));
    return opacity ? [r, g, b, opacity] : [r, g, b];
}
export function deg2tile(lon_deg, lat_deg, zoom) {
    const lat_rad = toRad(lat_deg)
    const ztile = Math.round(zoom)
    const n = Math.pow(2, ztile)
    const xtile = toInt(mod((lon_deg + 180.0) / 360.0, 1) * n)
    const ytile = toInt((1.0 - Math.log(Math.tan(lat_rad) + (1 / Math.cos(lat_rad))) / Math.PI) / 2.0 * n)
    return [xtile, ytile, ztile]
}
export function meter2pixel(mx, my, zoom) {
    const ires = 2 * Math.PI * RE / 256
    const oshift = 2 * Math.PI * RE / 2.0
    const res = ires / Math.pow(2, zoom)
    const xpixel = (mx + oshift) / res
    const ypixel = (my + oshift) / res
    const mapsize = 256 << zoom
    return [xpixel, mapsize - ypixel]
}
export function meter2tile2(mx, my, zoom) {
    const [xpixel, ypixel] = meter2pixel(mx, my, zoom)
    const xtile = toInt(xpixel / 256)
    const ytile = toInt(ypixel / 256)
    return [xtile, ytile]
}
export function meter2tile4(mx, my, zoom) {
    const [xpixel, ypixel] = meter2pixel(mx, my, zoom)
    const xtile = toInt(xpixel / 256)
    const ytile = toInt(ypixel / 256)
    const xcol = mod(toInt(xpixel), 256)
    const yrow = mod(toInt(ypixel), 256)
    return [xtile, ytile, xcol, yrow]
}

export function imageCoord2Meters(img_x, img_y, tile_x, tile_y, zoom) {
    // Get the starting coordinates of the tile
    const tile_size = 256; // 256 for google and bing maps, 512 for mapbox
    const initialResolution = 2 * Math.PI * RE / tile_size;
    const res = initialResolution / Math.pow(2, zoom);
    const originShift = 2 * Math.PI * RE / 2.0;

    // tile to world pixels
    const px = tile_x * tile_size + img_x;
    let py = tile_y * tile_size + img_y;

    // world pixels to meters
    py = (tile_size << zoom) - py;  // Google -> TMS
    const mx = px * res - originShift;
    const my = py * res - originShift;

    return [mx, my]
}
export function WorldPixels2Meters(px, py, zoom) {
    const tile_size = 256; // 256 for google and bing maps, 512 for mapbox
    const initialResolution = 2 * Math.PI * RE / tile_size;
    const res = initialResolution / Math.pow(2, zoom);
    const originShift = 2 * Math.PI * RE / 2.0;

    py = (tile_size << zoom) - py;  // Google -> TMS
    const mx = px * res - originShift;
    const my = py * res - originShift;

    return [mx, my]
}
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
export function imageCoord2WorldCoords0(img_x, img_y, tile_x, tile_y, zoom) {
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
function tileBounds0(x, y, zoomLevel) {
    const [lon_min, lat_min] = tileZXYToLatLon(x, y, zoomLevel)
    const [lon_max, lat_max] = tileZXYToLatLon(x + 1, y + 1, zoomLevel)
    return { "lon_min": lon_min, "lat_min": lat_min, "lon_max": lon_max, "lat_max": lat_max };
}
export function tilePixelToWorld0(px, py, img_size, x_tile, y_tile, zoom) {
    // Get the bounds of the tile in latitude/longitude
    const tile_bounds = tileBounds0(x_tile, y_tile, zoom);
    // Calculate the relative position within the tile in meters
    const rel_x = (px / img_size) * (tile_bounds.lon_max - tile_bounds.lon_min) + tile_bounds.lon_min;
    const rel_y = (py / img_size) * (tile_bounds.lat_max - tile_bounds.lat_min) + tile_bounds.lat_min;
    return [rel_y, rel_x];
}
function tileBounds(x, y, zoomLevel) {
    const z = parseInt(zoomLevel);
    const maxXY = (1 << z) - 1;
    if (x < 0 || x > maxXY || y < 0 || y > maxXY) {
        throw new Error(`Tile coordinates are out of range [0,${maxXY}]`);
    }

    // Calculate the longitude and latitude of the top-left corner
    const lon_min = (x / (1 << z)) * 360 - 180;
    const n_min = Math.PI - (2 * Math.PI * y) / (1 << z);
    const lat_min = (180 / Math.PI) * Math.atan(Math.sinh(n_min));

    // Calculate the longitude and latitude of the bottom-right corner
    const lon_max = ((x + 1) / (1 << z)) * 360 - 180;
    const n_max = Math.PI - (2 * Math.PI * (y + 1)) / (1 << z);
    const lat_max = (180 / Math.PI) * Math.atan(Math.sinh(n_max));

    return { "lon_min": lon_min, "lat_min": lat_min, "lon_max": lon_max, "lat_max": lat_max };
}
export function tilePixelToWorld(px, py, img_size, x_tile, y_tile, zoom) {
    // Get the bounds of the tile in latitude/longitude
    const tile_bounds = tileBounds(x_tile, y_tile, zoom);
    // Calculate the relative position within the tile in meters
    const rel_x = (px / img_size) * (tile_bounds.lon_max - tile_bounds.lon_min) + tile_bounds.lon_min;
    const rel_y = (py / img_size) * (tile_bounds.lat_max - tile_bounds.lat_min) + tile_bounds.lat_min;
    return [rel_y, rel_x];
}
export function getCorners(box) {
    // Function to calculate the 4 corners of the rotated bounding box
    // angle goes from -pi/2 to pi/2 with 0 being the horizontal axis in radians

    const [x1, y1, x2, y2, angle] = box;
    const x_center = (x1 + x2) / 2;
    const y_center = (y1 + y2) / 2;
    const width = x2 - x1;
    const height = y2 - y1;

    const cos = Math.cos(angle || 0);
    const sin = Math.sin(angle || 0);

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

function twoPointForm(p1, p2) {
    const dp = [p2[0] - p1[0], p2[1] - p1[1]];
    const a = -1 * dp[1];
    const b = dp[0];
    const c = p1[0] * dp[1] - p1[1] * dp[0];
    return [a, b, c];
}
function pointOfIntersection(l1, l2) {
    const denominator = l1[0] * l2[1] - l2[0] * l1[1];
    if (denominator === 0) {
        return [null, null]; // Lines are parallel
    }
    const x = (l1[1] * l2[2] - l2[1] * l1[2]) / denominator;
    const y = (l2[0] * l1[2] - l1[0] * l2[2]) / denominator;
    return [x, y];
}
function getEnvelopeArea(points) {
    const xs = points.map(p => p[0]);
    const ys = points.map(p => p[1]);
    const xmin = Math.min(...xs);
    const ymin = Math.min(...ys);
    const xmax = Math.max(...xs);
    const ymax = Math.max(...ys);
    return (xmax - xmin) * (ymax - ymin);
}
function getBoundedEnvelopeArea(points) {
    const xs = points.map(p => p[0]);
    const ys = points.map(p => p[1]);
    const xmin = Math.min(...xs);
    const ymin = Math.min(...ys);
    const xmax = Math.max(...xs);
    const ymax = Math.max(...ys);
    return (Math.min(xmax, 512) - Math.max(xmin, 0)) * (Math.min(ymax, 512) - Math.max(ymin, 0));
}
function getPolygonArea(points) {
    /**
     * Calculates the area of a polygon using the Shoelace formula.
     */
    const n = points.length;
    let total = 0;
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const [x1, y1] = points[i];
        const [x2, y2] = points[j];
        total += x1 * y2 - y1 * x2;
    }
    return Math.abs(0.5 * total);
}
function isPolyConvex(points) {
    const n = points.length;
    const signs = [];
    for (let j = 0; j < n; j++) {
        const i = (j - 1 + n) % n;
        const k = (j + 1) % n;
        const a = [points[i][0] - points[j][0], points[i][1] - points[j][1]];
        const b = [points[k][0] - points[j][0], points[k][1] - points[j][1]];
        const cross = a[0] * b[1] - a[1] * b[0];
        signs.push(cross > 0);
    }
    return signs.every(sign => sign) || signs.every(sign => !sign);
}
export function getKeypointsScore(keypoints) {
    /**
     * NOTE: keypoint coords are in image space, so use left-hand rule for cross product.
     */
    const kpScores = [];

    const leftVec = [keypoints[1][0] - keypoints[2][0], keypoints[1][1] - keypoints[2][1]];
    const frontVec = [keypoints[0][0] - keypoints[2][0], keypoints[0][1] - keypoints[2][1]];
    const rightVec = [keypoints[3][0] - keypoints[2][0], keypoints[3][1] - keypoints[2][1]];
    const wingsVec = [keypoints[1][0] - keypoints[3][0], keypoints[1][1] - keypoints[3][1]];

    const leftLen = Math.hypot(leftVec[0], leftVec[1]);
    const frontLen = Math.hypot(frontVec[0], frontVec[1]);
    const rightLen = Math.hypot(rightVec[0], rightVec[1]);
    const wingsLen = Math.hypot(wingsVec[0], wingsVec[1]);

    if (leftLen === 0 || frontLen === 0 || rightLen === 0 || wingsLen === 0) {
        return 0;
    }

    // Check for tiny polygons
    const pArea = getPolygonArea(keypoints);
    if (pArea < 4) {
        return 0;
    }

    // Check if polygon area is much much less than its envelope area.
    const eArea = getEnvelopeArea(keypoints);
    if (pArea / eArea < 0.2) {
        return 0;
    }

    // Check that keypoints form a convex polygon:
    if (!isPolyConvex(keypoints)) {
        return 0;
    }

    // Check keypoints winding order (ccw in cartesian coordinates, cw in image coordinates).
    const crossRightFront = rightVec[0] * frontVec[1] - rightVec[1] * frontVec[0];
    const crossLeftFront = leftVec[0] * frontVec[1] - leftVec[1] * frontVec[0];
    if (crossRightFront > 0 && crossLeftFront < 0) {
        return 0;
    }

    // Check how much of the polygon is bounded by the image.
    const bArea = getBoundedEnvelopeArea(keypoints)
    kpScores.push(bArea / eArea);

    // Check if wingspan vector and length vector are orthogonal.
    const a = [frontVec[0] / frontLen, frontVec[1] / frontLen];
    const b = [wingsVec[0] / wingsLen, wingsVec[1] / wingsLen];
    const cross = Math.abs(a[0] * b[1] - a[1] * b[0]);
    kpScores.push(cross);

    // Check symmetry, left wing length == right wing length.
    const headToTail = twoPointForm(keypoints[0], keypoints[2]);
    const leftToRight = twoPointForm(keypoints[1], keypoints[3]);
    const poi = pointOfIntersection(leftToRight, headToTail);
    let leftWing = 0, rightWing = 0;
    if (poi[0] !== null && poi[1] !== null) {
        leftWing = Math.hypot(keypoints[1][0] - poi[0], keypoints[1][1] - poi[1]);
        rightWing = Math.hypot(keypoints[3][0] - poi[0], keypoints[3][1] - poi[1]);
    }
    kpScores.push(Math.min(1, 2.0 * Math.min(leftWing, rightWing) / wingsLen));

    const sumScores = kpScores.reduce((a, b) => a + b, 0);
    return kpScores.length > 0 ? sumScores / kpScores.length : 0;
}

