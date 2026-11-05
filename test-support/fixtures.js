// Browser fixtures describe our API contract; provider mapping is tested separately.
export function forecastFixture(d){return d.time.map((date,i)=>({date,code:d.weather_code?.[i],high:d.temperature_2m_max?.[i],low:d.temperature_2m_min?.[i],rain:d.precipitation_probability_max?.[i],uv:d.uv_index_max?.[i],gust:d.wind_gusts_10m_max?.[i],precipitation:d.precipitation_sum?.[i]}))}
