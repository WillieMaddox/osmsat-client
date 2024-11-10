// import 'ol-ext/control/Bar.css';
// import 'ol-ext/control/EditBar.css';
// import 'ol-ext/control/Swipe.css';
// import 'ol-ext/control/Search.css';
// import 'ol-ext/control/LayerSwitcher.css';
import 'ol/ol.css';
import 'ol-ext/dist/ol-ext.css'
import './style.css';
// import $ from 'jquery';
import Map from 'ol/Map';
import View from 'ol/View';
import { transform } from 'ol/proj';
import { getCenter } from 'ol/extent';
import { LineString, Point } from 'ol/geom';
import { getArea, getLength } from 'ol/sphere';
// import { createXYZ } from 'ol/tilegrid';
import { ATTRIBUTION } from 'ol/source/OSM'
import { Fill, Stroke, Style, Text, RegularShape, Circle as CircleStyle} from 'ol/style';
import { createStringXY, toStringHDMS } from 'ol/coordinate';
import { GeoJSON, TopoJSON, MVT, GPX, IGC, KML, WKB } from 'ol/format';
import { Attribution, MousePosition, ScaleLine } from 'ol/control';
import { Select, Draw, Modify, DragAndDrop, Snap, defaults as defaultInteractions } from 'ol/interaction';
import { singleClick } from 'ol/events/condition';

// import VectorTileSource from 'ol/source/VectorTile';
import { Vector as VectorSource, XYZ } from 'ol/source';
import { TileDebug, OSM, BingMaps, StadiaMaps, GeoTIFF } from 'ol/source';
import { Tile as TileLayer, Vector as VectorLayer } from 'ol/layer';
import LayerGroup from 'ol/layer/Group';
// import { WebGLTile } from "ol/layer";
// import VectorTileLayer from 'ol/layer/VectorTile';
// import MapboxVectorLayer from 'ol/layer/MapboxVector';
// import { MapboxVectorLayer } from 'ol-mapbox-style';
import Bar from 'ol-ext/control/Bar';
import Swipe from 'ol-ext/control/Swipe';
import Toggle from 'ol-ext/control/Toggle';
// import Button from 'ol-ext/control/Button';
// import EditBar from 'ol-ext/control/EditBar';
// import UndoRedo from "ol-ext/interaction/UndoRedo";
import DrawRegular from "ol-ext/interaction/DrawRegular";
// import FillAttribute from "ol-ext/interaction/FillAttribute";
import FeatureList from "ol-ext/control/FeatureList";
import LayerSwitcher from 'ol-ext/control/LayerSwitcher';
import SearchNominatim from 'ol-ext/control/SearchNominatim';

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
const segmentStyle = new Style({
    text: new Text({
        font: '12px Calibri,sans-serif',
        fill: new Fill({
            color: 'rgba(255, 255, 255, 1)',
        }),
        backgroundFill: new Fill({
            color: 'rgba(0, 0, 0, 0.4)',
        }),
        padding: [2, 2, 2, 2],
        textBaseline: 'bottom',
        offsetY: -12,
    }),
    image: new RegularShape({
        radius: 6,
        points: 3,
        angle: Math.PI,
        displacement: [0, 8],
        fill: new Fill({
            color: 'rgba(0, 0, 0, 0.4)',
        }),
    }),
});
const segmentStyles = [segmentStyle];

function toRad (x) {
    return x * Math.PI / 180.0
}
function toInt (x) {
    return ~~x
}
function mod (n, m) {
    return ((n % m) + m) % m
}
function randomHexColor () {
    const num = Math.floor(Math.random() * 16777215).toString(16)
    return '#' + String.prototype.repeat.call('0', 6 - num.length) + num
}
function convertHex (hex, opacity) {
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
function randomColor (opacity) {
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
function deg2tile (lon_deg, lat_deg, zoom) {
    const lat_rad = toRad(lat_deg)
    const ztile = Math.round(zoom)
    const n = Math.pow(2, ztile)
    const xtile = toInt(mod((lon_deg + 180.0) / 360.0, 1) * n)
    const ytile = toInt((1.0 - Math.log(Math.tan(lat_rad) + (1 / Math.cos(lat_rad))) / Math.PI) / 2.0 * n)
    return [xtile, ytile, ztile]
}
function meter2pixel (mx, my, zoom) {
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
function meter2tile (mx, my, zoom) {
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
function coordinateFormatPIXEL (coord) {
    let zoom = view.getZoom()
    let xypixel = meter2pixel(coord[0], coord[1], zoom)
    let x = 'X: ' + xypixel[0]
    let y = 'Y: ' + xypixel[1]
    return [x, y].join('   ')
}
function coordinateFormatTILE (coord) {
    let zoom = view.getZoom()
    let xytile = meter2tile(coord[0], coord[1], zoom)
    let x = 'X: ' + xytile[0]
    let y = 'Y: ' + xytile[1]
    let z = 'Z: ' + xytile[2]
    let c = 'C: ' + xytile[3]
    let r = 'R: ' + xytile[4]
    return [z, x, y, c, r].join('   ')
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

let zoom = 16, center = [-110.83, 32.155];

let thunderforestAttributions = [
    'Tiles &copy; <a href="https://www.thunderforest.com/">Thunderforest</a>',
    ATTRIBUTION
]

// TODO: Make these layers work
// let Mapbox512_localhost = new TileLayer({
//     title: 'Mapbox512 (on localhost)',
//     visible: false,
//     baseLayer: true,
//     source: new XYZ({
//         url: '/mnt/Aorus/DATA/geos/maptiles/mapbox/satellite/{z}/{x}/{y}.png',
//     }),
// });
// let tileservergl_osmsat = new TileLayer({
//     title: 'tileserver-gl (on osmsat)',
//     visible: false,
//     baseLayer: true,
//     source: new XYZ({
//         url: 'http://osmsat.wbm4.com:8087/styles/basic-preview/{z}/{x}/{y}.png'
//     })
// });
// let OSMvector_localhost = new VectorTileLayer({
//     title: 'OSMvector (localhost)',
//     visible: false,
//     baseLayer: true,
//     source: new VectorTileSource({
//         // url: 'http://localhost:8087/tiles/{z}/{x}/{y}.pbf',
//         url: 'http://localhost:8087/data/v3/{z}/{x}/{y}.pbf',
//         format: new MVT(),
//         tileGrid: createXYZ({tileSize: 256, maxZoom: 20}),
//     })
// });

// TODO: Test if WebGLTile would work faster for TileLayer.
// let cog = new GeoTIFF({
//   sources: [
//     { url: 'https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/2020/S2A_36QWD_20200701_0_L2A/TCI.tif' }
//   ]
// });
// let gl = new WebGLTile({
//   // className: 'gl',
//   source: cog
// });
// map.addLayer(gl);
// map.setView(cog.getView());
// swipe.addLayer(gl, false);

// const source = new GeoTIFF({
//     sources: [
//         {
//             url: 'iSpy/NL_671721131_21OCT06045117-M1BS-505238142070_04_P001_3bands_scaled_3857_Tcrop.tif',
//         },
//     ],
// });
// const ras = new TileLayer({
//     source: source,
// });
// map.addLayer(ras);
// map.setView(source.getView());

// // A layer group for Testing new layers
// let satlayers = new LayerGroup({
//     title: 'Test Group',
//     openInLayerSwitcher: true,
//     layers: [
//         bingmapslayer,
//         newlayer,
//     ]
// });


function ThunderForestSource (layer) {
    return new OSM({
        url: 'https://{a-c}.tile.thunderforest.com/' + layer + '/{z}/{x}/{y}.png' +
            '?apikey=' + process.env.THUNDERFOREST_API_KEY,
        attributions: thunderforestAttributions
    });
}

function GoogleSource (layer) {
    return new XYZ({
        url: 'https://mt{0-3}.google.com/vt/lyrs=' + layer + '&x={x}&y={y}&z={z}',
        // url: 'http://mt0.google.com/vt/lyrs=s&hl=en&x={x}&y={y}&z={z}',
        // url: 'https://khms0.googleapis.com/kh?&v=870&x={x}&y={y}&z={z}',
        // url: 'https://khms0.google.com/kh/v=908?x={x}&y={y}&z={z}',
        // url: 'http://www.google.cn/maps/vt?lyrs=s@189&gl=cn&x={x}&y={y}&z={z}'
        // tileLoadFunction: function(tile, src) {
        //     tile.getImage().src = src;
        // },
    });
}

function BingSource (layer) {
    return new BingMaps({
        key: process.env.BINGMAPS_API_KEY,
        imagerySet: layer
    });
}

let sourceMapbox = new XYZ({
    url: 'https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}@2x.jpg90' +
        '?access_token=' + process.env.MAPBOX_API_KEY,
});

let sourceOSM = new OSM();
let sourceTFOutdoors = new ThunderForestSource('outdoors');
let sourceTFLandscape = new ThunderForestSource('landscape');
let sourceTFTransport = new ThunderForestSource('transport');
let sourceTFTransportDark = new ThunderForestSource('transport-dark');
let sourceTFCycle = new ThunderForestSource('cycle');

let sourceGoogleSatellite = new GoogleSource('s');
let sourceGoogleRoads = new GoogleSource('r');
let sourceGoogleLabels = new GoogleSource('h');

let sourceBingAerial = new BingSource('Aerial');
let sourceBingRoads = new BingSource('Road');

// function handleTileLoad(event) {
//     const tile = event.tile;
//     const url = tile.src;
//     if (!xyzsource.has(url)) {
//         // If tile not already in cache, add it
//         xyzsource.set(url, tile);
//     }
// }
// xyzsource.on('tileloadend', handleTileLoad);

// TODO: Add Attribution for left hand layer.
function StaticGroup () {
    return new LayerGroup({
        layers: [
            new LayerGroup({
                title: 'Base Layers',
                openInLayerSwitcher: true,
                noSwitcherDelete: true,
                layers: [
                    new TileLayer({
                        title: "OpenStreetMap",
                        visible: false,
                        baseLayer: true,
                        noSwitcherDelete: true,
                        source: sourceOSM,
                        // source: new OSM({
                        //     url: 'https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png',
                        //     crossOrigin: null,
                        // })
                    }),
                    new TileLayer({
                        title: 'OpenCycleMap',
                        visible: false,
                        baseLayer: true,
                        noSwitcherDelete: true,
                        source: sourceTFCycle,
                    }),
                    new TileLayer({
                        title: 'Transport Dark',
                        visible: false,
                        baseLayer: true,
                        noSwitcherDelete: true,
                        source: sourceTFTransportDark,
                    }),
                    new TileLayer({
                        title: 'Transport',
                        visible: false,
                        baseLayer: true,
                        noSwitcherDelete: true,
                        source: sourceTFTransport,
                    }),
                    new TileLayer({
                        title: 'Landscape',
                        visible: false,
                        baseLayer: true,
                        noSwitcherDelete: true,
                        source: sourceTFLandscape,
                    }),
                    new TileLayer({
                        title: 'Outdoors',
                        visible: false,
                        baseLayer: true,
                        noSwitcherDelete: true,
                        source: sourceTFOutdoors,
                    }),
                    new TileLayer({
                        title: 'Google (Roads)',
                        visible: false,
                        baseLayer: true,
                        noSwitcherDelete: true,
                        source: sourceGoogleRoads,
                    }),
                    new TileLayer({
                        title: 'Bing (Roads)',
                        visible: false,
                        baseLayer: true,
                        noSwitcherDelete: true,
                        source: sourceBingRoads,
                    }),
                    // new TileLayer({
                    //     title: 'Bing (Hybrid)',
                    //     visible: false,
                    //     baseLayer: true,
                    //     noSwitcherDelete: true,
                    //     source: sourceBingAerialWithLabels,
                    // }),
                    new TileLayer({
                        title: 'Mapbox',
                        // title: 'Mapbox (512)',
                        visible: false,
                        baseLayer: true,
                        noSwitcherDelete: true,
                        source: sourceMapbox,
                    }),
                    new TileLayer({
                        title: 'Google',
                        visible: false,
                        baseLayer: true,
                        noSwitcherDelete: true,
                        source: sourceGoogleSatellite,
                    }),
                    new TileLayer({
                        title: 'Bing',
                        visible: false,
                        baseLayer: true,
                        noSwitcherDelete: true,
                        source: sourceBingAerial,
                    }),
                    // new MapboxVectorLayer({
                    //     title: 'OSM (Mapbox Vector Layer)',
                    //     visible: false,
                    //     baseLayer: true,
                    //     // styleUrl: 'mapbox://styles/maddoxw/bright-v9',
                    //     styleUrl: 'mapbox://styles/maddoxw/cl4di271q000514nn9j5omi0c',
                    //     accessToken: process.env.MAPBOX_API_KEY,
                    // }),
                    // new TileLayer({
                    //     title: 'OpenSeaMap',
                    //     visible: false,
                    //     baseLayer: true,
                    //     source: new OSM({
                    //         url: 'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png',
                    //         attributions: [
                    //             'All maps © <a href="https://www.openseamap.org/">OpenSeaMap</a>',
                    //             ATTRIBUTION,
                    //         ],
                    //         opaque: false,
                    //     }),
                    // }),
                    // new TileLayer({
                    //     title: "Stamen (Watercolor)",
                    //     visible: false,
                    //     baseLayer: true,
                    //     source: new StadiaMaps({ layer: 'stamen_watercolor' })
                    // }),
                    // new TileLayer({
                    //     title: "Stamen (Labels)",
                    //     visible: false,
                    //     baseLayer: true,
                    //     allwaysOnTop: false,			// Stay on top of layer switcher
                    //     displayInLayerSwitcher: true,
                    //     source: new StadiaMaps({ layer: 'stamen_terrain_labels' })
                    // }),
                    // new TileLayer({
                    //     title: "Stamen (Toner)",
                    //     visible: false,
                    //     baseLayer: true,
                    //     source: new StadiaMaps({ layer: 'stamen_toner' })
                    // }),
                    // new TileLayer({
                    //     title: 'osmpgsql + mod_tile',
                    //     visible: false,
                    //     baseLayer: true,
                    //     source: new OSM({
                    //         url: 'osm_tiles/{z}/{x}/{y}.png',
                    //         crossOrigin: null,
                    //     })
                    // }),
                    // new TileLayer({
                    //     title: 'tileserver-gl (localhost)',
                    //     visible: false,
                    //     baseLayer: true,
                    //     source: new XYZ({
                    //         url: 'http://localhost:8087/styles/basic-preview/{z}/{x}/{y}.png'
                    //     })
                    // }),
                ]//.reverse()
            }),
            new LayerGroup({
                title: 'Vector Layers',
                openInLayerSwitcher: true,
                noSwitcherDelete: true,
                layers: [
                    new TileLayer({
                        title: 'Google (Labels)',
                        visible: false,
                        baseLayer: false,
                        source: sourceGoogleLabels,
                    }),
                ]
            })
        ]
    })
}

let leftgroup = new StaticGroup();
let rightgroup = new StaticGroup();

// Controls
// TODO: Wrap the mouse positions in a status control toggle
let controls = [
    new Attribution(),
    new ScaleLine(),
    new MousePosition({
        target: document.getElementById('mouse-position'),
        coordinateFormat: function(coord) {
            return 'HDMS: ' + toStringHDMS(coord);
        },
        className: 'ol-custom-mouse-position ol-custom-mouse-positionHDMS',
        projection: 'EPSG:4326',
    }),
    new MousePosition({
        coordinateFormat: function(coord) {
            return '4326: ' + createStringXY(6)(coord);
        },
        className: 'ol-custom-mouse-position ol-custom-mouse-position4326',
        projection: 'EPSG:4326',
    }),
    new MousePosition({
        coordinateFormat: function(coord) {
            return '900913: ' + createStringXY(1)(coord);
        },
        className: 'ol-custom-mouse-position ol-custom-mouse-position900913',
        projection: 'EPSG:900913',
    }),
    new MousePosition({
        coordinateFormat: function(coord) {
            return 'PIXEL: ' + coordinateFormatPIXEL(coord);
        },
        className: 'ol-custom-mouse-position ol-custom-mouse-positionPIXEL',
        projection: 'EPSG:900913',
    }),
    new MousePosition({
        coordinateFormat: function(coord) {
            return 'TILE: ' + coordinateFormatTILE(coord);
        },
        className: 'ol-custom-mouse-position ol-custom-mouse-positionTILE',
        projection: 'EPSG:900913',
    }),
];

let view = new View({
    center: transform(center, 'EPSG:4326', 'EPSG:3857'),
    zoom: zoom
});

let map = new Map({
    target: 'map',
    view: view,
    layers: [
        leftgroup,
        rightgroup,
    ],
    controls: controls,
    interactions: defaultInteractions(), //.extend([dragAndDropInteraction]),
    maxTilesLoading: 24
});

let $LeftLayerLabelDiv = document.createElement('div')
$LeftLayerLabelDiv.id = 'LeftLayerLabel'
$LeftLayerLabelDiv.className = 'ol-unselectable ol-control'
document.getElementsByClassName('ol-viewport')[0].appendChild($LeftLayerLabelDiv)

let $RightLayerLabelDiv = document.createElement('div')
$RightLayerLabelDiv.id = 'RightLayerLabel'
$RightLayerLabelDiv.className = 'ol-unselectable ol-control'
document.getElementsByClassName('ol-viewport')[0].appendChild($RightLayerLabelDiv)

let swipe = new Swipe()

function switchleft (layer) {
    let add_layers = [];
    let del_layers = [];
    if (layer.get('baseLayer')) {
        swipe.layers.forEach( function(l) {
            if (!l.right && l.layer.get('baseLayer')) {
                add_layers.push(layer);
                del_layers.push(l.layer);
            }
        })
    } else {
        if (layer.get('visible')) {
            add_layers.push(layer);
        } else {
            del_layers.push(layer);
        }
    }
    swipe.removeLayer(del_layers);
    swipe.addLayer(add_layers, false);
    if (layer.get('baseLayer')) {
        $LeftLayerLabelDiv.innerHTML = "&#9668; " + layer.get('title')
    }
    // console.log(' left ' + layer.get('title') + ' ' + layer.get('baseLayer') + ' ' + layer.get('visible'));
}
function switchright (layer) {
    let add_layers = [];
    let del_layers = [];
    if (layer.get('baseLayer')) {
        swipe.layers.forEach( function(l) {
            if (l.right && l.layer.get('baseLayer')) {
                add_layers.push(layer);
                del_layers.push(l.layer);
            }
        })
    } else {
        if (layer.get('visible')) {
            add_layers.push(layer);
        } else {
            del_layers.push(layer);
        }
    }
    swipe.removeLayer(del_layers);
    swipe.addLayer(add_layers, true);
    if (layer.get('baseLayer')) {
        $RightLayerLabelDiv.innerHTML = layer.get('title') + " &#9658;"
    }
    // console.log('right ' + layer.get('title') + ' ' + layer.get('baseLayer') + ' ' + layer.get('visible'));
}

let layerswitcherleft = new LayerSwitcher({
    trash: true,
    extent: true,
    collapsed: true,
    reordering: false,
    switcherClass: "layerSwitcherLeft ol-layerswitcher",
    layerGroup: leftgroup,
    oninfo: function (l) {},
    onchangeCheck: switchleft
});
map.addControl(layerswitcherleft);

let layerswitcheright = new LayerSwitcher({
    trash: true,
    extent: true,
    collapsed: true,
    reordering: false,
    switcherClass: "layerSwitcherRight ol-layerswitcher",
    layerGroup: rightgroup,
    onchangeCheck: switchright
});
map.addControl(layerswitcheright);

function initswipelayer ({layergroup, right, idx = 0} = {}) {
    // let layers = layergroup.getLayers().getArray()
    let layers = layergroup.getLayers().getArray()[0].getLayersArray()
    let index = Math.max(0, layers.length - (1 + idx))
    let layer = layers[index]
    layer.setVisible(true)
    swipe.addLayer(layer, right);
    if (right) {
        $RightLayerLabelDiv.innerHTML = layer.get('title') + " &#9658;";
    } else {
        $LeftLayerLabelDiv.innerHTML = "&#9668; " + layer.get('title');
    }
    // console.log(layer.get('title') + (right?" right":" left"));
}
initswipelayer({layergroup: leftgroup, right: false, idx: 10})
initswipelayer({layergroup: rightgroup, right: true, idx: 1})
map.addControl(swipe);

// Main control bar
var mainbar = new Bar();
map.addControl(mainbar);

// An overlay that stay on top
let debugLayer = new TileLayer({
    title: "Debug Tiles",
    visible: false,
    displayInLayerSwitcher: false,
    source: new TileDebug(),
});
map.addLayer(debugLayer);
// Add control to toggle the debug layer.
let debugLayerToggle = new Toggle({
    title: "Tiling Grid",
    className: "debug-toggle",
    html: '<i class="fa">D</i>',
    active: false,
    onToggle: function(active) { debugLayer.setVisible(active) }
});
mainbar.addControl(debugLayerToggle);

/* Nested toobar with one control activated at once */
var nestedbar = new Bar ({ toggleOne: true, group:true });
mainbar.addControl(nestedbar);

layerswitcherleft.on('info', function (e) {
    if (!e.layer.get('baseLayer')) {
        featurelist.setFeatures(e.layer.getSource())
    }
});

// Select  interaction
const select = new Select({
    hitTolerance: 5,
    condition: singleClick
});
map.addInteraction(select);

// Select feature when click on the reference index
select.on('select', function(e) {
    const f = e.selected[0];
    if (f) {
        featurelist.select(f)
    }
});

// Select control
let featurelist = new FeatureList({
    title: 'Communes',
    collapsed: true,
});
map.addControl(featurelist);

featurelist.enableSort('name1', 'name3', 'country', 'Country', 'lon')
featurelist.on('select', function(e) {
    select.getFeatures().clear();
    select.getFeatures().push(e.feature);
});
featurelist.on('dblclick', function(e) {
    map.getView().fit(e.feature.getGeometry().getExtent())
    map.getView().setZoom(map.getView().getZoom() - 1)
});

// Interactions
// TODO: Add ability to drop in shapefiles.
const dragAndDropInteraction = new DragAndDrop({
    formatConstructors: [
        GPX,
        GeoJSON,
        IGC,
        new KML({
            // extractStyles: false,
            showPointNames: false
        }),
        TopoJSON,
        WKB
    ],
});
map.addInteraction(dragAndDropInteraction);

dragAndDropInteraction.on('addfeatures', function (e) {
    // const randomcolor = randomColor()
    const vectorSource = new VectorSource({
        features: e.features,
    });
    const style = new Style({
        image: new CircleStyle({
            radius: 3,
            stroke: new Stroke({color: randomColor(), width: 2}),
        }),
        stroke: new Stroke({color: randomColor(), width: 3}),
        // stroke: new Stroke({color: 'rgb(255,165,0)', width: 3}),
    })
    function DragAndDropVectorLayer () {
        return new VectorLayer({
            title: e.file.name,
            visible: true,
            baseLayer: false,
            displayInLayerSwitcher: true,
            source: vectorSource,
            style: style
        })
    }

    let leftVectorLayer = new DragAndDropVectorLayer()
    let rightVectorLayer = new DragAndDropVectorLayer()
    leftgroup.getLayers().getArray()[1].getLayers().push(leftVectorLayer);
    rightgroup.getLayers().getArray()[1].getLayers().push(rightVectorLayer);
    swipe.addLayer(leftVectorLayer, false)
    swipe.addLayer(rightVectorLayer, true)
    map.getView().fit(vectorSource.getExtent());
});

// Nominatim Search
let searchLayer = new VectorLayer({
    name: 'search',
    source: new VectorSource(),
    style: new Style({
        image: new CircleStyle({
            radius: 5,
            stroke: new Stroke({color: 'rgb(255,165,0)', width: 3}),
            fill: new Fill({color: 'rgba(255,165,0,.3)'})
        }),
        stroke: new Stroke({color: 'rgb(255,165,0)', width: 3}),
        fill: new Fill({color: 'rgba(255,165,0,.3)'})
    })
});
map.addLayer(searchLayer);

let search = new SearchNominatim({
    reverse: true,
    position: true,	// Search, with priority to geo position
    maxItems: 15
});
map.addControl(search);
search.on('select', function(e) {
// console.log(e);
    searchLayer.getSource().clear();
    // Check if we get a geojson to describe the search
    if (e.search.geojson) {
        let format = new GeoJSON();
        let f = format.readFeature(e.search.geojson, { dataProjection: "EPSG:4326", featureProjection: map.getView().getProjection() });
        searchLayer.getSource().addFeature(f);
        let view = map.getView();
        let resolution = view.getResolutionForExtent(f.getGeometry().getExtent(), map.getSize());
        let zoom = view.getZoomForResolution(resolution);
        let center = getCenter(f.getGeometry().getExtent());
        // redraw before zoom
        setTimeout(function(){
            view.animate({
                center: center,
                zoom: Math.min (zoom, 16)
            });
        }, 100);
    } else {
        map.getView().animate({
            center: e.coordinate,
            zoom: Math.max (map.getView().getZoom(), 16)
        });
    }
});

// Add an on/off toggle for drawing bounding boxes
let bboxLayer = new VectorLayer({
    name: 'BBox',
    source: new VectorSource(),
    style: new Style({
        stroke: new Stroke({color: 'rgb(0,76,151)', width: 3}),
    }),
    visible: false
});
map.addLayer(bboxLayer);

let bboxToggle = new Toggle({
    title: "Bounding Box",
    className: "bbox-toggle",
    html: '<i class="fa">B</i>',
    interaction: new Select(),
    active: false,
});
bboxToggle.on('change:active', function (e) {
    document.getElementById('bbox').value = ''
    bboxLayer.getSource().clear();
    bboxInteraction.setActive(e.active);
    bboxLayer.setVisible(e.active);
});
nestedbar.addControl(bboxToggle);

let bboxInteraction = new DrawRegular({
    source: bboxLayer.getSource(),
    sides: 4,
    canRotate: false
});
bboxInteraction.setActive(bboxToggle.getActive());
map.addInteraction(bboxInteraction);
bboxInteraction.on('drawing', function (e) {
    let c0, c1, lon0, lat0, lon1, lat1, ll0, ll1
    c0 = transform(e.startCoordinate, 'EPSG:3857', 'EPSG:4326');
    c1 = transform(e.coordinate, 'EPSG:3857', 'EPSG:4326');
    lon0 = Math.min(c0[0], c1[0]);
    lat0 = Math.min(c0[1], c1[1]);
    lon1 = Math.max(c0[0], c1[0]);
    lat1 = Math.max(c0[1], c1[1]);
    ll0 = createStringXY(6)([lon0, lat0])
    ll1 = createStringXY(6)([lon1, lat1])
    document.getElementById('bbox').value = ll0+', '+ll1;
});


const typeSelect = document.getElementById('type');
const showSegments = document.getElementById('segments');
const clearPrevious = document.getElementById('clear');

const measureSource = new VectorSource();
const measureModify = new Modify({source: measureSource, style: modifyStyle});

let tipPoint;

function styleFunction(feature, segments, drawType, tip) {
    const styles = [];
    const geometry = feature.getGeometry();
    const type = geometry.getType();
    let point, label, line;
    if (!drawType || drawType === type || type === 'Point') {
        styles.push(style);
        if (type === 'Polygon') {
            point = geometry.getInteriorPoint();
            label = formatArea(geometry);
            line = new LineString(geometry.getCoordinates()[0]);
        } else if (type === 'LineString') {
            point = new Point(geometry.getLastCoordinate());
            label = formatLength(geometry);
            line = geometry;
        }
    }
    if (segments && line) {
        let count = 0;
        line.forEachSegment(function (a, b) {
            const segment = new LineString([a, b]);
            const label = formatLength(segment);
            if (segmentStyles.length - 1 < count) {
                segmentStyles.push(segmentStyle.clone());
            }
            const segmentPoint = new Point(segment.getCoordinateAt(0.5));
            segmentStyles[count].setGeometry(segmentPoint);
            segmentStyles[count].getText().setText(label);
            styles.push(segmentStyles[count]);
            count++;
        });
    }
    if (label) {
        labelStyle.setGeometry(point);
        labelStyle.getText().setText(label);
        styles.push(labelStyle);
    }
    if (
        tip &&
        type === 'Point' &&
        !measureModify.getOverlay().getSource().getFeatures().length
    ) {
        tipPoint = geometry;
        tipStyle.getText().setText(tip);
        styles.push(tipStyle);
    }
    return styles;
}

const measureLayer = new VectorLayer({
    source: measureSource,
    style: function (feature) {
        return styleFunction(feature, showSegments.checked);
    },
});
map.addLayer(measureLayer)

// Add a taggle for measureing length and areas.
let measureToggle = new Toggle({
    title: "Measure",
    className: "measure-toggle",
    html: '<i class="fa">M</i>',
    active: false,
});
measureToggle.on('change:active', function (e) {
    measureLayer.getSource().clear();
    measureModify.setActive(e.active);
    measureDraw.setActive(e.active);
    measureLayer.setVisible(e.active);
    typeSelect.disabled = !e.active;
    showSegments.disabled = !e.active;
    clearPrevious.disabled = !e.active;
});
nestedbar.addControl(measureToggle);

map.addInteraction(measureModify);

let measureDraw; // global so we can remove it later

function addInteraction() {
    const drawType = typeSelect.value;
    const activeTip =
        'Click to continue drawing the ' +
        (drawType === 'Polygon' ? 'polygon' : 'line');
    const idleTip = 'Click to start measuring';
    let tip = idleTip;
    measureDraw = new Draw({
        source: measureSource,
        type: drawType,
        style: function (feature) {
            return styleFunction(feature, showSegments.checked, drawType, tip);
            },
    });
    measureDraw.on('drawstart', function () {
        if (clearPrevious.checked) {
            measureSource.clear();
        }
        measureModify.setActive(false);
        tip = activeTip;
    });
    measureDraw.on('drawend', function () {
        modifyStyle.setGeometry(tipPoint);
        measureModify.setActive(true);
        map.once('pointermove', function () {
            modifyStyle.setGeometry();
        });
        tip = idleTip;
    });
    measureModify.setActive(true);
    map.addInteraction(measureDraw);
};
typeSelect.onchange = function () {
    map.removeInteraction(measureDraw);
    addInteraction();
};
addInteraction();
measureDraw.setActive(measureToggle.getActive());

showSegments.onchange = function () {
    measureLayer.changed();
    measureDraw.getOverlay().changed();
};

// In the current implementation of LayerSwitcher layers don't overlap, so we turn off opacity.
document.body.classList.add('hideOpacity')
