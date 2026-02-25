import requests
from azure.identity import AzureCliCredential

GRAPH_ME = "https://graph.microsoft.com/v1.0/me"

def main():
    cred = AzureCliCredential()
    token = cred.get_token("https://graph.microsoft.com/.default")

    headers = {"Authorization": f"Bearer {token.token}"}
    resp = requests.get(GRAPH_ME, headers=headers, timeout=30)

    print("Status:", resp.status_code)
    print(resp.json())

if __name__ == "__main__":
    main()