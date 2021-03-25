# geo-png-db
GeoPngDB is a tiled geospatial data format capable of representing global-scale data sets at high resolution in a format natively supported by web browsers.

## Basic Idea
Data tiles are images that contain data encoded in their pixels. Tiled using the standard web tile schema, they can provide instant access to spatial data at a practically unlimited scale. As interactive data visualization becomes more mainstream, there is an increasing need to quickly manipulate and represent massive datasets within the browser. The scale of these datasets often makes vector datasets inefficient and unable to deliver a smooth user-experience.

Web-based "slippy" maps already take advantage of tiled imagery, and we routinely load and navigate datasets composed of trillions of data points in our browsers. We believe data tiles can provide a solution for browsing and using data effortlessly at any scale. The “GeoPngDB” format builds on existing solutions to provide a browser-friendly way of encoding raw data for consumption by web-based tools.

## Current Version 1.0
The current version of the GeoPngDB specification is [GeoPngDB 1.0](./specifications/1.0/README.md). See this folder for detailed specs.

## Motivation
Raster formats are currently an underappreciated resource for sharing raw data for web-based tools. Thankfully solutions like Cloud Optimized GeoTIFFs (COGs) are poised to bring large-scale raster datasets to the main-stream for consumption in web-connected tools. However, COGs and other solutions currently require server-side processing as well as more intensive client side processing.

### Advantages of GeoPngDB

#### Inexpensive Hosting
For many public datasets, hosting costs are a major barrier. GeoPngDB tiles can be hosted statically just like any other web map tile sets. This means massive open data sets can be shared without major cost implications.

#### Browser-native image decoding
Unlike the TIFF format, browsers understand PNGs natively. Visualizations can render tiles immediately using GPU shaders without any script-based decoding. Or conventional canvas-based processing can be used to decode values for use in JavaScript.

#### True Real-Time Rendering
Removing sever requirements and keeping raw data in an image format on the client-side supports smooth updates if rendered on the GPU with shaders.

#### Dense Queries
Keeping the information as raw data allows for combining massive datasets on the fly in a web browser. This allows novel combinations of data versus representing the data as a graphic image - or as raw aerials.

#### Unlimited Scale
There are no limits to the size of dataset that can be hosted. Consideration should be given to practical limits on storage and zoom level limits from slippy map tools, but the specification imposes no limits.

#### Perfect Alignment
Standardizing on WGS 84 ([EPSG:4326](https://epsg.io/4326)) ensures all pixels are uniquely addressed and align perfectly across datasets. WGS 84 does present some challenges - such as the physical size represented by each pixel changing based on latitude, but we feel this is a worthwhile compromise and presents few practical limitations for web-based use.

#### Reliable Aggregation / Nesting
Unlike vector datasets that require aggressive simplification and loss of fidelity when zooming out, raster "pyramids" allow a simple, reliable method for accurately representing the aggregate data "beneath" each pixel. Typical aggregations can be MIN, MAX, MEAN, SUM that can be processed immediately from the tile below as illustrated in the diagram. Other statistical aggregations are possible, but require more complex processing where the original data must be available when producing each level.

![Illustration showing how values for 4 pixels from one zoom level are summed into a single pixel at the level above.](./img/pyramid.svg)

#### Powerful Parallelization
Because each tile is represented independently as a 256x256 image, very lightweight processing can be used when generating tiles. This allows tiles to be processed in a massively parallel fashion using cloud-based architectures. Truly massive datasets can be processed in manageable chunks on affordable microservices (such as AWS Lambda or Google Cloud Functions).

## Background
Data tiles are not new and this work draws on a number of sources - most notably the work done by MapZen on their [Terrarium tile format](https://github.com/tilezen/joerd/blob/master/docs/formats.md#terrarium).

The schema for encoding data in each pixel is based on [png-db](https://github.com/sasakiassociates/png-db).

## Implementations

QGIS Plugin for Exporting GeoPngDB 
The Zaru front-end visualization tool for consuming GeoPngDB

## Similar Solutions

### Cloud Optimized GeoTIFFs (COGs)
### Terrarium Tiles
