"use client";
import { Fragment, useEffect, useState } from "react";
import { GRAHA_NAMES, SIGNS, VARGA_INFO, formatDms, type Body, type Varga } from "@/lib/astro/client";

interface Planet { body: Body; sign: number; degree: number; vargaSign: number; house: number; retrograde: boolean; combust: boolean; vargottama: boolean; dignity: string | null; karaka: string | null; nakshatra: { name: string; pada: number } }
interface Period { lord: Body; start: string; end: string }
interface ChartData {
  profile: { id: string; name: string; timeKnown: boolean };
  label: string;
  varga: Varga;
  ascendant: { sign: number; degree: number; vargaSign: number; nakshatra: { name: string; pada: number } };
  planets: Planet[];
  yogas: { name: string; reason: string }[];
  mangalDosha: { present: boolean; from: string[] };
  dasha: { maha: Period; antar: Period; pratyantar: Period } | null;
  mahadashas: (Period & { antars?: Period[] })[];
  transits: { body: Body; sign: number; degree: number; retrograde: boolean; houseFromMoon: number; houseFromAscendant: number; nakshatra: { name: string } }[];
  sadeSati: string | null;
}

// South Indian layout: signs occupy fixed cells of a 4x4 grid.
const CELLS: [number, number, number][] = [
  [11, 0, 0], [0, 1, 0], [1, 2, 0], [2, 3, 0],
  [10, 0, 1], [3, 3, 1],
  [9, 0, 2], [4, 3, 2],
  [8, 0, 3], [7, 1, 3], [6, 2, 3], [5, 3, 3],
];

const ru = (l: string) => l === "ru";
const nm = (b: Body, l: string) => (ru(l) ? GRAHA_NAMES[b].ru : GRAHA_NAMES[b].en);
const sg = (s: number, l: string) => (ru(l) ? SIGNS[s].ru : SIGNS[s].en);
const day = (s: string) => s.slice(0, 10);
const DIGNITY_RU: Record<string, string> = { exalted: "экзальтация", moolatrikona: "мулатрикона", own: "свой знак", friend: "у друга", neutral: "нейтрально", enemy: "у врага", debilitated: "падение" };
const dig = (d: string, l: string) => (ru(l) ? DIGNITY_RU[d] ?? d : d);

function SouthIndianChart({ data, locale }: { data: ChartData; locale: string }) {
  const size = 100;
  const bySign = new Map<number, string[]>();
  for (const p of data.planets) {
    if (["uranus", "neptune", "pluto"].includes(p.body)) continue;
    const s = data.varga === "D1" ? p.sign : p.vargaSign;
    const label = GRAHA_NAMES[p.body].abbr + (data.varga === "D1" ? ` ${Math.floor(p.degree)}°` : "") + (p.retrograde && p.body !== "rahu" && p.body !== "ketu" ? " R" : "");
    bySign.set(s, [...(bySign.get(s) ?? []), label]);
  }
  const asc = data.varga === "D1" ? data.ascendant.sign : data.ascendant.vargaSign;
  return (
    <svg className="si-chart" viewBox={`0 0 ${size * 4} ${size * 4}`} role="img" aria-label="Birth chart">
      {CELLS.map(([sign, cx, cy]) => {
        const items = bySign.get(sign) ?? [];
        return (
          <g key={sign}>
            <rect x={cx * size} y={cy * size} width={size} height={size} className={sign === asc ? "asc" : undefined} />
            <text className="sign" x={cx * size + 6} y={cy * size + 14}>{sg(sign, locale)}{sign === asc ? (ru(locale) ? " · Асц" : " · Asc") : ""}</text>
            {items.map((it, i) => (
              <text key={i} x={cx * size + 8} y={cy * size + 34 + i * 16}>{it}</text>
            ))}
          </g>
        );
      })}
      <text className="center" x={size * 2} y={size * 2 - 6} textAnchor="middle">{data.varga}</text>
      <text className="sign" x={size * 2} y={size * 2 + 14} textAnchor="middle">{VARGA_INFO[data.varga].en}</text>
    </svg>
  );
}

export function ChartView({ locale, people }: { locale: string; people: { id: string; name: string }[] }) {
  const [profileId, setProfileId] = useState(people[0]?.id ?? "");
  const [varga, setVarga] = useState<Varga>("D1");
  const [data, setData] = useState<ChartData | null>(null);
  const [openMaha, setOpenMaha] = useState<number | null>(null);

  useEffect(() => {
    const q = new URLSearchParams({ varga, ...(profileId ? { profileId } : {}) });
    fetch(`/api/chart?${q}`).then(async (r) => r.ok && setData(await r.json()));
  }, [profileId, varga]);

  if (!data) return <p className="muted">…</p>;
  const R = ru(locale);
  return (
    <div className="chart-layout">
      <div className="stack">
        {people.length > 1 && (
          <select value={profileId} onChange={(e) => setProfileId(e.target.value)}>
            {people.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
          </select>
        )}
        <div className="tabs">
          {(Object.keys(VARGA_INFO) as Varga[]).map((v) => (
            <button key={v} className={v === varga ? "active" : undefined} onClick={() => setVarga(v)} title={VARGA_INFO[v].area}>{v}</button>
          ))}
        </div>
        <SouthIndianChart data={data} locale={locale} />
        <p className="muted small">{data.label}</p>
        {!data.profile.timeKnown && <p className="error small">{R ? "Время рождения неизвестно: асцендент и дома приблизительны." : "Birth time unknown: ascendant and houses are approximate."}</p>}
      </div>
      <div className="stack">
        <div className="card scroll-x">
          <h2>{R ? "Планеты" : "Planets"}</h2>
          <table>
            <thead><tr><th>{R ? "Планета" : "Planet"}</th><th>{R ? "Знак" : "Sign"}</th><th>°</th><th>{R ? "Дом" : "House"}</th><th>{R ? "Накшатра" : "Nakshatra"}</th><th>{R ? "Статус" : "Status"}</th></tr></thead>
            <tbody>
              <tr><td>{R ? "Асцендент" : "Ascendant"}</td><td>{sg(data.ascendant.sign, locale)}</td><td>{formatDms(data.ascendant.degree)}</td><td>1</td><td>{data.ascendant.nakshatra.name} {data.ascendant.nakshatra.pada}</td><td /></tr>
              {data.planets.map((p) => (
                <tr key={p.body}>
                  <td>{nm(p.body, locale)}</td><td>{sg(p.sign, locale)}</td><td>{formatDms(p.degree)}</td><td>{p.house}</td><td>{p.nakshatra.name} {p.nakshatra.pada}</td>
                  <td>
                    {p.karaka && <span className="pill">{p.karaka}</span>}
                    {p.dignity && <span className="pill">{dig(p.dignity, locale)}</span>}
                    {p.retrograde && p.body !== "rahu" && p.body !== "ketu" && <span className="pill">R</span>}
                    {p.combust && <span className="pill">{R ? "сожжена" : "combust"}</span>}
                    {p.vargottama && <span className="pill">vargottama</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.dasha && (
          <div className="card">
            <h2>{R ? "Вимшоттари-даша" : "Vimshottari dasha"}</h2>
            <p>
              <strong>{nm(data.dasha.maha.lord, locale)}</strong> / {nm(data.dasha.antar.lord, locale)} / {nm(data.dasha.pratyantar.lord, locale)}{" "}
              <span className="muted small">({R ? "до" : "until"} {day(data.dasha.pratyantar.end)})</span>
            </p>
            <table>
              <tbody>
                {data.mahadashas.map((m, i) => (
                  <Fragment key={`m${i}`}>
                    <tr onClick={() => setOpenMaha(openMaha === i ? null : i)} style={{ cursor: "pointer" }}>
                      <td>{openMaha === i ? "▾" : "▸"} {nm(m.lord, locale)}</td><td>{day(m.start)}</td><td>{day(m.end)}</td>
                    </tr>
                    {openMaha === i && m.antars?.map((a, j) => (
                      <tr key={`a${i}-${j}`} className="muted"><td style={{ paddingLeft: 28 }}>{nm(a.lord, locale)}</td><td>{day(a.start)}</td><td>{day(a.end)}</td></tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="card">
          <h2>{R ? "Йоги" : "Yogas"}</h2>
          {data.yogas.length ? data.yogas.map((y) => (<p key={y.name + y.reason}><strong>{y.name}</strong> <span className="muted small">— {y.reason}</span></p>)) : <p className="muted">—</p>}
          <p className="small">Mangal dosha: {data.mangalDosha.present ? `${R ? "есть" : "present"} (${data.mangalDosha.from.join(", ")})` : R ? "нет" : "absent"}</p>
        </div>
        <div className="card scroll-x">
          <h2>{R ? "Транзиты сегодня" : "Transits today"}</h2>
          <p className="small">Sade Sati: {data.sadeSati ?? (R ? "нет" : "no")}</p>
          <table>
            <thead><tr><th>{R ? "Планета" : "Planet"}</th><th>{R ? "Знак" : "Sign"}</th><th>°</th><th>{R ? "от Луны" : "from Moon"}</th><th>{R ? "от Асц" : "from Asc"}</th></tr></thead>
            <tbody>
              {data.transits.map((tr) => (
                <tr key={tr.body}><td>{nm(tr.body, locale)}{tr.retrograde && tr.body !== "rahu" && tr.body !== "ketu" ? " R" : ""}</td><td>{sg(tr.sign, locale)}</td><td>{formatDms(tr.degree)}</td><td>{tr.houseFromMoon}</td><td>{tr.houseFromAscendant}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
