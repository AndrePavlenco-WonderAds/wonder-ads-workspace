import { feature } from "topojson-client";
import { geoEqualEarth, geoPath } from "d3-geo";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { FeatureCollection, Geometry } from "geojson";
import worldData from "@/lib/world-110m.json";

// Numeric ISO 3166-1 codes (zero-padded as strings) for highlighted countries.
// Canada · Portugal · Spain · UAE · Australia.
const HIGHLIGHTED = new Set(["124", "620", "724", "784", "036", "36"]);

type CountryFeature = FeatureCollection<Geometry, { name: string }>;

export function WorldMap({
  width = 520,
  height = 280,
}: {
  width?: number;
  height?: number;
}) {
  const topology = worldData as unknown as Topology<{
    countries: GeometryCollection<{ name: string }>;
  }>;
  const countries = feature(
    topology,
    topology.objects.countries,
  ) as CountryFeature;

  const projection = geoEqualEarth().fitSize([width, height], countries);
  const pathGen = geoPath(projection);

  type Ping = { id: string; name: string; cx: number; cy: number };
  const pings: Ping[] = [];
  for (const f of countries.features) {
    const fid = String((f as { id?: string | number }).id ?? "");
    if (HIGHLIGHTED.has(fid)) {
      const c = pathGen.centroid(f);
      if (!Number.isNaN(c[0])) {
        pings.push({ id: fid, name: f.properties.name, cx: c[0], cy: c[1] });
      }
    }
  }

  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 rounded-2xl opacity-40 blur-3xl"
        style={{ background: "var(--brand-gradient)" }}
      />
      <svg
        viewBox={`0 0 ${width} ${height}`}
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

        {countries.features.map((f, i) => {
          const fid = String((f as { id?: string | number }).id ?? "");
          const isHighlighted = HIGHLIGHTED.has(fid);
          const d = pathGen(f);
          if (!d) return null;
          return (
            <path
              key={`${fid}-${i}`}
              d={d}
              fill={isHighlighted ? "url(#map-highlight)" : "rgba(255,255,255,0.05)"}
              stroke={
                isHighlighted
                  ? "rgba(255,255,255,0.45)"
                  : "rgba(255,255,255,0.08)"
              }
              strokeWidth={isHighlighted ? 0.5 : 0.3}
              filter={isHighlighted ? "url(#country-glow)" : undefined}
            >
              {isHighlighted && <title>{f.properties.name}</title>}
            </path>
          );
        })}

        {pings.map((p) => (
          <g key={`ping-${p.id}`} transform={`translate(${p.cx} ${p.cy})`}>
            <circle r="14" fill="url(#ping-grad)" className="animate-ping-slow" />
            <circle r="6" fill="url(#ping-grad)" opacity="0.55" />
            <circle r="2.4" fill="#fff" />
            <title>{p.name}</title>
          </g>
        ))}
      </svg>
    </div>
  );
}
