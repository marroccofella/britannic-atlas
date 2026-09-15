"use client";

import type { CSSProperties } from "react";
import { useState } from "react";
import { manxAreas, manxPlaceCategories, type ManxArea, type ManxPlaceCategoryId } from "./data";

const defaultAreaId: ManxArea["id"] = "douglas";
const allCategoryIds = manxPlaceCategories.map((category) => category.id);
const markedAreas = manxAreas.filter((item): item is ManxArea & { readonly marker: { readonly x: number; readonly y: number } } => "marker" in item);

function encodedCoordinates(area: ManxArea) {
  return encodeURIComponent(`${area.latitude},${area.longitude}`);
}

function localityQuery(area: ManxArea) {
  return area.id === "island" ? "Isle of Man" : `${area.name}, Isle of Man`;
}

function googleEarthUrl(area: ManxArea) {
  return `https://earth.google.com/web/search/${encodeURIComponent(localityQuery(area))}`;
}

function satelliteUrl(area: ManxArea) {
  return `https://www.google.com/maps/@?api=1&map_action=map&center=${encodedCoordinates(area)}&zoom=${area.zoom}&basemap=satellite`;
}

function streetViewUrl(area: ManxArea) {
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${encodedCoordinates(area)}&fov=85`;
}

function formatCoordinate(value: number, positiveHemisphere: string, negativeHemisphere: string) {
  return `${Math.abs(value).toFixed(4)}°${value >= 0 ? positiveHemisphere : negativeHemisphere}`;
}

function categoryUrl(area: ManxArea, query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${query} in ${localityQuery(area)}`)}`;
}

export default function EarthClient() {
  const [areaId, setAreaId] = useState(defaultAreaId);
  const [activeCategories, setActiveCategories] = useState<Set<ManxPlaceCategoryId>>(() => new Set(allCategoryIds));
  const defaultArea = manxAreas.find((item) => item.id === defaultAreaId) ?? manxAreas[0];
  const area = manxAreas.find((item) => item.id === areaId) ?? defaultArea;

  const toggleCategory = (id: ManxPlaceCategoryId) => setActiveCategories((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  return <section className="manx-earth-workspace" aria-label="Manx locality viewer">
    <aside className="manx-area-index" id="manx-localities">
      <span>CHOOSE LOCALITY</span>
      <div>{manxAreas.map((item, index) => <button type="button" aria-pressed={item.id === area.id} className={item.id === area.id ? "selected" : ""} onClick={() => setAreaId(item.id)} key={item.id}><small>{String(index + 1).padStart(2, "0")}</small><strong>{item.name}</strong><span>{item.district}</span></button>)}</div>
    </aside>

    <div className="manx-earth-stage">
      <header><div><span>SELECTED VIEWPOINT</span><div aria-live="polite" aria-atomic="true"><h2>{area.name}</h2><p>{area.note}</p></div></div><dl><div><dt>LAT</dt><dd>{formatCoordinate(area.latitude, "N", "S")}</dd></div><div><dt>LON</dt><dd>{formatCoordinate(area.longitude, "E", "W")}</dd></div></dl></header>

      <div className="manx-island-map" aria-label="Diagrammatic Isle of Man locality selector">
        <div className="manx-map-grid" aria-hidden="true" />
        <div className="manx-island-shape" aria-hidden="true"><span>ELLAN</span><span>VANNIN</span></div>
        {markedAreas.map((item) => <button type="button" aria-pressed={item.id === area.id} title={`Select ${item.name}`} className={item.id === area.id ? "selected" : ""} style={{ "--marker-x": `${item.marker.x}%`, "--marker-y": `${item.marker.y}%` } as CSSProperties} onClick={() => setAreaId(item.id)} aria-label={`Select ${item.name}`} key={item.id}><i /><span>{item.name}</span></button>)}
        <div className="manx-map-scale"><span>N</span><i /><small>DIAGRAMMATIC ORIENTATION</small></div>
      </div>

      <div className="manx-view-actions">
        <a href={googleEarthUrl(area)} target="_blank" rel="noopener noreferrer"><span>01</span><strong>Google Earth</strong><p>Open the locality in Google Earth’s globe and 3D environment.</p><b>↗</b></a>
        <a href={satelliteUrl(area)} target="_blank" rel="noopener noreferrer"><span>02</span><strong>Satellite map</strong><p>Open live Google satellite imagery centred on this viewpoint.</p><b>↗</b></a>
        {area.streetView ? <a href={streetViewUrl(area)} target="_blank" rel="noopener noreferrer"><span>03</span><strong>Street View</strong><p>Open the closest panorama currently available to Google.</p><b>↗</b></a> : <a className="unavailable" href="#manx-localities"><span>03</span><strong>Choose a locality</strong><p>Street View is available after choosing a named town or village.</p><b>↑</b></a>}
      </div>

      <section className="manx-place-filters">
        <header><div><span>PLACES NEAR {area.name.toUpperCase()}</span><h3>What should the map reveal?</h3></div><button type="button" onClick={() => setActiveCategories(activeCategories.size ? new Set<ManxPlaceCategoryId>() : new Set(allCategoryIds))}>{activeCategories.size ? "CLEAR ALL" : "SHOW ALL"}</button></header>
        <div className="manx-filter-toggles">{manxPlaceCategories.map((category) => {
          const active = activeCategories.has(category.id);
          return <button type="button" role="switch" aria-checked={active} className={active ? "active" : ""} onClick={() => toggleCategory(category.id)} key={category.id}><span>{category.code}</span><strong>{category.label}</strong><i>{active ? "ON" : "OFF"}</i></button>;
        })}</div>
        <div className="manx-filter-results">{manxPlaceCategories.filter((category) => activeCategories.has(category.id)).map((category) => <a href={categoryUrl(area, category.query)} target="_blank" rel="noopener noreferrer" key={category.id}><span>{category.code}</span><strong>{category.label} near {area.name}</strong><p>Open current Google Maps results for this category.</p><b>↗</b></a>)}{!activeCategories.size && <p className="manx-filter-empty">Choose one or more place categories to create nearby searches.</p>}</div>
      </section>
    </div>
  </section>;
}
