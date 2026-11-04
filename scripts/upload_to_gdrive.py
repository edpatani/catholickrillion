import os
import sys
import json
import subprocess
import urllib.request
import urllib.parse

def get_access_token():
    return subprocess.check_output('gcloud auth print-access-token', shell=True, text=True).strip()

def list_files_in_folder(token, folder_id):
    files_map = {} # name -> file dict
    page_token = None
    while True:
        q = f"'{folder_id}' in parents and trashed = false"
        url = f"https://www.googleapis.com/drive/v3/files?q={urllib.parse.quote(q)}&fields=nextPageToken,files(id,name,mimeType)"
        if page_token:
            url += f"&pageToken={page_token}"
        req = urllib.request.Request(url, headers={'Authorization': f'Bearer {token}'})
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            for f in data.get('files', []):
                files_map[f['name']] = f
            page_token = data.get('nextPageToken')
            if not page_token:
                break
    return files_map

def get_or_create_subfolder(token, parent_id, folder_name):
    existing = list_files_in_folder(token, parent_id)
    if folder_name in existing and existing[folder_name]['mimeType'] == 'application/vnd.google-apps.folder':
        return existing[folder_name]['id']
    
    # Create folder
    url = 'https://www.googleapis.com/drive/v3/files'
    metadata = {
        'name': folder_name,
        'mimeType': 'application/vnd.google-apps.folder',
        'parents': [parent_id]
    }
    body = json.dumps(metadata).encode('utf-8')
    req = urllib.request.Request(url, data=body, headers={
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }, method='POST')
    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode('utf-8'))
        print(f"Created subfolder: {folder_name} (id: {res['id']})")
        return res['id']

def upload_or_update_file(token, parent_id, local_path, remote_name=None, mime_type='application/octet-stream'):
    if not os.path.exists(local_path):
        print(f"Skip non-existent: {local_path}")
        return
    
    filename = remote_name or os.path.basename(local_path)
    existing_files = list_files_in_folder(token, parent_id)
    with open(local_path, 'rb') as f:
        file_bytes = f.read()

    if filename in existing_files and existing_files[filename]['mimeType'] != 'application/vnd.google-apps.folder':
        file_id = existing_files[filename]['id']
        url = f"https://www.googleapis.com/upload/drive/v3/files/{file_id}?uploadType=media"
        req = urllib.request.Request(url, data=file_bytes, headers={
            'Authorization': f'Bearer {token}',
            'Content-Type': mime_type
        }, method='PATCH')
        with urllib.request.urlopen(req) as resp:
            res = json.loads(resp.read().decode('utf-8'))
            print(f"[OK] Updated existing file: {filename} ({len(file_bytes)} bytes)")
            return res.get('id')
    else:
        # Multipart create
        boundary = '-------314159265358979323846'
        delimiter = f"\r\n--{boundary}\r\n".encode('utf-8')
        close_delimiter = f"\r\n--{boundary}--\r\n".encode('utf-8')
        
        metadata = {
            'name': filename,
            'parents': [parent_id]
        }
        
        body = (
            delimiter +
            b'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
            json.dumps(metadata).encode('utf-8') +
            delimiter +
            f'Content-Type: {mime_type}\r\n\r\n'.encode('utf-8') +
            file_bytes +
            close_delimiter
        )
        
        url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart'
        req = urllib.request.Request(url, data=body, headers={
            'Authorization': f'Bearer {token}',
            'Content-Type': f'multipart/related; boundary={boundary}'
        }, method='POST')
        with urllib.request.urlopen(req) as resp:
            res = json.loads(resp.read().decode('utf-8'))
            print(f"[OK] Created new file: {filename} ({len(file_bytes)} bytes)")
            return res.get('id')

def main():
    root_folder_id = '1-AIxQmQbDKMmHGgfqFFK03mkwPGJwwNt'
    print(f"Connecting to Google Drive folder: {root_folder_id}...")
    token = get_access_token()
    print("OAuth token acquired successfully.")

    # 1. Upload root files
    root_files = [
        ('server.js', 'text/javascript'),
        ('PROJECT_CONTEXT.md', 'text/markdown'),
        ('package.json', 'application/json'),
        ('package-lock.json', 'application/json'),
        ('README.md', 'text/markdown'),
        ('start.bat', 'text/plain'),
        ('Dockerfile', 'text/plain'),
        ('render.yaml', 'text/plain'),
        ('rebuild_catholic_vatican_catalog.js', 'text/javascript'),
        ('build_full_expanded_categories.js', 'text/javascript'),
        ('public_url.txt', 'text/plain'),
        ('catholic-krillion.zip', 'application/zip')
    ]

    for fname, mtype in root_files:
        upload_or_update_file(token, root_folder_id, fname, mime_type=mtype)

    # 2. Upload data folder
    data_folder_id = get_or_create_subfolder(token, root_folder_id, 'data')
    upload_or_update_file(token, data_folder_id, os.path.join('data', 'questions.json'), mime_type='application/json')

    # 3. Upload engine folder
    engine_folder_id = get_or_create_subfolder(token, root_folder_id, 'engine')
    upload_or_update_file(token, engine_folder_id, os.path.join('engine', 'validator.js'), mime_type='text/javascript')

    # 4. Upload public folder
    public_folder_id = get_or_create_subfolder(token, root_folder_id, 'public')
    public_files = [
        ('index.html', 'text/html'),
        ('team.html', 'text/html'),
        ('validator.js', 'text/javascript'),
        ('game-engine.js', 'text/javascript'),
        ('questions-bundle.js', 'text/javascript'),
        ('styles.css', 'text/css'),
        ('audio.js', 'text/javascript'),
        ('mqtt.min.js', 'text/javascript'),
        ('qrcode.min.js', 'text/javascript'),
        ('_redirects', 'text/plain')
    ]
    for pf, mtype in public_files:
        upload_or_update_file(token, public_folder_id, os.path.join('public', pf), mime_type=mtype)

    # 5. Upload test folder
    test_folder_id = get_or_create_subfolder(token, root_folder_id, 'test')
    test_files = [
        ('test_validator.js', 'text/javascript'),
        ('verify_krillion.js', 'text/javascript'),
        ('check_sample_answers.js', 'text/javascript')
    ]
    for tf, mtype in test_files:
        upload_or_update_file(token, test_folder_id, os.path.join('test', tf), mime_type=mtype)

    print("\nAll files successfully synced to Google Drive folder 'krillion'!")

if __name__ == '__main__':
    main()
