
// Constants
const RE = 6378137; // Earth radius

function toRad(x) {
    return x * Math.PI / 180.0
}
function toInt(x) {
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
    const xpixel = toInt((mx + oshift) / res)
    const ypixel = toInt((my + oshift) / res)
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
    const xcol = mod(xpixel, 256)
    const yrow = mod(ypixel, 256)
    return [xtile, ytile, xcol, yrow]
}

export function imageCoord2WorldCoords(img_x, img_y, tile_x, tile_y, zoom) {
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

    // meters to lat lon
    let lat_deg = (my / originShift) * 180.0;
    lat_deg = 180 / Math.PI * (2 * Math.atan(Math.exp(lat_deg * Math.PI / 180.0)) - Math.PI / 2.0);
    const lon_deg = (mx / originShift) * 180.0;

    return [lat_deg, lon_deg];
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
export function getCorners(x_center, y_center, width, height, radians) {
    // Function to calculate the 4 corners of the rotated bounding box
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