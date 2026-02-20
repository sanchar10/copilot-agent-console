# Feature: Tools Support

## Summary
Local tools system for chat sessions and Ralph AI Runner. Tools are defined as Python files in `~/.copilot-web/tools/` folder, each file can define one or more tools using OpenAI-style metadata. The app scans this folder, loads tool definitions, and makes them available for selection in chat sessions.

## Tool Definition Format

### Directory Structure
```
~/.copilot-web/
  tools/
    weather_tools.py      # Can define multiple tools
    file_utils.py
    custom_api.py
```

### Tool Module Convention
Each `.py` file exports a `TOOL_SPECS` list:

```python
# ~/.copilot-web/tools/weather_tools.py

def get_weather_info(location: str) -> str:
    """Get a short text weather report for a location."""
    return f"The weather in {location} is cloudy with a high of 15°C."


def get_temperatures(location: str) -> dict:
    """Get today's min/max temperatures for a location (°C)."""
    return {"min_c": 9, "max_c": 15}


TOOL_SPECS = [
    {
        "name": "weather_tools:get_weather_info",
        "description": "Get a short text weather report for a location.",
        "parameters": {
            "type": "object",
            "properties": {
                "location": {"type": "string", "description": "Location (city, region, etc.)"},
            },
            "required": ["location"],
        },
        "handler": get_weather_info,
    },
    {
        "name": "weather_tools:get_temperatures",
        "description": "Get today's min/max temperatures for a location (°C).",
        "parameters": {
            "type": "object",
            "properties": {
                "location": {"type": "string", "description": "Location (city, region, etc.)"},
            },
            "required": ["location"],
        },
        "handler": get_temperatures,
    },
]
```

### Tool Spec Required Keys
| Key | Type | Description |
|-----|------|-------------|
| `name` | string | Unique tool name, format: `{module}:{function}` |
| `description` | string | What the tool does (shown to model) |
| `parameters` | dict | JSON Schema for arguments (OpenAI-style) |
| `handler` | callable | Python function to execute |

### Handler Conventions
- Signature: `def tool_name(param1: T, param2: T = default, ..., context=None?) -> Any`
- Loader calls: `handler(**invocation["arguments"])`
- Optional `context` parameter receives runtime context dict
- Return: `str` (direct) or JSON-serializable data (dict, list, numbers, booleans, None)

### Result Normalization
- Success: `{"resultType": "success", "textResultForLlm": <string>}`
- Failure: `{"resultType": "failure", "textResultForLlm": "...", "error": "..."}`
- Dict/list returns are JSON-serialized

## Acceptance Criteria

### Tool Loading
- [ ] App scans `~/.copilot-web/tools/` folder on startup
- [ ] Each `.py` file is imported and `TOOL_SPECS` is read
- [ ] Tool definitions are validated (name, description, parameters, handler)
- [ ] Tool names must be unique across all modules
- [ ] Invalid tools are logged and skipped (don't break other tools)
- [ ] Tools are reloaded when folder changes (file watcher) or on manual refresh

### Tool Storage
- [ ] Loaded tools stored in memory with metadata (name, description, source file)
- [ ] `GET /api/tools` returns list of available tools
- [ ] `GET /api/tools/{name}` returns single tool details

### Session Integration
- [ ] New Session UI shows "Local Tools" dropdown (similar to MCP dropdown)
- [ ] All tools selected by default
- [ ] User can select/deselect individual tools
- [ ] Tool selection saved to session metadata on first message (like MCP servers)
- [ ] Selected tools passed to SDK session creation
- [ ] Tools available to agent during conversation

### Tool Execution
- [ ] Loader wraps handlers to catch exceptions
- [ ] Exceptions return failure ToolResult (don't crash session)
- [ ] Unexpected args return TypeError
- [ ] Missing required args return TypeError
- [ ] Tool execution logged for debugging

### UI
- [ ] Tools dropdown shows tool name and description
- [ ] Checkbox for each tool (checked = selected)
- [ ] "Select All" / "Deselect All" buttons
- [ ] Tools dropdown disabled after session starts (selection locked)
- [ ] Badge shows count of selected tools

### Ralph Integration
- [ ] Ralph sub-agents can use selected tools
- [ ] Tool selection can be specified in execution plan
- [ ] Default: inherit tools from prep session or use all available
