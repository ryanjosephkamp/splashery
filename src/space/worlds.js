// Lane Space r2: the real worlds, as data. Each world's size, day, maps and
// named features, from NASA, USGS and NOAA (public domain). The toys in
// src/packs/space-r2.js build splats from these, and other packs (the
// Arcade's lander) may import them too: loadWorld(id) in src/space/maps.js
// gives a world's maps and a sampler of height and color at any latitude and
// longitude.
//
// Longitudes are east, −180° to 180°; latitudes planetocentric. Feature
// positions are the centers listed in the USGS Gazetteer of Planetary
// Nomenclature (planetarynames.wr.usgs.gov), turned to east longitudes
// where the Gazetteer lists them west (Mercury). `patch` asks
// tools/sp2-maps.mjs for a sharper close-up map round the feature: `deg`
// is its half-height in degrees of latitude.
//
// The `maps` entries say where tools/sp2-maps.mjs reads each map (the toys
// read only the small files it writes in assets/toys/real-worlds/):
// lonLeft is the east longitude of the source's left edge, scale and offset
// turn its values into meters (heights) or 0..255 (colors).

const USGS = "https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/";
const SVS = "https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/";
const GAZ = "https://planetarynames.wr.usgs.gov/Feature/";
const BMNG =
  "https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-base/july/";
const ETOPO = "https://www.ngdc.noaa.gov/mgg/global/relief/ETOPO2022/data/";
// One 15° × 15° tile of ETOPO 2022 at 15 arc-seconds (about 450 m), named by
// its top left corner.
const etopoTile = (lat, lon) => ({
  url: `${ETOPO}15s/15s_surface_elev_gtif/ETOPO_2022_v1_15s_${lat >= 0 ? "N" : "S"}${String(Math.abs(lat)).padStart(2, "0")}${lon >= 0 ? "E" : "W"}${String(Math.abs(lon)).padStart(3, "0")}_surface.tif`,
  lonLeft: lon,
  lonSpan: 15,
  latTop: lat,
  latBottom: lat - 15,
});

export const WORLDS = [
  {
    id: "moon",
    name: "the Moon",
    radiusKm: 1737.4,
    // Sidereal rotation: the Moon turns once per orbit, 27.32 days.
    dayHours: 655.72,
    reference: "heights above a sphere of 1,737.4 km (LOLA)",
    sunlit: "#fffaf0",
    maps: {
      color: {
        url: `${SVS}lroc_color_16bit_srgb_4k.tif`,
        lonLeft: -180,
        scale: 255 / 65535,
        gamma: 1.35,
      },
      patchColor: { url: `${SVS}lroc_color_16bit_srgb_16k.tif`, lonLeft: -180, scale: 255 / 65535, gamma: 1.35 }, // prettier-ignore
      height: { url: `${SVS}ldem_4.tif`, lonLeft: -180, scale: 1000 },
      patchHeight: { url: `${SVS}ldem_64.tif`, lonLeft: -180, scale: 1000 },
    },
    features: [
      { id: "tycho", name: "Tycho crater", lat: -43.3, lon: -11.22, km: 85, gaz: 6163, patch: { deg: 3.2 } }, // prettier-ignore
      { id: "copernicus", name: "Copernicus crater", lat: 9.62, lon: -20.08, km: 96, gaz: 1296, patch: { deg: 3.4 } }, // prettier-ignore
      { id: "apollo-11", name: "Apollo 11's landing site (Tranquility Base)", lat: 0.67, lon: 23.47, km: 0, gaz: 5684, patch: { deg: 2.5 } }, // prettier-ignore
    ],
    credits: [
      {
        label: "Color and elevation maps",
        title: "CGI Moon Kit (LRO LROC color mosaic, 2025, and LOLA elevation)",
        source: "https://svs.gsfc.nasa.gov/4720",
        author: "NASA's Scientific Visualization Studio (Ernie Wright); LRO LROC and LOLA teams",
        license: "Public domain (NASA)",
        licenseUrl: "https://www.nasa.gov/nasa-brand-center/images-and-media/",
      },
    ],
  },
  {
    id: "mars",
    name: "Mars",
    radiusKm: 3389.5,
    dayHours: 24.6229,
    reference: "heights above the areoid, Mars's sea-level surface (MOLA)",
    sunlit: "#fff4e6",
    atmosphere: { color: "#e8b08a", thickness: 0.006, strength: 0.18 },
    maps: {
      color: { url: `${USGS}Mars_Viking_ClrMosaic_global_925m.tif`, lonLeft: -180 },
      height: { url: `${USGS}Mars_MGS_MOLA_DEM_mosaic_global_463m.tif`, lonLeft: -180, nodata: -32768 }, // prettier-ignore
    },
    features: [
      { id: "olympus-mons", name: "Olympus Mons", lat: 18.65, lon: -133.8, km: 610, gaz: 4453, patch: { deg: 7 } }, // prettier-ignore
      { id: "valles-marineris", name: "Valles Marineris", lat: -14.01, lon: -58.59, km: 3761, gaz: 6288, patch: { deg: 13, size: 768 } }, // prettier-ignore
      { id: "gale", name: "Gale crater (the Curiosity rover)", lat: -5.37, lon: 137.81, km: 154, gaz: 2071, patch: { deg: 2.6 } }, // prettier-ignore
    ],
    credits: [
      {
        label: "Color map",
        title: "Mars Viking Colorized Global Mosaic 925m",
        source: "https://astrogeology.usgs.gov/search/map/mars_viking_global_color_mosaic_925m",
        author:
          "NASA, JPL, Viking orbiters (Planetary Data System); USGS Astrogeology Science Center",
        license: "Public domain (USGS and NASA)",
        licenseUrl:
          "https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits",
      },
      {
        label: "Elevation map",
        title: "Mars MGS MOLA DEM 463m",
        source: "https://astrogeology.usgs.gov/search/map/mars_mgs_mola_dem_463m",
        author:
          "MOLA Science Team (NASA Goddard Space Flight Center); USGS Astrogeology Science Center",
        license: "Public domain (USGS and NASA)",
        licenseUrl:
          "https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits",
      },
    ],
  },
  {
    id: "mercury",
    name: "Mercury",
    radiusKm: 2439.4,
    // Sidereal rotation: 58.646 days.
    dayHours: 1407.6,
    reference: "heights above a sphere of 2,439.4 km (MESSENGER)",
    sunlit: "#ffffff",
    maps: {
      color: { url: `${USGS}Mercury_MESSENGER_MDIS_Basemap_MD3Color_Mosaic_Global_665m.tif`, lonLeft: -180 }, // prettier-ignore
      height: { url: `${USGS}Mercury_Messenger_USGS_DEM_Global_665m_v2.tif`, lonLeft: 0, scale: 0.5, nodata: -32768 }, // prettier-ignore
    },
    features: [
      { id: "caloris", name: "Caloris Planitia (the Caloris basin)", label: "Caloris basin", lat: 31.65, lon: 161.98, km: 1500, gaz: 979, patch: { deg: 18, size: 768 } }, // prettier-ignore
      { id: "rachmaninoff", name: "Rachmaninoff crater", label: "Rachmaninoff", lat: 27.66, lon: 57.37, km: 305, gaz: 14653, patch: { deg: 4.5 } }, // prettier-ignore
      { id: "hokusai", name: "Hokusai crater", label: "Hokusai", lat: 57.84, lon: 16.65, km: 114, gaz: 14644, patch: { deg: 3 } }, // prettier-ignore
    ],
    credits: [
      {
        label: "Color and elevation maps",
        title:
          "Mercury MESSENGER MDIS basemap, 3-color (1000, 750 and 430 nm; MESS-H-MDIS-5-RDR-MD3-V1.0, 665 m), and Mercury MESSENGER Global DEM 665m",
        source: "https://astrogeology.usgs.gov/search/map/mercury_messenger_global_dem_665m",
        author:
          "NASA, Johns Hopkins APL, Carnegie Institution for Science, Arizona State University; DEM by Kris Becker (USGS Astrogeology Science Center)",
        license: "Public domain (USGS and NASA)",
        licenseUrl:
          "https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits",
      },
    ],
  },
  {
    id: "venus",
    name: "Venus",
    radiusKm: 6051.8,
    // Sidereal rotation: 243.02 days, backward (retrograde).
    dayHours: -5832.6,
    reference: "heights above a sphere of 6,051 km (Magellan radar altimetry)",
    sunlit: "#fff6e0",
    maps: {
      color: { url: `${USGS}Venus_Magellan_C3-MDIR_Colorized_Global_Mosaic_4641m.tif`, lonLeft: -180 }, // prettier-ignore
      height: { url: `${USGS}Venus_Magellan_Topography_Global_4641m_v02.tif`, lonLeft: -180, nodata: -32768 }, // prettier-ignore
    },
    features: [
      { id: "maxwell-montes", name: "Maxwell Montes", lat: 65.2, lon: 3.3, km: 797, gaz: 3766, patch: { deg: 9 } }, // prettier-ignore
      { id: "maat-mons", name: "Maat Mons", lat: 0.5, lon: -165.4, km: 395, gaz: 3550, patch: { deg: 5 } }, // prettier-ignore
      { id: "artemis-corona", name: "Artemis Corona", lat: -35, lon: 135, km: 2600, gaz: 401, patch: { deg: 14, size: 768 } }, // prettier-ignore
    ],
    credits: [
      {
        label: "Radar and elevation maps",
        title:
          "Venus Magellan Global C3-MDIR Synthetic Color Mosaic 4641m and Venus Magellan Global Topography 4641m",
        source: "https://astrogeology.usgs.gov/search/map/venus_magellan_global_topography_4641m",
        author:
          "NASA, JPL, Magellan mission; PDS Geosciences Node; topography by Peter Ford, Gordon Pettengill, Fang Liu and Joan Quigley; USGS Astrogeology Science Center",
        license: "Public domain (USGS and NASA)",
        licenseUrl:
          "https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits",
      },
    ],
  },
  {
    id: "earth",
    name: "Earth",
    radiusKm: 6371,
    dayHours: 23.9345,
    reference: "heights above sea level (ETOPO 2022); the oceans are shown at sea level",
    sunlit: "#ffffff",
    atmosphere: { color: "#8fbaff", thickness: 0.012, strength: 0.45 },
    maps: {
      color: { url: `${BMNG}world.200407.3x5400x2700.jpg`, kind: "jpeg", lonLeft: -180 },
      patchColor: { url: `${BMNG}world.200407.3x21600x10800.jpg`, kind: "jpeg", lonLeft: -180 },
      height: { url: `${ETOPO}60s/60s_surface_elev_gtif/ETOPO_2022_v1_60s_N90W180_surface.tif`, lonLeft: -180 }, // prettier-ignore
      night: { url: "https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/144000/144898/BlackMarble_2016_01deg.jpg", kind: "jpeg", lonLeft: -180 }, // prettier-ignore
    },
    features: [
      { id: "everest", name: "Mount Everest and the Himalayas", label: "Mount Everest", lat: 27.988, lon: 86.925, km: 0, page: "https://en.wikipedia.org/wiki/Mount_Everest", patch: { deg: 1.6, height: etopoTile(30, 75) } }, // prettier-ignore
      { id: "grand-canyon", name: "The Grand Canyon (at Phantom Ranch, on the canyon floor)", label: "Grand Canyon", lat: 36.106, lon: -112.095, km: 16, page: "https://en.wikipedia.org/wiki/Phantom_Ranch", patch: { deg: 0.75, height: etopoTile(45, -120) } }, // prettier-ignore
      { id: "hawaii", name: "Hawaii, with Mauna Kea and Mauna Loa", label: "Hawaii", lat: 19.6, lon: -155.5, km: 0, page: "https://en.wikipedia.org/wiki/Mauna_Kea", patch: { deg: 1.3, height: etopoTile(30, -165) } }, // prettier-ignore
    ],
    credits: [
      {
        label: "Color map",
        title: "Blue Marble: Next Generation (July 2004)",
        source: "https://visibleearth.nasa.gov/images/74092/july-blue-marble-next-generation",
        author: "NASA Earth Observatory (Reto Stöckli)",
        license: "Public domain (NASA)",
        licenseUrl: "https://earthobservatory.nasa.gov/image-use-policy",
      },
      {
        label: "Elevation map",
        title: "ETOPO 2022 Global Relief Model (60 and 15 arc-seconds)",
        source: "https://www.ncei.noaa.gov/products/etopo-global-relief-model",
        author: "NOAA National Centers for Environmental Information",
        license: "Public domain (NOAA)",
        licenseUrl: "https://www.ncei.noaa.gov/products/etopo-global-relief-model",
      },
      {
        label: "Lights at night",
        title: "Black Marble 2016 (Earth at Night)",
        source: "https://earthobservatory.nasa.gov/features/NightLights",
        author: "NASA Earth Observatory (Joshua Stevens, Miguel Román)",
        license: "Public domain (NASA)",
        licenseUrl: "https://earthobservatory.nasa.gov/image-use-policy",
      },
    ],
  },
  {
    id: "io",
    name: "Io",
    radiusKm: 1821.5,
    // Io always turns the same face to Jupiter: a day is its orbit, 1.769 days.
    dayHours: 42.459,
    reference: "no global elevation map exists, so the ground is drawn smooth",
    maps: {
      color: { url: `${USGS}Io_GalileoSSI-Voyager_Global_Mosaic_ClrMerge_1km.tif`, lonLeft: -180 },
    },
    features: [
      { id: "pele", name: "Pele, a volcano and its red ring of fallout", label: "Pele", lat: -18.71, lon: 104.72, km: 1200, gaz: 4638, patch: { deg: 14 } }, // prettier-ignore
      { id: "loki", name: "Loki Patera, a lava lake", label: "Loki Patera", lat: 13.01, lon: 51.21, km: 227, gaz: 3459, patch: { deg: 6 } }, // prettier-ignore
      { id: "prometheus", name: "Prometheus, a volcano", label: "Prometheus", lat: -1.52, lon: -153.94, km: 439, gaz: 4836, patch: { deg: 7 } }, // prettier-ignore
    ],
    credits: [
      {
        label: "Color map",
        title: "Io Galileo SSI / Voyager Global Mosaic, color merge, 1 km",
        source:
          "https://astrogeology.usgs.gov/search/map/io_galileo_ssi_global_color_merge_mosaic_1km",
        author: "NASA, JPL, Galileo and Voyager missions; USGS Astrogeology Science Center",
        license: "Public domain (USGS and NASA)",
        licenseUrl:
          "https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits",
      },
    ],
  },
  {
    id: "europa",
    name: "Europa",
    radiusKm: 1560.8,
    dayHours: 85.228,
    reference: "no global elevation map exists, so the ground is drawn smooth",
    maps: {
      color: {
        url: `${USGS}Europa_Voyager_GalileoSSI_global_mosaic_500m.tif`,
        lonLeft: 0,
        gray: true,
        nodata: 0,
      },
    },
    features: [
      { id: "pwyll", name: "Pwyll crater and its rays", label: "Pwyll", lat: -25.2, lon: 88.6, km: 45, gaz: 4878, patch: { deg: 6 } }, // prettier-ignore
      { id: "conamara", name: "Conamara Chaos, broken plates of ice", label: "Conamara Chaos", lat: 9.7, lon: 87.3, km: 144, gaz: 1282, patch: { deg: 4 } }, // prettier-ignore
      { id: "tyre", name: "Tyre, a ringed impact scar", label: "Tyre", lat: 33.6, lon: -146.6, km: 149, gaz: 6170, patch: { deg: 5 } }, // prettier-ignore
    ],
    credits: [
      {
        label: "Map",
        title: "Europa Voyager / Galileo SSI Global Mosaic 500m",
        source:
          "https://astrogeology.usgs.gov/search/map/europa_voyager_galileo_ssi_global_mosaic_500m",
        author: "NASA, JPL, Galileo and Voyager missions; USGS Astrogeology Science Center",
        license: "Public domain (USGS and NASA)",
        licenseUrl:
          "https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits",
      },
    ],
  },
  {
    id: "ganymede",
    name: "Ganymede",
    radiusKm: 2631.2,
    dayHours: 171.71,
    reference: "no global elevation map exists, so the ground is drawn smooth",
    maps: {
      color: {
        url: `${USGS}Ganymede_Voyager_GalileoSSI_Global_ClrMosaic_1435m.tif`,
        lonLeft: 0,
        nodata: 0,
      },
    },
    features: [
      { id: "galileo-regio", name: "Galileo Regio, old dark ground", label: "Galileo Regio", lat: 45, lon: -127, km: 3200, gaz: 2076, patch: { deg: 14 } }, // prettier-ignore
      { id: "osiris", name: "Osiris, a young rayed crater", label: "Osiris", lat: -38, lon: -166.31, km: 107, gaz: 4509, patch: { deg: 5 } }, // prettier-ignore
      { id: "tros", name: "Tros, a young rayed crater", label: "Tros", lat: 11.14, lon: -27.26, km: 94, gaz: 6091, patch: { deg: 5 } }, // prettier-ignore
    ],
    credits: [
      {
        label: "Color map",
        title: "Ganymede Voyager / Galileo SSI Global Color Mosaic 1435m",
        source:
          "https://astrogeology.usgs.gov/search/map/ganymede_voyager_galileo_ssi_color_global_mosaic_1_4km",
        author: "NASA, JPL, Galileo and Voyager missions; USGS Astrogeology Science Center",
        license: "Public domain (USGS and NASA)",
        licenseUrl:
          "https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits",
      },
    ],
  },
  {
    id: "callisto",
    name: "Callisto",
    radiusKm: 2410.3,
    dayHours: 400.54,
    reference: "no global elevation map exists, so the ground is drawn smooth",
    maps: {
      color: {
        url: `${USGS}Callisto_Voyager_GalileoSSI_global_mosaic_1km.tif`,
        lonLeft: 0,
        gray: true,
        nodata: 0,
      },
    },
    features: [
      { id: "valhalla", name: "Valhalla, a giant ringed basin", label: "Valhalla", lat: 14.7, lon: -56, km: 3000, gaz: 6284, patch: { deg: 16 } }, // prettier-ignore
      { id: "asgard", name: "Asgard, a ringed basin", label: "Asgard", lat: 32.2, lon: -139.9, km: 1400, gaz: 420, patch: { deg: 10 } }, // prettier-ignore
    ],
    credits: [
      {
        label: "Map",
        title: "Callisto Voyager / Galileo SSI Global Mosaic 1km",
        source:
          "https://astrogeology.usgs.gov/search/map/callisto_voyager_galileo_ssi_global_mosaic_1km",
        author: "NASA, JPL, Galileo and Voyager missions; USGS Astrogeology Science Center",
        license: "Public domain (USGS and NASA)",
        licenseUrl:
          "https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits",
      },
    ],
  },
  {
    id: "titan",
    name: "Titan",
    radiusKm: 2575,
    dayHours: 382.69,
    reference:
      "no global elevation map exists, so the ground is drawn smooth; the haze is left out",
    maps: {
      color: { url: `${USGS}Titan_ISS_P19658_Mosaic_Global_4km.tif`, lonLeft: 0, gray: true },
    },
    features: [
      { id: "kraken-mare", name: "Kraken Mare, a sea of liquid methane and ethane", label: "Kraken Mare", lat: 68, lon: 50, km: 1170, gaz: 14399, patch: { deg: 12 } }, // prettier-ignore
      { id: "xanadu", name: "Xanadu, a bright highland", label: "Xanadu", lat: -15, lon: -100, km: 3400, gaz: 6958, patch: { deg: 16 } }, // prettier-ignore
      { id: "selk", name: "Selk crater, where the Dragonfly lander is headed", label: "Selk", lat: 7, lon: 161, km: 80, gaz: 14334, patch: { deg: 5 } }, // prettier-ignore
    ],
    credits: [
      {
        label: "Map",
        title: "Titan Cassini ISS Global Mosaic 4km",
        source: "https://astrogeology.usgs.gov/search/map/titan_cassini_iss_global_mosaic_4005m",
        author:
          "NASA, JPL, Space Science Institute, Cassini mission; USGS Astrogeology Science Center",
        license: "Public domain (USGS and NASA)",
        licenseUrl:
          "https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits",
      },
    ],
  },
  {
    id: "pluto",
    name: "Pluto",
    radiusKm: 1188.3,
    // Pluto turns backward, once every 6.387 days.
    dayHours: -153.29,
    reference:
      "heights above a sphere of 1,188.3 km (New Horizons stereo); the side New Horizons saw only from afar is filled in smoothly",
    maps: {
      color: {
        url: `${USGS}Pluto_NewHorizons_Global_Mosaic_300m_Jul2017_8bit.tif`,
        lonLeft: 0,
        gray: true,
        nodata: 0,
      },
      height: {
        url: `${USGS}Pluto_NewHorizons_Global_DEM_300m_Jul2017_16bit.tif`,
        lonLeft: 0,
        nodata: -32768,
      },
    },
    features: [
      { id: "sputnik-planitia", name: "Sputnik Planitia, a plain of nitrogen ice (the heart)", label: "Sputnik Planitia", lat: 19.51, lon: 178.69, km: 1492, gaz: 15669, patch: { deg: 16 } }, // prettier-ignore
      { id: "wright-mons", name: "Wright Mons, perhaps an ice volcano", label: "Wright Mons", lat: -21.36, lon: 173.24, km: 165, gaz: 15835, patch: { deg: 6 } }, // prettier-ignore
    ],
    credits: [
      {
        label: "Map and elevation",
        title: "Pluto New Horizons LORRI MVIC Global Mosaic and DEM 300m",
        source:
          "https://astrogeology.usgs.gov/search/map/pluto_new_horizons_lorri_mvic_global_dem_300m",
        author:
          "NASA, Johns Hopkins APL, Southwest Research Institute, New Horizons mission; USGS Astrogeology Science Center",
        license: "Public domain (USGS and NASA)",
        licenseUrl:
          "https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits",
      },
    ],
  },
  {
    id: "ceres",
    name: "Ceres",
    radiusKm: 470,
    dayHours: 9.074,
    reference: "heights above a sphere of 470 km (Dawn)",
    maps: {
      color: { url: `${USGS}Ceres_Dawn_FC_DLR_global_20ppd_Oct2015.tif`, lonLeft: 0, gray: true },
      height: {
        url: `${USGS}Ceres_Dawn_FC_HAMO_DTM_DLR_Global_60ppd_Oct2016.tif`,
        lonLeft: 0,
        nodata: -32768,
      },
    },
    features: [
      { id: "occator", name: "Occator crater and its bright salt", label: "Occator", lat: 19.82, lon: -120.67, km: 92, gaz: 15341, patch: { deg: 8 } }, // prettier-ignore
      { id: "ahuna-mons", name: "Ahuna Mons, a lone mountain of ice", label: "Ahuna Mons", lat: -10.48, lon: -43.8, km: 20, gaz: 15409, patch: { deg: 5 } }, // prettier-ignore
    ],
    credits: [
      {
        label: "Map and elevation",
        title: "Ceres Dawn FC global mosaic (DLR, 2015) and HAMO DTM (DLR, 2016)",
        source: "https://astrogeology.usgs.gov/search/map/ceres_dawn_fc2_hamo_global_dtm_137m",
        author: "NASA, JPL, MPS, DLR, IDA, Dawn mission; USGS Astrogeology Science Center",
        license: "Public domain (USGS and NASA)",
        licenseUrl:
          "https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits",
      },
    ],
  },
  {
    id: "vesta",
    name: "Vesta",
    radiusKm: 255,
    dayHours: 5.342,
    reference: "heights above a sphere of 255 km (Dawn), so its true lumpy shape shows",
    maps: {
      color: {
        url: `${USGS}Vesta_Dawn_FC_HAMO_Mosaic_Global_74ppd.tif`,
        lonLeft: -180,
        gray: true,
        nodata: 0,
      },
      height: {
        url: `${USGS}Vesta_Dawn_HAMO_DTM_DLR_Global_48ppd.tif`,
        lonLeft: -180,
        offset: -255000,
      },
    },
    features: [
      { id: "rheasilvia", name: "Rheasilvia, a basin almost as wide as Vesta", label: "Rheasilvia", lat: -71.95, lon: 86.3, km: 450, gaz: 14886, patch: { deg: 16 } }, // prettier-ignore
      { id: "marcia", name: "Marcia crater", label: "Marcia", lat: 8.98, lon: -20.45, km: 68, gaz: 14882, patch: { deg: 10 } }, // prettier-ignore
    ],
    credits: [
      {
        label: "Map and elevation",
        title: "Vesta Dawn FC HAMO Global Mosaic and DTM",
        source: "https://astrogeology.usgs.gov/search/map/vesta_dawn_fc_hamo_global_dtm_93m",
        author: "NASA, JPL, MPS, DLR, IDA, Dawn mission; USGS Astrogeology Science Center",
        license: "Public domain (USGS and NASA)",
        licenseUrl:
          "https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits",
      },
    ],
  },
];

// A world by id.
export const worldById = (id) => WORLDS.find((w) => w.id === id) || null;

// The Gazetteer page of a feature (for credits and the evidence files).
export const featurePage = (f) => (f.gaz ? `${GAZ}${f.gaz}` : f.page || "");
