# Léon Bartosch Portfolio – GSAP Motion Version

This build uses GSAP and ScrollTrigger for clearly visible scroll motion.

## Start locally

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Important

GSAP and ScrollTrigger are pinned and self-hosted in `assets/vendor`, so the animation does not depend on a third-party CDN. If either library cannot load, the site automatically uses simpler native motion and remains fully usable.

Responsive AVIF, WebP and JPEG variants are committed in `assets/generated`. Regenerate them after changing a source hero or thumbnail with:

```bash
./tools/generate-responsive-images.sh
```

## Motion included

- hero image parallax and zoom
- hero text movement/fade
- scroll cue fade
- glass header after scrolling
- section heading reveals
- staggered 3D-like card entrance
- animated filtering
- reduced-motion support

## Content

All works remain in `data/works.json`. Audio files and thumbnails are unchanged.

## Persistent audio player

Clicking an audio card now starts playback in a custom fixed player at the lower-right corner. The player remains visible while scrolling and includes play/pause, seeking, elapsed time, duration, artwork and a close control.

## Impressum

The footer links to `impressum.html`. Before publishing, replace all address placeholders with a complete serviceable postal address.

The contact email has been changed to `leon.bartosch@gmail.com`.
