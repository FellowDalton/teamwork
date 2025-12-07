# SharePoint & OneDrive Operations Reference

## Drive Operations (OneDrive)

### Get My Drive

```typescript
const myDrive = await client.sharepoint.getMyDrive();
console.log(`Drive: ${myDrive.name}`);
console.log(`Used: ${myDrive.quota?.used} / ${myDrive.quota?.total}`);
```

### List All Drives

```typescript
const drives = await client.sharepoint.listDrives();
for (const drive of drives.value) {
  console.log(`${drive.name} (${drive.driveType})`);
}
```

## File Operations

### List Root Items

```typescript
const items = await client.sharepoint.listRootItems({
  top: 50,
  orderBy: 'lastModifiedDateTime desc',
});

for (const item of items.value) {
  const type = item.folder ? 'Folder' : 'File';
  console.log(`[${type}] ${item.name} - ${item.size} bytes`);
}
```

### List Items by Path

```typescript
const items = await client.sharepoint.listItemsByPath('Documents/Projects', {
  top: 100,
});
```

### List Items by Folder ID

```typescript
const items = await client.sharepoint.listItemsById('folder-id', {
  top: 100,
  orderBy: 'name',
});
```

### Get Item by Path

```typescript
const file = await client.sharepoint.getItemByPath('Documents/report.docx');
console.log(`Name: ${file.name}`);
console.log(`Size: ${file.size}`);
console.log(`Modified: ${file.lastModifiedDateTime}`);
console.log(`URL: ${file.webUrl}`);
```

### Get Item by ID

```typescript
const file = await client.sharepoint.getItemById('item-id');
```

### Search Files

```typescript
const results = await client.sharepoint.searchFiles('quarterly report', {
  top: 25,
});

for (const file of results.value) {
  console.log(`${file.name}`);
  console.log(`  Path: ${file.parentReference?.path}`);
  console.log(`  Modified: ${file.lastModifiedDateTime}`);
  console.log(`  URL: ${file.webUrl}`);
}
```

### Get Download URL

```typescript
const downloadUrl = await client.sharepoint.getDownloadUrl('item-id');
// Use fetch to download the actual content
const response = await fetch(downloadUrl);
const content = await response.text();
```

### Upload File (< 4MB)

```typescript
const file = await client.sharepoint.uploadFile({
  fileName: 'report.txt',
  content: 'File content here',
  contentType: 'text/plain',
  folderPath: 'Documents/Reports',
  conflictBehavior: 'rename', // 'fail', 'replace', 'rename'
});

console.log(`Uploaded: ${file.webUrl}`);
```

### Create Folder

```typescript
const folder = await client.sharepoint.createFolder({
  name: 'New Project',
  parentPath: 'Documents',
});
```

### Delete Item

```typescript
await client.sharepoint.deleteItem('item-id');
```

### Copy Item

```typescript
await client.sharepoint.copyItem(
  'item-id',
  'Documents/Archive', // Destination path
  'renamed-copy.docx'  // Optional new name
);
```

### Move Item

```typescript
const moved = await client.sharepoint.moveItem(
  'item-id',
  'Documents/Archive',
  'new-name.docx' // Optional
);
```

## SharePoint Site Operations

### Get Root Site

```typescript
const rootSite = await client.sharepoint.getRootSite();
console.log(`Root site: ${rootSite.displayName}`);
```

### Get Site by Path

```typescript
// Format: hostname:/sites/sitename
const site = await client.sharepoint.getSiteByPath(
  'contoso.sharepoint.com:/sites/marketing'
);
```

### Search Sites

```typescript
const sites = await client.sharepoint.searchSites('marketing', {
  top: 10,
});

for (const site of sites.value) {
  console.log(`${site.displayName} - ${site.webUrl}`);
}
```

### List Followed Sites

```typescript
const followed = await client.sharepoint.listFollowedSites();
for (const site of followed.value) {
  console.log(`${site.displayName}`);
}
```

### Get Site Drives (Document Libraries)

```typescript
const drives = await client.sharepoint.listSiteDrives('site-id');
for (const drive of drives.value) {
  console.log(`${drive.name} (${drive.driveType})`);
}
```

### Get Site Default Drive

```typescript
const drive = await client.sharepoint.getSiteDefaultDrive('site-id');
```

### List SharePoint Lists

```typescript
const lists = await client.sharepoint.listSiteLists('site-id');
for (const list of lists.value) {
  console.log(`${list.displayName} - ${list.webUrl}`);
}
```

## Cross-Service Search

### Search Across OneDrive and SharePoint

```typescript
const files = await client.sharepoint.searchAcrossServices('budget 2024', {
  top: 50,
  entityTypes: ['driveItem', 'listItem'], // Types to search
});

for (const file of files) {
  console.log(`${file.name} - ${file.webUrl}`);
}
```

## Shared Items

### List Items Shared With Me

```typescript
const shared = await client.sharepoint.listSharedWithMe();
for (const item of shared.value) {
  console.log(`${item.name} shared by ${item.createdBy?.user?.displayName}`);
}
```

### List Recent Files

```typescript
const recent = await client.sharepoint.listRecentFiles(20);
for (const item of recent.value) {
  console.log(`${item.name} - ${item.lastModifiedDateTime}`);
}
```

## Common Patterns

### Download and Process File

```typescript
async function readFileContent(filePath: string): Promise<string> {
  const file = await client.sharepoint.getItemByPath(filePath);
  const downloadUrl = file['@microsoft.graph.downloadUrl'];

  if (!downloadUrl) {
    throw new Error('File does not have download URL');
  }

  const response = await fetch(downloadUrl);
  return response.text();
}

const content = await readFileContent('Documents/config.json');
const config = JSON.parse(content);
```

### Find Files by Extension

```typescript
async function findByExtension(extension: string, folder?: string) {
  const items = folder
    ? await client.sharepoint.listItemsByPath(folder, { top: 1000 })
    : await client.sharepoint.listRootItems({ top: 1000 });

  return items.value.filter(item =>
    item.name.toLowerCase().endsWith(`.${extension.toLowerCase()}`)
  );
}

const pdfs = await findByExtension('pdf', 'Documents');
```

### Get Folder Tree

```typescript
async function getFolderTree(folderId?: string, depth: number = 2): Promise<any> {
  const items = folderId
    ? await client.sharepoint.listItemsById(folderId)
    : await client.sharepoint.listRootItems();

  const tree = [];

  for (const item of items.value) {
    if (item.folder && depth > 0) {
      tree.push({
        name: item.name,
        children: await getFolderTree(item.id, depth - 1),
      });
    } else {
      tree.push({ name: item.name });
    }
  }

  return tree;
}
```

## File Type Detection

```typescript
function getFileType(item: DriveItem): string {
  if (item.folder) return 'folder';

  const mimeType = item.file?.mimeType;
  if (!mimeType) return 'unknown';

  if (mimeType.includes('image')) return 'image';
  if (mimeType.includes('video')) return 'video';
  if (mimeType.includes('audio')) return 'audio';
  if (mimeType.includes('pdf')) return 'pdf';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'spreadsheet';
  if (mimeType.includes('document') || mimeType.includes('word')) return 'document';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'presentation';

  return 'file';
}
```
