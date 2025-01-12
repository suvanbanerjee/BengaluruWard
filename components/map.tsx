'use client';

import { useCallback, useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, useMap } from 'react-leaflet';
import { kml } from '@tmcw/togeojson';
import * as turf from '@turf/turf';
import { MapPin, Search } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import axios from 'axios';
import debounce from 'debounce';
import datalist from '../public/chapters.json';

// Custom marker icon
const customIcon = new L.Icon({
  iconUrl: 'https://www.cp-desk.com/wp-content/uploads/2019/02/map-marker-free-download-png.png',
  iconSize: [40, 40],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const userPointer = new L.DivIcon({
  className: 'custom-div-icon',
  html: "<div style='background-color:#007bff; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white;'></div>",
  iconSize: [12, 12],
  iconAnchor: [6, 6],
  popupAnchor: [0, -6],
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
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);

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
      if (mapInstance) {
        mapInstance.setView(position, 15); // Adjust zoom level as needed
      }
    },
    [findWard, mapInstance]
  );

  const handleSearch = async () => {
    const bengaluruSuggestions = suggestions.filter((suggestion) =>
      suggestion.display_name.includes('Bangalore') || suggestion.display_name.includes('Bengaluru')
    );

    if (bengaluruSuggestions.length > 0) {
      const { lat, lon } = bengaluruSuggestions[0];
      const position: [number, number] = [parseFloat(lat), parseFloat(lon)];
      const wardInfo = findWard(position);
      setMarker({ position, wardInfo });
      if (mapInstance) {
        mapInstance.setView(position, 15); // Adjust zoom level as needed
      }
    } else {
      console.log('No results found in Bangalore');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="flex flex-col h-[85vh]">
      <div className="p-4 z-10">
        <div className="max-w-3xl mx-auto relative">
          <input
            type="text"
            placeholder="Search address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            className="w-full p-2 pr-10 border border-[#28306f] rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-[#28306f] text-[#28306f]"
          />
          <button
            onClick={handleSearch}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 bg-[#f39117] text-white rounded-full hover:bg-[#28306f] focus:outline-none focus:ring-2 focus:ring-[#f39117]"
          >
            <Search className="w-4 h-4" />
            <span className="sr-only">Search</span>
          </button>
          {suggestions.length > 0 && (
            <ul className="absolute z-50 w-full bg-white border border-[#f39117] rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto">
              {suggestions.map((suggestion, index) => (
                <li
                  key={index}
                  className="p-2 cursor-pointer hover:bg-[#f39117] hover:text-white"
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
        </div>
      </div>
      <div className="flex-grow flex flex-col lg:flex-row">
        <div className="w-full lg:w-3/4 h-1/2 lg:h-full p-4">
          <div className="h-full relative rounded-lg overflow-hidden border border-[#28306f]">
            <MapContainer
              center={[12.9716, 77.5946]}
              zoom={11}
              className="h-full w-full z-0"
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
                    weight: 0.5,
                    opacity: 0.8,
                    fillColor: '#f39117',
                    fillOpacity: 0.05,
                  })}
                />
              )}
              {marker && (
                <Marker position={marker.position} icon={customIcon}>
                  <Popup>
                    <div className="p-2 rounded">
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
                <Marker position={userLocation.position} icon={userPointer}>
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
              <MapEvents onMapClick={handleMapClick} setMap={setMapInstance} />
            </MapContainer>
          </div>
        </div>
        <div className="w-full lg:w-1/4 h-1/2 lg:h-full p-4 overflow-y-auto">
          {marker ? (
            <div className="bg-[#28306f] text-white p-4 rounded-lg shadow-lg">
              <h3 className="font-semibold mb-2 text-[#f39117] text-lg">{marker.wardInfo?.chapter || 'Unknown'} Chapter</h3>
              <div className="space-y-1 text-lg">
                <p>{marker.wardInfo?.ward || 'No ward found'}</p>
                <p>Zone: {marker.wardInfo?.zone}</p>
                <p>Division: {marker.wardInfo?.division}</p>
                <p>Subdivision: {marker.wardInfo?.subdivision}</p>
                <p>Assembly: {marker.wardInfo?.assembly}</p>
                <p>Parliament: {marker.wardInfo?.parliament}</p>
              </div>
            </div>
          ) : (
            <p className="text-[#28306f] font-semibold">This tool allows you to find what SBA chapter you are in by clicking on the map or searching for an address. you will also be able to see the ward, zone, division, subdivision, assembly, and parliament constituency you are in.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default MapComponent;