# GeoPngDB version 1.1

## Status
This is a working draft for new features that are not yet fully worked out or supported by tools or libraries. If these solutions are proven to work in real use-cases, they will be folded into the main spec via a version bump. Not all features in this working draft will necessarily be included in the next spec version. 

All spec changes at a 1.x level are expected to be non-breaking backwards compatible changes.

## Format

### Proposed features

#### Per-Tile TEXT lookups
Text fields map integers encoded in the tiles to specific values in the JSON file. This works great for most text classifications which are no more than a few thousand unique values. However, certain "key" values such as census block IDs may need to be associated with pixels. In this case, the number of unique census blocks is around 7 million which is well within the Integer space (of 16 million), but a lookup file for all census block values to map to the integer space can be prohibitively large.

A simple solution to this problem is to store the unique values using a JSON file at the same address as the PNG tile file. That way the values need only be uniquely defined within that single tile.

```
{
    ...
    "fields": [
        {
            "id": "GeoID",
            "type": "TEXT",
            "perTileLookup": "geoId",            
        },
    ]
}
```

Tile JSON file: Note the keys are specified as integer strings and need not be sequential or start at zero. This lets us ensure consistency in number/key lookups at different pyramid zoom levels. Values are stored as arrays to let us account for multiple records being combined into single pixels as we zoom out.

e.g. `10/543/345.png` would have an accompanying `10/543/345.json` file:
```
{
    "geoId": {
        "128": ["G3012287338"],
        "129": ["G3012287339"],
        "130": ["G3012287340"],
        "268": ["G3012257167"],
        "269": ["G3012257171", "G3012257172"],
    }
```

#### Detail Overrides

In some cases, datasets may contain different levels of detail (represented by a different maximum zoom limit) for different areas. For example the polar regions are typically data-sparse but occupy a large percentage of the WGS 84 map. It may be wasteful to represent these areas at the same zoom level as the equator.

Metadata about these zones lets the client-side consumer of these datasets intelligently handle the data at different zoom levels.

These zones are represented as an override to the primary tile tileBounds. Detail overrides must be specified at a higher zoom level than the primary bounds.

```
{
    ...
    "tileBounds": {
        "zoom": 12,
        "xMin": 870,
        "xMax": 1360,
        "yMin": 442,
        "yMax": 1280,
    },
    ...
    "detailOverrides": [
        "tileBounds": {
            "zoom": 13,
            "xMin": 1760,
            "xMax": 2590,
            "yMin": 888,
            "yMax": 2380,
        },
        "tileBounds": {
            "zoom": 14,
            "xMin": 3640,
            "xMax": 4200,
            "yMin": 2280,
            "yMax": 2800,
        }
    ]
}
```

### Challenges

#### Per-Tile TEXT lookups
Text lookups work well at higher zoom levels where fewer entities are represented. This is also where they may be most useful - for example when a user interacts with part of the image. However there is no elegant and lightweight way to aggregate this information as we zoom out to global scale. We may need to set limits on the zoom level at which the data becomes available (e.g. zooming in)  -- or cull key values once they become smaller than a certain size limit. 

So far this technique of per-tile text lookup has been used in the processing stages to assign numeric data to pixels rather than bringing it to the front end. In that case it is used only at the maximum zoom level used to process the data. However, there may be usefulness in bringing this capability to the front-end and this spec would benefit from more applied testing.

#### Detail Overrides

This seems pretty simple at a spec-level, but may be challenging to implement in front-end tools. I haven't seen any examples of slippy map tiles loading and displaying multiple zoom levels side-by-side. In Zaru, we have implemented "zoom beyond" support for grabbing portions of higher level tiles and displaying those via GPU rendering. This could be adapted to work with variable zoom levels, but would require careful treatment at the margins.
