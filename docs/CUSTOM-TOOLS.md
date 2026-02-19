# Custom Tools

## Using Tool Builder (Recommended)

The easiest way to create a tool is with the built-in **Tool Builder** agent. Select it from the Agent Library, describe what the tool should do, and it handles the rest — generates the code, writes the file, verifies it loads, and runs a smoke test.

**Example:** _"Build a tool that gets the current weather for a city"_ → Tool Builder creates `free_weather.py` in `~/.copilot-agent-console/tools/`, tests the import, calls the handler with sample data, and confirms everything works. Then ask any agent: _"What's the weather in Seattle?"_ and it will use your new tool.

## Managing Tools

Tools are stored in `~/.copilot-agent-console/tools/`. Each `.py` file in this folder becomes available for selection in new sessions.

- **Add tools:** Use Tool Builder or manually create `.py` files in the folder
- **Remove tools:** Delete the `.py` file from the folder — it will no longer appear in the tools selector
- **Tools auto-reload** when files change — new sessions pick them up without restarting

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
