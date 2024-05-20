// must import css in this order
import 'ol/ol.css';
import 'ol-ext/dist/ol-ext.css'
import './style.css';

import { Select, Draw, Modify, DragAndDrop, defaults as defaultInteractions } from 'ol/interaction';
import { Fill, Stroke, Style, Text, RegularShape, Circle as CircleStyle } from 'ol/style';
import { Vector as VectorSource, XYZ, TileDebug, OSM, BingMaps } from 'ol/source';
import { Tile as TileLayer, Vector as VectorLayer } from 'ol/layer';
import { Attribution, MousePosition, ScaleLine } from 'ol/control';
import { GeoJSON, TopoJSON, GPX, IGC, KML, WKB } from 'ol/format';
import { createStringXY, toStringHDMS } from 'ol/coordinate';
import { LineString, Point, Polygon } from 'ol/geom';
import { ATTRIBUTION } from 'ol/source/OSM'
import LayerGroup from 'ol/layer/Group';
import { containsCoordinate, getCenter } from 'ol/extent';
import { transform } from 'ol/proj';
import { Feature } from 'ol';
import View from 'ol/View';
import Map from 'ol/Map';

import SearchNominatim from 'ol-ext/control/SearchNominatim';
import DrawRegular from "ol-ext/interaction/DrawRegular";
import LayerSwitcher from 'ol-ext/control/LayerSwitcher';
import Toggle from 'ol-ext/control/Toggle';
import Swipe from 'ol-ext/control/Swipe';
import Bar from 'ol-ext/control/Bar';

import { randomColor, meter2pixel, meter2tile, formatLength, formatArea } from './utils';
import { style, labelStyle, tipStyle, modifyStyle, polygonStyleFunction } from './utils';

let zoom = 16, center = [-110.83, 32.155];

function coordinateFormatPIXEL(coord) {
    let zoom = view.getZoom()
    let xypixel = meter2pixel(coord[0], coord[1], zoom)
    let x = 'X: ' + xypixel[0]
    let y = 'Y: ' + xypixel[1]
    return [x, y].join('   ')
}
function coordinateFormatTILE(coord) {
    let zoom = view.getZoom()
    let xytile = meter2tile(coord[0], coord[1], zoom)
    let x = 'X: ' + xytile[0]
    let y = 'Y: ' + xytile[1]
    let z = 'Z: ' + xytile[2]
    let c = 'C: ' + xytile[3]
    let r = 'R: ' + xytile[4]
    return [z, x, y, c, r].join('   ')
}

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

let thunderforestAttributions = [
    'Tiles &copy; <a href="https://www.thunderforest.com/">Thunderforest</a>',
    ATTRIBUTION
];

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
                        source: new OSM(),
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
                        source: new OSM({
                            url: 'https://{a-c}.tile.thunderforest.com/cycle/{z}/{x}/{y}.png' +
                                '?apikey=' + process.env.THUNDERFOREST_API_KEY,
                            attributions: thunderforestAttributions
                        })
                    }),
                    new TileLayer({
                        title: 'Transport Dark',
                        visible: false,
                        baseLayer: true,
                        noSwitcherDelete: true,
                        source: new OSM({
                            url: 'https://{a-c}.tile.thunderforest.com/transport-dark/{z}/{x}/{y}.png' +
                                '?apikey=' + process.env.THUNDERFOREST_API_KEY,
                            attributions: thunderforestAttributions
                        })
                    }),
                    new TileLayer({
                        title: 'Transport',
                        visible: false,
                        baseLayer: true,
                        noSwitcherDelete: true,
                        source: new OSM({
                            url: 'https://{a-c}.tile.thunderforest.com/transport/{z}/{x}/{y}.png' +
                                '?apikey=' + process.env.THUNDERFOREST_API_KEY,
                            attributions: thunderforestAttributions
                        })
                    }),
                    new TileLayer({
                        title: 'Landscape',
                        visible: false,
                        baseLayer: true,
                        noSwitcherDelete: true,
                        source: new OSM({
                            url: 'https://{a-c}.tile.thunderforest.com/landscape/{z}/{x}/{y}.png' +
                                '?apikey=' + process.env.THUNDERFOREST_API_KEY,
                            attributions: thunderforestAttributions
                        })
                    }),
                    new TileLayer({
                        title: 'Outdoors',
                        visible: false,
                        baseLayer: true,
                        noSwitcherDelete: true,
                        source: new OSM({
                            url: 'https://{a-c}.tile.thunderforest.com/outdoors/{z}/{x}/{y}.png' +
                                '?apikey=' + process.env.THUNDERFOREST_API_KEY,
                            attributions: thunderforestAttributions
                        })
                    }),
                    new TileLayer({
                        title: 'Google (Roads)',
                        visible: false,
                        baseLayer: true,
                        noSwitcherDelete: true,
                        source: new XYZ({
                            url: 'https://mt{0-3}.google.com/vt/lyrs=r&x={x}&y={y}&z={z}',
                        }),
                    }),
                    new TileLayer({
                        title: 'Bing (Roads)',
                        visible: false,
                        baseLayer: true,
                        noSwitcherDelete: true,
                        source: new BingMaps({
                            key: process.env.BINGMAPS_API_KEY,
                            imagerySet: 'Road'
                        })
                    }),
                    // new TileLayer({
                    //     title: 'Bing (Hybrid)',
                    //     visible: false,
                    //     baseLayer: true,
                    // noSwitcherDelete: true,
                    //     source: new BingMaps({
                    //         key: process.env.BINGMAPS_API_KEY,
                    //         imagerySet: 'AerialWithLabels'
                    //     })
                    // }),
                    new TileLayer({
                        title: 'Mapbox',
                        // title: 'Mapbox (512)',
                        visible: false,
                        baseLayer: true,
                        noSwitcherDelete: true,
                        source: new XYZ({
                            url: 'https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}@2x.jpg90' +
                                '?access_token=' + process.env.MAPBOX_API_KEY,
                        }),
                    }),
                    new TileLayer({
                        title: 'Google',
                        // title: 'Google (Satellite)',
                        visible: false,
                        baseLayer: true,
                        noSwitcherDelete: true,
                        source: new XYZ({
                            url: 'https://mt{0-3}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
                            // url: 'http://mt0.google.com/vt/lyrs=s&hl=en&x={x}&y={y}&z={z}',
                            // url: 'https://khms0.googleapis.com/kh?&v=870&x={x}&y={y}&z={z}',
                            // url: 'https://khms0.google.com/kh/v=908?x={x}&y={y}&z={z}',
                            // url: 'http://www.google.cn/maps/vt?lyrs=s@189&gl=cn&x={x}&y={y}&z={z}'
                        }),
                    }),
                    new TileLayer({
                        title: 'Bing',
                        // title: 'Bing (Aerial)',
                        visible: false,
                        baseLayer: true,
                        noSwitcherDelete: true,
                        source: new BingMaps({
                            key: process.env.BINGMAPS_API_KEY,
                            imagerySet: 'Aerial'
                        })
                    }),
                ]
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
                        source: new XYZ({
                            url: 'https://mt{0-3}.google.com/vt/lyrs=h&x={x}&y={y}&z={z}',
                        }),
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
        coordinateFormat: function (coord) {
            return 'HDMS: ' + toStringHDMS(coord);
        },
        className: 'ol-custom-mouse-position ol-custom-mouse-positionHDMS',
        projection: 'EPSG:4326',
    }),
    new MousePosition({
        coordinateFormat: function (coord) {
            return '4326: ' + createStringXY(6)(coord);
        },
        className: 'ol-custom-mouse-position ol-custom-mouse-position4326',
        projection: 'EPSG:4326',
    }),
    new MousePosition({
        coordinateFormat: function (coord) {
            return '900913: ' + createStringXY(1)(coord);
        },
        className: 'ol-custom-mouse-position ol-custom-mouse-position900913',
        projection: 'EPSG:900913',
    }),
    new MousePosition({
        coordinateFormat: function (coord) {
            return 'PIXEL: ' + coordinateFormatPIXEL(coord);
        },
        className: 'ol-custom-mouse-position ol-custom-mouse-positionPIXEL',
        projection: 'EPSG:900913',
    }),
    new MousePosition({
        coordinateFormat: function (coord) {
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

// RightLayerLabelDiv LeftLayerLabelDiv
let $LeftLayerLabelDiv = document.createElement('div')
$LeftLayerLabelDiv.id = 'LeftLayerLabel'
$LeftLayerLabelDiv.className = 'ol-unselectable ol-control'
$LeftLayerLabelDiv.style.backgroundColor = 'rgba(256, 256, 256, 0.75)'
$LeftLayerLabelDiv.style.padding = '0.1rem'
$LeftLayerLabelDiv.style.paddingRight = '0.5rem'
document.getElementsByClassName('ol-viewport')[0].appendChild($LeftLayerLabelDiv)

let $RightLayerLabelDiv = document.createElement('div')
$RightLayerLabelDiv.id = 'RightLayerLabel'
$RightLayerLabelDiv.className = 'ol-unselectable ol-control'
$RightLayerLabelDiv.style.backgroundColor = 'rgba(256, 256, 256, 0.75)'
$RightLayerLabelDiv.style.padding = '0.1rem'
$RightLayerLabelDiv.style.paddingLeft = '0.5rem'
document.getElementsByClassName('ol-viewport')[0].appendChild($RightLayerLabelDiv)

let swipe = new Swipe({
    position: .03
});

function switchleft(layer) {
    let add_layers = [];
    let del_layers = [];
    if (layer.get('baseLayer')) {
        swipe.layers.forEach(function (l) {
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
function switchright(layer) {
    let add_layers = [];
    let del_layers = [];
    if (layer.get('baseLayer')) {
        swipe.layers.forEach(function (l) {
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

function initswipelayer({ layergroup, right, idx = 0 } = {}) {
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
initswipelayer({ layergroup: leftgroup, right: false, idx: 10 })
initswipelayer({ layergroup: rightgroup, right: true, idx: 1 })
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
    html: '<svg width="1.5rem" height="1.5rem" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2280/svg"><path d="M12.5 2H8V7H13V2.5C13 2.22386 12.7761 2 12.5 2ZM13 8H8V13H12.5C12.7761 13 13 12.7761 13 12.5V8ZM7 7V2H2.5C2.22386 2 2 2.22386 2 2.5V7H7ZM2 8V12.5C2 12.7761 2.22386 13 2.5 13H7V8H2ZM2.5 1C1.67157 1 1 1.67157 1 2.5V12.5C1 13.3284 1.67157 14 2.5 14H12.5C13.3284 14 14 13.3284 14 12.5V2.5C14 1.67157 13.3284 1 12.5 1H2.5Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"></path></svg>',
    active: false,
    onToggle: function (active) { debugLayer.setVisible(active) }
});
mainbar.addControl(debugLayerToggle);

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
            stroke: new Stroke({ color: randomColor(), width: 2 }),
        }),
        stroke: new Stroke({ color: randomColor(), width: 3 }),
        // stroke: new Stroke({color: 'rgb(255,165,0)', width: 3}),
    })
    function DragAndDropVectorLayer() {
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
        setTimeout(function () {
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

// Add an on/off toggle for drawing bounding boxes
let bboxLayer = new VectorLayer({
    name: 'BBox',
    source: new VectorSource(),
    style: new Style({
        stroke: new Stroke({ color: 'rgb(0,76,151)', width: 3 }),
    }),
    visible: false
});
map.addLayer(bboxLayer);

let bboxToggle = new Toggle({
    title: "Bounding Box",
    className: "bbox-toggle",
    html: '<svg width="1.5rem" height="1.5rem" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2280/svg"><path d="M12.5 2H2.5C2.22386 2 2 2.22386 2 2.5V12.5C2 12.7761 2.22386 13 2.5 13H12.5C12.7761 13 13 12.7761 13 12.5V2.5C13 2.22386 12.7761 2 12.5 2ZM2.5 1C1.67157 1 1 1.67157 1 2.5V12.5C1 13.3284 1.67157 14 2.5 14H12.5C13.3284 14 14 13.3284 14 12.5V2.5C14 1.67157 13.3284 1 12.5 1H2.5Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"></path></svg>',
    interaction: new Select(),
    active: false,
});
bboxToggle.on('change:active', function (e) {
    document.getElementById('bbox').value = ''
    bboxLayer.getSource().clear();
    bboxInteraction.setActive(e.active);
    bboxLayer.setVisible(e.active);
    measureDisplayElement.style.display = e.active ? '' : 'none';
})
mainbar.addControl(bboxToggle);

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
    document.getElementById('bbox').value = ll0 + ', ' + ll1;
});


const typeSelect = document.getElementById('type');
const showSegments = document.getElementById('segments');
const clearPrevious = document.getElementById('clear');
const measureElement = document.getElementById('measure');
const measureDisplayElement = document.getElementById('formatted');

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

// Add a taggle for measureing length and areas.
let measureToggle = new Toggle({
    title: "Measure",
    className: "measure-toggle",
    html: '<svg width="1.5rem" height="1.5rem" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2280/svg"><path d="M0.5 4C0.223858 4 0 4.22386 0 4.5V10.5C0 10.7761 0.223858 11 0.5 11H14.5C14.7761 11 15 10.7761 15 10.5V4.5C15 4.22386 14.7761 4 14.5 4H0.5ZM1 10V5H2.075V7.5C2.075 7.73472 2.26528 7.925 2.5 7.925C2.73472 7.925 2.925 7.73472 2.925 7.5V5H4.075V6.5C4.075 6.73472 4.26528 6.925 4.5 6.925C4.73472 6.925 4.925 6.73472 4.925 6.5V5H6.075V6.5C6.075 6.73472 6.26528 6.925 6.5 6.925C6.73472 6.925 6.925 6.73472 6.925 6.5V5H8.075V7.5C8.075 7.73472 8.26528 7.925 8.5 7.925C8.73472 7.925 8.925 7.73472 8.925 7.5V5H10.075V6.5C10.075 6.73472 10.2653 6.925 10.5 6.925C10.7347 6.925 10.925 6.73472 10.925 6.5V5H12.075V6.5C12.075 6.73472 12.2653 6.925 12.5 6.925C12.7347 6.925 12.925 6.73472 12.925 6.5V5H14V10H1Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"></path></svg>',
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
    measureElement.style.display = e.active ? '' : 'none';
});
mainbar.addControl(measureToggle);

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

// makeing a vector layer for detections
const geojsonSource = new VectorSource();
const geojsonLayer = new VectorLayer({
    source: geojsonSource,
    title: "Detections",
    visible: true,
    baseLayer: false,
    displayInLayerSwitcher: true,
    style: polygonStyleFunction
});
map.addLayer(geojsonLayer);
rightgroup.getLayers().getArray()[1].getLayers().push(geojsonLayer);
leftgroup.getLayers().getArray()[1].getLayers().push(geojsonLayer);

// YOLO predict code
const tfjs_worker = new Worker(new URL("./worker.js", import.meta.url));
tfjs_worker.postMessage({ url: document.URL });
const processedTiles = new Set();

async function runModelOnTiles() {
    const resources = performance.getEntriesByType('resource');
    const imageResources = resources.filter(resource => resource.initiatorType === 'img');
    const imagePaths = imageResources.map(resource => resource.name);
    const googlePaths = imagePaths.filter(path => path.includes('google'));
    const googleTiles = googlePaths.filter(path => path.endsWith('z=17') || path.endsWith('z=18') || path.endsWith('z=19'));
    const tilesToProcess = googleTiles.filter(tile => !processedTiles.has(tile));
    tfjs_worker.postMessage(tilesToProcess); // send to web worker
    tilesToProcess.forEach(tile => processedTiles.add(tile));
}

// Listen for messages from the worker
let modelLoadingStatusElement = document.getElementById('modelLoading');
tfjs_worker.onmessage = function (event) {
    const { ready, results, error } = event.data;

    // Check if the message indicates that the model is ready
    if (ready === true) {
        let predictElement = document.querySelectorAll('button[type=button][title="Predict"]')[0];
        predictElement.innerHTML = '<svg width="1.5rem" height="1.5rem" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2280/svg"><path d="M13.9 0.499976C13.9 0.279062 13.7209 0.0999756 13.5 0.0999756C13.2791 0.0999756 13.1 0.279062 13.1 0.499976V1.09998H12.5C12.2791 1.09998 12.1 1.27906 12.1 1.49998C12.1 1.72089 12.2791 1.89998 12.5 1.89998H13.1V2.49998C13.1 2.72089 13.2791 2.89998 13.5 2.89998C13.7209 2.89998 13.9 2.72089 13.9 2.49998V1.89998H14.5C14.7209 1.89998 14.9 1.72089 14.9 1.49998C14.9 1.27906 14.7209 1.09998 14.5 1.09998H13.9V0.499976ZM11.8536 3.14642C12.0488 3.34168 12.0488 3.65826 11.8536 3.85353L10.8536 4.85353C10.6583 5.04879 10.3417 5.04879 10.1465 4.85353C9.9512 4.65827 9.9512 4.34169 10.1465 4.14642L11.1464 3.14643C11.3417 2.95116 11.6583 2.95116 11.8536 3.14642ZM9.85357 5.14642C10.0488 5.34168 10.0488 5.65827 9.85357 5.85353L2.85355 12.8535C2.65829 13.0488 2.34171 13.0488 2.14645 12.8535C1.95118 12.6583 1.95118 12.3417 2.14645 12.1464L9.14646 5.14642C9.34172 4.95116 9.65831 4.95116 9.85357 5.14642ZM13.5 5.09998C13.7209 5.09998 13.9 5.27906 13.9 5.49998V6.09998H14.5C14.7209 6.09998 14.9 6.27906 14.9 6.49998C14.9 6.72089 14.7209 6.89998 14.5 6.89998H13.9V7.49998C13.9 7.72089 13.7209 7.89998 13.5 7.89998C13.2791 7.89998 13.1 7.72089 13.1 7.49998V6.89998H12.5C12.2791 6.89998 12.1 6.72089 12.1 6.49998C12.1 6.27906 12.2791 6.09998 12.5 6.09998H13.1V5.49998C13.1 5.27906 13.2791 5.09998 13.5 5.09998ZM8.90002 0.499976C8.90002 0.279062 8.72093 0.0999756 8.50002 0.0999756C8.2791 0.0999756 8.10002 0.279062 8.10002 0.499976V1.09998H7.50002C7.2791 1.09998 7.10002 1.27906 7.10002 1.49998C7.10002 1.72089 7.2791 1.89998 7.50002 1.89998H8.10002V2.49998C8.10002 2.72089 8.2791 2.89998 8.50002 2.89998C8.72093 2.89998 8.90002 2.72089 8.90002 2.49998V1.89998H9.50002C9.72093 1.89998 9.90002 1.72089 9.90002 1.49998C9.90002 1.27906 9.72093 1.09998 9.50002 1.09998H8.90002V0.499976Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"></path></svg>';
        modelLoadingStatusElement.innerHTML = '&nbsp; Model Loaded &nbsp;';
        modelLoadingStatusElement.style.backgroundColor = '#00AAFF';
        return; // Exit the listener function
    }

    // when changing model show loading icon
    if (ready === false) {
        let predictElement = document.querySelectorAll('button[type=button][title="Predict"]')[0];
        predictElement.innerHTML = '<svg id="star" width="1.5rem" height="1.5rem" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.486 2 2 6.486 2 12C2 17.514 6.486 22 12 22C17.514 22 22 17.514 22 12C22 6.486 17.514 2 12 2ZM12 20C7.589 20 4 16.411 4 12C4 7.589 7.589 4 12 4C16.411 4 20 7.589 20 12C20 16.411 16.411 20 12 20Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"></path><path d="M12 6C8.686 6 6 8.686 6 12C6 15.314 8.686 18 12 18C15.314 18 18 15.314 18 12C18 8.686 15.314 6 12 6ZM12 16C9.243 16 7 13.757 7 11C7 8.243 9.243 6 12 6C14.757 6 17 8.243 17 11C17 13.757 14.757 16 12 16Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"></path></svg>';
        modelLoadingStatusElement.innerHTML = "&nbsp; Model Loading &nbsp;";
        modelLoadingStatusElement.style.backgroundColor = 'rgb(255, 165, 0)';
        return; // Exit the listener function
    }

    // Handle the results if the model is ready
    if (results) { // results.corners, results.className, results.score
        results.forEach(result => {
            // invert cords to match the map
            let corners = result.corners.map(cord => [cord[1], cord[0]]);
            corners.push(corners[0]);
            const boxFeature = new Feature({
                geometry: new Polygon([corners]).transform('EPSG:4326', 'EPSG:3857'),
                classIndex: result.className,
                score: result.score
            });
            geojsonSource.addFeature(boxFeature);
        });
    }

    // Handle errors
    if (error) {
        console.error('Error:', error);
        // Add error handling logic as needed
    }
};

const modelElement = document.getElementById('modelInfoElement');
const modelLoading = document.getElementById('loadModel');
const modelName = document.getElementById('modelName');
const modelType = document.getElementById('modelType');

modelLoading.onclick = function () {
    const model = modelName.value;
    const type = modelType.value;
    tfjs_worker.postMessage({ model, type });
};

const predictButton = new Toggle({
    title: "Predict",
    className: "predict-button",
    html: '<svg id="star" width="1.5rem" height="1.5rem" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.486 2 2 6.486 2 12C2 17.514 6.486 22 12 22C17.514 22 22 17.514 22 12C22 6.486 17.514 2 12 2ZM12 20C7.589 20 4 16.411 4 12C4 7.589 7.589 4 12 4C16.411 4 20 7.589 20 12C20 16.411 16.411 20 12 20Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"></path><path d="M12 6C8.686 6 6 8.686 6 12C6 15.314 8.686 18 12 18C15.314 18 18 15.314 18 12C18 8.686 15.314 6 12 6ZM12 16C9.243 16 7 13.757 7 11C7 8.243 9.243 6 12 6C14.757 6 17 8.243 17 11C17 13.757 14.757 16 12 16Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"></path></svg>',
    active: false,
    onToggle: function (active) {
        if (active) {
            runModelOnTiles();
        }
        modelElement.style.display = active ? 'flex' : 'none';
    }
});
mainbar.addControl(predictButton);

// Set up the PerformanceObserver to observe resource entries
const observer = new PerformanceObserver((list) => {
    if (predictButton.getActive()) {
        runModelOnTiles();
    }
});
observer.observe({ entryTypes: ['resource'] });


// create some button click when a key is pressed, G clicks debugLayer.setVisible(active)
document.addEventListener('keydown', function (event) {
    if (event.key === 'd') {
        let debugElement = document.querySelectorAll('button[type=button][title="Tiling Grid"]')[0];
        debugElement.click();
    } else if (event.key === 'p') {
        let predictElement = document.querySelectorAll('button[type=button][title="Predict"]')[0];
        predictElement.click();
    } else if (event.key === 'm') {
        let measureElement = document.querySelectorAll('button[type=button][title="Measure"]')[0];
        measureElement.click();
    } else if (event.key === 'b') {
        let bboxElement = document.querySelectorAll('button[type=button][title="Bounding Box"]')[0];
        bboxElement.click();
    }
    else if (event.key === 'h') {
        const modelElement = document.getElementById('modelInfoElement');
        modelElement.style.display = modelElement.style.display === 'none' ? 'flex' : 'none';
    }
});

// copy to clipboard function
function copyToClipboard() {
    const copyText = document.getElementById('bbox');
    copyText.select();
    copyText.setSelectionRange(0, 99999); /*For mobile devices*/
    document.execCommand('copy');
}
const copyButton = document.getElementById('CopyToClipboard');
copyButton.addEventListener('click', copyToClipboard);


// information buttton
const howToUse = document.getElementById('HowToUse');
const infoPanel = document.getElementById('infoPanel');
const howToIcon = document.getElementById('HowToIcon');
howToIcon.addEventListener('click', () => {
    infoPanel.style.display = infoPanel.style.display === 'none' ? 'block' : 'none';
    // make the background blue when the info panel is open
    if (infoPanel.style.display === 'block') {
        howToUse.style.backgroundColor = '#00AAFF';
        howToIcon.style.color = 'white';
    } else {
        howToUse.style.backgroundColor = 'white';
        howToIcon.style.color = 'black';
    }
});

// buttons for search function
document.addEventListener('DOMContentLoaded', function () {
    // add a svg icon to the element Button with title="Search"
    let searchElement = document.querySelector('.ol-search button[title="Search"]');
    searchElement.innerHTML = '<svg width="1.5rem" height="1.5rem" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2280/svg"><path d="M10 6.5C10 8.433 8.433 10 6.5 10C4.567 10 3 8.433 3 6.5C3 4.567 4.567 3 6.5 3C8.433 3 10 4.567 10 6.5ZM9.30884 10.0159C8.53901 10.6318 7.56251 11 6.5 11C4.01472 11 2 8.98528 2 6.5C2 4.01472 4.01472 2 6.5 2C8.98528 2 11 4.01472 11 6.5C11 7.56251 10.6318 8.53901 10.0159 9.30884L12.8536 12.1464C13.0488 12.3417 13.0488 12.6583 12.8536 12.8536C12.6583 13.0488 12.3417 13.0488 12.1464 12.8536L9.30884 10.0159Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"></path></svg>';
    searchElement.style.margin = "2px 1px"
    // add a svg icon to the element Button with title="ol-revers"
    let reverseElement = document.querySelector('.ol-search button[title="click on the map"]');
    reverseElement.innerHTML = '<svg width="1.5rem" height="1.5rem" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2280/svg"><path d="M0.900024 7.50002C0.900024 3.85495 3.85495 0.900024 7.50002 0.900024C11.1451 0.900024 14.1 3.85495 14.1 7.50002C14.1 11.1451 11.1451 14.1 7.50002 14.1C3.85495 14.1 0.900024 11.1451 0.900024 7.50002ZM7.50002 1.80002C4.35201 1.80002 1.80002 4.35201 1.80002 7.50002C1.80002 10.648 4.35201 13.2 7.50002 13.2C10.648 13.2 13.2 10.648 13.2 7.50002C13.2 4.35201 10.648 1.80002 7.50002 1.80002ZM3.07504 7.50002C3.07504 5.05617 5.05618 3.07502 7.50004 3.07502C9.94388 3.07502 11.925 5.05617 11.925 7.50002C11.925 9.94386 9.94388 11.925 7.50004 11.925C5.05618 11.925 3.07504 9.94386 3.07504 7.50002ZM7.50004 3.92502C5.52562 3.92502 3.92504 5.52561 3.92504 7.50002C3.92504 9.47442 5.52563 11.075 7.50004 11.075C9.47444 11.075 11.075 9.47442 11.075 7.50002C11.075 5.52561 9.47444 3.92502 7.50004 3.92502ZM7.50004 5.25002C6.2574 5.25002 5.25004 6.25739 5.25004 7.50002C5.25004 8.74266 6.2574 9.75002 7.50004 9.75002C8.74267 9.75002 9.75004 8.74266 9.75004 7.50002C9.75004 6.25738 8.74267 5.25002 7.50004 5.25002ZM6.05004 7.50002C6.05004 6.69921 6.69923 6.05002 7.50004 6.05002C8.30084 6.05002 8.95004 6.69921 8.95004 7.50002C8.95004 8.30083 8.30084 8.95002 7.50004 8.95002C6.69923 8.95002 6.05004 8.30083 6.05004 7.50002Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"></path></svg>';
    reverseElement.style.margin = "2px 1px"
    // add word to button layer switcher left
    let left_switch = document.querySelector('.layerSwitcherLeft button');
    left_switch.innerHTML = '<svg width="2.5rem" height="2.5rem" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2280/svg"><path d="M7.75432 0.819537C7.59742 0.726821 7.4025 0.726821 7.24559 0.819537L1.74559 4.06954C1.59336 4.15949 1.49996 4.32317 1.49996 4.5C1.49996 4.67683 1.59336 4.84051 1.74559 4.93046L7.24559 8.18046C7.4025 8.27318 7.59742 8.27318 7.75432 8.18046L13.2543 4.93046C13.4066 4.84051 13.5 4.67683 13.5 4.5C13.5 4.32317 13.4066 4.15949 13.2543 4.06954L7.75432 0.819537ZM7.49996 7.16923L2.9828 4.5L7.49996 1.83077L12.0171 4.5L7.49996 7.16923ZM1.5695 7.49564C1.70998 7.2579 2.01659 7.17906 2.25432 7.31954L7.49996 10.4192L12.7456 7.31954C12.9833 7.17906 13.2899 7.2579 13.4304 7.49564C13.5709 7.73337 13.4921 8.03998 13.2543 8.18046L7.75432 11.4305C7.59742 11.5232 7.4025 11.5232 7.24559 11.4305L1.74559 8.18046C1.50786 8.03998 1.42901 7.73337 1.5695 7.49564ZM1.56949 10.4956C1.70998 10.2579 2.01658 10.1791 2.25432 10.3195L7.49996 13.4192L12.7456 10.3195C12.9833 10.1791 13.2899 10.2579 13.4304 10.4956C13.5709 10.7334 13.4921 11.04 13.2543 11.1805L7.75432 14.4305C7.59742 14.5232 7.4025 14.5232 7.24559 14.4305L1.74559 11.1805C1.50785 11.04 1.42901 10.7334 1.56949 10.4956Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"></path></svg>';
    // add word to button layer switcher right
    let right_switch = document.querySelector('.layerSwitcherRight button');
    right_switch.innerHTML = '<svg width="2.5rem" height="2.5rem" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2280/svg"><path d="M7.75432 0.819537C7.59742 0.726821 7.4025 0.726821 7.24559 0.819537L1.74559 4.06954C1.59336 4.15949 1.49996 4.32317 1.49996 4.5C1.49996 4.67683 1.59336 4.84051 1.74559 4.93046L7.24559 8.18046C7.4025 8.27318 7.59742 8.27318 7.75432 8.18046L13.2543 4.93046C13.4066 4.84051 13.5 4.67683 13.5 4.5C13.5 4.32317 13.4066 4.15949 13.2543 4.06954L7.75432 0.819537ZM7.49996 7.16923L2.9828 4.5L7.49996 1.83077L12.0171 4.5L7.49996 7.16923ZM1.5695 7.49564C1.70998 7.2579 2.01659 7.17906 2.25432 7.31954L7.49996 10.4192L12.7456 7.31954C12.9833 7.17906 13.2899 7.2579 13.4304 7.49564C13.5709 7.73337 13.4921 8.03998 13.2543 8.18046L7.75432 11.4305C7.59742 11.5232 7.4025 11.5232 7.24559 11.4305L1.74559 8.18046C1.50786 8.03998 1.42901 7.73337 1.5695 7.49564ZM1.56949 10.4956C1.70998 10.2579 2.01658 10.1791 2.25432 10.3195L7.49996 13.4192L12.7456 10.3195C12.9833 10.1791 13.2899 10.2579 13.4304 10.4956C13.5709 10.7334 13.4921 11.04 13.2543 11.1805L7.75432 14.4305C7.59742 14.5232 7.4025 14.5232 7.24559 14.4305L1.74559 11.1805C1.50785 11.04 1.42901 10.7334 1.56949 10.4956Z" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"></path></svg>';

    // load model when DOM loaded
    tfjs_worker.postMessage({ model: "yolob8s_allplanes_class_89_hbb_web_model", type: "hbb" });
});

// In the current implementation of LayerSwitcher layers don't overlap, so we turn off opacity.
document.body.classList.add('hideOpacity')
