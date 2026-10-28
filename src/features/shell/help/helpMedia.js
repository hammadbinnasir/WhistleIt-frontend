// Decides where a Help image/GIF/SVG comes from.
//
// A media entry looks like { name: 'features-2', url: null } and is resolved in order:
//   1. `url`  - an external link (https://...) or a path served from /public
//   2. `name` - a file in src/assets/help/ called `name` plus any extension. gif, svg, png, jpg,
//               jpeg and webp all work, so just drop the file in (features-2.gif, features-2.svg...)
//   3. nothing - the caller shows its own fallback
const localFiles = import.meta.glob('../../../assets/help/*.{gif,svg,png,jpg,jpeg,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
})

function nameWithoutExtension(path) {
  return path
    .split('/')
    .pop()
    .replace(/\.[^.]+$/, '')
}

const filesByName = Object.fromEntries(
  Object.entries(localFiles).map(([path, url]) => [nameWithoutExtension(path), url]),
)

export const IS_DEV = import.meta.env.DEV

export function resolveMediaSrc(media, files = filesByName) {
  if (!media) return null
  if (media.url) return media.url
  if (media.name && files[media.name]) return files[media.name]
  return null
}

// Image slots only take up space once they have an image.
// While developing they also show a dashed placeholder so you can see where the image goes.
export function shouldShowMedia(media, files = filesByName, isDev = IS_DEV) {
  if (!media) return false
  return isDev || resolveMediaSrc(media, files) !== null
}
