# Search SharePoint & OneDrive Workflow

## Intake Questions

1. **What are you looking for?** (file name, content, or topic)
2. **Where to search?** (OneDrive, specific SharePoint site, or everywhere)
3. **File type?** (any, documents, spreadsheets, images, etc.)

## Steps

### 1. Search OneDrive

```typescript
import { createMicrosoftClientFromEnv } from './apps/microsoft_365_api_client/src/index.ts';

const client = createMicrosoftClientFromEnv();

const searchQuery = '<user-search-term>';

const results = await client.sharepoint.searchFiles(searchQuery, {
  top: 25,
});

console.log(`Found ${results.value.length} files:\n`);

for (const file of results.value) {
  const type = file.folder ? '📁' : '📄';
  const size = file.size ? `(${(file.size / 1024).toFixed(1)} KB)` : '';

  console.log(`${type} ${file.name} ${size}`);
  console.log(`   Path: ${file.parentReference?.path?.replace('/drive/root:', '') || '/'}`);
  console.log(`   Modified: ${file.lastModifiedDateTime}`);
  console.log(`   By: ${file.lastModifiedBy?.user?.displayName || 'Unknown'}`);
  console.log(`   URL: ${file.webUrl}`);
  console.log('');
}
```

### 2. Search Across OneDrive and SharePoint

```typescript
const searchQuery = '<search-term>';

const files = await client.sharepoint.searchAcrossServices(searchQuery, {
  top: 50,
  entityTypes: ['driveItem', 'listItem'],
});

console.log(`Found ${files.length} items across all services:\n`);

for (const file of files) {
  console.log(`📄 ${file.name}`);
  console.log(`   URL: ${file.webUrl}`);
  console.log('');
}
```

### 3. List Recent Files

```typescript
const recentFiles = await client.sharepoint.listRecentFiles(20);

console.log('Recently accessed files:\n');

for (const file of recentFiles.value) {
  console.log(`📄 ${file.name}`);
  console.log(`   Modified: ${file.lastModifiedDateTime}`);
  console.log(`   URL: ${file.webUrl}`);
  console.log('');
}
```

### 4. List Shared With Me

```typescript
const sharedFiles = await client.sharepoint.listSharedWithMe();

console.log('Files shared with you:\n');

for (const file of sharedFiles.value) {
  console.log(`📄 ${file.name}`);
  console.log(`   Shared by: ${file.createdBy?.user?.displayName}`);
  console.log(`   URL: ${file.webUrl}`);
  console.log('');
}
```

### 5. Browse SharePoint Sites

```typescript
// Search for sites
const sites = await client.sharepoint.searchSites('marketing', { top: 10 });

console.log('SharePoint Sites:\n');

for (const site of sites.value) {
  console.log(`🌐 ${site.displayName}`);
  console.log(`   URL: ${site.webUrl}`);
  console.log('');
}

// Get documents from a site
const siteId = sites.value[0].id;
const siteDrives = await client.sharepoint.listSiteDrives(siteId);

console.log('\nDocument Libraries:\n');
for (const drive of siteDrives.value) {
  console.log(`📚 ${drive.name}`);
}
```

### 6. Browse Folder Contents

```typescript
// List root contents
const rootItems = await client.sharepoint.listRootItems({
  top: 50,
  orderBy: 'name',
});

console.log('Root folder contents:\n');

for (const item of rootItems.value) {
  const icon = item.folder ? '📁' : '📄';
  console.log(`${icon} ${item.name}`);
}

// List specific folder
const folderItems = await client.sharepoint.listItemsByPath('Documents/Projects', {
  top: 100,
});

console.log('\nProjects folder:\n');

for (const item of folderItems.value) {
  const icon = item.folder ? '📁' : '📄';
  console.log(`${icon} ${item.name}`);
}
```

## Filter by File Type

```typescript
const allFiles = await client.sharepoint.searchFiles('*', { top: 100 });

// Filter by extension
const pdfFiles = allFiles.value.filter(f =>
  f.name.toLowerCase().endsWith('.pdf')
);

const excelFiles = allFiles.value.filter(f =>
  f.name.toLowerCase().match(/\.(xlsx?|csv)$/)
);

const wordDocs = allFiles.value.filter(f =>
  f.name.toLowerCase().match(/\.docx?$/)
);

console.log(`PDFs: ${pdfFiles.length}`);
console.log(`Excel: ${excelFiles.length}`);
console.log(`Word: ${wordDocs.length}`);
```

## Download File Content

```typescript
const filePath = 'Documents/config.json';

// Get file metadata
const file = await client.sharepoint.getItemByPath(filePath);
console.log(`File: ${file.name}`);
console.log(`Size: ${file.size} bytes`);

// Get download URL
const downloadUrl = await client.sharepoint.getDownloadUrl(file.id);

// Download content (for text files)
const response = await fetch(downloadUrl);
const content = await response.text();
console.log('\nContent:');
console.log(content);
```

## Success Criteria

- [ ] Search query gathered from user
- [ ] Files found and listed with names, paths, and dates
- [ ] URLs provided for opening files
- [ ] File sizes and modification info displayed
