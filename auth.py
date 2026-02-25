import json
import requests
from azure.identity import DefaultAzureCredential

GRAPH_SCOPE = "https://graph.microsoft.com/.default"
GRAPH_ME = "https://graph.microsoft.com/v1.0/me"

def main():
    credential = DefaultAzureCredential()
    token = credential.get_token(GRAPH_SCOPE)

    headers = {"Authorization": f"Bearer {token.token}"}
    resp = requests.get(GRAPH_ME, headers=headers, timeout=30)

    print("Status:", resp.status_code)
    try:
        print(json.dumps(resp.json(), indent=2))
    except Exception:
        print(resp.text)

if __name__ == "__main__":
    main()