"""Sample custom tool — get system information.

Demonstrates the TOOL_SPECS format for creating custom tools.
Drop .py files like this into ~/.copilot-console/tools/ to extend agent capabilities.
"""


def get_system_info() -> dict:
    """Get current system resource usage (CPU, memory, disk)."""
    import os
    import platform
    import shutil

    info = {
        "hostname": platform.node(),
        "os": f"{platform.system()} {platform.release()}",
        "cpu_cores": os.cpu_count(),
    }

    # Disk usage (stdlib)
    disk = shutil.disk_usage(os.path.expanduser("~"))
    info["disk_total_gb"] = round(disk.total / (1024**3), 1)
    info["disk_used_gb"] = round(disk.used / (1024**3), 1)
    info["disk_free_gb"] = round(disk.free / (1024**3), 1)
    info["disk_percent"] = round(disk.used / disk.total * 100, 1)

    # Memory usage (psutil if available, otherwise skip)
    try:
        import psutil
        mem = psutil.virtual_memory()
        info["memory_total_gb"] = round(mem.total / (1024**3), 1)
        info["memory_used_gb"] = round(mem.used / (1024**3), 1)
        info["memory_percent"] = mem.percent
        info["cpu_percent"] = psutil.cpu_percent(interval=0.5)
    except ImportError:
        info["note"] = "Install psutil for memory and CPU usage: pip install psutil"

    return info


TOOL_SPECS = [
    {
        "name": "get_system_info",
        "description": "Get current system resource usage including CPU, memory, and disk. Use when asked about system health, resource usage, or machine specs.",
        "parameters": {
            "type": "object",
            "properties": {},
            "required": [],
        },
        "handler": get_system_info,
    },
]
