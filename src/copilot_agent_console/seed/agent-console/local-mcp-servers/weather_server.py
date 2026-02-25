#!/usr/bin/env python3
"""
Weather MCP Server - Provides weather information using Open-Meteo API.

A sample MCP (Model Context Protocol) server that ships with Copilot Console.
Free to use — no API key required.
"""

import json
import sys
import urllib.request
import urllib.parse


def geocode_location(city: str, state: str = "", country: str = "US") -> dict | None:
    """Convert city/state to latitude/longitude using Open-Meteo Geocoding API."""
    params = urllib.parse.urlencode({"name": city, "count": 10, "format": "json"})
    url = f"https://geocoding-api.open-meteo.com/v1/search?{params}"

    try:
        with urllib.request.urlopen(url, timeout=10) as response:
            data = json.loads(response.read().decode())
            if "results" not in data or len(data["results"]) == 0:
                return None

            for result in data["results"]:
                result_state = result.get("admin1", "").lower()
                result_country = result.get("country_code", "").lower()
                state_match = not state or state.lower() in result_state or result_state.startswith(state.lower())
                country_match = not country or country.lower() == result_country

                if state_match and country_match:
                    return {
                        "latitude": result["latitude"],
                        "longitude": result["longitude"],
                        "name": result.get("name", city),
                        "admin1": result.get("admin1", state),
                        "country": result.get("country", country),
                    }

            # No exact match — return first result
            result = data["results"][0]
            return {
                "latitude": result["latitude"],
                "longitude": result["longitude"],
                "name": result.get("name", city),
                "admin1": result.get("admin1", state),
                "country": result.get("country", country),
            }
    except Exception as e:
        sys.stderr.write(f"Geocoding error: {e}\n")
    return None


def get_weather_data(latitude: float, longitude: float) -> dict | None:
    """Fetch weather data from Open-Meteo API."""
    params = urllib.parse.urlencode({
        "latitude": latitude,
        "longitude": longitude,
        "current": "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m",
        "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max",
        "temperature_unit": "fahrenheit",
        "wind_speed_unit": "mph",
        "precipitation_unit": "inch",
        "timezone": "auto",
        "forecast_days": 7,
    })
    url = f"https://api.open-meteo.com/v1/forecast?{params}"

    try:
        with urllib.request.urlopen(url, timeout=10) as response:
            return json.loads(response.read().decode())
    except Exception as e:
        sys.stderr.write(f"Weather API error: {e}\n")
    return None


WEATHER_CODES = {
    0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Foggy", 48: "Depositing rime fog",
    51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
    61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
    66: "Light freezing rain", 67: "Heavy freezing rain",
    71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow", 77: "Snow grains",
    80: "Slight rain showers", 81: "Moderate rain showers", 82: "Violent rain showers",
    85: "Slight snow showers", 86: "Heavy snow showers",
    95: "Thunderstorm", 96: "Thunderstorm with slight hail", 99: "Thunderstorm with heavy hail",
}


def format_weather_response(location: dict, weather: dict) -> str:
    """Format weather data into a readable response."""
    current = weather.get("current", {})
    daily = weather.get("daily", {})

    response = f"## Weather for {location['name']}"
    if location.get("admin1"):
        response += f", {location['admin1']}"
    response += f", {location['country']}\n\n"

    response += "### Current Conditions\n"
    response += f"- **Temperature:** {current.get('temperature_2m', 'N/A')}°F\n"
    response += f"- **Feels Like:** {current.get('apparent_temperature', 'N/A')}°F\n"
    response += f"- **Humidity:** {current.get('relative_humidity_2m', 'N/A')}%\n"
    response += f"- **Conditions:** {WEATHER_CODES.get(current.get('weather_code', -1), 'Unknown')}\n"
    response += f"- **Wind:** {current.get('wind_speed_10m', 'N/A')} mph\n"
    response += f"- **Precipitation:** {current.get('precipitation', 0)} in\n\n"

    response += "### 7-Day Forecast\n"
    if "time" in daily:
        for i, date in enumerate(daily["time"][:7]):
            high = daily.get("temperature_2m_max", [None])[i]
            low = daily.get("temperature_2m_min", [None])[i]
            code = daily.get("weather_code", [None])[i]
            precip_prob = daily.get("precipitation_probability_max", [0])[i]

            desc = WEATHER_CODES.get(code, "N/A") if code is not None else "N/A"
            response += f"- **{date}:** {desc}, High: {high}°F, Low: {low}°F"
            if precip_prob and precip_prob > 0:
                response += f", {precip_prob}% chance of precipitation"
            response += "\n"

    return response


def handle_get_weather(args: dict) -> dict:
    """Handle the get_weather tool call."""
    city = args.get("city", "")
    if not city:
        return {"error": "City is required"}

    location = geocode_location(city, args.get("state", ""), args.get("country", "US"))
    if not location:
        return {"error": f"Could not find location: {city}"}

    weather = get_weather_data(location["latitude"], location["longitude"])
    if not weather:
        return {"error": "Could not fetch weather data"}

    return {"content": format_weather_response(location, weather)}


# --- MCP Protocol Handler ---

def read_message() -> dict | None:
    try:
        line = sys.stdin.readline()
        if not line:
            return None
        return json.loads(line)
    except json.JSONDecodeError:
        return None


def write_message(message: dict):
    sys.stdout.write(json.dumps(message) + "\n")
    sys.stdout.flush()


def handle_request(request: dict) -> dict | None:
    method = request.get("method", "")
    request_id = request.get("id")
    params = request.get("params", {})

    if method == "initialize":
        return {
            "jsonrpc": "2.0", "id": request_id,
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {"tools": {}},
                "serverInfo": {"name": "weather-server", "version": "1.0.0"},
            },
        }
    elif method == "notifications/initialized":
        return None
    elif method == "tools/list":
        return {
            "jsonrpc": "2.0", "id": request_id,
            "result": {
                "tools": [{
                    "name": "get_weather",
                    "description": "Get current weather and 7-day forecast for a location. Uses Open-Meteo API (free, no API key required).",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "city": {"type": "string", "description": "City name (e.g., 'Seattle', 'New York')"},
                            "state": {"type": "string", "description": "State or province (e.g., 'WA', 'NY')"},
                            "country": {"type": "string", "description": "Country code (e.g., 'US', 'CA'). Defaults to 'US'", "default": "US"},
                        },
                        "required": ["city"],
                    },
                }],
            },
        }
    elif method == "tools/call":
        tool_name = params.get("name", "")
        if tool_name == "get_weather":
            result = handle_get_weather(params.get("arguments", {}))
            if "error" in result:
                return {"jsonrpc": "2.0", "id": request_id, "result": {"content": [{"type": "text", "text": f"Error: {result['error']}"}], "isError": True}}
            return {"jsonrpc": "2.0", "id": request_id, "result": {"content": [{"type": "text", "text": result["content"]}]}}
        return {"jsonrpc": "2.0", "id": request_id, "error": {"code": -32601, "message": f"Unknown tool: {tool_name}"}}
    elif request_id is not None:
        return {"jsonrpc": "2.0", "id": request_id, "error": {"code": -32601, "message": f"Method not found: {method}"}}
    return None


def main():
    sys.stderr.write("Weather MCP Server started\n")
    while True:
        request = read_message()
        if request is None:
            break
        response = handle_request(request)
        if response is not None:
            write_message(response)


if __name__ == "__main__":
    main()
