import { feature } from "topojson-client";
import { geoEqualEarth, geoPath } from "d3-geo";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { FeatureCollection, Geometry } from "geojson";
import worldData from "@/lib/world-110m.json";

type CountryFeature = FeatureCollection<Geometry, { name: string }>;

// Numeric ISO 3166-1 codes used by the world-atlas TopoJSON. Both padded
// and unpadded variants of single-zero codes are included so e.g. Australia
// matches ("036" / "36").
const DEFAULT_HIGHLIGHTED = ["124", "620", "724", "784", "036", "36"];

type Ping = { id: string; name: string; cx: number; cy: number };
type MapShapes = {
  /** Os países sem destaque, todos num só path (o mesmo traço e
   *  preenchimento — eram ~170 elementos <path>). */
  rest: string;
  highlighted: Array<{ key: string; name: string; d: string }>;
  pings: Ping[];
};

// O mapa é igual em todos os pedidos: calcula-se uma vez por instância do
// servidor (v78.34), com 1 casa decimal nas coordenadas — a 520px de largura
// é um décimo de píxel, e o HTML do SEO DPT encolhe ~80 KB.
const SHAPES = new Map<string, MapShapes>();

function shapesFor(width: number, height: number, ids: string[]): MapShapes {
  const cacheKey = `${width}x${height}:${ids.join(",")}`;
  const cached = SHAPES.get(cacheKey);
  if (cached) return cached;

  const HIGHLIGHTED = new Set(ids);
  const topology = worldData as unknown as Topology<{
    countries: GeometryCollection<{ name: string }>;
  }>;
  const countries = feature(
    topology,
    topology.objects.countries,
  ) as CountryFeature;

  const projection = geoEqualEarth().fitSize([width, height], countries);
  const pathGen = geoPath(projection).digits(1);

  const rest: string[] = [];
  const highlighted: MapShapes["highlighted"] = [];
  const pings: Ping[] = [];
  countries.features.forEach((f, i) => {
    const fid = String((f as { id?: string | number }).id ?? "");
    const d = pathGen(f);
    if (!HIGHLIGHTED.has(fid)) {
      if (d) rest.push(d);
      return;
    }
    if (d) highlighted.push({ key: `${fid}-${i}`, name: f.properties.name, d });
    const c = pathGen.centroid(f);
    if (!Number.isNaN(c[0])) {
      pings.push({ id: fid, name: f.properties.name, cx: c[0], cy: c[1] });
    }
  });

  const shapes = { rest: rest.join(""), highlighted, pings };
  SHAPES.set(cacheKey, shapes);
  return shapes;
}

export function WorldMap({
  width = 520,
  height = 300,
  highlightedCountryIds = DEFAULT_HIGHLIGHTED,
}: {
  width?: number;
  height?: number;
  highlightedCountryIds?: string[];
}) {
  const { rest, highlighted, pings } = shapesFor(width, height, highlightedCountryIds);

  // Crop Antarctica + lower void by rendering only the top ~80% of the
  // projection. All highlighted countries (incl. Australia at ~70%) stay
  // visible.
  const viewBoxHeight = Math.round(height * 0.78);

  return (
    <svg
      viewBox={`0 0 ${width} ${viewBoxHeight}`}
      className="relative h-auto w-full"
      role="img"
      aria-label="World map highlighting client countries"
    >
      <defs>
        <linearGradient
          id="map-highlight"
          x1="0"
          y1="0"
          x2={width}
          y2={height}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#343ED7" />
          <stop offset="0.5365" stopColor="#783DF5" />
          <stop offset="1" stopColor="#C535C9" />
        </linearGradient>
        <radialGradient id="ping-grad">
          <stop offset="0" stopColor="#C535C9" stopOpacity="0.8" />
          <stop offset="0.5" stopColor="#783DF5" stopOpacity="0.35" />
          <stop offset="1" stopColor="#343ED7" stopOpacity="0" />
        </radialGradient>
        <filter id="country-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <path d={rest} fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.08)" strokeWidth={0.3} />
      {highlighted.map((c) => (
        <path
          key={c.key}
          d={c.d}
          fill="url(#map-highlight)"
          stroke="rgba(255,255,255,0.45)"
          strokeWidth={0.5}
          filter="url(#country-glow)"
        >
          <title>{c.name}</title>
        </path>
      ))}

      {pings.map((p) => (
        <g key={`ping-${p.id}`} transform={`translate(${p.cx} ${p.cy})`}>
          <circle r="14" fill="url(#ping-grad)" className="animate-ping-slow" />
          <circle r="6" fill="url(#ping-grad)" opacity="0.55" />
          <circle r="2.4" fill="#fff" />
          <title>{p.name}</title>
        </g>
      ))}
    </svg>
  );
}
