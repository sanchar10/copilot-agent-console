#!/usr/bin/env python3
"""
Create a Ralph execution batch.

This script creates an execution batch by:
1. Querying the session config (cwd, model, mcp_servers, tools) from the backend
2. Creating a batch with the jobs and inherited session config
3. Returning the batch ID for use with start_batch.py

Usage:
    python create_batch.py --session-id SESSION_ID --file jobs.json
    python create_batch.py --session-id SESSION_ID --file jobs.json --source "backlog.md" --auto-approve

Arguments:
    --session-id    Current chat session ID (required)
    --file          Path to JSON file containing jobs array (required)
    --source        Description of where jobs came from (optional)
    --auto-approve  Enable auto-approve mode (optional flag)

JSON file format:
    [
        {"description": "Job 1 description", "context": "Additional context"},
        {"description": "Job 2 description", "context": "More context"}
    ]
"""

import argparse
import json
import sys
import urllib.request
import urllib.error

API_BASE = "http://localhost:8765"


def get_session(session_id: str) -> dict:
    """Get session config from backend."""
    url = f"{API_BASE}/api/sessions/{session_id}"
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        if e.code == 404:
            print(f"Error: Session '{session_id}' not found")
            sys.exit(1)
        raise


def create_batch(batch_data: dict) -> dict:
    """Create execution batch via backend API."""
    url = f"{API_BASE}/api/ralph/batches"
    data = json.dumps(batch_data).encode()
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"Error creating batch: {e.code} - {body}")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description="Create a Ralph execution batch",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    # Create batch from JSON file
    python create_batch.py --session-id abc-123 --file jobs.json
    
    # With source description
    python create_batch.py --session-id abc-123 --file jobs.json --source "backlog.md"
    
    # Auto-approve mode (no human review between jobs)
    python create_batch.py --session-id abc-123 --file jobs.json --auto-approve

JSON file format (jobs.json):
    [
        {"description": "Add user authentication", "context": "Use JWT tokens"},
        {"description": "Write unit tests", "context": "For auth module"}
    ]
"""
    )
    parser.add_argument("--session-id", required=True, help="Your chat session UUID (required for inheriting config)")
    parser.add_argument("--file", required=True, help="Path to JSON file containing jobs array")
    parser.add_argument("--source", default="", help="Description of job source")
    parser.add_argument("--auto-approve", action="store_true", help="Enable auto-approve mode")
    
    args = parser.parse_args()
    
    # Read jobs from file
    try:
        with open(args.file, 'r', encoding='utf-8') as f:
            jobs = json.load(f)
    except FileNotFoundError:
        print(f"Error: File not found: {args.file}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON file: {e}")
        sys.exit(1)
    
    if not isinstance(jobs, list):
        print("Error: JSON file must contain an array of job objects")
        sys.exit(1)
    
    # Validate job format
    for i, job in enumerate(jobs):
        if not isinstance(job, dict):
            print(f"Error: Job {i+1} must be an object")
            sys.exit(1)
        if "description" not in job:
            print(f"Error: Job {i+1} missing 'description' field")
            sys.exit(1)
    
    print(f"Loaded {len(jobs)} jobs from {args.file}")
    
    # Get session config to inherit (model, MCP servers, tools, workspace)
    print(f"Getting session config for {args.session_id}...")
    session = get_session(args.session_id)
    
    # Build batch request
    batch_jobs = []
    for i, job in enumerate(jobs):
        batch_jobs.append({
            "id": f"j{i+1}",
            "type": "planned",
            "description": job["description"],
            "context": job.get("context", ""),
            "status": "pending"
        })
    
    batch_data = {
        "workspace": session.get("cwd", ""),
        "source_description": args.source,
        "model": session.get("model", "gpt-4.1"),
        "auto_approve": args.auto_approve,
        "jobs": batch_jobs,
        "mcp_servers": session.get("mcp_servers", {}),
        "tools": session.get("tools", {})
    }
    
    # Create batch
    print(f"Creating batch with {len(batch_jobs)} jobs...")
    batch = create_batch(batch_data)
    
    # Output result
    workspace_display = batch['workspace'].replace('\\', '/')
    total = len(batch['jobs'])
    
    print("\n" + "=" * 50)
    print("BATCH CREATED SUCCESSFULLY")
    print("=" * 50)
    print(f"Batch ID:     {batch['id']}")
    print(f"Jobs:         {total}")
    print(f"Workspace:    {workspace_display}")
    print(f"Model:        {batch['model']}")
    print(f"Auto-approve: {batch['auto_approve']}")
    print(f"MCP Servers:  {len(batch.get('mcp_servers', {}))} configured")
    print(f"Tools:        {len([t for t, enabled in batch.get('tools', {}).items() if enabled])} enabled")
    print("=" * 50)
    
    # Show summary (first 3 + last 2 if many, else all)
    if total <= 7:
        # Show all
        print(f"\nJOBS ({total}):")
        for i, job in enumerate(batch['jobs'], 1):
            desc = job.get('description', '')[:60]
            if len(job.get('description', '')) > 60:
                desc += '...'
            print(f"  {i}. {desc}")
    else:
        # Show first 3 and last 2
        print(f"\nJOBS ({total} - showing first 3 and last 2):")
        for i, job in enumerate(batch['jobs'][:3], 1):
            desc = job.get('description', '')[:60]
            if len(job.get('description', '')) > 60:
                desc += '...'
            print(f"  {i}. {desc}")
        print(f"  ... ({total - 5} more) ...")
        for i, job in enumerate(batch['jobs'][-2:], total - 1):
            desc = job.get('description', '')[:60]
            if len(job.get('description', '')) > 60:
                desc += '...'
            print(f"  {i}. {desc}")
    
    print("\n→ View full list in Ralph Monitor")
    print("=" * 50)
    print(f"\nTo start execution, run:")
    print(f"  python start_batch.py --batch-id {batch['id']}")
    
    # Return batch ID for scripting
    return batch["id"]


if __name__ == "__main__":
    main()
