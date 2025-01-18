'use client';

import { useCallback, useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, useMap } from 'react-leaflet';
import { kml } from '@tmcw/togeojson';
import * as turf from '@turf/turf';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import datalist from '../public/chapters.json';

interface WardInfo {
  ward: string | null;
  zone: string | null;
  division: string | null;
  subdivision: string | null;
  assembly: string | null;
  parliament: string | null;
  chapter?: string | null;
}

interface MarkerData {
  position: [number, number];
  wardInfo: WardInfo | null;
}

const customIcon = new L.Icon({
  iconUrl: 'https://www.cp-desk.com/wp-content/uploads/2019/02/map-marker-free-download-png.png',
  iconSize: [40, 40],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

function MapEvents({ onMapClick, setMap }: { onMapClick: (e: L.LeafletMouseEvent) => void; setMap: (map: L.Map) => void }) {
  const map = useMap();

  useEffect(() => {
    setMap(map);
    map.on('click', onMapClick);
    return () => {
      map.off('click', onMapClick);
    };
  }, [map, onMapClick, setMap]);

  return null;
}

function MapEmbed() {
  const [geoJsonData, setGeoJsonData] = useState<any>(null);
  const [marker, setMarker] = useState<MarkerData | null>(null);
  const chapters: Record<string, string> = datalist;
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);

  useEffect(() => {
    fetch('/sba-data.kml')
      .then((response) => response.text())
      .then((text) => {
        const parser = new DOMParser();
        const kmlDoc = parser.parseFromString(text, 'text/xml');
        const geoJson = kml(kmlDoc);
        setGeoJsonData(geoJson);
      })
      .catch((error) => console.error('Error fetching KML data:', error));
  }, []);

  const findWard = useCallback(
    (point: [number, number]): WardInfo | null => {
      if (!geoJsonData) return null;

      const pt = turf.point([point[1], point[0]]);
      let foundWard: WardInfo | null = null as WardInfo | null;

      geoJsonData.features.forEach((feature: any) => {
        if ((feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') && turf.booleanPointInPolygon(pt, feature)) {
          foundWard = {
            ward: feature.properties?.name || 'Unnamed Ward',
            zone: feature.properties?.COL519A9F225DE5362C || 'Unknown Zone',
            division: feature.properties?.COL519A9F225D815914 || 'Unknown Division',
            subdivision: feature.properties?.COL519A9F225DDB66BD || 'Unknown Subdivision',
            assembly: feature.properties?.COL519A9F225DC0CB09 || 'Unknown Assembly',
            parliament: feature.properties?.COL519A9F225DC40EAA || 'Unknown Parliament',
          };
        }
      });

      if (foundWard?.ward) {
        const normalizedWardName = foundWard.ward.replace(/Ward\s+/i, '').trim().toLowerCase();
        const normalizedChapters = Object.fromEntries(
          Object.entries(chapters).map(([key, value]) => [
            key.replace(/Ward\s+/i, '').trim().toLowerCase(),
            value,
          ])
        );
        foundWard.chapter = normalizedChapters[normalizedWardName] || null;
      }

      return foundWard;
    },
    [geoJsonData, chapters]
  );

  const handleMapClick = useCallback(
    (e: L.LeafletMouseEvent) => {
      const position: [number, number] = [e.latlng.lat, e.latlng.lng];
      const wardInfo = findWard(position);

      if (wardInfo) {
        setMarker({ position, wardInfo });
        navigator.clipboard.writeText(
          `Ward: ${wardInfo.ward || 'Unknown'}, Chapter: ${wardInfo.chapter || 'Unknown'}`
        );
        if (mapInstance) mapInstance.setView(position, 13);
      }
    },
    [findWard, mapInstance]
  );

  return (
    <div className="h-screen">
      <MapContainer
        center={[12.9716, 77.5946]}
        zoom={11}
        className="h-full w-full"
        dragging={true}
        maxBounds={[[12.834, 77.379], [13.139, 77.789]]}
        maxBoundsViscosity={1.0}
        minZoom={11}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        {geoJsonData && (
          <GeoJSON
            data={geoJsonData}
            style={{
              color: '#28306f',
              weight: 0.5,
              opacity: 0.8,
              fillColor: '#f39117',
              fillOpacity: 0.05,
            }}
          />
        )}
        {marker && (
          <Marker position={marker.position} icon={customIcon}>
            <Popup autoClose={false} autoPan={false}>
              <div>
                <p><strong>Ward:</strong> {marker.wardInfo?.ward || 'No ward found'}</p>
                <p><strong>Chapter:</strong> {marker.wardInfo?.chapter || 'Unknown Chapter'}</p>
              </div>
            </Popup>
          </Marker>
        )}
        <MapEvents onMapClick={handleMapClick} setMap={setMapInstance} />
      </MapContainer>
    </div>
  );
}

export default MapEmbed;