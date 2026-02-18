# Custom Tools

## Using Tool Builder (Recommended)

The easiest way to create a tool is with the built-in **Tool Builder** agent. Select it from the Agent Library, describe what the tool should do, and it handles the rest — generates the code, writes the file, verifies it loads, and runs a smoke test.

**Example:** _"Build a tool that gets the latest AI news"_ → Tool Builder creates `ai_news.py` in `~/.copilot-agent-console/tools/`, tests the import, calls the handler with sample data, and confirms everything works.

## Writing Tools Manually

Each `.py` file in `~/.copilot-agent-console/tools/` needs a `TOOL_SPECS` list defining the tool schema and handler:

```python
# ~/.copilot-agent-console/tools/weather.py

def get_weather(city: str) -> str:
    """Get current weather for a city."""
    import requests  # always import inside the function
    resp = requests.get(f"https://wttr.in/{city}?format=3")
    return resp.text

TOOL_SPECS = [
    {
        "name": "get_weather",
        "description": "Get current weather for a city",
        "parameters": {
            "type": "object",
            "properties": {
                "city": {"type": "string", "description": "City name"}
            },
            "required": ["city"]
        },
        "handler": get_weather,
    }
]
```

Tools auto-reload when files change — new sessions pick them up without restarting.
