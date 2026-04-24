import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import PinModal from "./PinModal";
import Drawer from "./Drawer";
import ToolbarPanel from "./ToolbarPanel";
import HamburgerMenu from "./HamburgerMenu";

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const PIN_CLICK_MIN_ZOOM = 6;
const PIN_CLICK_SPEED = 4;
const VIEW_KEY = (mapId) => `globescour_view_${mapId}`;
const SEARCH_KEY = (mapId) => `globescour_search_${mapId}`;
const DISCOVER_KEY = (mapId) => `globescour_discover_${mapId}`;

async function reverseGeocode(lng, lat) {
  try {
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=place,locality,poi&limit=1&access_token=${TOKEN}`,
    );
    const data = await res.json();
    const feature = data.features?.[0];
    if (!feature) return null;
    return {
      name: feature.text,
      placeName: feature.place_name,
      context: feature.context ?? [],
    };
  } catch {
    return null;
  }
}

// "mapbox" — better ranking, misses small/obscure places
// "nominatim" — OSM-based, better coverage of surf spots and small communities
const SEARCH_PLATFORM = "nominatim";

async function forwardGeocode(query) {
  try {
    if (SEARCH_PLATFORM === "nominatim") {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`,
        { headers: { "User-Agent": "GlobeScour/1.0" } },
      );
      const data = await res.json();
      return data.map((f, i) => {
        const a = f.address ?? {};
        const region = a.state ?? a.county ?? null;
        const country = a.country ?? null;
        const context = [
          region && { id: "region.0", text: region },
          country && { id: "country.0", text: country },
        ].filter(Boolean);
        return {
          _sid: `suggest_${i}_${Date.now()}`,
          name: f.name || f.display_name.split(",")[0],
          placeName: f.display_name,
          lat: parseFloat(f.lat),
          lng: parseFloat(f.lon),
          context,
          isSuggestion: true,
        };
      });
    } else {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?types=place,locality,region,poi&limit=5&access_token=${TOKEN}`,
      );
      const data = await res.json();
      return (data.features ?? []).map((f, i) => ({
        _sid: `suggest_${i}_${Date.now()}`,
        name: f.text,
        placeName: f.place_name,
        lat: f.center[1],
        lng: f.center[0],
        context: f.context ?? [],
        isSuggestion: true,
      }));
    }
  } catch {
    return [];
  }
}

function makeSuggestionEl() {
  const el = document.createElement("div");
  el.style.cssText = `
    width: 14px; height: 14px;
    background: #ef4444; border-radius: 50%;
    border: 2px solid #fff;
    cursor: pointer;
    box-shadow: 0 0 6px rgba(0,0,0,0.4);
  `;
  return el;
}

export default function Globe({ user, map, onMapChange, onExit }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const pinsRef = useRef([]);
  const suggestionMarkersRef = useRef({});
  const discoverMarkersRef = useRef({});

  const [pins, setPins] = useState([]);
  const [modal, setModal] = useState(null);
  const [drawer, setDrawer] = useState(null);
  const [criteria, setCriteria] = useState(
    map.criteria ?? { items: [], vision: "" },
  );
  const [suggestions, setSuggestions] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(SEARCH_KEY(map.id)) ?? "[]");
    } catch {
      return [];
    }
  });
  const [toolbarMode, setToolbarMode] = useState("browse");
  const [discoverSpots, setDiscoverSpots] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(DISCOVER_KEY(map.id)) ?? "[]");
    } catch {
      return [];
    }
  });
  const [discoverRegion, setDiscoverRegion] = useState(null);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key !== "Escape") return;
      if (modal) {
        setModal(null);
        return;
      }
      if (drawer) {
        setDrawer(null);
        return;
      }
      if (toolbarMode !== "browse") {
        if (toolbarMode === "search") handleSearchTabClose();
        if (toolbarMode === "discover") handleDiscoverTabClose();
        setToolbarMode("browse");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modal, drawer, toolbarMode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!TOKEN) {
      console.error("VITE_MAPBOX_TOKEN is not set");
      return;
    }

    mapboxgl.accessToken = TOKEN;
    const saved = JSON.parse(localStorage.getItem(VIEW_KEY(map.id)) ?? "null");
    const m = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      projection: "globe",
      zoom: saved?.zoom ?? 1.5,
      center: saved ? [saved.lng, saved.lat] : [0, 20],
    });

    m.addControl(new mapboxgl.NavigationControl());

    m.on("moveend", () => {
      const { lng, lat } = m.getCenter();
      localStorage.setItem(
        VIEW_KEY(map.id),
        JSON.stringify({ lng, lat, zoom: m.getZoom() }),
      );
    });

    m.on("click", async (e) => {
      const { lat, lng } = e.lngLat;
      const geocode = await reverseGeocode(lng, lat);
      setModal({
        lat,
        lng,
        suggestedName: geocode?.name ?? null,
        locationType: geocode ? "named" : "coordinate",
        geocodeContext: geocode,
      });
    });

    mapRef.current = m;
    return () => m.remove();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch(`/api/locations?map_id=${map.id}`)
      .then((r) => r.json())
      .then(setPins);
  }, [map.id]);

  useEffect(() => {
    pinsRef.current = pins;
  }, [pins]);

  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;

    pins.forEach((pin) => {
      if (markersRef.current[pin.id]) return;

      const el = document.createElement("div");
      el.style.cssText = `
        width: 14px; height: 14px;
        background: #3b82f6; border-radius: 50%;
        border: 2px solid #fff;
        cursor: pointer;
        box-shadow: 0 0 6px rgba(0,0,0,0.4);
      `;
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const latest = pinsRef.current.find((p) => p.id === pin.id) ?? pin;
        mapRef.current.flyTo({
          center: [pin.lng, pin.lat],
          zoom: Math.max(mapRef.current.getZoom(), PIN_CLICK_MIN_ZOOM),
          speed: PIN_CLICK_SPEED,
        });
        setDrawer(latest);
      });

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([pin.lng, pin.lat])
        .addTo(m);

      markersRef.current[pin.id] = marker;
    });
  }, [pins]);

  async function handleSavePin(name) {
    const res = await fetch("/api/locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        lat: modal.lat,
        lng: modal.lng,
        created_by: user,
        map_id: map.id,
        location_type: modal.locationType,
        geocode_context: modal.geocodeContext ?? null,
      }),
    });
    const pin = await res.json();
    setPins((prev) => [...prev, pin]);
    setModal(null);
  }

  function handleCriteriaChange(updated) {
    setCriteria(updated);
    onMapChange({ ...map, criteria: updated });
  }

  async function handleSearch(query) {
    Object.values(suggestionMarkersRef.current).forEach((m) => m.remove());
    suggestionMarkersRef.current = {};

    const results = await forwardGeocode(query);
    setSuggestions(results);
    localStorage.setItem(SEARCH_KEY(map.id), JSON.stringify(results));

    const m = mapRef.current;
    if (!m) return;
    results.forEach((sug) => {
      const el = makeSuggestionEl();
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        m.flyTo({
          center: [sug.lng, sug.lat],
          zoom: Math.max(mapRef.current.getZoom(), PIN_CLICK_MIN_ZOOM),
          speed: PIN_CLICK_SPEED,
        });
        setDrawer(sug);
      });
      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([sug.lng, sug.lat])
        .addTo(m);
      suggestionMarkersRef.current[sug._sid] = marker;
    });

    if (results.length > 0) {
      const lngs = results.map((s) => s.lng);
      const lats = results.map((s) => s.lat);
      m.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        { maxZoom: 6, padding: 60, speed: 3 },
      );
    }
  }

  function handleSearchTabClose() {
    Object.values(suggestionMarkersRef.current).forEach((marker) => {
      marker.getElement().style.display = "none";
    });
  }

  function handleSearchTabOpen() {
    const m = mapRef.current;
    if (!m) return;
    suggestions.forEach((sug) => {
      if (suggestionMarkersRef.current[sug._sid]) {
        suggestionMarkersRef.current[sug._sid].getElement().style.display = "";
      } else {
        const el = makeSuggestionEl();
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          if (m)
            m.flyTo({
              center: [sug.lng, sug.lat],
              zoom: Math.max(m.getZoom(), 6),
              speed: 3,
            });
          setDrawer(sug);
        });
        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([sug.lng, sug.lat])
          .addTo(m);
        suggestionMarkersRef.current[sug._sid] = marker;
      }
    });
  }

  async function handleDiscover(params) {
    Object.values(discoverMarkersRef.current).forEach((m) => m.remove());
    discoverMarkersRef.current = {};

    const res = await fetch("/api/discover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: params.mode,
        region: params.region,
        instructions: params.instructions,
        criteria: criteria.items,
        vision: criteria.vision,
      }),
    });
    const data = await res.json();

    if (data.mode === "regions") {
      setDiscoverRegion({ summary: data.summary });
      setDiscoverSpots([]);
      localStorage.setItem(DISCOVER_KEY(map.id), JSON.stringify([]));
      return;
    }

    setDiscoverRegion(null);
    const ts = Date.now();
    const found = (data.found ?? []).map((s, i) => ({
      ...s,
      _sid: `discover_${i}_${ts}`,
    }));
    const notFound = (data.not_found ?? []).map((name, i) => ({
      name,
      _notFound: true,
      _sid: `discover_nf_${i}_${ts}`,
    }));
    const all = [...found, ...notFound];
    setDiscoverSpots(all);
    localStorage.setItem(DISCOVER_KEY(map.id), JSON.stringify(all));

    const m = mapRef.current;
    if (!m) return;
    found.forEach((sug) => {
      const el = makeSuggestionEl();
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        mapRef.current.flyTo({
          center: [sug.lng, sug.lat],
          zoom: Math.max(mapRef.current.getZoom(), PIN_CLICK_MIN_ZOOM),
          speed: PIN_CLICK_SPEED,
        });
        setDrawer(sug);
      });
      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([sug.lng, sug.lat])
        .addTo(m);
      discoverMarkersRef.current[sug._sid] = marker;
    });

    if (found.length > 0) {
      const lngs = found.map((s) => s.lng);
      const lats = found.map((s) => s.lat);
      m.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        { maxZoom: 6, padding: 60, speed: 3 },
      );
    }
  }

  function handleDiscoverTabClose() {
    Object.values(discoverMarkersRef.current).forEach((marker) => {
      marker.getElement().style.display = "none";
    });
  }

  function handleDiscoverTabOpen() {
    const m = mapRef.current;
    if (!m) return;
    discoverSpots
      .filter((s) => !s._notFound)
      .forEach((sug) => {
        if (discoverMarkersRef.current[sug._sid]) {
          discoverMarkersRef.current[sug._sid].getElement().style.display = "";
        } else {
          const el = makeSuggestionEl();
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            mapRef.current.flyTo({
              center: [sug.lng, sug.lat],
              zoom: Math.max(mapRef.current.getZoom(), PIN_CLICK_MIN_ZOOM),
              speed: PIN_CLICK_SPEED,
            });
            setDrawer(sug);
          });
          const marker = new mapboxgl.Marker({ element: el })
            .setLngLat([sug.lng, sug.lat])
            .addTo(m);
          discoverMarkersRef.current[sug._sid] = marker;
        }
      });
  }

  function handleSuggestionClick(sug) {
    const m = mapRef.current;
    if (m)
      m.flyTo({
        center: [sug.lng, sug.lat],
        zoom: Math.max(mapRef.current.getZoom(), PIN_CLICK_MIN_ZOOM),
        speed: PIN_CLICK_SPEED,
      });
  }

  async function handleSaveSuggestion(suggestion, name, opts = {}) {
    const res = await fetch("/api/locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        lat: suggestion.lat,
        lng: suggestion.lng,
        created_by: user,
        map_id: map.id,
        location_type: "named",
        geocode_context: {
          name: suggestion.name,
          placeName: suggestion.placeName,
          context: suggestion.context,
        },
      }),
    });
    const pin = await res.json();

    if (suggestionMarkersRef.current[suggestion._sid]) {
      suggestionMarkersRef.current[suggestion._sid].remove();
      delete suggestionMarkersRef.current[suggestion._sid];
      const updatedSuggestions = suggestions.filter(
        (s) => s._sid !== suggestion._sid,
      );
      setSuggestions(updatedSuggestions);
      localStorage.setItem(SEARCH_KEY(map.id), JSON.stringify(updatedSuggestions));
    } else if (discoverMarkersRef.current[suggestion._sid]) {
      discoverMarkersRef.current[suggestion._sid].remove();
      delete discoverMarkersRef.current[suggestion._sid];
      const updatedDiscover = discoverSpots.filter(
        (s) => s._sid !== suggestion._sid,
      );
      setDiscoverSpots(updatedDiscover);
      localStorage.setItem(DISCOVER_KEY(map.id), JSON.stringify(updatedDiscover));
    }

    if (opts.research) {
      const pendingPin = { ...pin, research_status: "pending" };
      setPins((prev) => [...prev, pendingPin]);
      setDrawer(pendingPin);
      await fetch(`/api/locations/${pin.id}/research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deep: opts.deep ?? false }),
      });
    } else {
      setPins((prev) => [...prev, pin]);
      setDrawer(pin);
    }
  }

  async function handleRenamePin(id, name) {
    await fetch(`/api/locations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setPins((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
    setDrawer((prev) => (prev && prev.id === id ? { ...prev, name } : prev));
  }

  return (
    <>
      <div ref={containerRef} style={{ width: "100%", height: "100vh" }} />
      <HamburgerMenu onChooseMap={onExit} />
      <ToolbarPanel
        mapId={map.id}
        criteria={criteria}
        onCriteriaChange={handleCriteriaChange}
        mode={toolbarMode}
        onModeChange={(next) => {
          if (toolbarMode === "search" && next !== "search")
            handleSearchTabClose();
          if (next === "search" && toolbarMode !== "search")
            handleSearchTabOpen();
          if (toolbarMode === "discover" && next !== "discover")
            handleDiscoverTabClose();
          if (next === "discover" && toolbarMode !== "discover")
            handleDiscoverTabOpen();
          setToolbarMode(next);
        }}
        suggestions={suggestions}
        activeSuggestionId={
          drawer?.isSuggestion && suggestions.some((s) => s._sid === drawer._sid)
            ? drawer._sid
            : null
        }
        onSearch={handleSearch}
        onSuggestionClick={handleSuggestionClick}
        onSearchTabClose={handleSearchTabClose}
        onSearchTabOpen={handleSearchTabOpen}
        discoverSpots={discoverSpots}
        discoverRegion={discoverRegion}
        activeDiscoverSpotId={
          drawer?.isSuggestion && discoverSpots.some((s) => s._sid === drawer._sid)
            ? drawer._sid
            : null
        }
        onDiscover={handleDiscover}
        onDiscoverSuggestionClick={(sug) => {
          const m = mapRef.current;
          if (m)
            m.flyTo({
              center: [sug.lng, sug.lat],
              zoom: Math.max(mapRef.current.getZoom(), PIN_CLICK_MIN_ZOOM),
              speed: PIN_CLICK_SPEED,
            });
        }}
      />
      {modal && (
        <PinModal
          suggestedName={modal.suggestedName}
          onSave={handleSavePin}
          onCancel={() => setModal(null)}
        />
      )}
      {drawer && (
        <Drawer
          key={drawer.id ?? drawer._sid}
          pin={drawer}
          criteria={criteria}
          onClose={() => setDrawer(null)}
          onRename={handleRenamePin}
          onSaveSuggestion={handleSaveSuggestion}
          onStatusChange={(id, newStatus) => {
            setPins((prev) =>
              prev.map((p) =>
                p.id === id ? { ...p, research_status: newStatus } : p,
              ),
            );
          }}
          onResearchDone={(result) => {
            const updated = {
              ...drawer,
              research: result,
              research_status: "done",
            };
            setPins((prev) =>
              prev.map((p) => (p.id === drawer.id ? updated : p)),
            );
            setDrawer(updated);
          }}
          onDelete={(id) => {
            markersRef.current[id]?.remove();
            delete markersRef.current[id];
            setPins((prev) => prev.filter((p) => p.id !== id));
            setDrawer(null);
          }}
        />
      )}
    </>
  );
}
