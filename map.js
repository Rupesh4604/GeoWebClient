var map, geojson, overlays, layerSwitcher, popup, selectedFeature;
var layer_name;

var view = new ol.View({
    projection: 'EPSG:4326',
    center: [82.00, 23.00],
    zoom: 5,
});

var base_maps = new ol.layer.Group({
    'title': 'Base maps',
    layers: [
        new ol.layer.Tile({
            title: 'Satellite',
            type: 'base',
            visible: true,
            source: new ol.source.XYZ({
                url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
                maxZoom: 23
            })
        }),
        new ol.layer.Tile({
            title: 'OSM',
            type: 'base',
            visible: false,
            source: new ol.source.OSM()
        })
    ]
});

overlays = new ol.layer.Group({
    'title': 'Overlays',
    layers: []
});

map = new ol.Map({
    target: 'map',
    view: view,
    layers: [base_maps, overlays],
    interactions: ol.interaction.defaults(), // Ensure default interactions (panning, zooming)
});

popup = new Popup();
map.addOverlay(popup);

// Removed MousePosition control
map.addControl(new ol.control.ZoomSlider());
map.addControl(new ol.control.ZoomToExtent({ extent: [65.90, 7.48, 98.96, 40.30] }));
map.addControl(new ol.control.ScaleLine({ units: 'metric', bar: true, steps: 6, text: true, minWidth: 140, target: 'scale_bar' }));

layerSwitcher = new ol.control.LayerSwitcher({ startActive: true });
map.addControl(layerSwitcher);

var geocoder = new Geocoder('nominatim', {
    provider: 'osm',
    lang: 'en',
    placeholder: 'Search for ...',
    limit: 5,
    keepOpen: true
});
map.addControl(geocoder);

// Force geocoder dimensions after initialization
setTimeout(() => {
    const geocoderElement = document.querySelector('.ol-geocoder.gcd-gl-container');
    if (geocoderElement) {
        geocoderElement.style.width = '160px';
        geocoderElement.style.maxHeight = '35px';
    }
}, 500);

geocoder.on('addresschosen', function(evt) {
    popup.show(evt.coordinate, evt.address.formatted);
    setTimeout(() => popup.hide(), 3000);
});

function scale() {
    var resolution = map.getView().getResolution();
    var units = map.getView().getProjection().getUnits();
    var dpi = 25.4 / 0.28;
    var mpu = ol.proj.Units.METERS_PER_UNIT[units];
    var scale = resolution * mpu * 39.37 * dpi;
    scale = scale >= 950000 ? Math.round(scale / 1000000) + "M" : scale >= 9500 ? Math.round(scale / 1000) + "K" : Math.round(scale);
    document.getElementById('scale_bar1').innerHTML = "Scale = 1 : " + scale;
}
map.getView().on('change:resolution', scale);
scale();

function legend() {
    $('#legend').empty();
    $('#legend').append('<h8>Legend</h8>');
    overlays.getLayers().forEach(layer => {
        $('#legend').append(`<p>${layer.get('title')}</p>`);
        var img = new Image();
        img.src = `http://localhost:8080/geoserver/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&WIDTH=20&HEIGHT=20&LAYER=${layer.get('title')}`;
        $('#legend').append(img);
    });
}

function loadCapabilities() {
    var serverUrl = $('#serverUrl').val().replace(/\/web\/?$/, '');
    $.ajax({
        type: "GET",
        url: `${serverUrl}/wfs?request=getCapabilities`,
        dataType: "xml",
        success: function(xml) {
            $('#layer').empty().append('<option>Select Layer</option>');
            $(xml).find('FeatureType').each(function() {
                var name = $(this).find('Name').text();
                $('#layer').append(`<option value="${name}">${name}</option>`);
            });
        }
    });
}

$('#layer').change(function() {
    var value_layer = $(this).val();
    $('#attributes').empty().append('<option>Select Attribute</option>');
    $.ajax({
        type: "GET",
        url: `http://localhost:8080/geoserver/wfs?service=WFS&request=DescribeFeatureType&version=1.1.0&typeName=${value_layer}`,
        dataType: "xml",
        success: function(xml) {
            var properties = {};
            $(xml).find('xsd\\:sequence xsd\\:element').each(function() {
                var name = $(this).attr('name');
                var type = $(this).attr('type');
                if (name !== 'geom' && name !== 'the_geom') {
                    $('#attributes').append(`<option value="${type}">${name}</option>`);
                    properties[name] = { type: type, sampleValue: '' };
                }
            });
            $.getJSON(`http://localhost:8080/geoserver/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=${value_layer}&maxFeatures=1&outputFormat=application/json`, function(data) {
                if (data.features.length > 0) {
                    Object.keys(properties).forEach(key => properties[key].sampleValue = data.features[0].properties[key] || 'N/A');
                    displayLayerProperties(properties, 'WFS');
                }
            });
        }
    });
});

$('#attributes').change(function() {
    var value_type = $(this).val();
    $('#operator').empty().append('<option>Select Operator</option>');
    if (['xsd:short', 'xsd:int', 'xsd:double', 'xsd:long'].includes(value_type)) {
        $('#operator').append('<option value=">">Greater than</option><option value="<">Less than</option><option value="=">Equal to</option><option value="BETWEEN">Between</option>');
    } else if (value_type === 'xsd:string') {
        $('#operator').append('<option value="ILike">Like</option>');
    }
});

var highlightStyle = new ol.style.Style({
    fill: new ol.style.Fill({ color: 'rgba(255,0,0,0.3)' }),
    stroke: new ol.style.Stroke({ color: '#3399CC', width: 3 }),
    image: new ol.style.Circle({ radius: 10, fill: new ol.style.Fill({ color: '#3399CC' }) })
});

function query() {
    if (geojson) map.removeLayer(geojson);
    if (selectedFeature) selectedFeature.setStyle();
    $('#table_data').empty();
    $('#layer_properties').empty();

    var layer = $('#layer').val();
    var attribute = $('#attributes option:selected').text();
    var operator = $('#operator').val();
    var value = $('#value').val();

    var cqlFilter = operator === 'ILike' ? `${attribute} ${operator} '${value}%25'` : operator === 'BETWEEN' ? `${attribute} ${operator} ${value.split(',')[0]} AND ${value.split(',')[1]}` : `${attribute} ${operator} ${value}`;
    var url = `http://localhost:8080/geoserver/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=${layer}&CQL_FILTER=${encodeURIComponent(cqlFilter)}&outputFormat=application/json`;

    geojson = new ol.layer.Vector({
        source: new ol.source.Vector({
            url: url,
            format: new ol.format.GeoJSON()
        }),
        style: new ol.style.Style({
            fill: new ol.style.Fill({ color: 'rgba(255, 255, 255, 0.2)' }),
            stroke: new ol.style.Stroke({ color: '#ffcc33', width: 3 }),
            image: new ol.style.Circle({ radius: 7, fill: new ol.style.Fill({ color: '#ffcc33' }) })
        })
    });

    geojson.getSource().on('addfeature', function() {
        map.getView().fit(geojson.getSource().getExtent(), { duration: 1590 });
    });

    map.addLayer(geojson);

    $.getJSON(url, function(data) {
        var col = ['id', ...Object.keys(data.features[0]?.properties || {})];
        var table = $('<table class="table table-hover table-striped" id="table"><caption>' + layer + ' (Features: ' + data.features.length + ')</caption></table>');
        var tr = $('<tr></tr>');
        col.forEach(c => tr.append(`<th>${c}</th>`));
        table.append(tr);

        data.features.forEach(f => {
            var tr = $('<tr></tr>');
            tr.append(`<td>${f.id}</td>`);
            col.slice(1).forEach(c => tr.append(`<td>${f.properties[c] || ''}</td>`));
            table.append(tr);
        });

        $('#table_data').html(table);
        addRowHandlers();
    });
    map.on('singleclick', highlight);
}

function highlight(evt) {
    if (selectedFeature) selectedFeature.setStyle();
    var feature = map.forEachFeatureAtPixel(evt.pixel, f => f);
    if (feature && feature.getId()) {
        feature.setStyle(highlightStyle);
        selectedFeature = feature;
        $('#table tr').css('background-color', 'white');
        $(`#table td:contains('${feature.getId()}')`).parent().css('background-color', 'grey').get(0).scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function addRowHandlers() {
    $('#table tr').click(function() {
        if (selectedFeature) selectedFeature.setStyle();
        $('#table tr').css('background-color', 'white');
        $(this).css('background-color', 'grey');
        var id = $(this).find('td:first').text();
        var feature = geojson.getSource().getFeatures().find(f => f.getId() === id);
        if (feature) {
            feature.setStyle(highlightStyle);
            selectedFeature = feature;
            map.getView().fit(feature.getGeometry().getExtent(), { duration: 1590 });
        }
    });
}

// Add this function to validate and load layer with bounding box
function add_layer_with_bbox() {
    var minX = parseFloat($('#minX').val());
    var minY = parseFloat($('#minY').val());
    var maxX = parseFloat($('#maxX').val());
    var maxY = parseFloat($('#maxY').val());

    // Check if a layer is selected
    if (!layer_name) {
        alert("Please select a WMS layer first.");
        return;
    }

    // Validate bounding box inputs (optional usage)
    if (minX || minY || maxX || maxY) {
        if (isNaN(minX) || isNaN(minY) || isNaN(maxX) || isNaN(maxY)) {
            alert("Please enter valid numeric values for all bounding box coordinates.");
            return;
        }
        if (minX >= maxX || minY >= maxY) {
            alert("Minimum values must be less than maximum values.");
            return;
        }
        if (minX < -180 || maxX > 180 || minY < -90 || maxY > 90) {
            alert("Coordinates must be within valid geographic bounds (-180 to 180 for longitude, -90 to 90 for latitude).");
            return;
        }
    }

    // Create WMS layer with optional BBOX parameter
    var wmsParams = {'LAYERS': layer_name};
    if (minX && minY && maxX && maxY) {
        wmsParams['BBOX'] = [minX, minY, maxX, maxY].join(',');
    }

    var layer_wms = new ol.layer.Image({
        title: layer_name,
        source: new ol.source.ImageWMS({
            url: 'http://localhost:8080/geoserver/wms',
            params: wmsParams,
            ratio: 1,
            serverType: 'geoserver'
        })
    });

    overlays.getLayers().push(layer_wms);

    // Fit the view to the bounding box or layer extent
    if (minX && minY && maxX && maxY) {
        map.getView().fit([minX, minY, maxX, maxY], { duration: 1590 });
    } else {
        $.ajax({
            url: 'http://localhost:8080/geoserver/wms?request=getCapabilities'
        }).then(function(response) {
            var parser = new ol.format.WMSCapabilities();
            var result = parser.read(response);
            var layer = result.Capability.Layer.Layer.find(l => l.Name === layer_name);
            if (layer) map.getView().fit(layer.BoundingBox[0].extent, { duration: 1590 });
        });
    }

    layerSwitcher.renderPanel();
    legend();
    $("#wms_layers_window").modal('hide');
}

// Update existing add_layer() to keep it as a fallback for full extent
function add_layer() {
    var layer_wms = new ol.layer.Image({
        title: layer_name,
        source: new ol.source.ImageWMS({
            url: 'http://localhost:8080/geoserver/wms',
            params: {'LAYERS': layer_name},
            ratio: 1,
            serverType: 'geoserver'
        })
    });
    overlays.getLayers().push(layer_wms);
    $.ajax({
        url: 'http://localhost:8080/geoserver/wms?request=getCapabilities'
    }).then(function(response) {
        var parser = new ol.format.WMSCapabilities();
        var result = parser.read(response);
        var layer = result.Capability.Layer.Layer.find(l => l.Name === layer_name);
        if (layer) map.getView().fit(layer.BoundingBox[0].extent, { duration: 1590 });
    });
    layerSwitcher.renderPanel();
    legend();
    $("#wms_layers_window").modal('hide');
}

// Reset bounding box inputs when opening WMS layers modal
function wms_layers() {
    $("#wms_layers_window").modal({ backdrop: false }).modal('show');
    $('#minX, #minY, #maxX, #maxY').val(''); // Clear inputs
    $.ajax({
        type: "GET",
        url: "http://localhost:8080/geoserver/wms?request=getCapabilities",
        dataType: "xml",
        success: function(xml) {
            $('#table_wms_layers').empty().append('<tr><th>Name</th><th>Title</th><th>Abstract</th></tr>');
            $(xml).find('Layer > Layer').each(function() {
                var name = $(this).children('Name').text();
                var title = $(this).children('Title').text();
                var abst = $(this).children('Abstract').text();
                $('#table_wms_layers').append(`<tr><td>${name}</td><td>${title}</td><td>${abst}</td></tr>`);
            });
            $('#table_wms_layers tr').click(function() {
                layer_name = $(this).find('td:first').text();
                $('#table_wms_layers tr').css('background-color', 'white');
                $(this).css('background-color', 'grey');
                $.ajax({
                    type: "GET",
                    url: "http://localhost:8080/geoserver/wms?request=getCapabilities",
                    dataType: "xml",
                    success: function(xml) {
                        var properties = {};
                        $(xml).find('Layer > Layer').each(function() {
                            if ($(this).children('Name').text() === layer_name) {
                                properties['Title'] = $(this).children('Title').text();
                                properties['Abstract'] = $(this).children('Abstract').text();
                                properties['CRS'] = $(this).children('CRS').first().text();
                            }
                        });
                        displayLayerProperties(properties, 'WMS');
                    }
                });
            });
        }
    });
}

function close_wms_window() {
    layer_name = undefined;
    $("#wms_layers_window").modal('hide');
}

function displayLayerProperties(data, layerType) {
    $('#layer_properties').empty();
    var table = $('<table id="properties_table" class="table table-hover table-striped"></table>');
    table.append(`<tr><th>${layerType === 'WFS' ? 'Attribute' : 'Property'}</th><th>${layerType === 'WFS' ? 'Type' : 'Value'}</th>${layerType === 'WFS' ? '<th>Sample Value</th>' : ''}</tr>`);
    Object.entries(data).forEach(([key, value]) => {
        table.append(`<tr><td>${key}</td><td>${layerType === 'WFS' ? value.type : value || 'N/A'}</td>${layerType === 'WFS' ? `<td>${value.sampleValue || 'N/A'}</td>` : ''}</tr>`);
    });
    $('#layer_properties').append(table);
}

function info() {
    if ($('#info_btn').html() === "☰ Activate GetInfo") {
        $('#info_btn').html("☰ De-Activate GetInfo").removeClass('btn-success').addClass('btn-danger');
        map.un('singleclick', highlight); // Unbind highlight to avoid conflict
        map.on('singleclick', getinfo);
    } else {
        $('#info_btn').html("☰ Activate GetInfo").removeClass('btn-danger').addClass('btn-success');
        map.un('singleclick', getinfo);
        map.on('singleclick', highlight); // Rebind highlight when deactivating
        popup.hide();
    }
}

function getinfo(evt) {
    popup.hide();
    var content = '';
    overlays.getLayers().forEach(layer => {
        if (layer.getVisible()) {
            var wmsSource = new ol.source.ImageWMS({
                url: 'http://localhost:8080/geoserver/wms',
                params: {'LAYERS': layer.get('title')},
                serverType: 'geoserver',
                crossOrigin: 'anonymous'
            });
            var url = wmsSource.getFeatureInfoUrl(evt.coordinate, map.getView().getResolution(), 'EPSG:4326', {'INFO_FORMAT': 'text/html'});
            $.get(url, data => content += data || 'No data available').fail(() => content += 'Error fetching info');
        }
    });
    setTimeout(() => popup.show(evt.coordinate, content || 'No info available'), 500);
}

function clear_all() {
    if (geojson) map.removeLayer(geojson);
    if (selectedFeature) selectedFeature.setStyle();
    overlays.getLayers().clear();
    popup.hide();
    $('#table_data, #layer_properties, #legend').empty();
    map.getView().fit([65.90, 7.48, 98.96, 40.30], { duration: 1590 });
    layerSwitcher.renderPanel();
    $('#info_btn').html("☰ Activate GetInfo").removeClass('btn-danger').addClass('btn-success');
    map.un('singleclick', getinfo);
    map.un('singleclick', highlight);
    $('#legend').css({ width: '0', visibility: 'hidden' });
    $('#legend_btn').html("☰ Show Legend").removeClass('btn-danger').addClass('btn-success');
}

function show_hide_legend() {
    if ($('#legend').css('visibility') === 'hidden') {
        $('#legend_btn').html("☰ Hide Legend").removeClass('btn-success').addClass('btn-danger');
        $('#legend').css({ visibility: 'visible', width: '15%' });
        legend();
    } else {
        $('#legend_btn').html("☰ Show Legend").removeClass('btn-danger').addClass('btn-success');
        $('#legend').css({ width: '0', visibility: 'hidden' });
    }
}

$(document).ready(loadCapabilities);