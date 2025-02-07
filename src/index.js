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
import { Feature } from 'ol';
import { LineString, Point, Polygon } from 'ol/geom';
import { getArea, getLength } from 'ol/sphere';
// import { createXYZ } from 'ol/tilegrid';
import { ATTRIBUTION } from 'ol/source/OSM'
import { Fill, Stroke, Style, Text, RegularShape, Circle as CircleStyle} from 'ol/style';
import { createStringXY, toStringHDMS } from 'ol/coordinate';
import { GeoJSON, TopoJSON, MVT, GPX, IGC, KML, WKB } from 'ol/format';
import { Attribution, MousePosition, ScaleLine } from 'ol/control';
import { Select, Draw, Modify, DragAndDrop, Snap, defaults as defaultInteractions } from 'ol/interaction';
import { createBox } from 'ol/interaction/Draw';
import { singleClick } from 'ol/events/condition';

// import VectorTileSource from 'ol/source/VectorTile';
import { Vector as VectorSource, XYZ } from 'ol/source';
import { ImageTile as ImageTileSource } from 'ol/source';
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
import Button from 'ol-ext/control/Button';
// import EditBar from 'ol-ext/control/EditBar';
// import UndoRedo from "ol-ext/interaction/UndoRedo";
import DrawRegular from "ol-ext/interaction/DrawRegular";
// import FillAttribute from "ol-ext/interaction/FillAttribute";
import FeatureList from "ol-ext/control/FeatureList";
import LayerSwitcher from 'ol-ext/control/LayerSwitcher';
import SearchNominatim from 'ol-ext/control/SearchNominatim';

import * as tf from '@tensorflow/tfjs';
import { toInt, mod, randomColor, meter2pixel, meter2tile2, meter2tile4, WorldPixels2Meters, imageCoord2Meters } from './utils';
import { NMMPostprocess, convertOPstoFCs, convertFCstoOPs } from './postprocess';

const style = new Style({
    fill: new Fill({ color: 'rgba(255, 255, 255, 0.2)' }),
    stroke: new Stroke({
        color: 'rgba(0, 0, 0, 0.5)',
        lineDash: [10, 10],
        width: 2,
    }),
    image: new CircleStyle({
        radius: 5,
        stroke: new Stroke({ color: 'rgba(0, 0, 0, 0.7)' }),
        fill: new Fill({ color: 'rgba(255, 255, 255, 0.2)' }),
    }),
});
const labelStyle = new Style({
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
const tipStyle = new Style({
    text: new Text({
        font: '12px Calibri,sans-serif',
        fill: new Fill({ color: 'rgba(255, 255, 255, 1)' }),
        backgroundFill: new Fill({ color: 'rgba(0, 0, 0, 0.4)' }),
        padding: [2, 2, 2, 2],
        textAlign: 'left',
        offsetX: 15,
    }),
});
const modifyStyle = new Style({
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
const segmentStyle = new Style({
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
const segmentStyles = [segmentStyle];

// Labels and Colors
let labels = [];
let colors = [];
function updateLabels(newLabels) {
    labels = newLabels;
    colors = Array.from({ length: Object.entries(labels).length }, () => randomColor());
}
// Function to create text style with hardcoded settings
const createTextStyle = function (feature, resolution) {
    const maxResolution = 2400;
    let classIndex = feature.get('classIndex');
    let score = feature.get('score');
    let className = labels[classIndex];
    let text = `${className} ${Math.round(score * 100)}%`;
    // eval text as number and select class from labels
    if (resolution > maxResolution) { text = ''; }
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
const polygonStyleFunction = (feature, resolution) => {
    let classIndex = feature.get('classIndex');
    let fillColor = colors[classIndex];
    return new Style({
        stroke: new Stroke({ color: fillColor, width: 1.5 }),
        fill: new Fill({ color: fillColor.concat([0.1]) }),
        text: createTextStyle(feature, resolution),
    });
};

function coordinateFormatPIXEL(coord, zoom) {
    const xypixel = meter2pixel(coord[0], coord[1], zoom);
    const x = 'X: ' + toInt(xypixel[0]);
    const y = 'Y: ' + toInt(xypixel[1]);
    return [x, y].join('   ')
}
function coordinateFormatTILE(coord, zoom) {
    const xytile = meter2tile4(coord[0], coord[1], zoom)
    const z = 'Z: ' + zoom
    const x = 'X: ' + xytile[0]
    const y = 'Y: ' + xytile[1]
    const c = 'C: ' + xytile[2]
    const r = 'R: ' + xytile[3]
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

let zoom = 16, center = [-110.848, 32.163];
let predictList = [];
let task;

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

function ThunderForestSource(layer) {
    return new OSM({
        url: 'https://{a-c}.tile.thunderforest.com/' + layer + '/{z}/{x}/{y}.png' +
            '?apikey=' + process.env.THUNDERFOREST_API_KEY,
        attributions: thunderforestAttributions
    });
}
function GoogleSource(layer) {
    return new ImageTileSource({
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
function BingSource(layer) {
    return new BingMaps({
        key: process.env.BINGMAPS_API_KEY,
        imagerySet: layer
    });
}
function MapboxSource(tileSize) {
    return new ImageTileSource({
        url: 'https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}' +
            (tileSize===512?"@2x.jpg90":".jpg") +
            '?access_token=' + process.env.MAPBOX_API_KEY,
    });
}

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
let sourceMapbox = new MapboxSource()

sourceGoogleSatellite.tileToURL = {}
sourceBingAerial.tileToURL = {}
sourceMapbox.tileToURL = {}
function handleTileLoad(event) {
    this.tileToURL[event.tile.tileCoord] = event.tile.getData().src;
}
function handleTileLoadBing(event) {
    this.tileToURL[event.tile.tileCoord] = event.tile.getImage().src;
}
sourceGoogleSatellite.on('tileloadend', handleTileLoad);
sourceBingAerial.on('tileloadend', handleTileLoadBing);
sourceMapbox.on('tileloadend', handleTileLoad);

let activePredictionLayer;

// TODO: Add Attribution for left hand layer.
function StaticGroup() {
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
                        satLayer: true,
                        baseLayer: true,
                        noSwitcherDelete: true,
                        source: sourceMapbox,
                    }),
                    new TileLayer({
                        title: 'Google',
                        visible: false,
                        satLayer: true,
                        baseLayer: true,
                        noSwitcherDelete: true,
                        source: sourceGoogleSatellite,
                    }),
                    new TileLayer({
                        title: 'Bing',
                        visible: false,
                        satLayer: true,
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
                        noSwitcherDelete: true,
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
    new ScaleLine({
        // className: 'ol-scale-line',
        // bar: true,
        // steps: 4,
        // text: true,
        // minWidth: 140,
    }),
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
            return 'PIXEL: ' + coordinateFormatPIXEL(coord, intZoom);
        },
        className: 'ol-custom-mouse-position ol-custom-mouse-positionPIXEL',
        projection: 'EPSG:900913',
    }),
    new MousePosition({
        coordinateFormat: function(coord) {
            return 'TILE: ' + coordinateFormatTILE(coord, intZoom);
        },
        className: 'ol-custom-mouse-position ol-custom-mouse-positionTILE',
        projection: 'EPSG:900913',
    }),
];
let view = new View({
    center: transform(center, 'EPSG:4326', 'EPSG:3857'),
    zoom: zoom
});
let intZoom = view.getZoom();
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

function NewPredictionLayer(predLayerName, predSource) {
    return new VectorLayer({
        title: `${predLayerName} (Detections)`,
        visible: true,
        baseLayer: false,
        predLayer: predLayerName,
        source: predSource,
        style: polygonStyleFunction
    })
}
function addNewPredictionLayer(predLayer) {
    let predSource = new VectorSource()
    let leftVectorLayer = new NewPredictionLayer(predLayer, predSource)
    let rightVectorLayer = new NewPredictionLayer(predLayer, predSource)
    leftgroup.getLayers().getArray()[1].getLayers().push(leftVectorLayer);
    rightgroup.getLayers().getArray()[1].getLayers().push(rightVectorLayer);
    swipe.addLayer(leftVectorLayer, false);
    let predLayerFound = false;
    swipe.layers.forEach(l => {
        if (l.right && l.layer.get('baseLayer') && l.layer.get('title') === predLayer) {
            predLayerFound = true;
        }
    })
    if (predLayerFound) {
        swipe.addLayer(rightVectorLayer, true)
    } else {
        rightVectorLayer.setVisible(false)
    }
    return leftVectorLayer;
}

function switchleft(layer) {
    let add_layers = [];
    let del_layers = [];
    if (layer.get('baseLayer')) {
        swipe.layers.forEach( function(l) {
            if (!l.right && l.layer.get('baseLayer')) {
                del_layers.push(l.layer);
                add_layers.push(layer);
            }
        })
        if (layer.get('satLayer')) {
            let predLayerFound = false;
            this._layers.forEach( function(l) {
                if (l.layer.get('predLayer') === layer.get('title')) {
                    add_layers.push(l.layer);
                    activePredictionLayer = l.layer;
                    predLayerFound = true;
                }
            })
            if (!predLayerFound) {
                activePredictionLayer = addNewPredictionLayer(layer.get('title'));
            }
        }
    } else {
        if (layer.get('visible')) {
            add_layers.push(layer);
        } else {
            del_layers.push(layer);
        }
    }
    swipe.removeLayer(del_layers);
    add_layers.forEach( function(l) {
        l.setVisible(true);
        swipe.addLayer(l, false);
    })
    if (layer.get('baseLayer')) {
        swipe.leftBaseLayer = layer;
        $LeftLayerLabelDiv.innerHTML = "&#9668; " + layer.get('title')
    }
    // console.log(' left ' + layer.get('title') + ' ' + layer.get('baseLayer') + ' ' + layer.get('visible'));
}
function switchright(layer) {
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
    trash: false,
    extent: true,
    collapsed: true,
    reordering: false,
    switcherClass: "layerSwitcherRight ol-layerswitcher",
    layerGroup: rightgroup,
    onchangeCheck: switchright
});
map.addControl(layerswitcheright);

function initswipelayer({ layergroup, right, idx = 0 } = {}) {
    let layers = layergroup.getLayers().getArray()[0].getLayersArray()
    let index = mod(layers.length - (1 + idx), layers.length)
    let layer = layers[index]
    layer.setVisible(true);
    swipe.addLayer(layer, right);
    if (!right && layer.get('satLayer')) {
        activePredictionLayer = addNewPredictionLayer(layer.get('title'));
    }
    if (right) {
        $RightLayerLabelDiv.innerHTML = layer.get('title') + " &#9658;";
    } else {
        swipe.leftBaseLayer = layer;
        $LeftLayerLabelDiv.innerHTML = "&#9668; " + layer.get('title');
    }
}
initswipelayer({ layergroup: rightgroup, right: true, idx: 0 })
initswipelayer({ layergroup: leftgroup, right: false, idx: -1 })
map.addControl(swipe);

// Main control bar
let mainbar = new Bar();
map.addControl(mainbar);

// Add a button to get predictions from the active baselayer.
let predictButton = new Button({
    title: "Predict",
    className: "predict-button",
    html: '<i class="fa-solid fa-bolt" style="opacity: 0.5;"></i>',
    disabled: true,
    handleClick: function () {
        runModelOnTiles();
    }
});
mainbar.addControl(predictButton);

let predictionWindow;
map.on('moveend', function(e) {
    predictionWindow = e.frameState.extent;
});
map.on('rendercomplete', function (e) {
    const res = map.getView().getResolution();
    intZoom = swipe.leftBaseLayer.getSource().getTileGrid().getZForResolution(res);

    const titles = {};
    for (const l of map.getAllLayers()) {
        if (l.get('predLayer') || l.get('dragdropLayer')) {
            titles[l.get('title')] = (titles[l.get('title')] || 0) + 1;
        }
    }
    for (const l of map.getAllLayers()) {
        if (l.get('predLayer') || l.get('dragdropLayer')) {
            if (titles[l.get('title')] === 1) {
                rightgroup.getLayers().getArray()[1].getLayers().remove(l);
            }
        }
    }
});

// An overlay that stay on top
let debugLayer = new TileLayer({
    title: "Debug Tiles",
    visible: false,
    // displayInLayerSwitcher: false,
    source: new TileDebug(),
});
map.addLayer(debugLayer);
let debugLayerToggle = new Toggle({
    title: "Tiling Grid",
    className: "debug-toggle",
    html: '<i class="fa-solid fa-bug"></i>',
    active: false,
    onToggle: function(active) { debugLayer.setVisible(active) }
});
mainbar.addControl(debugLayerToggle);

// Feature List control
let featurelist = new FeatureList({
    title: 'Detections',
    collapsed: true,
});
map.addControl(featurelist);
featurelist.element.getElementsByTagName('button')[0].innerHTML = '<i class="fa-solid fa-table-list"></i>'
let selectFeatureList;
layerswitcherleft.on('info', function (e) {
    if (!e.layer.get('baseLayer')) {
        featurelist.setFeatures(e.layer.getSource())
        featurelist._menu.getElementsByTagName('p')[0].innerHTML = e.layer.get('title')
        featurelist.enableSort(...featurelist.getColumns(e.layer.getSource().getFeatures()))
        map.removeInteraction(selectFeatureList);
        selectFeatureList = new Select({
            hitTolerance: 5,
            condition: singleClick,
            layers: [e.layer],
        });
        map.addInteraction(selectFeatureList);
        featurelist.on('select', function(e) {
            selectFeatureList.getFeatures().clear();
            selectFeatureList.getFeatures().push(e.feature);
        });
        featurelist.on('dblclick', function(e) {
            map.getView().fit(e.feature.getGeometry().getExtent())
            map.getView().setZoom(Math.min(map.getView().getZoom(), 20) - 1)
        });
        selectFeatureList.on('select', function(e) {
            const f = e.selected[0];
            if (f) {
                featurelist.select(f)
            }
        });
        featurelist.collapse(false);
    }
});

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
    const vectorSource = new VectorSource({
        features: e.features,
    });
    const color = randomColor()
    const style = new Style({
        image: new CircleStyle({
            radius: 3,
            stroke: new Stroke({ color: color, width: 2 }),
        }),
        stroke: new Stroke({ color: color, width: 3 }),
        // stroke: new Stroke({color: 'rgb(255,165,0)', width: 3}),
    })
    function DragAndDropVectorLayer() {
        return new VectorLayer({
            title: e.file.name,
            visible: true,
            baseLayer: false,
            dragdropLayer: true,
            displayInLayerSwitcher: true,
            source: vectorSource,
            style: style
        })
    }

    let leftVectorLayer = new DragAndDropVectorLayer();
    let rightVectorLayer = new DragAndDropVectorLayer();
    leftgroup.getLayers().getArray()[1].getLayers().push(leftVectorLayer);
    rightgroup.getLayers().getArray()[1].getLayers().push(rightVectorLayer);
    swipe.addLayer(leftVectorLayer, false);
    swipe.addLayer(rightVectorLayer, true);
    map.getView().fit(vectorSource.getExtent());
});

// Nominatim Search
let searchLayer = new VectorLayer({
    name: 'search',
    source: new VectorSource(),
    style: new Style({
        image: new CircleStyle({
            radius: 5,
            stroke: new Stroke({ color: 'rgb(255,165,0)', width: 3 }),
            fill: new Fill({ color: 'rgba(255,165,0,.3)' })
        }),
        stroke: new Stroke({ color: 'rgb(255,165,0)', width: 3 }),
        fill: new Fill({ color: 'rgba(255,165,0,.3)' })
    })
});
map.addLayer(searchLayer);
let search = new SearchNominatim({
    reverse: true,
    position: true,	// Search, with priority to geo position
    maxItems: 15
});
map.addControl(search);
search.on('select', function (e) {
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
        setTimeout(function (){
            view.animate({
                center: center,
                zoom: Math.min(zoom, 16)
            });
        }, 100);
    } else {
        map.getView().animate({
            center: e.coordinate,
            zoom: Math.max(map.getView().getZoom(), 16)
        });
    }
});
$('.ol-search > button').html('<i class="fa-solid fa-magnifying-glass"></i>');

// Nested toolbar (Only one control activated at a time.)
var nestedbar = new Bar ({ toggleOne: true, group: true });
mainbar.addControl(nestedbar);

// Add a toggle for the model/prediction menu.
let predictLayer = new VectorLayer({
    name: 'Predict Box',
    visible: false,
    source: new VectorSource(),
    style: new Style({
        stroke: new Stroke({ color: 'rgb(0,76,151)', width: 3 }),
    }),
});
map.addLayer(predictLayer);
let predictToggle = new Toggle({
    title: "Model",
    className: "model-button",
    html: '<i class="fa-solid fa-hexagon-nodes"></i>',
    disabled: false,
});
nestedbar.addControl(predictToggle);
let predictInteraction; // global so we can remove it later
function addPredictInteraction(value) {
    if (value !== 'None') {
        let geometryFunction;
        let clickTolerance;
        if (value === 'Rectangle') {
            value = 'Circle';
            geometryFunction = createBox();
            clickTolerance = 12;
        } else if (value === 'Polygon') {
            value = 'Polygon';
            clickTolerance = 12;
        }
        predictInteraction = new Draw({
            source: predictLayer.getSource(),
            type: value,
            geometryFunction: geometryFunction,
            clickTolerance: clickTolerance,
            style: new Style({
                fill: new Fill({color: 'rgba(255, 255, 255, 0.1)'}),
                stroke: new Stroke({color: 'rgba(0, 0, 0, 0.5)', width: 2}),
            })
        });
        map.addInteraction(predictInteraction);
        predictInteraction.setActive(predictToggle.getActive());
        predictInteraction.on('drawend', function (e) {
            let predictPolygon = e.feature.getGeometry();
            let tiles = get_tiles_from_polygon(predictPolygon);
            if (tiles.length > 500 && !confirm(`Download ${tiles.flat().length} tiles?`)) {
                predictLayer.getSource().once('addfeature', function (event) {
                    predictLayer.getSource().removeFeature(event.feature)
                })
            } else {
                predictList.push(tiles);
                if (predictToggle.getActive()) {
                    runModelOnCoords(); //  if predict is active run on boxes as they are drawn
                }
                map.getTargetElement().style.cursor = '';
            }
        });
    }
}
predictToggle.on('change:active', function (e) {
    predictLayer.getSource().clear();
    predictInteraction.setActive(e.active);
    predictLayer.setVisible(e.active);
    if (!e.active) predictList = []; // reset the bbox list if we turn off the toggle
    $('#modelInfoElement')[0].style.display = e.active ? 'flex' : 'none';
});

// Add a toggle for drawing bounding boxes
let bboxLayer = new VectorLayer({
    name: 'BBox',
    visible: false,
    source: new VectorSource(),
    style: new Style({
        stroke: new Stroke({ color: 'rgb(0,76,151)', width: 3 }),
    }),
});
map.addLayer(bboxLayer);
let bboxToggle = new Toggle({
    title: "Bounding Box",
    className: "bbox-toggle",
    html: '<i class="fa-solid fa-vector-square"></i>',
    active: false,
});
nestedbar.addControl(bboxToggle);
let bboxInteraction = new DrawRegular({
    source: bboxLayer.getSource(),
    clickTolerance: 12,
    sides: 4,
    canRotate: false
});
map.addInteraction(bboxInteraction);
bboxInteraction.setActive(bboxToggle.getActive());
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
    $('#bbox').val(ll0 + ', ' + ll1);
});
bboxToggle.on('change:active', function (e) {
    $('#bbox').val('')
    bboxLayer.getSource().clear();
    bboxInteraction.setActive(e.active);
    bboxLayer.setVisible(e.active);
    $('#formatted')[0].style.display = e.active ? '' : 'none';
});

// Add a toggle for measureing length and areas.
const typeSelect = document.getElementById('type');
const showSegments = document.getElementById('segments');
const clearPrevious = document.getElementById('clear');
const measureSource = new VectorSource();
const measureModify = new Modify({ source: measureSource, style: modifyStyle });
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
let measureToggle = new Toggle({
    title: "Measure",
    className: "measure-toggle",
    html: '<i class="fa-solid fa-ruler"></i>',
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
    $('#measure')[0].style.display = e.active ? '' : 'none';
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
}
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

// Modal functionality of opening/closing jobs modal
let modal = document.getElementById("JobModal");
let close_modal = document.getElementsByClassName("close-modal")[0];
let JobToggle = new Button({
    title: "Jobs",
    className: "job-toggle",
    id: "job-toggle",
    html: '<i class="fa-solid fa-calendar-days"></i>',
    active: false,
    handleClick: function (active) {
        if (active) {
            modal.style.display = "block";
        } else {
            modal.style.display = "none";
        }
    }
});
close_modal.onclick = function() {
    modal.style.display = "none";
};
window.onclick = function(event) {
    if (event.target === modal) {
        modal.style.display = "none";
    }
};
mainbar.addControl(JobToggle);

// information buttton
const infoPanel = document.getElementById('infoPanel');
const closeInfo = document.getElementById('close-info');
let infoToggle = new Toggle({
    title: 'Info',
    className: 'info-toggle',
    html: '<i class="fa-solid fa-question"></i>',
    active: false,
});
mainbar.addControl(infoToggle);
infoToggle.on('change:active', function (e) {
    infoPanel.style.display = e.active ? 'block' : 'none';
});
closeInfo.onclick = function () {
    infoToggle.setActive(false);
};


// job modal map
const mapModal = new Map({
    target: 'map-modal', // Target the div with id "map"
    layers: [
        new TileLayer({
            source: new OSM() // OpenStreetMap as the base layer
        })
    ],
    view: new View({
        center: [0, 0], // Default center (longitude, latitude in EPSG:3857)
        zoom: 2 // Default zoom level
    }),
    interactions: defaultInteractions(),
});

//job modal map functionallity
const dragAndDropInteractionModal = new DragAndDrop({
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
mapModal.addInteraction(dragAndDropInteractionModal);

dragAndDropInteractionModal.on('addfeatures', function (e) {
    const vectorSource = new VectorSource({
        features: e.features,
    });
    const color = randomColor(); // reuse existing randomColor
    const style = new Style({
        image: new CircleStyle({
            radius: 3,
            stroke: new Stroke({ color: color, width: 2 }),
        }),
        stroke: new Stroke({ color: color, width: 3 }),
    });
    function DragAndDropVectorLayer() {
        return new VectorLayer({
            source: vectorSource,
            style: style,
        });
    }
    let vectorLayer = new DragAndDropVectorLayer();
    mapModal.addLayer(vectorLayer);
    mapModal.getView().fit(vectorSource.getExtent());
});

const nmm_postprocess = new NMMPostprocess(0.5, 'IOS', true);
async function nmsPredictions(featuresInExtent, zoom) {
    // create boxes, scores, and classes from feature values
    let geoms = [];
    let bounds = [];
    let scores = [];
    let classes = [];
    featuresInExtent.forEach((feature) => {
        const geom = feature.getGeometry().getCoordinates()[0];
        const [minx, miny, maxx, maxy] = feature.get('bounds');
        const [px0, py0] = meter2pixel(minx, maxy, zoom);
        const [px1, py1] = meter2pixel(maxx, miny, zoom);
        geoms.push(geom);
        bounds.push([px0, py0, px1, py1]);
        scores.push(feature.get('score'));
        classes.push(feature.get('classIndex'));
    });

    // run nms
    const boundsTensor = tf.tensor2d(bounds, [bounds.length, 4]); // [x, 4]
    const scoresTensor = tf.tensor1d(scores); // [x]
    const geometryTensor = tf.tensor3d(geoms, [bounds.length, 5, 2]);
    // const nmsIndices = await tf.image.nonMaxSuppressionAsync(boxesTensor, scoresTensor, scores.length, .5, .5, .5)
    const nms_results = await tf.image.nonMaxSuppressionWithScoreAsync(boundsTensor, scoresTensor, scores.length, .5, .5, .1);
    // console.log(nms_results, nms_results.selectedIndices, nmsIndices);

    // gather results
    const gatheredGeoms = geometryTensor.gather(nms_results.selectedIndices); // float32 for class keypoints
    const gatheredBounds = boundsTensor.gather(nms_results.selectedIndices);
    const gatheredScores = scoresTensor.gather(nms_results.selectedIndices);
    const gatheredClasses = tf.gather(tf.tensor1d(classes, 'int32'), nms_results.selectedIndices); // int32 for class indices

    const geometryData = await gatheredGeoms.array();
    const boundsData = await gatheredBounds.array();
    const scoresData = await gatheredScores.array();
    const classesData = await gatheredClasses.array();

    // replace the current features with the nms results
    const featureCollection = [];
    for (let i = 0; i < scoresData.length; i++) {
        const geom = geometryData[i];
        const [px0, py0, px1, py1] = boundsData[i];
        const [minx, maxy] = WorldPixels2Meters(px0, py0, zoom);
        const [maxx, miny] = WorldPixels2Meters(px1, py1, zoom);
        const score = scoresData[i];
        const cls = classesData[i];
        const feature = new Feature({
            geometry: new Polygon([geom]),
            bounds: [minx, miny, maxx, maxy],
            classIndex: cls,
            label: labels[cls],
            score: score,
        });
        featureCollection.push(feature);
    }

    // dispose tensors to free memory
    boundsTensor.dispose();
    geometryTensor.dispose();
    scoresTensor.dispose();
    gatheredBounds.dispose();
    gatheredGeoms.dispose();
    gatheredScores.dispose();
    gatheredClasses.dispose();

    return featureCollection
}
async function nmsPredictions1(featuresInExtent) {
    let bounds = [];
    let scores = [];
    featuresInExtent.forEach((feature) => {
        bounds.push(feature.get('bounds'));
        scores.push(feature.get('score'));
    });
    const boundsTensor = tf.tensor2d(bounds, [bounds.length, 4]); // [x, 4]
    const scoresTensor = tf.tensor1d(scores); // [x]
    const nms = await tf.image.nonMaxSuppressionWithScoreAsync(boundsTensor, scoresTensor, scores.length, .5, .25, .1);
    const nms_indices = nms.selectedIndices.arraySync();
    const featureCollection = [];
    for (const nms_idx of nms_indices) {
        featureCollection.push(featuresInExtent[nms_idx]);
    }
    boundsTensor.dispose();
    scoresTensor.dispose();
    return featureCollection
}
async function nmmWrapper(nmm_extent) {
    const zoom = toInt($('#modelZoom').val());
    let featureCollection1 = activePredictionLayer.getSource().getFeaturesInExtent(nmm_extent);
    let featureCollection2;
    if (task !== 'obb') {
        const objectPredictions1 = convertFCstoOPs(featureCollection1, zoom, task); //, intZoom);
        const objectPredictions2 = nmm_postprocess.call(objectPredictions1);
        featureCollection2 = convertOPstoFCs(objectPredictions2, zoom, task); // , intZoom);
    } else {
        featureCollection2 = featureCollection1;
    }
    const featureCollection3 = await nmsPredictions1(featureCollection2);
    activePredictionLayer.getSource().removeFeatures(featureCollection1);
    activePredictionLayer.getSource().addFeatures(featureCollection3);
}

// copy to clipboard function
function copyToClipboard() {
    const copyText = document.getElementById('bbox');
    navigator.clipboard.writeText(copyText.value)
        .then(() => {
            console.log('Text copied to clipboard successfully!');
        })
        .catch(err => {
            console.error('Failed to copy text: ', err);
        });
}
const copyButton = document.getElementById('CopyToClipboard');
copyButton.addEventListener('click', copyToClipboard, { passive: true });

const tfjs_worker = new Worker(new URL("./worker.js", import.meta.url));
document.addEventListener('DOMContentLoaded', function () {
    document.body.classList.add('hideOpacity')
}, { passive: true });
$('#modelName').on('change', (e) => {
    tfjs_worker.postMessage({ model: e.target.value });
})
$('#predictDrawType').on('change', (e) => {
    map.removeInteraction(predictInteraction);
    addPredictInteraction(e.target.value)

})
function loadDefaultModel() {
    const default_model = 'CivPlanes_detect_1_08_half_160k'
    const default_model_zoom = 19;
    $('#modelName').val(default_model).trigger('change')
    $('#modelZoom').val(default_model_zoom).trigger('change')
    $('#predictDrawType').val('Rectangle').trigger('change')
}
function loadModelOptions(directories) {
    const $modelNames = $('#modelName');
    $modelNames.empty().append($('<option value="">Select a model</option>'));
    directories.forEach(dir => {
        $modelNames.append($(`<option value="${dir}">${dir}</option>`));
    });
    const $modelZooms = $('#modelZoom');
    for (let i = 15; i <= 20; i++) {
        $modelZooms.append($(`<option value="${i}">${i}</option>`));
    }
    loadDefaultModel();
}
tfjs_worker.postMessage({ url: document.URL });
tfjs_worker.postMessage({ loadModelDirectories: true });
// Listen for messages from the worker
let modelLoadingStatusElement = document.getElementById('modelLoadingStatus');
tfjs_worker.onmessage = function (event) {
    console.log('Main thread: Message received from worker', event.data);
    const { directories, ready, model_loaded, results, labels, error, nmm_extent } = event.data;

    if (directories) { loadModelOptions(directories) }
    if (ready === true) {
        predictButton.setHtml('<i class="fa-solid fa-bolt"></i>');
        predictButton.setDisable(false);
        modelLoadingStatusElement.innerHTML = 'Loaded';
        modelLoadingStatusElement.style.backgroundColor = 'rgb(0, 165, 255)';
    }
    if (ready === false) {
        predictButton.setHtml('<i class="fa-solid fa-bolt" style="opacity: 0.5;"></i>');
        predictButton.setDisable(true);
        modelLoadingStatusElement.innerHTML = 'Loading';
        modelLoadingStatusElement.style.backgroundColor = 'rgb(255, 165, 0)';
    }
    if (model_loaded) {
        task = model_loaded
    }
    // Handle the results if the model is ready
    if (results) { // results.geometry, results.bounds, results.classIndex, results.label, results.score
        results.forEach(result => {
            result.geometry.push(result.geometry[0]);
            const feature = new Feature({
                geometry: new Polygon([result.geometry]),
                bounds: result.bounds,
                classIndex: result.classIndex,
                label: result.label,
                score: result.score
            });
            activePredictionLayer.getSource().addFeature(feature);
        });
    }
    // run nmm (and nms) on all predictions
    if (nmm_extent) { nmmWrapper(nmm_extent) }
    // Handle the labels if the model is ready
    if (labels) { updateLabels(labels) }

    if (error) { console.error('Error:', error) }
};

function get_tiles_from_extent(box) {
    // let z = intZoom;
    let z = $('#modelZoom').val();
    let [x0, y0] = meter2tile2(box[0], box[1], z);
    let [x1, y1] = meter2tile2(box[2], box[3], z);
    // Collect all tiles within the view extent
    let tiles = [];
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
        for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) {
            const url = swipe.leftBaseLayer.getSource().tileToURL[[z, x, y].join(',')];
            tiles.push({ x, y, z, url });
        }
    }
    return tiles;
}
function runModelOnTiles() {
    const tiles = get_tiles_from_extent(predictionWindow);
    tfjs_worker.postMessage({ tiles: tiles });
}
async function get_tiles_from_cord_box(box) {
    let z = $('#modelZoom').val();
    let [x0, y0] = meter2tile2(box[0], box[1], z);
    let [x1, y1] = meter2tile2(box[2], box[3], z);
    // Collect all tiles within the bounding box
    let tiles = [];
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
        for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) {
            const loadImage = swipe.leftBaseLayer.getSource().loader_(z, x, y, {crossOrigin: 'anonymous'});
            tiles.push(
                loadImage.then((e) => ({ x, y, z, url: e.src }))
            );
        }
    }
    return Promise.all(tiles);
}
async function runModelOnBoxes() {
    let tileArrays = await Promise.all(predictList.map(get_tiles_from_cord_box));
    tfjs_worker.postMessage({ tiles: tileArrays.flat() });
    predictList = [];
}
function get_tiles_from_polygon(polygon) {
    // let z = intZoom;
    let z = toInt($('#modelZoom').val());
    const tile_coords = polygon.getCoordinates()[0].map(([x, y]) => meter2tile2(x, y, z));
    const geom = new Polygon([tile_coords]);
    const [x0, y0, x1, y1] = geom.getExtent();

    // Collect all tiles within the bounded polygon
    let tiles = [];
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
        for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) {
            for (let i = 0; i < 4; i++) {
                let [mx, my] = imageCoord2Meters(0, 0, x + mod(i, 2), y + Math.floor(i / 2), z);
                if (polygon.containsXY(mx, my)) {
                    tiles.push({x, y, z});
                    break;
                }
            }
        }
    }
    return tiles;
}
async function get_tiles_from_coord_list(coord_list) {
    let tiles = [];
    coord_list.forEach(({ x, y, z }) => {
        const loadImage = swipe.leftBaseLayer.getSource().loader_(z, x, y, {crossOrigin: 'anonymous'});
        tiles.push(
            loadImage.then((e) => ({ x, y, z, url: e.src }))
        );
    });
    return Promise.all(tiles);
}
async function runModelOnCoords() {
    let tileArrays = await Promise.all(predictList.map(get_tiles_from_coord_list));
    tfjs_worker.postMessage({ tiles: tileArrays.flat() });
    predictList = [];
}

// remove all overlays
function toggleUI() {
    const controls = document.getElementsByClassName('ol-control');
    for (let i = 0; i < controls.length; i++) {
        controls[i].style.display = controls[i].style.display === 'none' ? '' : 'none';
    }
    document.getElementsByClassName('ol-overlaycontainer')[0].style.display = document.getElementsByClassName('ol-overlaycontainer')[0].style.display === 'none' ? '' : 'none';
    document.getElementsByClassName('ol-overlaycontainer-stopevent')[0].style.display = document.getElementsByClassName('ol-overlaycontainer-stopevent')[0].style.display === 'none' ? '' : 'none';
    document.getElementById('panel').style.display = document.getElementById('panel').style.display === 'none' ? '' : 'none';
}

// add font awesome icon on layers switchers
document.querySelectorAll('.ol-layerswitcher').forEach((e) => {
    e.querySelector('button').innerHTML = '<i class="fa-solid fa-layer-group"></i>';
});

// create some button click when a key is pressed, G clicks debugLayer.setVisible(active)
document.addEventListener('keydown', function (event) {
    const debugElement = document.querySelectorAll('button[type=button][title="Tiling Grid"]')[0];
    const predictElement = document.querySelectorAll('button[type=button][title="Predict"]')[0];
    const measureElement = document.querySelectorAll('button[type=button][title="Measure"]')[0];
    const bboxElement = document.querySelectorAll('button[type=button][title="Bounding Box"]')[0];
    const modelInfoElement = $('#modelInfoElement')[0]
    // if the search bar is not "ol-collapsed", then we must be using it so dont do shortcuts
    if (document.getElementsByClassName('nominatim ol-search ol-unselectable ol-control ol-collapsed').length != 1) {
        return;
    }

    if (event.key === 'd') {
        debugElement.click();
    } else if (event.key === 'p') {
        predictElement.click();
    } else if (event.key === 'm') {
        measureElement.click();
    } else if (event.key === 'b') {
        bboxElement.click();
    } else if (event.key === 'l') {
        modelInfoElement.style.display = modelInfoElement.style.display === 'flex' ? 'none' : 'flex';
    } else if (event.key === 'c') { // clear the detection layer predictions
        activePredictionLayer.getSource().clear();
    } else if (event.key === 'h') { // hide everything but the map
        toggleUI()
    } else if (event.key === 'Escape') {
        predictInteraction.abortDrawing();
    }
}, { passive: true });
