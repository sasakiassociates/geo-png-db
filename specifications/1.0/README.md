# GeoPngDB version 1.0

## Format

### Tiling Scheme

GeoPngDB uses the standard Google x/y/z tile schema with tiles starting in the NW corner of the WGS 84 map projection.
Tile schemas represent the entire globe, slicing a square map into 4 smaller tiles and adding detail at each new zoom
level. See this reference: https://www.maptiler.com/google-maps-coordinates-tile-bounds-projection/

### Data Encoding

GeoPngDB borrows the numeric encodings from [png-db](https://github.com/sasakiassociates/png-db). See png-db
documentation for more details.

### JSON Data

This Json file must be named "geoPngDb.json" and placed at the root alongside the zoom-numbered image folders.

A basic example of a GeoPngDB spec is as follows:

```
{
    "type": "GeoPngDB",
    "version": "1.0",
    "metadata": {
        "field":"USPopulationByRace",
        "description": "U.S. population data by race.",
        "metric": "# people",
        "source": "U.S. Census",
        "sourceLink": "https://www.census.gov/topics/population/data.html",
    },
    "tileBounds": {
        "zoom": 12,
        "xMin": 870,
        "xMax": 1360,
        "yMin": 442,
        "yMax": 1280,
    },
    "fields": [
        {
            "id": "Black",
            "type": "DECIMAL",
            "precision": 10000,
            "variablePrecision": 1.5,
            "range": {
                "min": -105.11037116007518,
                "max": -104.73393825708611
            }
        }
    ]
}
```

#### Metadata

Metadata is suggested by this schema but not required. The following fields are strongly encouraged:

```
description
metric
source
```

Any number of additional fields and data structures can be added to the metadata section for custom use.

#### Data Types
The following [png-db](https://github.com/sasakiassociates/png-db) data types are supported:
```
INTEGER
DECIMAL
TEXT
```

#### Precision
Png-db uses the RGB color space to represent numbers. This gives us a broad range of integers (16,777,215). For decimals, we simply map this integer number space to a decimal number space using a range of possible values (min/max), and a given precision value.

#### Variable Precision
When dealing with numerous zoom levels, the appropriate precision for the maximum zoom may differ from the appropriate level at the minimum zoom. For example, in a data set showing property value, any given pixel when zoomed in may contain no more than a few $. However, at the minimum zoom (e.g. global scale), one pixel might contain millions or billions of $.

A difference of a few hundred $ won't change the map much at the global scale, but may make a dramatic difference at the zoomed in scale. To account for this, variable precision changes the precision value used per zoom level.

#### Support for Arrays

Tiles are typically represented as single 256x256 tiles, but sometimes it can be more efficient to load multiple data
fields into a single larger image if there is a very strong relationship, and they are unlikely to be used separately.
The larger tiles (e.g. 512x512) *do not* take up more space on the map, but client side tools can be used to query
different fields within the data by looking at different parts of the image.

An offset array with `[x,y]` values is used to specify where each field is represented in the composite image.

```
{
   ...
   "fields": [
        {
            //NOTE: offset not required, assumed to be 0,0 if not specified
            "id": "Black",
            "type": "DECIMAL",
            "precision": 10000,
            "variablePrecision": 1.5,
            "range": {
                "min": 0,
                "max": 12000
            }
        },
        {
            "id": "Asian",
            "offset": [1,0],//offset specifed as [x,y]
            "type": "DECIMAL",
            "precision": 10000,
            "variablePrecision": 1.5,
            "range": {
                "min": 0,
                "max": 12000
            }
        }
    ]
}
```
