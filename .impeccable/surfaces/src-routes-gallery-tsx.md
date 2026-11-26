---
version: 1
slug: "src-routes-gallery-tsx"
primary_target: "src/routes/gallery.tsx"
related_targets: ["src/components/gallery","src/routes/admin.tsx"]
---

# Gallery and photo publishing

Mode: Experience for the public gallery; Operate for the administrator's publishing form.

Scope: src/routes/gallery.tsx, gallery components, and the Gallery panel in src/routes/admin.tsx.

Visitors browse the restaurant's published videos and photos on phones and computers. Administrators publish a photo from their computer with a caption and visibility setting. Preserve existing guest likes, comments, authenticated publishing, the official logo, and the cream, ember and charcoal system. Use actual gallery content, without invented posts or engagement.

## Direction contract

THESIS: The food leads through familiar short-video and photo browsing. The current masonry gallery becomes a vertical Reels feed and an Instagram-style photo grid.

OWN-WORLD: Existing Archivo and Figtree type, warm cream page surfaces, charcoal video frames, ember actions, and the official flame mark. The upload form uses the existing admin controls with a large file picker and a real photo preview.

STORY: Visitors choose Reels or Photos, watch or open a post, and react or share. Administrators select a local photo, inspect it, add a caption and publish.

FIRST VIEWPORT: A compact gallery profile and menu link sit above two tabs. A tall video occupies the Reels view, with controls and social actions over the image; Photos uses a three-column square grid. Desktop adds navigation and links to the real photos.

FORM: seed: none (pinned). User request: "have the ui of ticktok and instagram for the videos" and "upload images directly from my pc". Signature interaction: native vertical scroll snapping, with only the visible video playing and explicit play under reduced motion.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Validation: production build, meaningful media and publishing checks, and desktop/mobile browser inspection. This extends the existing visual system; no new imagery or global design-system replacement is needed.
