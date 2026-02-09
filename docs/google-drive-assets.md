# Google Drive Animated Assets

This guide explains how to use Google Drive links to display animated assets (GIFs, videos, images) in the Hive OS UI.

## Overview

You can now store animated assets in Google Drive and display them directly in the UI using a simple Google Drive share link. The system automatically:

- Extracts the file ID from Google Drive URLs
- Converts it to a direct view URL
- Detects the file type (GIF, video, image)
- Renders the asset appropriately

## Usage

### Basic Usage in Story Blocks (QBR Reports)

Add a media block to your story document:

```typescript
import type { MediaBlockContent } from '@/components/story/types';

const mediaBlock: MediaBlockContent = {
  type: 'media',
  driveUrl: 'https://drive.google.com/file/d/YOUR_FILE_ID/view',
  alt: 'Description of the asset',
  caption: 'Optional caption text',
  align: 'center', // 'left' | 'center' | 'right' | 'full-width'
  maxWidth: 800, // Optional: max width in pixels
  maxHeight: 600, // Optional: max height in pixels
  autoplay: false, // For videos: autoplay (muted)
  loop: true, // For videos/GIFs: loop the animation
};
```

### Using the Component Directly

You can also use the `GoogleDriveAsset` component directly in any React component:

```tsx
import { GoogleDriveAsset } from '@/components/media/GoogleDriveAsset';

function MyComponent() {
  return (
    <GoogleDriveAsset
      driveUrl="https://drive.google.com/file/d/YOUR_FILE_ID/view"
      filename="animation.gif" // Optional: helps detect file type
      alt="My animated asset"
      maxWidth={800}
      maxHeight={600}
      autoplay={false}
      loop={true}
    />
  );
}
```

### Supported Google Drive URL Formats

The utility supports multiple Google Drive URL formats:

- `https://drive.google.com/file/d/FILE_ID/view`
- `https://drive.google.com/open?id=FILE_ID`
- `https://drive.google.com/uc?id=FILE_ID`
- Just the `FILE_ID` itself

### Supported File Types

- **GIFs**: Automatically detected and displayed as animated images
- **Videos**: MP4, WebM, MOV, AVI, MKV - displayed with video controls
- **Images**: JPG, JPEG, PNG, WebP, SVG - displayed as static images

### Example: Adding Media to a QBR Story

```typescript
import { narrativeToStoryDocument } from '@/components/story/types';

// After generating your story document
const story = narrativeToStoryDocument(narrative, companyId);

// Add a media block
story.blocks.push({
  id: 'demo-animation',
  type: 'media',
  chapterId: 'overview',
  order: 5,
  content: {
    type: 'media',
    driveUrl: 'https://drive.google.com/file/d/1a2b3c4d5e6f7g8h9i0j/view',
    alt: 'Product demo animation',
    caption: 'Watch how our new feature works',
    align: 'center',
    maxWidth: 1200,
    loop: true,
  },
});
```

## How It Works

1. **Upload your asset** to Google Drive (GIF, video, or image)
2. **Get the share link**: Right-click the file → Share → Copy link
3. **Use the link** in the `driveUrl` prop
4. The component automatically:
   - Extracts the file ID
   - Converts to a direct view URL
   - Detects file type
   - Renders with appropriate HTML element (`<img>` or `<video>`)

## Important Notes

- **File Permissions**: Make sure the Google Drive file is shared with "Anyone with the link can view" for public access
- **File Size**: Large files may take time to load. Consider optimizing GIFs/videos before uploading
- **CORS**: Google Drive direct URLs work for most browsers, but some may have CORS restrictions
- **Video Autoplay**: Videos with `autoplay={true}` are automatically muted to comply with browser autoplay policies

## Troubleshooting

### Asset Not Loading

1. Check that the Google Drive file is shared publicly (or with your domain)
2. Verify the URL format is correct
3. Check browser console for CORS errors
4. Try using the direct file ID instead of the full URL

### Wrong File Type Detected

- Provide the `filename` prop to help with detection
- Or manually specify the file type in your code

### Video Not Playing

- Ensure the video format is supported by browsers (MP4 is most compatible)
- Check that the file isn't too large
- Try using `videoControls={true}` to allow manual playback
