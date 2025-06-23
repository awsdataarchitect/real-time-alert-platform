/**
 * Geohash utility functions for location-based queries
 */

/**
 * Encodes a latitude/longitude point to a geohash string
 * @param {number} latitude - The latitude in decimal degrees
 * @param {number} longitude - The longitude in decimal degrees
 * @param {number} precision - The precision of the geohash (default: 7)
 * @returns {string} The geohash string
 */
export const encodeGeohash = (latitude, longitude, precision = 7) => {
  const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
  let geohash = '';
  let bits = 0;
  let bitsTotal = 0;
  let hashValue = 0;
  let maxLat = 90;
  let minLat = -90;
  let maxLng = 180;
  let minLng = -180;
  let mid;

  while (geohash.length < precision) {
    if (bitsTotal % 2 === 0) {
      mid = (maxLng + minLng) / 2;
      if (longitude > mid) {
        hashValue = (hashValue << 1) + 1;
        minLng = mid;
      } else {
        hashValue = (hashValue << 1) + 0;
        maxLng = mid;
      }
    } else {
      mid = (maxLat + minLat) / 2;
      if (latitude > mid) {
        hashValue = (hashValue << 1) + 1;
        minLat = mid;
      } else {
        hashValue = (hashValue << 1) + 0;
        maxLat = mid;
      }
    }

    bits++;
    bitsTotal++;

    if (bits === 5) {
      geohash += BASE32.charAt(hashValue);
      bits = 0;
      hashValue = 0;
    }
  }

  return geohash;
};

/**
 * Decodes a geohash string to a latitude/longitude point
 * @param {string} geohash - The geohash string
 * @returns {Object} Object with latitude and longitude
 */
export const decodeGeohash = (geohash) => {
  const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
  let isEven = true;
  let lat = [-90, 90];
  let lng = [-180, 180];
  let latErr = 90;
  let lngErr = 180;
  let i = 0;
  let c = 0;
  let hashValue = 0;
  let bits = 0;

  for (i = 0; i < geohash.length; i++) {
    c = geohash.charAt(i).toLowerCase();
    hashValue = BASE32.indexOf(c);

    for (bits = 4; bits >= 0; bits--) {
      const bit = (hashValue >> bits) & 1;
      if (isEven) {
        lngErr /= 2;
        if (bit === 1) {
          lng[0] = (lng[0] + lng[1]) / 2;
        } else {
          lng[1] = (lng[0] + lng[1]) / 2;
        }
      } else {
        latErr /= 2;
        if (bit === 1) {
          lat[0] = (lat[0] + lat[1]) / 2;
        } else {
          lat[1] = (lat[0] + lat[1]) / 2;
        }
      }
      isEven = !isEven;
    }
  }

  return {
    latitude: (lat[0] + lat[1]) / 2,
    longitude: (lng[0] + lng[1]) / 2,
    latitudeError: latErr,
    longitudeError: lngErr
  };
};

/**
 * Gets the neighbors of a geohash
 * @param {string} geohash - The geohash string
 * @returns {Object} Object with neighbor geohashes in all directions
 */
export const getNeighbors = (geohash) => {
  const decoded = decodeGeohash(geohash);
  const precision = geohash.length;
  
  const neighbors = {
    n: encodeGeohash(decoded.latitude + decoded.latitudeError * 2, decoded.longitude, precision),
    ne: encodeGeohash(decoded.latitude + decoded.latitudeError * 2, decoded.longitude + decoded.longitudeError * 2, precision),
    e: encodeGeohash(decoded.latitude, decoded.longitude + decoded.longitudeError * 2, precision),
    se: encodeGeohash(decoded.latitude - decoded.latitudeError * 2, decoded.longitude + decoded.longitudeError * 2, precision),
    s: encodeGeohash(decoded.latitude - decoded.latitudeError * 2, decoded.longitude, precision),
    sw: encodeGeohash(decoded.latitude - decoded.latitudeError * 2, decoded.longitude - decoded.longitudeError * 2, precision),
    w: encodeGeohash(decoded.latitude, decoded.longitude - decoded.longitudeError * 2, precision),
    nw: encodeGeohash(decoded.latitude + decoded.latitudeError * 2, decoded.longitude - decoded.longitudeError * 2, precision)
  };

  return neighbors;
};

/**
 * Gets the geohash for a GeoJSON object
 * @param {Object} geoJson - The GeoJSON object
 * @param {number} precision - The precision of the geohash (default: 7)
 * @returns {string} The geohash string
 */
export const getGeohashFromGeoJson = (geoJson, precision = 7) => {
  if (!geoJson || !geoJson.type || !geoJson.coordinates) {
    throw new Error('Invalid GeoJSON object');
  }

  switch (geoJson.type) {
    case 'Point':
      return encodeGeohash(geoJson.coordinates[1], geoJson.coordinates[0], precision);
    case 'Polygon':
      // For polygons, we use the centroid
      const coordinates = geoJson.coordinates[0];
      let sumLat = 0;
      let sumLng = 0;
      for (let i = 0; i < coordinates.length; i++) {
        sumLng += coordinates[i][0];
        sumLat += coordinates[i][1];
      }
      return encodeGeohash(sumLat / coordinates.length, sumLng / coordinates.length, precision);
    case 'MultiPolygon':
      // For multi-polygons, we use the centroid of the first polygon
      const firstPolygon = geoJson.coordinates[0][0];
      let sumLat2 = 0;
      let sumLng2 = 0;
      for (let i = 0; i < firstPolygon.length; i++) {
        sumLng2 += firstPolygon[i][0];
        sumLat2 += firstPolygon[i][1];
      }
      return encodeGeohash(sumLat2 / firstPolygon.length, sumLng2 / firstPolygon.length, precision);
    default:
      throw new Error(`Unsupported GeoJSON type: ${geoJson.type}`);
  }
};