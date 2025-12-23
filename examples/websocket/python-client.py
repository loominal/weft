#!/usr/bin/env python3
"""
Python WebSocket Client for Weft

Connects to the Weft WebSocket API and monitors work and agent events.

Requirements:
    pip install websockets

Usage:
    python python-client.py [websocket-url]

Examples:
    python python-client.py
    python python-client.py ws://localhost:3000/api/ws
    python python-client.py ws://localhost:3000/api/ws?token=dev-token
"""

import asyncio
import websockets
import json
import sys
from datetime import datetime


async def monitor_weft(uri):
    """Connect to Weft and monitor events."""

    print(f"Connecting to Weft WebSocket at {uri}...")

    try:
        async with websockets.connect(uri) as ws:
            print("✓ Connected to Weft\n")

            # Subscribe to work and agent events
            print("Subscribing to work and agent events...")
            await ws.send(json.dumps({
                "type": "subscribe",
                "topic": "work"
            }))

            await ws.send(json.dumps({
                "type": "subscribe",
                "topic": "agents"
            }))

            # Optionally subscribe to stats for periodic updates
            # await ws.send(json.dumps({
            #     "type": "subscribe",
            #     "topic": "stats"
            # }))

            print()

            # Process messages
            async for message in ws:
                try:
                    msg = json.loads(message)
                    await handle_message(msg)
                except json.JSONDecodeError:
                    print(f"Failed to parse message: {message}")
                except Exception as e:
                    print(f"Error handling message: {e}")

    except websockets.exceptions.WebSocketException as e:
        print(f"WebSocket error: {e}")
    except KeyboardInterrupt:
        print("\n\nShutting down...")


async def handle_message(msg):
    """Handle incoming WebSocket messages."""

    msg_type = msg.get('type')

    # Acknowledgements
    if msg_type == 'ack':
        if 'subscribed' in msg:
            print(f"✓ Subscribed to topic: {msg['subscribed']}\n")
            print("Waiting for events...\n")
        if 'unsubscribed' in msg:
            print(f"✓ Unsubscribed from topic: {msg['unsubscribed']}")

    # Events
    elif msg_type == 'event':
        timestamp = datetime.fromisoformat(
            msg['timestamp'].replace('Z', '+00:00')
        ).strftime('%H:%M:%S')

        event = msg['event']
        data = msg['data']

        print(f"[{timestamp}] {event}")

        # Format event-specific data
        if event.startswith('work:'):
            print(f"  Task ID: {data.get('taskId', 'unknown')}")
            if 'capability' in data:
                print(f"  Capability: {data['capability']}")
            if 'boundary' in data:
                print(f"  Boundary: {data['boundary']}")
            if 'priority' in data:
                print(f"  Priority: {data['priority']}")
            if 'description' in data:
                print(f"  Description: {data['description']}")
            if 'assignedTo' in data:
                agent_type = data.get('assignedToAgent', {}).get(
                    'agentType',
                    data['assignedTo']
                )
                print(f"  Assigned to: {agent_type}")
            if 'errorMessage' in data:
                print(f"  Error: {data['errorMessage']}")
            if 'summary' in data:
                print(f"  Summary: {data['summary']}")
            if 'progress' in data:
                print(f"  Progress: {data['progress']}%")

        elif event.startswith('agent:'):
            agent = data.get('agent', {})
            agent_id = agent.get('guid', 'unknown')[:8]
            agent_type = agent.get('agentType', 'unknown')

            print(f"  Agent: {agent_id}... ({agent_type})")

            if 'status' in data:
                print(f"  Status: {data['status']}")
            if 'newStatus' in data:
                prev = data.get('previousStatus', 'unknown')
                print(f"  Status: {prev} → {data['newStatus']}")
            if 'currentTaskCount' in data:
                print(f"  Tasks: {data['currentTaskCount']}")
            if 'capabilities' in data:
                print(f"  Capabilities: {', '.join(data['capabilities'])}")
            if 'boundaries' in data:
                print(f"  Boundaries: {', '.join(data['boundaries'])}")
            if 'reason' in data:
                print(f"  Reason: {data['reason']}")
            if 'graceful' in data:
                print(f"  Graceful: {'Yes' if data['graceful'] else 'No'}")

        elif event.startswith('target:') or event.startswith('spin-up:'):
            if 'targetName' in data:
                print(f"  Target: {data['targetName']}")
            if 'agentType' in data:
                print(f"  Agent Type: {data['agentType']}")
            if 'mechanism' in data:
                print(f"  Mechanism: {data['mechanism']}")
            if 'errorMessage' in data:
                print(f"  Error: {data['errorMessage']}")
            if 'durationMs' in data:
                print(f"  Duration: {data['durationMs']}ms")

        print()  # Blank line between events

    # Stats updates
    elif msg_type == 'stats':
        timestamp = datetime.fromisoformat(
            msg['timestamp'].replace('Z', '+00:00')
        ).strftime('%H:%M:%S')

        data = msg['data']

        print(f"\n=== Stats Update ({timestamp}) ===")
        print(f"Agents: {data['agents']['total']} total")
        print(f"  Online: {data['agents']['byStatus'].get('online', 0)}")
        print(f"  Busy: {data['agents']['byStatus'].get('busy', 0)}")

        print(f"Work: {data['work']['pending']} pending, "
              f"{data['work']['active']} active")
        print(f"  Completed: {data['work']['completed']}, "
              f"Failed: {data['work']['failed']}")

        print(f"Targets: {data['targets']['available']}/"
              f"{data['targets']['total']} available")

        if 'websocket' in data:
            ws_data = data['websocket']
            print(f"WebSocket: {ws_data['connections']} connections, "
                  f"{ws_data['subscriptions']} subscriptions")

        print()

    # Errors
    elif msg_type == 'error':
        print(f"✗ Error: {msg['error']}")

    # Pong (silent - connection health check)
    elif msg_type == 'pong':
        pass


def main():
    """Main entry point."""

    # Get WebSocket URL from command line or use default
    ws_url = sys.argv[1] if len(sys.argv) > 1 else 'ws://localhost:3000/api/ws'

    try:
        asyncio.run(monitor_weft(ws_url))
    except KeyboardInterrupt:
        print("\nDisconnected")


if __name__ == "__main__":
    main()
