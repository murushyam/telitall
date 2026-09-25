import os, sys, hashlib, urllib.request, urllib.error, json

def deploy():
    token = os.environ.get('VERCEL_TOKEN')
    team_id = os.environ.get('VERCEL_ORG_ID', 'team_TysqJ7yB3DYJm21bBdJ59828')
    project_id = os.environ.get('VERCEL_PROJECT_ID', 'prj_MyGeUADWEn7YRiMLY6dGt4h327gJ')

    if not token:
        print("ERROR: VERCEL_TOKEN environment variable is required")
        sys.exit(1)

    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    docs_dir = os.path.join(repo_root, 'docs')

    if not os.path.isdir(docs_dir):
        print(f"ERROR: docs directory not found at {docs_dir}")
        sys.exit(1)

    print(f"Deploying {docs_dir} to Vercel (Project: {project_id})...")

    files_manifest = []

    for root, dirs, files in os.walk(docs_dir):
        for f in files:
            fp = os.path.join(root, f)
            rel_path = os.path.relpath(fp, docs_dir).replace('\\', '/')
            with open(fp, 'rb') as file_obj:
                content = file_obj.read()
            sha = hashlib.sha1(content).hexdigest()
            size = len(content)

            # Upload file
            upload_url = f'https://api.vercel.com/v2/files?teamId={team_id}'
            req = urllib.request.Request(
                upload_url,
                data=content,
                headers={
                    'Authorization': f'Bearer {token}',
                    'Content-Type': 'application/octet-stream',
                    'x-vercel-digest': sha,
                    'Content-Length': str(size)
                },
                method='POST'
            )
            try:
                with urllib.request.urlopen(req) as resp:
                    print(f"  Uploaded {rel_path} ({size} bytes)")
            except urllib.error.HTTPError as e:
                # 200 or 409 (already uploaded) are both fine
                if e.code == 409:
                    print(f"  Cached {rel_path} ({size} bytes)")
                else:
                    print(f"  Upload note for {rel_path}: {e.code} {e.reason}")

            files_manifest.append({
                'file': rel_path,
                'sha': sha,
                'size': size
            })

    print(f"Manifest prepared with {len(files_manifest)} files. Creating deployment...")

    deploy_payload = {
        'name': 'telitall',
        'project': project_id,
        'target': 'production',
        'files': files_manifest,
        'projectSettings': {
            'framework': None
        }
    }

    req_deploy = urllib.request.Request(
        f'https://api.vercel.com/v13/deployments?teamId={team_id}',
        data=json.dumps(deploy_payload).encode('utf-8'),
        headers={
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        },
        method='POST'
    )

    try:
        with urllib.request.urlopen(req_deploy) as resp:
            deploy_res = json.loads(resp.read().decode('utf-8'))
            print("Deployment successfully triggered!")
            print(f"  URL: https://{deploy_res.get('url')}")
            aliases = deploy_res.get('alias', [])
            if aliases:
                print(f"  Production Aliases: {', '.join(['https://' + a for a in aliases])}")
            print(f"  Status: {deploy_res.get('readyState') or deploy_res.get('status')}")
    except urllib.error.HTTPError as e:
        print("Deploy HTTP Error:", e.code, e.reason)
        print(e.read().decode('utf-8'))
        sys.exit(1)
    except Exception as e:
        print("Deploy Error:", e)
        sys.exit(1)

if __name__ == '__main__':
    deploy()
