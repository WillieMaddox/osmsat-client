# OSMSAT
<span style="color:gray">Version 0.2</span>

The OSMSAT project is a web-based mapping tool that offers functionalities like base layer switching, overlay viewing, bounding box drawing, distance measuring, object detection with YOLOv8, location searching, and keyboard shortcuts, using JavaScript and npm for dependency management.

## About

This tool allows you to perform various actions on the map:

### Layers

- Base Layers: Choose between base layers like OpenStreetMap, Google Maps, and Bing Maps.
- Vector Layer: View various overlays on the map like detections or markers.

### Interactions

- **Toggle Tile Grid**: Show or hide the tile grid on the map.
- **Draw Box**: Get world coordinates of a drawn bounding box.
- **Measure Distances**: Measure cumulative map distance between various points.
- **Detect Objects**: Run a YOLOv8 model on the tiles to detect objects.
- **Search Locations**: Use a search bar to find locations on the map.

### Keyboard Shortcuts

- **d**: Toggles the visibility of the grid tiles.
- **p**: Toggles the object detection prediction mode.
- **m**: Toggles the measurement mode.
- **b**: Toggles the bounding box drawing mode.
- **l**: Toggles the model info panel.
- **q**: Sends a single tile to the worker for debugging. `{ x: 100732, y: 212643, z: 19 }`.
- **c**: Clears the detection layer predictions.
- **h**: Hides or shows all controls and overlays, including the "How To Use" panel.

## Starting the Web Application

Clone the project.

    git clone https://github.com/WillieMaddox/osmsat-client.git

Install the project dependencies.

    cd osmsat-client
    npm i

Serve the files

    npm run serve
