#!/usr/bin/env python3
"""
Start a Ralph execution run.

This script starts execution of a previously created batch.
The run executes asynchronously in the backend - this script returns immediately.

Usage:
    python start_batch.py --batch-id BATCH_ID
    python start_batch.py --batch-id BATCH_ID --auto-approve

Arguments:
    --batch-id      Batch ID to execute (required)
    --auto-approve  Override batch's auto-approve setting (optional flag)
"""

import argparse
import json
import sys
import urllib.request
import urllib.error

API_BASE = "http://localhost:8765"


def start_run(batch_id: str, auto_approve: bool | None = None) -> dict:
    """Start a Ralph run via backend API."""
    url = f"{API_BASE}/api/ralph/runs"
    
    data = {"batch_id": batch_id}
    if auto_approve is not None:
        data["auto_approve"] = auto_approve
    
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode(),
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"Error starting run: {e.code} - {body}")
        sys.exit(1)


def get_batch(batch_id: str) -> dict:
    """Get batch details."""
    url = f"{API_BASE}/api/ralph/batches/{batch_id}"
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        if e.code == 404:
            print(f"Error: Batch '{batch_id}' not found")
            sys.exit(1)
        raise


def main():
    parser = argparse.ArgumentParser(
        description="Start a Ralph execution run",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    # Start run with batch's default settings
    python start_batch.py --batch-id batch_20260131_143052
    
    # Start with auto-approve enabled
    python start_batch.py --batch-id batch_20260131_143052 --auto-approve
"""
    )
    parser.add_argument("--batch-id", required=True, help="Batch ID to execute")
    parser.add_argument("--auto-approve", action="store_true", default=None, 
                        help="Override to enable auto-approve")
    
    args = parser.parse_args()
    
    # Verify batch exists
    print(f"Verifying batch {args.batch_id}...")
    batch = get_batch(args.batch_id)
    
    pending_jobs = [j for j in batch["jobs"] if j["status"] == "pending"]
    if not pending_jobs:
        print("Warning: No pending jobs in this batch")
    
    # Start the run (returns immediately - run executes async in backend)
    print(f"Starting execution...")
    auto_approve = True if args.auto_approve else None
    run = start_run(args.batch_id, auto_approve)
    
    # Output result - use forward slashes for paths
    workspace = run['workspace'].replace('\\', '/')
    total = len(batch['jobs'])
    pending = len(pending_jobs)
    
    print("\n" + "=" * 50)
    print("RUN STARTED SUCCESSFULLY")
    print("=" * 50)
    print(f"Run ID:       {run['id']}")
    print(f"Batch ID:     {run['batch_id']}")
    print(f"Jobs:         {total} total, {pending} pending")
    print(f"Auto-approve: {run['auto_approve']}")
    print(f"Workspace:    {workspace}")
    print("=" * 50)
    
    print("\n✅ BACKEND IS NOW EXECUTING JOBS")
    print("→ Monitor progress in Ralph Monitor (Agent Console sidebar)")
    print("→ Each job runs with a FRESH agent (not this chat)")
    print("→ The calling agent's work is DONE - do not execute jobs yourself")
    
    return run["id"]


if __name__ == "__main__":
    main()
