import Draw from './L.PM.Draw';

function lineIntersection([a1, a2], [b1, b2]) {
    const denom = (b2.lng - b1.lng) * (a2.lat - a1.lat) -
        (b2.lat - b1.lat) * (a2.lng - a1.lng);
    if (denom == 0) {
        return null;
    }
    const ua = ((b2.lat - b1.lat) * (a1.lng - b1.lng) -
        (b2.lng - b1.lng) * (a1.lat - b1.lat)) / denom;
    const ub = ((a2.lat - a1.lat) * (a1.lng - b1.lng) -
        (a2.lng - a1.lng) * (a1.lat - b1.lat)) / denom;
    return {
        lat: a1.lat + ua * (a2.lat - a1.lat),
        lng: a1.lng + ua * (a2.lng - a1.lng),
    };
}

function straightAngleRotate(a, center) {
    return new L.Point(
        -(a.y - center.y) + center.x,
        (a.x - center.x) + center.y
    );
}


Draw.Rectangle = Draw.Poly.extend({

    initialize(map) {
        this._map = map;
        this._shape = 'Rectangle';
        this.toolbarButtonName = 'drawRectangle';
    },

    enable() {
        Draw.Poly.prototype.enable.call(this);
        //this._map.on('click', this._createVertex, this);

        // this is the hintmarker on the mouse cursor
        this._hintMarker = L.marker([0, 0], {
            icon: L.divIcon({ className: 'marker-icon cursor-marker' }),
        });
        this._hintMarker._pmTempLayer = true;
        this._layerGroup.addLayer(this._hintMarker);

        // show the hintmarker if the option is set
        if(this.options.cursorMarker) {
            L.DomUtil.addClass(this._hintMarker._icon, 'visible');
        }

        // sync the hintline with hint marker
        this._hintMarker.on('move', this._syncHintLine, this);

        // this is the hint rectangle displayed after the second click
        this._hintRectangle = L.polygon([], this.options.hintRectangleStyle); //TODO hintRectangleStyle ?
        this._hintRectangle._pmTempLayer = true;
        this._layerGroup.addLayer(this._hintRectangle);
    },

    disable() {
        this._map.off('mousemove', this._syncHintMarker, this);
        this._map.off('click', this._finishShape, this);
        Draw.Poly.prototype.disable.call(this);
    },

    _finishShape() {
        // get coordinates, create the leaflet shape and add it to the map
        // we don't use L.rectangle because it doesn't have the ability to be rotated
        const coords = this._hintRectangle.getLatLngs();
        const polygonLayer = L.polygon(coords, this.options.pathOptions).addTo(this._map);

        // disable drawing
        this.disable();

        // fire the pm:create event and pass shape and layer
        this._map.fire('pm:create', {
            shape: this._shape,
            layer: polygonLayer,
        });

        // clean up snapping states
        this._cleanupSnapping();
    },

    _createMarker(latlng, first) {
        // create the new marker
        const marker = new L.Marker(latlng, {
            draggable: false,
            icon: L.divIcon({ className: 'marker-icon' }),
        });

        // mark this marker as temporary
        marker._pmTempLayer = true;

        // add it to the map
        this._layerGroup.addLayer(marker);

        if (!first) {
            this._map.off('click', this._createMarker, this);
            this._map.on('click', this._finishShape, this);

            this._map.on('mousemove', this._syncHintMarker, this);
            this._hintMarker.off('move', this._syncHintLine, this);
        }
    },

    _syncHintRectangle([A, B, C] = []) {
        const AToBSlope = new L.LatLng((A.lat - B.lat), (A.lng - B.lng));
        const D = new L.LatLng(C.lat + AToBSlope.lat, C.lng + AToBSlope.lng);
        const coords = [ A, B, C, D ];
        this._hintRectangle.setLatLngs(coords);
    },

    _syncHintMarker(e) {
        const cursorPos = e.latlng;
        const vertices = this._layer.getLatLngs();

        if (vertices.length >= 2) {
            const [A, B] = vertices;

            let maxzoom = this._map.getMaxZoom();
            if (maxzoom === Infinity)
                maxzoom = this._map.getZoom();
            const rotatedProjected = straightAngleRotate(
                this._map.project(A, maxzoom),
                this._map.project(B, maxzoom));
            const rotated = this._map.unproject(rotatedProjected, maxzoom);

            const perpendicularLine = [ B, rotated ];

            const AToBSlope = new L.LatLng((A.lat - B.lat), (A.lng - B.lng));
            const cursorPosShifted = new L.LatLng(cursorPos.lat + AToBSlope.lat, cursorPos.lng + AToBSlope.lng);
            const cursorLine = [ cursorPos, cursorPosShifted ];

            const C = lineIntersection(perpendicularLine, cursorLine);

            this._hintMarker.setLatLng(C);

            this._syncHintRectangle([A, B, C]);
        } else {
            // move the cursor marker
            this._hintMarker.setLatLng(cursorPos);
        }

        // if snapping is enabled, do it
        if(this.options.snappable) {
            const fakeDragEvent = e;
            fakeDragEvent.target = this._hintMarker;
            this._handleSnapping(fakeDragEvent);
        }
    },

});
