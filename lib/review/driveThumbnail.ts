/** Rewrite Drive thumbnailLink size suffix (e.g. trailing =s220) for card previews. */
export function driveThumbnailUrlAtSize(thumbnailLink: string, size = 800): string {
  const trimmed = thumbnailLink.trim();
  if (/=s\d+(-[^?]*)?$/i.test(trimmed)) {
    return trimmed.replace(/=s\d+(-[^?]*)?$/i, `=s${size}$1`);
  }
  return `${trimmed}=s${size}`;
}
