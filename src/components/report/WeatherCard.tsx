import type { WeatherData } from "@/lib/weather";
import LocalDate from "@/components/LocalDate";

// Read-only weather summary for a daily report. Weather is auto-pulled at
// creation, never entered by hand — this just displays what was recorded so a
// rain delay is documented without dispute. The report date rides on the card
// header so the weather is unambiguously tied to the day it documents.
export default function WeatherCard({
  weather,
  reportDate,
}: {
  weather: WeatherData;
  reportDate?: string;
}) {
  const stat = (label: string, value: string) => (
    <div className="flex flex-col">
      <span className="text-[11px] uppercase tracking-wide text-neutral-400">
        {label}
      </span>
      <span className="font-semibold text-neutral-800">{value}</span>
    </div>
  );

  const num = (n: number | null, suffix: string) =>
    n == null ? "—" : `${n}${suffix}`;

  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-brand">
          Weather
          {reportDate && (
            <span className="ml-2 font-semibold normal-case tracking-normal text-neutral-800">
              <LocalDate iso={`${reportDate}T12:00:00Z`} format="long" />
            </span>
          )}
        </h3>
        <span className="text-[11px] text-neutral-400">{weather.source}</span>
      </div>

      {weather.summary && (
        <p className="mt-1 text-sm text-neutral-600">{weather.summary}</p>
      )}

      <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-6">
        {stat("High", num(weather.highF, "°"))}
        {stat("Low", num(weather.lowF, "°"))}
        {stat("Precip", num(weather.precipInches, '"'))}
        {stat("Humidity", num(weather.humidityPct, "%"))}
        {stat("Wind", num(weather.windMph, " mph"))}
        {stat("Gust", num(weather.windGustMph, " mph"))}
      </div>

      {weather.hourly.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-neutral-200 pt-3 text-sm">
          {weather.hourly.map((h) => (
            <span key={h.hour} className="text-neutral-600">
              <span className="text-neutral-400">{h.label}</span>{" "}
              <span className="font-semibold text-neutral-800">
                {h.tempF == null ? "—" : `${h.tempF}°`}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
