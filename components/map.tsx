'use client';

import { useCallback, useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, useMap } from 'react-leaflet';
import { kml } from '@tmcw/togeojson';
import * as turf from '@turf/turf';
import { MapPin } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import axios from 'axios';
import debounce from 'debounce';
import datalist from '../public/chapters.json';

// Custom marker icon
const customIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function MapEvents({ onMapClick }: { onMapClick: (e: L.LeafletMouseEvent) => void }) {
  const map = useMap();

  useEffect(() => {
    map.on('click', onMapClick);
    return () => {
      map.off('click', onMapClick);
    };
  }, [map, onMapClick]);

  return null;
}

function MapComponent() {
  const [geoJsonData, setGeoJsonData] = useState<any>(null);
  const [marker, setMarker] = useState<{
    position: [number, number];
    wardInfo: {
      ward: string | null;
      zone: string | null;
      division: string | null;
      subdivision: string | null;
      assembly: string | null;
      parliament: string | null;
      chapter?: string | null;
    } | null;
  } | null>(null);

  const chapters: any = datalist;
  const [userLocation, setUserLocation] = useState<{
    position: [number, number];
    wardInfo: {
      ward: string | null;
      zone: string | null;
      division: string | null;
      subdivision: string | null;
      assembly: string | null;
      parliament: string | null;
      chapter?: string | null;
    } | null;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [suggestions, setSuggestions] = useState<any[]>([]);

  useEffect(() => {
    fetch('/sba-data.kml')
      .then((response) => response.text())
      .then((text) => {
        const parser = new DOMParser();
        const kmlDoc = parser.parseFromString(text, 'text/xml');
        const geoJson = kml(kmlDoc);
        setGeoJsonData(geoJson);
        console.log('Parsed GeoJSON:', geoJson);
      })
      .catch((error) => {
        console.error('Error fetching KML data:', error);
      });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userPos: [number, number] = [position.coords.latitude, position.coords.longitude];
        console.log('User Location:', userPos);
        const wardInfo = findWard(userPos);
        setUserLocation({ position: userPos, wardInfo });
      },
      (error) => {
        console.error('Error fetching user location:', error);
      }
    );
  }, []);

  const debouncedFetchSuggestions = useCallback(
    debounce((query: string) => {
      fetchSuggestions(query);
    }, 300),
    []
  );

  useEffect(() => {
    if (searchQuery.length > 2) {
      debouncedFetchSuggestions(searchQuery);
    } else {
      setSuggestions([]);
    }
  }, [searchQuery, debouncedFetchSuggestions]);

  const fetchSuggestions = async (query: string) => {
    try {
      const response = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          q: query,
          format: 'json',
          limit: 5,
        },
      });
      setSuggestions(response.data);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    }
  };

  const findWard = useCallback((point: [number, number]) => {
    if (!geoJsonData) {
      console.log('GeoJSON data is not loaded yet.');
      return null;
    }

    const pt = turf.point([point[1], point[0]]);
    console.log('Checking point:', pt);

    let foundWard: any;

    geoJsonData.features.forEach((feature: any) => {
      if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
        if (turf.booleanPointInPolygon(pt, feature)) {
          foundWard = {
            ward: feature.properties?.name || 'Unnamed Ward',
            zone: feature.properties?.COL519A9F225DE5362C || 'Unknown Zone',
            division: feature.properties?.COL519A9F225D815914 || 'Unknown Division',
            subdivision: feature.properties?.COL519A9F225DDB66BD || 'Unknown Subdivision',
            assembly: feature.properties?.COL519A9F225DC0CB09 || 'Unknown Assembly Constituency',
            parliament: feature.properties?.COL519A9F225DC40EAA || 'Unknown Parliament Constituency',
          };
          console.log('Found Ward:', foundWard);
        }
      }
    });

    if (!foundWard) {
      console.log('Point not found in any ward:', point);
      return null;
    }

    if (foundWard.ward) {
      const normalizedWardName = foundWard.ward.replace(/Ward\s+/i, '').trim().toLowerCase();
      const normalizedChapters = Object.fromEntries(
        Object.entries(chapters).map(([key, value]) => [
          key.replace(/Ward\s+/i, '').trim().toLowerCase(),
          value,
        ])
      );

      foundWard.chapter = normalizedChapters[normalizedWardName] || null;
      console.log('Matched Chapter:', foundWard.chapter);
    }

    return foundWard;
  }, [geoJsonData, chapters]);

  const handleMapClick = useCallback(
    (e: L.LeafletMouseEvent) => {
      const position: [number, number] = [e.latlng.lat, e.latlng.lng];
      const wardInfo = findWard(position);
      setMarker({ position, wardInfo });
    },
    [findWard]
  );

  const handleSearch = async () => {
    if (suggestions.length > 0) {
      const { lat, lon, display_name } = suggestions[0];
      if (display_name.includes('Bangalore') || display_name.includes('Bengaluru')) {
        const position: [number, number] = [parseFloat(lat), parseFloat(lon)];
        const wardInfo = findWard(position);
        setMarker({ position, wardInfo });
      } else {
        console.log('Result is not in Bangalore');
      }
    } else {
      console.log('No results found');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="relative h-full">
      <div className="top-4 left-4 z-[1000] space-y-4">
        <input
          type="text"
          placeholder="Search address..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={handleKeyPress}
          className="p-2 w-full border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {suggestions.length > 0 && (
          <ul className="bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {suggestions.map((suggestion, index) => (
              <li
                key={index}
                className="p-2 cursor-pointer hover:bg-gray-100"
                onClick={() => {
                  setSearchQuery(suggestion.display_name);
                  setSuggestions([]);
                  handleSearch();
                }}
              >
                {suggestion.display_name}
              </li>
            ))}
          </ul>
        )}
        <button onClick={handleSearch} className="p-2 w-full bg-blue-500 text-white rounded-lg shadow hover:bg-blue-600">
          Search
        </button>
      </div>
      <div className="absolute top-4 right-4 z-[1000] space-y-4">
        {marker && (
          <div className="bg-[#28306f] text-white p-4 rounded-lg shadow-lg">
            <h3 className="font-semibold mb-2 text-[#f39117]">Pinned Location</h3>
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <MapPin className="w-4 h-4 text-[#f39117]" />
                <span><strong>Ward:</strong> {marker.wardInfo?.ward || 'Outside Bengaluru'}</span>
              </div>
              <p><strong>Zone:</strong> {marker.wardInfo?.zone}</p>
              <p><strong>Division:</strong> {marker.wardInfo?.division}</p>
              <p><strong>Subdivision:</strong> {marker.wardInfo?.subdivision}</p>
              <p><strong>Assembly:</strong> {marker.wardInfo?.assembly}</p>
              <p><strong>Parliament:</strong> {marker.wardInfo?.parliament}</p>
              <p><strong>Chapter:</strong> {marker.wardInfo?.chapter}</p>
            </div>
          </div>
        )}
      </div>

      <div className="h-[600px] relative rounded-lg overflow-hidden border border-[#28306f]">
        <MapContainer
          center={[12.9716, 77.5946]}
          zoom={11}
          className="h-full w-full"
          dragging={true}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />
          {geoJsonData && (
            <GeoJSON
              data={geoJsonData}
              style={() => ({
                color: '#28306f',
                weight: 2,
                opacity: 0.8,
                fillColor: '#f39117',
                fillOpacity: 0.1,
              })}
            />
          )}
          {marker && (
            <Marker position={marker.position} icon={customIcon}>
              <Popup>
                <div className="bg-[#28306f] text-white p-2 rounded">
                  <p><strong className="text-[#f39117]">Ward:</strong> {marker.wardInfo?.ward || 'No ward found'}</p>
                  <p><strong className="text-[#f39117]">Zone:</strong> {marker.wardInfo?.zone}</p>
                  <p><strong className="text-[#f39117]">Division:</strong> {marker.wardInfo?.division}</p>
                  <p><strong className="text-[#f39117]">Subdivision:</strong> {marker.wardInfo?.subdivision}</p>
                  <p><strong className="text-[#f39117]">Assembly:</strong> {marker.wardInfo?.assembly}</p>
                  <p><strong className="text-[#f39117]">Parliament:</strong> {marker.wardInfo?.parliament}</p>
                  <p><strong className="text-[#f39117]">Chapter:</strong> {marker.wardInfo?.chapter || 'Unknown Chapter'}</p>
                </div>
              </Popup>
            </Marker>
          )}
                    {userLocation && (
            <Marker position={userLocation.position} icon={customIcon}>
              <Popup>
                <div className="bg-[#28306f] text-white p-2 rounded">
                  <p><strong className="text-[#f39117]">User Location:</strong></p>
                  <p><strong className="text-[#f39117]">Ward:</strong> {userLocation.wardInfo?.ward || 'No ward found'}</p>
                  <p><strong className="text-[#f39117]">Zone:</strong> {userLocation.wardInfo?.zone}</p>
                  <p><strong className="text-[#f39117]">Division:</strong> {userLocation.wardInfo?.division}</p>
                  <p><strong className="text-[#f39117]">Subdivision:</strong> {userLocation.wardInfo?.subdivision}</p>
                  <p><strong className="text-[#f39117]">Assembly:</strong> {userLocation.wardInfo?.assembly}</p>
                  <p><strong className="text-[#f39117]">Parliament:</strong> {userLocation.wardInfo?.parliament}</p>
                  <p><strong className="text-[#f39117]">Chapter:</strong> {userLocation.wardInfo?.chapter || 'Unknown Chapter'}</p>
                </div>
              </Popup>
            </Marker>
          )}
          <MapEvents onMapClick={handleMapClick} />
        </MapContainer>
      </div>
    </div>
  );
}

export default MapComponent;
