// Icon Data
export interface IconData {
  name: string;
  tags: string[];
}

export const ICON_DATA: IconData[] = [
  { name: 'home', tags: ['house', 'building', 'main'] },
  { name: 'search', tags: ['find', 'magnifying glass', 'query'] },
  { name: 'settings', tags: ['options', 'gear', 'controls'] },
  { name: 'favorite', tags: ['heart', 'love', 'like'] },
  { name: 'add', tags: ['plus', 'create', 'new'] },
  { name: 'delete', tags: ['trash', 'remove', 'bin'] },
  { name: 'edit', tags: ['pencil', 'change', 'modify'] },
  { name: 'menu', tags: ['hamburger', 'navigation', 'options'] },
  { name: 'close', tags: ['exit', 'x', 'cancel'] },
  { name: 'person', tags: ['user', 'account', 'profile'] },
  { name: 'shopping_cart', tags: ['buy', 'purchase', 'store'] },
  { name: 'cloud', tags: ['weather', 'sky', 'storage'] },
  { name: 'email', tags: ['mail', 'message', 'inbox'] },
  { name: 'lightbulb', tags: ['idea', 'suggestion', 'hint'] },
  { name: 'task_alt', tags: ['check', 'done', 'complete', 'ok'] },
  { name: 'token', tags: ['sparkle', 'ai', 'gemini'] },
  { name: 'bolt', tags: ['fast', 'energy', 'power'] },
  { name: 'rocket_launch', tags: ['space', 'deploy', 'start'] },
  { name: 'palette', tags: ['color', 'art', 'design'] },
  { name: 'shield', tags: ['security', 'protection', 'safe'] },
  { name: 'done', tags: ['check', 'complete', 'finished'] },
  { name: 'info', tags: ['information', 'details', 'about'] },
  { name: 'help', tags: ['question', 'support', 'faq'] },
  { name: 'warning', tags: ['alert', 'caution', 'error'] },
  { name: 'error', tags: ['problem', 'issue', 'alert'] },
  { name: 'thumb_up', tags: ['like', 'approve', 'agree'] },
  { name: 'thumb_down', tags: ['dislike', 'disapprove', 'disagree'] },
  { name: 'visibility', tags: ['eye', 'view', 'see', 'preview'] },
  { name: 'visibility_off', tags: ['eye', 'hide', 'hidden', 'unsee'] },
  { name: 'refresh', tags: ['reload', 'sync', 'update'] },
  { name: 'logout', tags: ['sign out', 'exit', 'leave'] },
  { name: 'login', tags: ['sign in', 'enter', 'access'] },
  { name: 'download', tags: ['save', 'get', 'import'] },
  { name: 'upload', tags: ['send', 'publish', 'export'] },
  { name: 'link', tags: ['url', 'connect', 'chain'] },
  { name: 'attach_file', tags: ['paperclip', 'attachment', 'upload'] },
  { name: 'share', tags: ['send', 'connect', 'social'] },
  { name: 'filter_list', tags: ['sort', 'options', 'filter'] },
  { name: 'flag', tags: ['report', 'mark', 'important'] },
  { name: 'bookmark', tags: ['save', 'favorite', 'remember'] },
  { name: 'print', tags: ['printer', 'document', 'copy'] },
  { name: 'launch', tags: ['open', 'external', 'new tab'] },
  { name: 'arrow_back', tags: ['left', 'previous', 'return'] },
  { name: 'arrow_forward', tags: ['right', 'next', 'continue'] },
  { name: 'arrow_upward', tags: ['up', 'top', 'scroll'] },
  { name: 'arrow_downward', tags: ['down', 'bottom', 'scroll'] },
  { name: 'expand_more', tags: ['down', 'arrow', 'dropdown'] },
  { name: 'expand_less', tags: ['up', 'arrow', 'collapse'] },
  { name: 'chevron_left', tags: ['back', 'arrow', 'previous'] },
  { name: 'chevron_right', tags: ['forward', 'arrow', 'next'] },
  { name: 'apps', tags: ['grid', 'menu', 'dashboard'] },
  { name: 'more_vert', tags: ['menu', 'options', 'dots'] },
  { name: 'more_horiz', tags: ['menu', 'options', 'dots'] },
  { name: 'check_circle', tags: ['success', 'done', 'complete'] },
  { name: 'cancel', tags: ['close', 'x', 'stop'] },
  { name: 'add_circle', tags: ['plus', 'new', 'create'] },
  { name: 'remove_circle', tags: ['minus', 'delete', 'remove'] },
  { name: 'control_camera', tags: ['move', 'arrows', 'position'] },
  { name: 'linked_camera', tags: ['photo', 'sync', 'connect'] },
  { name: 'timer', tags: ['clock', 'stopwatch', 'time'] },
  { name: 'audiotrack', tags: ['music', 'note', 'sound'] },
  { name: 'playlist_play', tags: ['music', 'list', 'queue'] },
  { name: 'album', tags: ['music', 'record', 'vinyl'] },
  { name: 'volume_down', tags: ['sound', 'audio', 'less'] },
  { name: 'volume_mute', tags: ['sound', 'audio', 'silent'] },
  { name: 'subtitles', tags: ['text', 'video', 'closed captions'] },
  { name: 'closed_caption', tags: ['cc', 'subtitles', 'video'] },
  { name: 'library_music', tags: ['songs', 'collection', 'audio'] },
  { name: 'computer', tags: ['desktop', 'monitor', 'pc'] },
  { name: 'desktop_windows', tags: ['computer', 'monitor', 'screen'] },
  { name: 'phone_iphone', tags: ['mobile', 'device', 'apple'] },
  { name: 'smartphone', tags: ['phone', 'mobile', 'android'] },
  { name: 'tablet_mac', tags: ['device', 'ipad', 'apple'] },
  { name: 'keyboard', tags: ['type', 'input', 'text'] },
  { name: 'mouse', tags: ['click', 'pointer', 'input'] },
  { name: 'speaker', tags: ['audio', 'sound', 'stereo'] },
  { name: 'gamepad', tags: ['controller', 'joystick', 'play'] },
  { name: 'watch', tags: ['time', 'clock', 'smartwatch'] },
  { name: 'headset_mic', tags: ['gaming', 'audio', 'support'] },
  { name: 'memory', tags: ['chip', 'processor', 'cpu'] },
  { name: 'router', tags: ['wifi', 'internet', 'network'] },
  { name: 'scanner', tags: ['document', 'scan', 'copy'] },
  { name: 'security_update_good', tags: ['check', 'phone', 'safe'] },
  { name: 'sd_storage', tags: ['card', 'memory', 'data'] },
  { name: 'sim_card', tags: ['phone', 'mobile', 'network'] },
  { name: 'content_copy', tags: ['duplicate', 'file', 'clone'] },
  { name: 'content_cut', tags: ['scissors', 'trim', 'edit'] },
  { name: 'content_paste', tags: ['clipboard', 'document', 'add'] },
  { name: 'drafts', tags: ['email', 'unread', 'message'] },
  { name: 'inbox', tags: ['email', 'messages', 'mail'] },
  { name: 'mark_email_read', tags: ['message', 'open', 'mail'] },
  { name: 'save', tags: ['disk', 'floppy', 'document'] },
  { name: 'sort', tags: ['filter', 'order', 'arrange'] },
  { name: 'file_copy', tags: ['duplicate', 'document', 'clone'] },
  { name: 'folder_open', tags: ['directory', 'files', 'storage'] },
  { name: 'folder_shared', tags: ['directory', 'people', 'collaboration'] },
  { name: 'attachment', tags: ['paperclip', 'file', 'link'] },
  { name: 'cloud_upload', tags: ['save', 'backup', 'data'] },
  { name: 'cloud_download', tags: ['get', 'backup', 'data'] },
  { name: 'cloud_done', tags: ['complete', 'check', 'backup'] },
  { name: 'grid_view', tags: ['layout', 'dashboard', 'squares'] },
  { name: 'view_list', tags: ['layout', 'rows', 'lines'] },
  { name: 'view_module', tags: ['layout', 'grid', 'apps'] },
  { name: 'view_quilt', tags: ['layout', 'grid', 'dashboard'] },
  { name: 'view_stream', tags: ['layout', 'list', 'rows'] },
  { name: 'toc', tags: ['table of contents', 'list', 'menu'] },
  { name: 'event', tags: ['calendar', 'date', 'schedule'] },
  { name: 'date_range', tags: ['calendar', 'schedule', 'time'] },
  { name: 'today', tags: ['calendar', 'date', 'day'] },
  { name: 'pending', tags: ['clock', 'wait', 'loading'] },
  { name: 'published_with_changes', tags: ['sync', 'arrows', 'approved'] },
  { name: 'g_translate', tags: ['google', 'language', 'words'] },
  { name: 'cookie', tags: ['biscuit', 'food', 'snack'] },
  { name: 'icecream', tags: ['dessert', 'food', 'summer'] },
  { name: 'cake', tags: ['dessert', 'birthday', 'party'] },
  { name: 'local_pizza', tags: ['food', 'slice', 'italian'] },
  { name: 'fastfood', tags: ['burger', 'fries', 'junk'] },
  { name: 'emoji_emotions', tags: ['smile', 'happy', 'face'] },
  { name: 'emoji_events', tags: ['trophy', 'winner', 'award'] },
  { name: 'emoji_nature', tags: ['tree', 'plant', 'forest'] },
  { name: 'emoji_objects', tags: ['lightbulb', 'idea', 'stuff'] },
  { name: 'emoji_people', tags: ['person', 'waving', 'human'] },
  { name: 'emoji_symbols', tags: ['music', 'heart', 'ampersand'] },
  { name: 'emoji_transportation', tags: ['car', 'vehicle', 'travel'] },
  { name: 'sentiment_satisfied', tags: ['happy', 'face', 'smile'] },
  { name: 'control_camera', tags: ['move', 'arrows', 'position'] },
  { name: 'linked_camera', tags: ['photo', 'sync', 'connect'] },
];

// Prompt Templates
export const ICON_STUDIO_3D_PROMPT_TEMPLATE = JSON.stringify({
  "task": "generate isometric 3D icon",
  "subject": "{ICON_SUBJECT}",
  "style_lock": true,
  "output": { "format": "png", "size": "2048x2048" },
  "negative_prompt": "vignette, dark corners, shadow artifacts, patterns, gradients, ground/drop shadows, stroke/outline, textures, scratches, dirt, noise, bevel/emboss, text, watermark, photographic background, fabric/leather realism, grunge, low-res, aliasing",
  "brand_tone": "vibrant, modern, friendly, premium",
  "system": { "scalable": true, "interchangeable": true },
  "background": { "type": "solid", "color": "#FFFFFF", "alpha": true },
  "render": {
    "quality": "ultra-high",
    "resolution": 2048,
    "separation": "by color/lighting/depth only"
  },
  "colors": {
    "dominant_blue": "#2962FF",
    "white": "#FFFFFF",
    "accent_light_blue": "#4FC3F7",
    "inherent_colors": "when object has a universal color identity (e.g. sun=yellow, carrot=orange/green, leaf=green), preserve it. Otherwise default to blue/white palette."
  },
  "materials": {
    "primary": "high-gloss blue plastic",
    "secondary": "clean matte white plastic",
    "accents": "minimal silver/chrome details only"
  },
  "lighting": {
    "mode": "soft diffused studio",
    "source": "top-front or top-right",
    "highlights": "clean specular on glossy areas",
    "shadows": "internal only; no ground/drop shadow"
  },
  "form": {
    "shapes": "rounded, smooth, bubbly",
    "edges": "crisp, no outlines"
  },
  "composition": {
    "elements": "single main subject, centered, no extra decorations",
    "depth": "distinct layering, slight elevation",
    "density": "minimal, focused center",
    "framing": "The entire subject must be fully visible and centered inside the frame. Leave a small, clean margin around all edges. Do not crop any part of the subject."
  },
  "camera": { "type": "isometric", "static": true },
  "canvas": { "ratio": "1:1", "safe_margins": true }
}, null, 2);

export const DEFAULT_3D_STYLE_PROMPT_TEMPLATE = JSON.stringify({
  "task": "generate isometric 3D icon",
  "subject": "{ICON_SUBJECT|backpack}",
  "style_lock": true,
  "output": { "format": "png", "size": "1536x672" },
  "negative_prompt": "vignette, dark corners, shadow artifacts, patterns, gradients, ground/drop shadows, stroke/outline, textures, scratches, dirt, noise, bevel/emboss, text, watermark, photographic background, fabric/leather realism, grunge, low-res, aliasing",
  "brand_tone": "vibrant, modern, friendly, premium",
  "system": { "scalable": true, "interchangeable": true },
  "background": { "type": "solid", "color": "#FFFFFF", "alpha": true },
  "render": {
    "quality": "ultra-high",
    "resolution": 1536,
    "separation": "by color/lighting/depth only"
  },
  "colors": {
    "dominant_blue": "#2962FF",
    "white": "#FFFFFF",
    "accent_light_blue": "#4FC3F7",
    "inherent_colors": "when object has a universal color identity (e.g. sun=yellow, carrot=orange/green, leaf=green), preserve it. Otherwise default to blue/white palette."
  },
  "materials": {
    "primary": "high-gloss blue plastic",
    "secondary": "clean matte white plastic",
    "accents": "minimal silver/chrome details only"
  },
  "lighting": {
    "mode": "soft diffused studio",
    "source": "top-front or top-right",
    "highlights": "clean specular on glossy areas",
    "shadows": "internal only; no ground/drop shadow"
  },
  "form": {
    "shapes": "rounded, smooth, bubbly",
    "edges": "crisp, no outlines"
  },
  "composition": {
    "elements": "single main subject, centered, no extra decorations",
    "depth": "distinct layering, slight elevation",
    "density": "minimal, focused center",
    "framing": "The entire subject must be fully visible and centered inside the frame. Leave a small, clean margin around all edges. Do not crop any part of the subject."
  },
  "camera": { "type": "isometric", "static": true },
  "canvas": { "ratio": "16:7", "safe_margins": true }
}, null, 2);

export const DEFAULT_2D_STYLE_PROMPT_TEMPLATE = JSON.stringify({
  "task": "generate a single 2D vector icon in the precise style of Google Material Symbols.",
  "subject": "{ICON_SUBJECT}",
  "style_lock": true,
  "controls": {
    "style": {
      "shape": "outlined",
      "fill": {
        "enabled": false
      }
    },
    "stroke": {
      "weight": {
        "value": 400,
        "unit": "weight"
      }
    },
    "color": {
      "primary": "#212121"
    }
  },
  "output": {
    "format": "png",
    "size": "1024x1024",
    "background": "#FFFFFF"
  },
  "constraints": {
    "single_output": true,
    "no_variations_or_set": true
  },
  "negative_prompt": "3D, photo, realism, shading, gradients, textures, raster, pixelated, complex details, multiple icons, variations, set, collage, hand-drawn, overly detailed, skeuomorphic, shadows",
  "brand_tone": "Google Material Design, clean, minimal, consistent, modern, utilitarian",
  "style_rules": {
    "inspiration": "Google Material Symbols (fonts.google.com/icons)",
    "render_type": "outlined",
    "stroke_weight_map": "weight 100-900 -> 1-4px, perfectly uniform stroke width",
    "corner_radius_map": "rounded -> 6-12% | sharp -> 0% | outlined -> 2-4%",
    "grid": "24x24 dp material design icon grid",
    "alignment": "pixel-perfect, centered within the 24x24 grid",
    "geometry": "simple, geometric, bold, with minimal detail",
    "line_caps": "rounded",
    "line_joins": "rounded"
  },
  "composition": {
    "elements": "exactly one icon, centered",
    "margin": "15%"
  }
}, null, 2);

// Animation Details
export const ANIMATION_DETAILS: { [key: string]: { duration: string; timing: string; keyframes: string; } } = {
  'fade-in': { duration: '1s', timing: 'forwards', keyframes: `@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }` },
  'fade-out': { duration: '1s', timing: 'forwards', keyframes: `@keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }` },
  'bounce': { duration: '1s', timing: 'ease', keyframes: `@keyframes bounce { 0%, 20%, 50%, 80%, 100% { transform: translateY(0); } 40% { transform: translateY(-30px); } 60% { transform: translateY(-15px); } }` },
  'scale': { duration: '1s', timing: 'ease', keyframes: `@keyframes scale { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.2); } }` },
  'shake': { duration: '0.82s', timing: 'cubic-bezier(.36,.07,.19,.97) both', keyframes: `@keyframes shake { 0% { transform: translate(1px, 1px) rotate(0deg); } 10% { transform: translate(-1px, -2px) rotate(-1deg); } 20% { transform: translate(-3px, 0px) rotate(1deg); } 30% { transform: translate(3px, 2px) rotate(0deg); } 40% { transform: translate(1px, -1px) rotate(1deg); } 50% { transform: translate(-1px, 2px) rotate(-1deg); } 60% { transform: translate(-3px, 1px) rotate(0deg); } 70% { translate(3px, 1px) rotate(-1deg); } 80% { transform: translate(-1px, -1px) rotate(1deg); } 90% { transform: translate(1px, 2px) rotate(0deg); } 100% { transform: translate(1px, -2px) rotate(-1deg); } }` },
  'rotate': { duration: '1s', timing: 'linear', keyframes: `@keyframes rotate { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }` },
  'breathe': { duration: '4s', timing: 'ease-in-out', keyframes: `@keyframes breathe { 0% { transform: scale(0.9); } 25% { transform: scale(1); } 50% { transform: scale(0.9); } 75% { transform: scale(1); } 100% { transform: scale(0.9); } }` },
  'pulse': { duration: '2s', timing: 'ease-in-out', keyframes: `@keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.1); } 100% { transform: scale(1); } }` },
  'variable-color': { duration: '5s', timing: 'ease-in-out', keyframes: `@keyframes variableColor { 0% { color: #4285F4; } 25% { color: #DB4437; } 50% { color: #F4B400; } 75% { color: #0F9D58; } 100% { color: #4285F4; } }` },
  'draw-on': { duration: '1s', timing: 'forwards', keyframes: `@keyframes drawOn { from { mask: linear-gradient(to right, #000 0%, #000 0%, transparent 0%, transparent 100%); } to { mask: linear-gradient(to right, #000 0%, #000 100%, transparent 100%, transparent 100%); } }` },
  'draw-off': { duration: '1s', timing: 'forwards', keyframes: `@keyframes drawOff { from { mask: linear-gradient(to left, #000 0%, #000 0%, transparent 0%, transparent 100%); } to { mask: linear-gradient(to left, #000 0%, #000 100%, transparent 100%, transparent 100%); } }` },
  'replace': { duration: '1s', timing: 'forwards', keyframes: `@keyframes replace { from { clip-path: circle(0% at 50% 50%); } to { clip-path: circle(75% at 50% 50%); } }` },
};

export const PREVIEW_ANIMATION_CLASSES = [
  'animate-preview-jump',
  'animate-preview-spin',
  'animate-preview-pulse',
  'animate-preview-shake',
  'animate-preview-bounce'
];

export const VIDEO_LOADER_MESSAGES = [
  "Warming up the pixels...",
  "Choreographing the digital dance...",
  "Rendering cinematic magic...",
  "This is where the magic happens...",
  "Assembling frames, one by one...",
  "Just a moment, great art takes time.",
  "Our AI is working its visual wonders...",
];
