declare module '@turf/turf' {
  import { Feature, Polygon, MultiPolygon, Point } from 'geojson';

  export function point(coordinates: [number, number]): Feature<Point>;
  export function booleanPointInPolygon(point: Feature<Point>, polygon: Feature<Polygon | MultiPolygon>): boolean;
  // Add other functions you use from @turf/turf here
}