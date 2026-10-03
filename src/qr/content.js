// Lane QR: what a code holds. Like any QR generator, a code can hold a link,
// plain text, a Wi-Fi network, a contact card, an email, a phone number, a
// text message or a place; each has a small form, and this file turns the
// form into the standard text that phones understand. Everything stays on
// the device.
//
// The formats (as phone cameras read them):
//   Wi-Fi     WIFI:T:WPA;S:<name>;P:<password>;H:true;;   (\ ; , : " escaped with \)
//   Contact   MECARD:N:<name>;TEL:<phone>;EMAIL:<email>;ORG:<org>;URL:<url>;;
//   Email     mailto:<to>?subject=…&body=…               (percent-encoded)
//   Phone     tel:<number>
//   Message   SMSTO:<number>:<message>
//   Place     geo:<latitude>,<longitude>

export const KINDS = [
  { id: "link", label: "Link", fields: [{ key: "url", label: "Link", placeholder: "https://…" }] },
  { id: "text", label: "Text", fields: [{ key: "text", label: "Text", multiline: true }] },
  {
    id: "wifi",
    label: "Wi-Fi network",
    fields: [
      { key: "ssid", label: "Network name" },
      { key: "password", label: "Password", secret: true },
      {
        key: "security",
        label: "Security",
        choices: [
          { id: "WPA", label: "WPA/WPA2/WPA3" },
          { id: "WEP", label: "WEP" },
          { id: "nopass", label: "None" },
        ],
      },
      { key: "hidden", label: "Hidden network", check: true },
    ],
  },
  {
    id: "contact",
    label: "Contact card",
    fields: [
      { key: "name", label: "Name" },
      { key: "phone", label: "Phone" },
      { key: "email", label: "Email" },
      { key: "org", label: "Organization" },
      { key: "url", label: "Website" },
    ],
  },
  {
    id: "email",
    label: "Email",
    fields: [
      { key: "to", label: "To" },
      { key: "subject", label: "Subject" },
      { key: "body", label: "Message", multiline: true },
    ],
  },
  { id: "phone", label: "Phone", fields: [{ key: "number", label: "Phone number" }] },
  {
    id: "sms",
    label: "Text message",
    fields: [
      { key: "number", label: "Phone number" },
      { key: "message", label: "Message", multiline: true },
    ],
  },
  {
    id: "geo",
    label: "Place",
    fields: [
      { key: "lat", label: "Latitude", placeholder: "40.6892" },
      { key: "lon", label: "Longitude", placeholder: "-74.0445" },
    ],
  },
];

export const kindById = (id) => KINDS.find((k) => k.id === id) || KINDS[0];

// Wi-Fi and MECARD fields escape \ ; , : and " with a backslash.
const esc = (s) => String(s ?? "").replace(/([\\;,:"])/g, "\\$1");
const trim = (s) => String(s ?? "").trim();
const phone = (s) => trim(s).replace(/[^\d+*#,;]/g, "");

// The text a code holds, from its kind and its form's fields.
export function contentText(kind, f = {}) {
  switch (kind) {
    case "wifi": {
      const t = f.security === "WEP" || f.security === "nopass" ? f.security : "WPA";
      const p = t === "nopass" ? "" : `P:${esc(f.password)};`;
      return `WIFI:T:${t};S:${esc(f.ssid)};${p}${f.hidden ? "H:true;" : ""};`;
    }
    case "contact": {
      const parts = [["N", f.name], ["TEL", phone(f.phone)], ["EMAIL", f.email], ["ORG", f.org], ["URL", f.url]]; // prettier-ignore
      return `MECARD:${parts.filter(([, v]) => trim(v)).map(([k, v]) => `${k}:${esc(trim(v))};`).join("")};`; // prettier-ignore
    }
    case "email": {
      const q = [["subject", f.subject], ["body", f.body]].filter(([, v]) => trim(v)); // prettier-ignore
      const qs = q.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
      return `mailto:${trim(f.to)}${qs ? `?${qs}` : ""}`;
    }
    case "phone":
      return `tel:${phone(f.number)}`;
    case "sms":
      return `SMSTO:${phone(f.number)}:${f.message ?? ""}`;
    case "geo": {
      const n = (v, lim) => {
        const x = Number(String(v ?? "").replace(",", "."));
        return Number.isFinite(x) && Math.abs(x) <= lim ? String(Math.round(x * 1e6) / 1e6) : "0";
      };
      return `geo:${n(f.lat, 90)},${n(f.lon, 180)}`;
    }
    case "text":
      return String(f.text ?? "");
    default:
      return trim(f.url);
  }
}

// The fields that may go into the toy's options (so into #s= links and
// saved scenes): all but the Wi-Fi password.
export function shareableFields(kind, f = {}) {
  const out = { ...f };
  for (const fd of kindById(kind).fields) if (fd.secret) delete out[fd.key];
  return out;
}
