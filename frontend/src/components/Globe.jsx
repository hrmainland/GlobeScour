import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import PinModal from "./PinModal";
import Drawer from "./Drawer";
import ToolbarPanel from "./ToolbarPanel";
const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

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

export default function Globe({ user, map, onMapChange }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const pinsRef = useRef([]);
  const [pins, setPins] = useState([]);
  const [modal, setModal] = useState(null);
  const [drawer, setDrawer] = useState(null);
  const [criteria, setCriteria] = useState(
    map.criteria ?? { items: [], vision: "" },
  );
  useEffect(() => {
    if (!TOKEN) {
      console.error("VITE_MAPBOX_TOKEN is not set");
      return;
    }

    mapboxgl.accessToken = TOKEN;
    const m = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      projection: "globe",
      zoom: 1.5,
      center: [0, 20],
    });

    m.addControl(new mapboxgl.NavigationControl());

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
  }, []);

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
        setDrawer(latest);
      });

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([pin.lng, pin.lat])
        .addTo(m);

      markersRef.current[pin.id] = marker;
    });
  }, [pins]);

  async function handleSavePin(name) {
    console.log("[pin save] geocode_context:", JSON.stringify(modal.geocodeContext, null, 2))
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

  return (
    <>
      <div ref={containerRef} style={{ width: "100%", height: "100vh" }} />
      <ToolbarPanel
        mapId={map.id}
        criteria={criteria}
        onCriteriaChange={handleCriteriaChange}
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
          pin={drawer}
          criteria={criteria}
          onClose={() => setDrawer(null)}
          onStatusChange={(id, newStatus) => {
            setPins((prev) => prev.map((p) => p.id === id ? { ...p, research_status: newStatus } : p))
          }}
          onResearchDone={(result) => {
            const updated = { ...drawer, research: result, research_status: "done" }
            setPins((prev) => prev.map((p) => (p.id === drawer.id ? updated : p)))
            setDrawer(updated)
          }}
          onDelete={(id) => {
            markersRef.current[id]?.remove()
            delete markersRef.current[id]
            setPins((prev) => prev.filter((p) => p.id !== id))
            setDrawer(null)
          }}
        />
      )}
    </>
  );
}
