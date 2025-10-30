/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, GenerateContentResponse, Modality, Chat, Type } from '@google/genai';
import {marked} from 'https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js';
import ImageTracer from 'imagetracerjs';

// --- TYPE DEFINITIONS ---
interface IconData {
  name: string;
  tags: string[];
}

interface ToastOptions {
  type: 'success' | 'error';
  title: string;
  body: string;
  duration?: number;
}

type GeneratedImageData = {
  id: string;
  data: string; // base64
  mimeType: string;
  subject: string;
  styleConstraints: string;
  timestamp: number;
  videoDataUrl?: string;
  motionPrompt?: { json: any, korean: string, english:string } | null;
  originalData?: string; // Original image data before fix
  originalMimeType?: string; // Original image mimeType before fix
  modificationType?: string; // Type of modification: Original, Remove Background, SVG, Modified
};

// --- WRAP IN DOMCONTENTLOADED TO PREVENT RACE CONDITIONS ---
window.addEventListener('DOMContentLoaded', () => {

  // --- STATE ---
  let selectedIcon: IconData | null = null;
  let currentAnimationTimeout: number | null = null;
  let currentGeneratedIcon3d: { data: string, prompt: string, userPrompt: string } | null = null;
  
  // 3D Page State
  let currentGeneratedImage: GeneratedImageData | null = null;
  let imageHistory: GeneratedImageData[] = [];
  let historyIndex = -1;
  
  // 2D Page State
  let currentGeneratedImage2d: GeneratedImageData | null = null;
  let imageHistory2d: GeneratedImageData[] = []; // Left sidebar history (all prompts)
  let historyIndex2d = -1;
  let detailsPanelHistory2d: GeneratedImageData[] = []; // Right panel history (only Fix modifications)
  let detailsPanelHistoryIndex2d = -1;
  let referenceImagesForEdit2d: ({ file: File; dataUrl: string } | null)[] = [null, null, null, null];
  
  // 2D Studio: Local state for background removal
  let p2dOriginalImageData: string | null = null; // Cache original image data
  let p2dHasBackgroundRemoved = false; // Track if background was removed

  let referenceImagesFor3d: ({ file: File; dataUrl: string } | null)[] = [null, null, null];
  let referenceImagesForIconStudio3d: ({ file: File; dataUrl: string } | null)[] = [null, null, null];
  let motionFirstFrameImage: { file: File; dataUrl: string; } | null = null;
  let motionLastFrameImage: { file: File; dataUrl: string; } | null = null;
  let motionFirstFrameImageStudio: { file: File; dataUrl: string; } | null = null;
  let motionLastFrameImageStudio: { file: File; dataUrl: string; } | null = null;
  let currentPage = 'page-usages';
  let isGeneratingVideo = false;
  let currentVideoGenerationOperation: any = null;
  let lastFocusedElement: HTMLElement | null = null;
  
  // Explore page state
  let exploreMedia: any[] = [];
  let currentSelectedExploreMedia: any | null = null;
  let fileToRenameId: string | null = null;
  let videoObserver: IntersectionObserver | null = null;
  
  // Banner Toast State
  let bannerToastTimer: number | null = null;

  // Motion prompt state
  let currentMotionCategories: any[] = [];
  let videoMessageInterval: number | null = null;

  // Image Library state
  let imageLibrary: {id: string, dataUrl: string, mimeType: string}[] = [];

  // Image Studio state
  let imageStudioReferenceImages: ({ file: File; dataUrl: string; } | null)[] = [null, null, null];
  let currentGeneratedImageStudio: GeneratedImageData | null = null;
  let imageStudioHistory: GeneratedImageData[] = [];
  let imageStudioHistoryIndex = -1;
  let imageStudioSubjectImage: { file: File; dataUrl: string } | null = null;
  let imageStudioSceneImage: { file: File; dataUrl: string } | null = null;
  let currentImageStudioModalType: 'subject' | 'scene' | null = null;
  
  // Main Page State (3D Studio functionality)
  let currentGeneratedImageMain: GeneratedImageData | null = null;
  let imageHistoryMain: GeneratedImageData[] = [];
  let historyIndexMain = -1;
  let mainReferenceImage: string | null = null;

  // --- CONSTANTS ---
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const ICON_STUDIO_3D_PROMPT_TEMPLATE = JSON.stringify({
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
  const DEFAULT_3D_STYLE_PROMPT_TEMPLATE = JSON.stringify({
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
  
  const DEFAULT_2D_STYLE_PROMPT_TEMPLATE = JSON.stringify({
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


  const ICON_DATA: IconData[] = [
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
    { name: 'more_vert', tags: ['dots', 'options', 'menu'] },
    { name: 'more_horiz', tags: ['dots', 'options', 'menu'] },
    { name: 'unfold_more', tags: ['expand', 'collapse', 'arrows'] },
    { name: 'call', tags: ['phone', 'contact', 'telephone'] },
    { name: 'chat', tags: ['message', 'talk', 'bubble'] },
    { name: 'forum', tags: ['community', 'discussion', 'messages'] },
    { name: 'send', tags: ['submit', 'message', 'mail'] },
    { name: 'notifications', tags: ['bell', 'alert', 'reminders'] },
    { name: 'format_bold', tags: ['text', 'style', 'bold'] },
    { name: 'format_italic', tags: ['text', 'style', 'italic'] },
    { name: 'format_underlined', tags: ['text', 'style', 'underline'] },
    { name: 'format_align_left', tags: ['text', 'style', 'align'] },
    { name: 'format_align_center', tags: ['text', 'style', 'align'] },
    { name: 'format_align_right', tags: ['text', 'style', 'align'] },
    { name: 'format_quote', tags: ['text', 'style', 'blockquote'] },
    { name: 'format_list_bulleted', tags: ['text', 'style', 'list'] },
    { name: 'format_list_numbered', tags: ['text', 'style', 'list'] },
    { name: 'image', tags: ['photo', 'picture', 'gallery'] },
    { name: 'photo_camera', tags: ['camera', 'picture', 'take photo'] },
    { name: 'videocam', tags: ['video', 'camera', 'record'] },
    { name: 'play_arrow', tags: ['start', 'run', 'video'] },
    { name: 'pause', tags: ['stop', 'hold', 'video'] },
    { name: 'stop', tags: ['end', 'video', 'media'] },
    { name: 'volume_up', tags: ['sound', 'audio', 'music'] },
    { name: 'volume_off', tags: ['mute', 'sound', 'audio'] },
    { name: 'mic', tags: ['microphone', 'record', 'voice'] },
    { name: 'mic_off', tags: ['mute', 'microphone', 'voice'] },
    { name: 'fullscreen', tags: ['expand', 'view', 'screen'] },
    { name: 'file_present', tags: ['document', 'file', 'attachment'] },
    { name: 'folder', tags: ['directory', 'files', 'storage'] },
    { name: 'analytics', tags: ['chart', 'data', 'statistics'] },
    { name: 'pie_chart', tags: ['data', 'graph', 'analytics'] },
    { name: 'database', tags: ['data', 'storage', 'server'] },
    { name: 'key', tags: ['password', 'login', 'security'] },
    { name: 'lock', tags: ['security', 'password', 'private'] },
    { name: 'public', tags: ['world', 'global', 'internet'] },
    { name: 'map', tags: ['location', 'gps', 'navigation'] },
    { name: 'place', tags: ['location', 'marker', 'pin'] },
    { name: 'restaurant', tags: ['food', 'dining', 'eat'] },
    { name: 'local_mall', tags: ['shopping', 'bag', 'store'] },
    { name: 'work', tags: ['briefcase', 'job', 'office'] },
    { name: 'calendar_month', tags: ['date', 'schedule', 'event'] },
    { name: 'schedule', tags: ['time', 'clock', 'watch'] },
    { name: 'language', tags: ['translate', 'web', 'global'] },
    { name: 'code', tags: ['developer', 'programming', 'script'] },
    { name: 'terminal', tags: ['console', 'code', 'developer'] },
    { name: 'bug_report', tags: ['debug', 'issue', 'error'] },
    { name: 'dashboard', tags: ['grid', 'layout', 'home'] },
    { name: 'groups', tags: ['people', 'team', 'users'] },
    { name: 'science', tags: ['test', 'lab', 'experiment'] },
    { name: 'construction', tags: ['tools', 'build', 'wrench'] },
    { name: 'psychology', tags: ['brain', 'idea', 'think'] },
    { name: 'eco', tags: ['leaf', 'nature', 'green'] },
    { name: 'pets', tags: ['animal', 'dog', 'cat', 'paw'] },
    { name: 'savings', tags: ['money', 'piggy bank', 'finance'] },
    { name: 'credit_card', tags: ['payment', 'finance', 'money'] },
    { name: 'receipt_long', tags: ['invoice', 'bill', 'payment'] },
    { name: 'account_balance', tags: ['bank', 'finance', 'money'] },
    { name: 'description', tags: ['file', 'document', 'text'] },
    { name: 'bed', tags: ['sleep', 'hotel', 'rest'] },
    { name: 'coffee', tags: ['drink', 'cup', 'cafe'] },
    { name: 'sports_esports', tags: ['gaming', 'controller', 'play'] },
    { name: 'school', tags: ['education', 'learn', 'student'] },
    { name: 'celebration', tags: ['party', 'event', 'confetti'] },
    { name: 'movie', tags: ['film', 'video', 'cinema'] },
    { name: 'music_note', tags: ['sound', 'audio', 'song'] },
    { name: 'star', tags: ['favorite', 'rating', 'special'] },
    { name: 'sunny', tags: ['weather', 'light', 'day'] },
    { name: 'bedtime', tags: ['moon', 'night', 'dark'] },
    { name: 'build', tags: ['wrench', 'tool', 'construct'] },
    { name: 'fingerprint', tags: ['security', 'id', 'biometric'] },
    { name: 'face', tags: ['person', 'profile', 'user'] },
    { name: 'verified', tags: ['check', 'security', 'badge'] },
    { name: 'support_agent', tags: ['customer service', 'help', 'headset'] },
    { name: 'sell', tags: ['tag', 'price', 'commerce'] },
    { name: 'store', tags: ['shop', 'building', 'commerce'] },
    { name: 'credit_score', tags: ['finance', 'money', 'rating'] },
    { name: 'history', tags: ['time', 'clock', 'rewind'] },
    { name: 'backup', tags: ['cloud', 'upload', 'save'] },
    { name: 'translate', tags: ['language', 'words', 'international'] },
    { name: 'sync_alt', tags: ['arrows', 'data', 'transfer'] },
    { name: 'record_voice_over', tags: ['speech', 'person', 'audio'] },
    { name: 'voice_chat', tags: ['talk', 'message', 'audio'] },
    { name: 'location_on', tags: ['pin', 'map', 'place'] },
    { name: 'home_repair_service', tags: ['tools', 'wrench', 'fix'] },
    { name: 'water_drop', tags: ['liquid', 'rain', 'aqua'] },
    { name: 'local_fire_department', tags: ['flame', 'hot', 'emergency'] },
    { name: 'flight', tags: ['airplane', 'travel', 'trip'] },
    { name: 'directions_car', tags: ['vehicle', 'auto', 'transportation'] },
    { name: 'train', tags: ['railway', 'subway', 'transportation'] },
    { name: 'local_shipping', tags: ['truck', 'delivery', 'vehicle'] },
    { name: 'hotel', tags: ['bed', 'sleep', 'travel'] },
    { name: 'local_bar', tags: ['drink', 'alcohol', 'cocktail'] },
    { name: 'fitness_center', tags: ['gym', 'dumbbell', 'workout'] },
    { name: 'spa', tags: ['wellness', 'flower', 'relax'] },
    { name: 'beach_access', tags: ['umbrella', 'sand', 'summer'] },
    { name: 'casino', tags: ['dice', 'gambling', 'game'] },
    { name: 'child_friendly', tags: ['baby', 'stroller', 'kid'] },
    { name: 'photo_album', tags: ['images', 'gallery', 'book'] },
    { name: 'camera_alt', tags: ['photo', 'picture', 'shutter'] },
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
    { name: 'add_circle', tags: ['plus', 'new', 'create'] },
    { name: 'cancel', tags: ['close', 'x', 'stop'] },
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
    { name: 'sentiment_satisfied', tags: ['happy', 'face', 'smile'] }
  ];
  const ANIMATION_DETAILS: { [key: string]: { duration: string; timing: string; keyframes: string; } } = {
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
  const PREVIEW_ANIMATION_CLASSES = [
    'animate-preview-jump',
    'animate-preview-spin',
    'animate-preview-pulse',
    'animate-preview-shake',
    'animate-preview-bounce'
  ];
  const VIDEO_LOADER_MESSAGES = [
    "Warming up the pixels...",
    "Choreographing the digital dance...",
    "Rendering cinematic magic...",
    "This is where the magic happens...",
    "Assembling frames, one by one...",
    "Just a moment, great art takes time.",
    "Our AI is working its visual wonders...",
  ];

  // --- DOM ELEMENTS ---
  const $ = (selector: string): HTMLElement | null => document.querySelector(selector);
  const $$ = (selector: string): NodeListOf<HTMLElement> => document.querySelectorAll(selector);

  const body = document.body;
  const navItems = $$('.nav-item');
  const pageContainers = $$('.page-container');
  const themeToggleButton = $('.theme-toggle-btn');
  const iconGrid = $('#icon-grid');
  const iconGridPanel = $('.icon-grid-panel');
  const searchInput = $('#search-input') as HTMLInputElement;
  const settingsPanel = $('#settings-panel');
  const settingsCloseBtn = $('#settings-close-btn');
  const settingsTitle = $('#settings-title');
  const settingsPreviewIcon = $('#settings-preview-icon');
  const convertTo3DBtn = $('#convert-to-3d-btn');
  const generatedImageIcon = $('#generated-image') as HTMLImageElement;
  const loader3d = $('#loader');
  const promptDisplay3d = $('#prompt-display-3d') as HTMLTextAreaElement;
  const userPrompt3d = $('#user-prompt-3d') as HTMLInputElement;
  const placeholder3d = $('#id-3d-placeholder');
  const errorPlaceholder3d = $('#id-3d-error-placeholder');
  const download3DBtn = $('#download-3d-btn') as HTMLAnchorElement;
  const regenerate3DBtn = $('#regenerate-3d-btn');
  const viewLargerBtn = $('#view-larger-btn');
  const toggleFiltersBtn = $('#toggle-filters-panel-btn');
  const iconsPage = $('#page-icons');
  const filtersCloseBtn = $('#filters-close-btn');
  const filtersPanel = $('.filters-panel');
  
  // Main 3D page elements
  const imageGenerateBtn = $('#image-generate-btn');
  const imagePromptSubjectInput = $('#image-prompt-subject-input') as HTMLInputElement;
  const imagePromptDisplay = $('#image-prompt-display') as HTMLTextAreaElement;
  const resultIdlePlaceholder = $('#result-idle-placeholder');
  const resultPlaceholder = $('#page-id-3d .result-placeholder');
  const resultImage = $('#page-id-3d .result-image') as HTMLImageElement;
  const resultVideo = $('#page-id-3d .result-video') as HTMLVideoElement;
  const resultError = $('#page-id-3d .result-error');
  const retryGenerateBtn = $('#retry-generate-btn');
  const historyPanel = $('#page-id-3d .history-panel');
  const historyList = $('#history-list');
  const historyBackBtn = $('#history-back-btn') as HTMLButtonElement;
  const historyForwardBtn = $('#history-forward-btn') as HTMLButtonElement;
  const historyCounter = $('#history-counter');
  const mainResultContentHeader = $('#page-id-3d .result-item-content .result-content-header');
  const detailsPanel = $('#image-details-panel');
  const detailsCloseBtn = $('#details-close-btn');
  const detailsPreviewImage = $('#details-preview-image') as HTMLImageElement;
  const detailsDownloadBtn = $('#details-download-btn') as HTMLAnchorElement;
  const detailsCopyBtn = $('#details-copy-btn');
  const detailsDeleteBtn = $('#details-delete-btn');
  const detailsUpscaleBtn = $('#details-upscale-btn');
  const detailsFixBtn = $('#details-fix-btn');
  const detailsBackgroundColorPicker = $('#details-background-color-picker-3d') as HTMLInputElement;
  const detailsObjectColorPicker = $('#details-object-color-picker-3d') as HTMLInputElement;
  const shadowToggleIcons = $('#shadow-toggle-icons') as HTMLInputElement;
  const shadowToggle3d = $('#shadow-toggle-3d') as HTMLInputElement;
  const toggleDetailsPanelBtn = $('#toggle-details-panel-btn');
  const previewSwitcherImageBtn = $('.preview-switcher .preview-tab-item[data-tab="image"]');
  const previewSwitcherVideoBtn = $('.preview-switcher .preview-tab-item[data-tab="video"]');
  const motionPromptPlaceholder = $('#motion-prompt-placeholder');
  
  // 2D Page Elements
  const imageGenerateBtn2d = $('#p2d-image-generate-btn');
  const imagePromptSubjectInput2d = $('#p2d-image-prompt-subject-input') as HTMLInputElement;
  const imagePromptDisplay2d = $('#p2d-image-prompt-display') as HTMLTextAreaElement;
  const resultIdlePlaceholder2d = $('#p2d-result-idle-placeholder');
  const resultPlaceholder2d = $('#page-id-2d .result-placeholder');
  const resultImage2d = $('#page-id-2d .result-image') as HTMLImageElement;
  const resultError2d = $('#page-id-2d .result-error');
  const retryGenerateBtn2d = $('#p2d-retry-generate-btn');
  const historyPanel2d = $('#page-id-2d .history-panel');
  const historyList2d = $('#p2d-history-list');
  const historyBackBtn2d = $('#p2d-history-back-btn') as HTMLButtonElement;
  const historyForwardBtn2d = $('#p2d-history-forward-btn') as HTMLButtonElement;
  const historyCounter2d = $('#p2d-history-counter');
  const mainResultContentHeader2d = $('#page-id-2d .result-item-content .result-content-header');
  const detailsPanel2d = $('#p2d-image-details-panel');
  const detailsCloseBtn2d = $('#p2d-details-close-btn');
  const detailsPreviewImage2d = $('#p2d-details-preview-image') as HTMLImageElement;
  const detailsDownloadBtn2d = $('#p2d-details-download-btn') as HTMLAnchorElement;
  const detailsCopyBtn2d = $('#p2d-details-copy-btn');
  const detailsDeleteBtn2d = $('#p2d-details-delete-btn');
  const toggleDetailsPanelBtn2d = $('#p2d-toggle-details-panel-btn');

  // Motion Tab (Details Panel)
  const motionTabBtn = $('.details-panel-tabs .tab-item[data-tab="motion"]');
  const motionTabContent = $('.details-panel .details-tab-content[data-tab-content="motion"]');
  const motionPreviewIcon = $('#motion-preview-icon');
  const motionThumbnailImage = $('#motion-thumbnail-image') as HTMLImageElement;
  const motionThumbnailLabel = $('#motion-thumbnail-label');
  const motionAnimationSelect = $('#motion-animation-select') as HTMLSelectElement;
  const motionRepeatSelect = $('#motion-repeat-select') as HTMLSelectElement;
  const motionVideoContainer = $('#motion-video-container');
  const motionVideoPlayer = $('#motion-video-player') as HTMLVideoElement;
  const motionVideoLoader = $('#motion-video-loader');
  const generateMotionPromptBtn = $('#generate-motion-prompt-btn');
  const regenerateMotionPromptBtn = $('#regenerate-motion-prompt-btn');
  const generateVideoBtn = $('#generate-video-btn');
  const regenerateVideoBtn = $('#regenerate-video-btn');
  const downloadVideoBtn = $('#download-video-btn') as HTMLAnchorElement;
  const motionPromptOutput = $('#motion-prompt-output');
  const motionGenStatusText = $('#motion-gen-status-text');
  const motionPlayBtn = $('#motion-play-btn');
  const generateMotionFromPreviewBtn = $('#generate-motion-from-preview-btn');
  const convertToLottieBtn = $('#convert-to-lottie-btn');
  
  // Image Modal
  const imageModal = $('#image-modal');
  const imageModalView = $('#image-modal-view') as HTMLImageElement;
  const imageModalCloseBtn = $('#image-modal-close-btn');
  const imageModalRegenerateBtn = $('#image-modal-regenerate-btn');
  const imageModalDownloadBtn = $('#image-modal-download-btn') as HTMLAnchorElement;

  // Motion Category Modal
  const motionCategoryModal = $('#motion-category-modal');
  const motionCategoryList = $('#motion-category-list');
  const motionCategoryCloseBtn = $('#motion-category-close-btn');
  
  // Image Studio Motion Elements
  const previewSwitcherImageBtnStudio = $('#result-item-main-image .preview-tab-item[data-tab="image"]');
  const previewSwitcherVideoBtnStudio = $('#result-item-main-image .preview-tab-item[data-tab="motion"]');
  const motionPromptPlaceholderStudio = $('#motion-prompt-placeholder-image');
  const resultImageStudio = $('#result-image-image') as HTMLImageElement;
  const resultVideoStudio = $('#result-video-image') as HTMLVideoElement;
  const motionThumbnailImageStudio = $('#motion-thumbnail-image-image') as HTMLImageElement;
  const motionThumbnailLabelStudio = $('#motion-thumbnail-label-image');
  const generateMotionPromptBtnStudio = $('#generate-motion-prompt-btn-image');
  const regenerateMotionPromptBtnStudio = $('#regenerate-motion-prompt-btn-image');
  const generateVideoBtnStudio = $('#generate-video-btn-image');
  const regenerateVideoBtnStudio = $('#regenerate-video-btn-image');
  const downloadVideoBtnStudio = $('#download-video-btn-image') as HTMLAnchorElement;
  const detailsPanelImageStudio = $('#image-details-panel-image');
  const detailsTabBtnDetailImageStudio = $('#image-details-panel-image .tab-item[data-tab="detail"]');
  const detailsTabBtnMotionImageStudio = $('#image-details-panel-image .tab-item[data-tab="motion"]');
  const generateMotionFromPreviewBtnImage = $('#generate-motion-from-preview-btn-image');

  // Loader Modals
  const imageGenerationLoaderModal = $('#image-generation-loader-modal');
  const videoGenerationLoaderModal = $('#video-generation-loader-modal');
  const videoLoaderMessage = $('#video-loader-message');
  const p2dLoaderModal = $('#p2d-loader-modal');
  const p2dLoaderMessage = $('#p2d-loader-message');
  
  // 2D Studio: New action buttons
  const p2dRevertBackgroundBtn = $('#p2d-revert-background-btn');
  const p2dPreviewResultBtn = $('#p2d-preview-result-btn');
  const p2dCompareBtn = $('#p2d-compare-btn');
  const p2dCopySvgBtn = $('#p2d-copy-svg-btn');
  
  // 2D Studio: Modals
  const p2dSvgPreviewModal = $('#p2d-svg-preview-modal');
  const p2dCompareModal = $('#p2d-compare-modal');
  
  // Explore Page
  const explorePage = $('#page-usages');
  const exploreMain = $('.explore-main');
  
  // Main Page Elements (3D Studio functionality)
  const mainReferenceContainer = $('#main-reference-container');
  const mainReferenceDropZone = $('#main-reference-drop-zone');
  const mainGenerateWithTextBtn = $('#main-generate-with-text-btn');
  const mainAttachImageBtn = $('#main-attach-image-btn');
  const mainRemoveReferenceBtn = $('#main-remove-reference-btn');
  const mainGenerationLoaderModal = $('#main-generation-loader-modal');
  const exploreFeed = $('#explore-feed');
  const exploreDetailsPanel = $('#explore-details-panel');
  const exploreDetailsCloseBtn = $('#explore-details-close-btn');
  const exploreDetailsTitle = $('#explore-details-title');
  const exploreDetailsPreviewContainer = $('#explore-details-preview-container');
  const exploreDetailsInfo = $('#explore-details-info');
  const exploreDetailsPromptContainer = $('#explore-details-prompt');
  const exploreDetailsPromptCode = $('#explore-details-prompt-code');
  const exploreDetailsNoPrompt = $('#explore-details-no-prompt');
  const exploreDetailsDownloadBtn = $('#explore-details-download-btn') as HTMLAnchorElement;
  const exploreDetailsRenameBtn = $('#explore-details-rename-btn');
  const exploreDetailsDeleteBtn = $('#explore-details-delete-btn');
  const exploreUploadInput = $('#explore-upload-input') as HTMLInputElement;
  const exploreSearchInput = $('#explore-search-input') as HTMLInputElement;
  const exploreUploadBtn = $('#explore-upload-btn');
  const exploreContentModalOverlay = $('#explore-content-modal-overlay');
  const exploreContentModalTitle = $('#explore-content-modal-title');
  const exploreContentModalViewContainer = $('#explore-content-modal-view-container');
  const exploreContentModalCloseBtn = $('#explore-content-modal-close-btn');
  const exploreContentModalDeleteBtn = $('#explore-content-modal-delete-btn');
  const exploreContentModalDownloadBtn = $('#explore-content-modal-download-btn') as HTMLAnchorElement;
  const uploadChoiceModal = $('#upload-choice-modal');
  const uploadChoiceCloseBtn = $('#upload-choice-close-btn');
  const uploadFromDeviceBtn = $('#upload-from-device-btn');
  
  // Rename Modal
  const renameModalOverlay = $('#rename-modal-overlay');
  const renameModalForm = $('#rename-modal-form') as HTMLFormElement;
  const renameModalInput = $('#rename-modal-input') as HTMLInputElement;
  const renameModalCancel = $('#rename-modal-cancel');

  // Icon Studio Details Panel Elements
  const downloadSvgBtn = $('#download-svg-btn') as HTMLButtonElement;
  const downloadPngBtn = $('#download-png-btn') as HTMLButtonElement;
  const copyJsxBtn = $('#copy-jsx-btn') as HTMLButtonElement;
  const snippetTabsContainer = $('#snippet-tabs');
  const snippetTabs = $$('#snippet-tabs .snippet-tab-item');
  const snippetCode = $('#snippet-code');
  const copySnippetBtn = $('#copy-snippet-btn') as HTMLButtonElement;

  // --- HELPER FUNCTIONS ---

  const saveImageLibrary = () => {
    try {
      localStorage.setItem('imageLibrary', JSON.stringify(imageLibrary));
    } catch (e) {
      console.error("Failed to save image library to localStorage", e);
    }
  };

  const loadImageLibrary = () => {
    try {
      const savedLibrary = localStorage.getItem('imageLibrary');
      if (savedLibrary) {
        imageLibrary = JSON.parse(savedLibrary);
      }
    } catch (e) {
      console.error("Failed to load image library from localStorage", e);
      imageLibrary = [];
    }
  };

  const renderImageLibrary = () => {
    const processLibrary = (
      libraryListEl: HTMLElement | null, 
      placeholderEl: HTMLElement | null, 
      refImagesState: ({ file: File; dataUrl: string } | null)[], 
      refContainerSelector: string
    ) => {
      if (!libraryListEl || !placeholderEl) return;

      libraryListEl.innerHTML = '';
      if (imageLibrary.length === 0) {
        placeholderEl.classList.remove('hidden');
      } else {
        placeholderEl.classList.add('hidden');
        imageLibrary.forEach((item, index) => {
          const libraryItem = document.createElement('div');
          libraryItem.className = 'library-item';
          libraryItem.dataset.id = item.id;
          libraryItem.title = "Click to add to an empty reference slot";
          libraryItem.innerHTML = `
            <img src="${item.dataUrl}" alt="Saved image ${index + 1}" class="library-item-img">
            <button class="library-item-delete-btn icon-button" aria-label="Delete image ${index + 1}">
              <span class="material-symbols-outlined">delete</span>
            </button>
          `;
          
          const deleteBtn = libraryItem.querySelector('.library-item-delete-btn');
          deleteBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            imageLibrary.splice(index, 1);
            saveImageLibrary();
            renderImageLibrary();
            showToast({ type: 'success', title: 'Deleted', body: 'Image removed from library.' });
          });
          
          libraryItem.addEventListener('click', () => {
            const dropZoneContainer = $(refContainerSelector);
            const emptySlotIndex = refImagesState.findIndex(slot => slot === null);
            
            if (emptySlotIndex !== -1 && dropZoneContainer) {
              fetch(item.dataUrl)
                .then(res => res.blob())
                .then(blob => {
                  const file = new File([blob], `library_ref_${item.id}.${item.mimeType.split('/')[1] || 'png'}`, { type: item.mimeType });
                  const dropZone = dropZoneContainer.querySelector<HTMLElement>(`.image-drop-zone[data-index="${emptySlotIndex}"]`);
                  if (dropZone) {
                      handleFileForDropZone(file, dropZone, refImagesState);
                      showToast({ type: 'success', title: 'Image Added', body: 'Image added as a reference.' });
                  }
                });
            } else {
              showToast({ type: 'error', title: 'No Empty Slots', body: 'All reference image slots are full.' });
            }
          });

          libraryListEl.appendChild(libraryItem);
        });
      }
    };
    
    processLibrary(
      $('#image-library-list'), 
      $('#image-library-placeholder'), 
      referenceImagesFor3d,
      '#edit-reference-image-container-3d'
    );
    processLibrary(
      $('#p2d-image-library-list'), 
      $('#p2d-image-library-placeholder'),
      referenceImagesForEdit2d,
      '#p2d-edit-reference-image-container-3d'
    );
  };

  const setupTabs = (container: HTMLElement | null) => {
    if (!container) return;
    const tabButtons = container.querySelectorAll<HTMLElement>('.tab-item');
    const tabContents = container.querySelectorAll<HTMLElement>('.tab-content, .details-tab-content');

    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const tabName = button.dataset.tab;

        tabButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        tabContents.forEach(content => {
          const contentName = (content as HTMLElement).dataset.tabContent || (content as HTMLElement).dataset.tab;
          content.classList.toggle('hidden', contentName !== tabName);
          content.classList.toggle('active', contentName === tabName);
        });
      });
    });
  };

  const showToast = (options: ToastOptions) => {
    const toast = $('#banner-toast');
    const icon = $('#banner-toast-icon');
    const title = $('#banner-toast-title');
    const body = $('#banner-toast-body');

    if (!toast || !icon || !title || !body) return;

    if (bannerToastTimer) {
        clearTimeout(bannerToastTimer);
    }

    toast.className = 'banner-toast'; // Reset classes
    toast.classList.add(options.type);

    icon.textContent = options.type === 'success' ? 'check_circle' : 'error';
    title.textContent = options.title;
    body.textContent = options.body;

    toast.classList.remove('hidden');
    
    // Trigger confetti for success toasts
    if (options.type === 'success') {
        triggerConfetti();
    }

    bannerToastTimer = window.setTimeout(() => {
        toast.classList.add('hidden');
    }, options.duration || 5000);
  };
  
  const triggerConfetti = () => {
    // Create confetti particles
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE'];
    const confettiCount = 150;
    
    for (let i = 0; i < confettiCount; i++) {
      createConfettiParticle(colors[Math.floor(Math.random() * colors.length)]);
    }
  };
  
  const createConfettiParticle = (color: string) => {
    const confetti = document.createElement('div');
    confetti.style.position = 'fixed';
    confetti.style.width = Math.random() * 10 + 5 + 'px';
    confetti.style.height = confetti.style.width;
    confetti.style.backgroundColor = color;
    confetti.style.left = Math.random() * 100 + '%';
    confetti.style.top = '-10px';
    confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
    confetti.style.pointerEvents = 'none';
    confetti.style.zIndex = '1000';
    document.body.appendChild(confetti);
    
    const rotation = Math.random() * 360;
    const horizontalMovement = (Math.random() - 0.5) * 200;
    
    const animation = confetti.animate([
      { 
        transform: `translate(0, 0) rotate(0deg)`,
        opacity: 1 
      },
      { 
        transform: `translate(${horizontalMovement}px, ${window.innerHeight + 200}px) rotate(${rotation}deg)`,
        opacity: 0 
      }
    ], {
      duration: Math.random() * 2000 + 2000,
      easing: 'cubic-bezier(0.5, 0, 0.5, 1)'
    });
    
    animation.onfinish = () => confetti.remove();
  };

  const updateButtonLoadingState = (button: HTMLElement | null, isLoading: boolean) => {
    if (!button) return;
    button.classList.toggle('loading', isLoading);
    (button as HTMLButtonElement).disabled = isLoading;
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result.split(',')[1]);
        } else {
          reject(new Error("Failed to convert blob to base64"));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // --- NAVIGATION AND THEME ---
  const handleNavClick = (e: MouseEvent) => {
    e.preventDefault();
    const target = e.currentTarget as HTMLElement;
    const pageId = target.dataset.page;

    if (!pageId || pageId === currentPage) return;

    navItems.forEach(item => {
      item.classList.toggle('active', item.dataset.page === pageId);
    });

    pageContainers.forEach(container => {
      container.classList.toggle('hidden', container.id !== pageId);
    });
    
    currentPage = pageId;
  };

  const applyTheme = (theme: 'light' | 'dark') => {
    if (document.body.dataset.theme === theme) return;
      
    document.body.dataset.theme = theme;
    localStorage.setItem('theme', theme);
    const themeIcon = themeToggleButton?.querySelector('.material-symbols-outlined');
    if (themeIcon) {
        themeIcon.textContent = theme === 'light' ? 'light_mode' : 'dark_mode';
    }
  };


  // --- CORE LOGIC ---
  const updateWeightValue = () => {
    const weightSlider = $('#weight-slider') as HTMLInputElement;
    const weightValue = $('#weight-value');
    if (weightSlider && weightValue) {
        weightValue.textContent = `Value: ${weightSlider.value}`;
    }
  };

  const applyAllIconStyles = () => {
      const style = (document.querySelector('input[name="icon-family"]:checked') as HTMLInputElement)?.value || 'Outlined';
      const fill = ($('#fill-toggle') as HTMLInputElement)?.checked ? 1 : 0;
      const weight = ($('#weight-slider') as HTMLInputElement)?.value || '400';
      const opticalSize = ($('#optical-size-slider') as HTMLInputElement)?.value || '24';
      
      const newStyleClass = `material-symbols-${style.toLowerCase()}`;
      const fontVariationSettings = `'FILL' ${fill}, 'wght' ${weight}, 'opsz' ${opticalSize}`;

      const iconsToStyle = $$('#icon-grid .icon-item > span:first-child, #settings-preview-icon, #motion-preview-icon');
      
      iconsToStyle.forEach(icon => {
          icon.classList.remove('material-symbols-outlined', 'material-symbols-rounded', 'material-symbols-sharp');
          icon.classList.add(newStyleClass);
          icon.style.fontVariationSettings = fontVariationSettings;
      });
  };

  const updatePreviewStyles = () => {
      const sizeInput = $('#export-size-input') as HTMLInputElement;
      const colorPicker = $('#color-picker') as HTMLInputElement;
      const previewIcon = $('#settings-preview-icon');
      const motionPreviewIcon = $('#motion-preview-icon');

      if (!sizeInput || !colorPicker || !previewIcon || !motionPreviewIcon) return;

      const size = sizeInput.value || '48';
      const color = colorPicker.value || '#0F172A';

      previewIcon.style.fontSize = `${size}px`;
      previewIcon.style.color = color;
      
      motionPreviewIcon.style.color = color;
  };

  const handlePlayMotion = () => {
    if (!motionPreviewIcon || !motionAnimationSelect || !motionRepeatSelect) return;

    // Clear any existing animation timeout and reset the style
    if (currentAnimationTimeout) {
      clearTimeout(currentAnimationTimeout);
    }
    motionPreviewIcon.style.animation = '';

    const animationName = motionAnimationSelect.value;
    const animation = ANIMATION_DETAILS[animationName];
    if (!animation) return;

    const repeatCount = motionRepeatSelect.value === 'infinite' ? 'infinite' : '1';
    const durationMs = parseFloat(animation.duration) * 1000;

    // Inject keyframes stylesheet if it doesn't exist
    const styleSheetId = `anim-style-${animationName}`;
    if (!document.getElementById(styleSheetId)) {
      const style = document.createElement('style');
      style.id = styleSheetId;
      style.innerHTML = animation.keyframes;
      document.head.appendChild(style);
    }

    // Force a reflow to restart the animation
    void motionPreviewIcon.offsetWidth;

    // Apply the new animation
    motionPreviewIcon.style.animation = `${animationName} ${animation.duration} ${animation.timing} ${repeatCount}`;

    // Set a timeout to clear the animation style after it finishes (if not looping)
    if (repeatCount !== 'infinite') {
      currentAnimationTimeout = window.setTimeout(() => {
        motionPreviewIcon.style.animation = '';
      }, durationMs);
    }
  };

  const generateImage = async (
    prompt: string,
    resultImgElement: HTMLImageElement | null,
    resultPlaceholderElement: HTMLElement | null,
    resultErrorElement: HTMLElement | null,
    idlePlaceholderElement: HTMLElement | null,
    generateBtn: HTMLElement,
    referenceImages: ({ file: File; dataUrl: string } | null)[] = []
  ) => {
    updateButtonLoadingState(generateBtn, true);
    resultPlaceholderElement?.classList.remove('hidden');
    resultPlaceholderElement?.classList.remove('is-error');
    idlePlaceholderElement?.classList.add('hidden');
    resultImgElement?.classList.add('hidden');
    resultImgElement?.classList.remove('visible');

    try {
      const parts: any[] = [{ text: prompt }];
      
      const imageParts = await Promise.all(referenceImages.filter(img => img).map(async refImg => {
        if (!refImg) return null;
        
        // If file exists, use it
        if (refImg.file) {
          return {
            inlineData: {
              data: await blobToBase64(refImg.file),
              mimeType: refImg.file.type,
            }
          };
        }
        
        // Otherwise, extract from dataUrl
        if (refImg.dataUrl) {
          const match = refImg.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            const mimeType = match[1];
            const base64Data = match[2];
            return {
              inlineData: {
                data: base64Data,
                mimeType: mimeType,
              }
            };
          }
        }
        
        return null;
      }));
      
      // Filter out null values
      const validImageParts = imageParts.filter(part => part !== null) as any[];
      parts.push(...validImageParts);

      console.log('Calling AI API with parts:', parts);
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts },
        config: {
          responseModalities: [Modality.IMAGE],
        },
      });

      console.log('API response received:', response);
      
      const candidate = response.candidates?.[0];
      const content = candidate?.content;
      const responseParts = content?.parts;
      const firstPart = responseParts?.[0];
      const inlineData = firstPart?.inlineData;

      if (inlineData && inlineData.data && inlineData.mimeType) {
        console.log('Image data extracted successfully, mimeType:', inlineData.mimeType);
        const imageData = inlineData;
        const dataUrl = `data:${imageData.mimeType};base64,${imageData.data}`;
        if (resultImgElement) {
          resultImgElement.src = dataUrl;
          resultImgElement.classList.remove('hidden');
          setTimeout(() => resultImgElement.classList.add('visible'), 50); // For transition
        }
        return { data: imageData.data, mimeType: imageData.mimeType };
      } else {
        console.error('Invalid API response structure:', {
          hasCandidates: !!response.candidates,
          candidateCount: response.candidates?.length,
          hasContent: !!candidate?.content,
          hasParts: !!responseParts,
          partsCount: responseParts?.length,
          hasInlineData: !!inlineData,
          inlineDataKeys: inlineData ? Object.keys(inlineData) : null
        });
        throw new Error('No image data received from API.');
      }
    } catch (error) {
      console.error('Image generation failed:', error);
      resultPlaceholderElement?.classList.add('is-error');
      return null;
    } finally {
      updateButtonLoadingState(generateBtn, false);
      resultPlaceholderElement?.classList.add('hidden');
    }
  };

  // --- PAGE-SPECIFIC LOGIC: 2D Studio ---

  const update2dWeightValue = () => {
    const weightSlider = $('#p2d-weight-slider') as HTMLInputElement;
    const weightValue = $('#p2d-weight-value');
    if (weightSlider && weightValue) {
        weightValue.textContent = `Value: ${weightSlider.value}`;
    }
  };

  const update2dPromptDisplay = () => {
    if (!imagePromptDisplay2d) return;
    try {
      const template = JSON.parse(DEFAULT_2D_STYLE_PROMPT_TEMPLATE);
      const subject = imagePromptSubjectInput2d.value || 'a friendly robot';
      
      const style = document.querySelector<HTMLInputElement>('input[name="p2d-icon-family"]:checked')?.value || 'outlined';
      const fill = (document.querySelector('#p2d-fill-toggle') as HTMLInputElement).checked;
      const weight = parseInt((document.querySelector('#p2d-weight-slider') as HTMLInputElement).value);
      const color = (document.querySelector('#p2d-color-picker') as HTMLInputElement).value;

      template.subject = subject;
      template.controls.style.shape = style;
      template.controls.style.fill.enabled = fill;
      template.controls.stroke.weight.value = weight;
      template.controls.color.primary = color;
      
      imagePromptDisplay2d.value = JSON.stringify(template, null, 2);
    } catch(e) {
      console.error("Failed to parse or update 2D prompt", e);
      imagePromptDisplay2d.value = DEFAULT_2D_STYLE_PROMPT_TEMPLATE.replace("{ICON_SUBJECT}", imagePromptSubjectInput2d.value || 'a friendly robot');
    }
  };
  
  const handleGenerateImage2d = async () => {
    if (!imagePromptSubjectInput2d.value) {
        showToast({ type: 'error', title: 'Input Required', body: 'Please enter a subject for your icon.' });
        imagePromptSubjectInput2d.focus();
        return;
    }
    
    update2dPromptDisplay();

    // Show loading modal
    if (p2dLoaderModal && p2dLoaderMessage) {
        p2dLoaderMessage.textContent = 'Generating your icon...';
        p2dLoaderModal.classList.remove('hidden');
    }

    try {
        const fill = (document.querySelector('#p2d-fill-toggle') as HTMLInputElement).checked;
        const weight = parseInt((document.querySelector('#p2d-weight-slider') as HTMLInputElement).value);

        const selectedReferences = new Set<({ file: File; dataUrl: string } | null)>();

        // Rule for Fill
        if (fill) {
          if (referenceImagesForEdit2d[0]) {
            selectedReferences.add(referenceImagesForEdit2d[0]);
          }
        } else { // fill is off
          if (referenceImagesForEdit2d[1]) {
            selectedReferences.add(referenceImagesForEdit2d[1]);
          }
        }

        // Rule for Weight
        if (weight <= 300) {
          if (referenceImagesForEdit2d[2]) {
            selectedReferences.add(referenceImagesForEdit2d[2]);
          }
        } else if (weight >= 500) {
          if (referenceImagesForEdit2d[3]) {
            selectedReferences.add(referenceImagesForEdit2d[3]);
          }
        } else if (weight === 400) {
          if (referenceImagesForEdit2d[1]) {
            selectedReferences.add(referenceImagesForEdit2d[1]);
          }
        }

        const finalReferenceImages = Array.from(selectedReferences);

        const imageData = await generateImage(
          imagePromptDisplay2d.value,
          resultImage2d,
          resultPlaceholder2d,
          resultError2d,
          resultIdlePlaceholder2d,
          imageGenerateBtn2d,
          finalReferenceImages
        );

        if (imageData) {
            const newImage: GeneratedImageData = {
                id: `img_2d_${Date.now()}`,
                data: imageData.data,
                mimeType: imageData.mimeType,
                subject: imagePromptSubjectInput2d.value,
                styleConstraints: imagePromptDisplay2d.value,
                timestamp: Date.now(),
                modificationType: 'Original'
            };
            
            currentGeneratedImage2d = newImage;
            imageHistory2d.splice(historyIndex2d + 1);
            imageHistory2d.push(newImage);
            historyIndex2d = imageHistory2d.length - 1;

            const dataUrl = `data:${newImage.mimeType};base64,${newImage.data}`;
            const newLibraryItem = { id: newImage.id, dataUrl, mimeType: newImage.mimeType };

            imageLibrary.unshift(newLibraryItem);
            if (imageLibrary.length > 20) {
                imageLibrary.pop();
            }

            saveImageLibrary();
            renderImageLibrary();
            update2dViewFromState();
            detailsPanel2d?.classList.remove('hidden');
            detailsPanel2d?.classList.add('is-open');
            renderHistory2d();
        }
    } catch (error) {
        console.error('Error generating 2D image:', error);
        showToast({ type: 'error', title: 'Generation Failed', body: 'Failed to generate icon. Please try again.' });
    } finally {
        // Hide loading modal
        if (p2dLoaderModal) {
            p2dLoaderModal.classList.add('hidden');
        }
    }
  };

  const update2dViewFromState = () => {
    if (!currentGeneratedImage2d || !resultImage2d || !resultIdlePlaceholder2d || !resultPlaceholder2d || !resultError2d || !mainResultContentHeader2d) return;

    resultImage2d.src = `data:${currentGeneratedImage2d.mimeType};base64,${currentGeneratedImage2d.data}`;
    resultImage2d.classList.remove('hidden');
    setTimeout(() => resultImage2d.classList.add('visible'), 50);

    resultIdlePlaceholder2d.classList.add('hidden');
    resultPlaceholder2d.classList.add('hidden');
    resultError2d.classList.add('hidden');
    mainResultContentHeader2d.classList.remove('hidden');
    
    if(detailsPreviewImage2d && detailsDownloadBtn2d) {
        detailsPreviewImage2d.src = resultImage2d.src;
        detailsDownloadBtn2d.href = resultImage2d.src;
        detailsDownloadBtn2d.download = `${currentGeneratedImage2d.subject.replace(/\s+/g, '_')}.png`;
    }
    
    // Cache original image data for background removal revert
    const dataUrl = `data:${currentGeneratedImage2d.mimeType};base64,${currentGeneratedImage2d.data}`;
    p2dOriginalImageData = dataUrl;
    
    // Update button visibility based on background removal state
    const removeBgBtn = $('#p2d-remove-background-btn');
    const bgTransparentNote = $('#p2d-bg-transparent-note');
    
    // Reset background removal state when new image loads
    p2dHasBackgroundRemoved = false;
    
    if (removeBgBtn) {
        removeBgBtn.classList.remove('hidden');
    }
    if (bgTransparentNote) {
        bgTransparentNote.classList.add('hidden');
    }
  };
  
  const updateDetailsPanelHistory2d = () => {
    const detailsHistoryList = $('#p2d-details-history-list');
    const historyTabContent = detailsHistoryList?.closest('.details-tab-content[data-tab-content="history"]');
    
    // Only update if History tab is visible
    if (!detailsHistoryList || !historyTabContent) return;
    if (historyTabContent.classList.contains('hidden')) return;
    
    if (detailsPanelHistory2d.length === 0) {
        detailsHistoryList.innerHTML = '<p style="padding: var(--spacing-4); text-align: center; color: var(--text-secondary);">No Fix history available</p>';
        return;
    }
    
    detailsHistoryList.innerHTML = '';
    
    // Show in chronological order (oldest first, newest last)
    // Only show Fix modifications, not original generations
    detailsPanelHistory2d.forEach((item, index) => {
        const isActive = index === detailsPanelHistoryIndex2d;
        
        // Determine modification type
        let modificationType = item.modificationType || 'Original';
        
        // Create thumbnail button
        const thumbnailBtn = document.createElement('button');
        thumbnailBtn.type = 'button';
        thumbnailBtn.className = 'details-history-thumbnail-btn';
        thumbnailBtn.dataset.index = String(historyIndex);
        thumbnailBtn.setAttribute('aria-label', `Load history item ${historyIndex + 1}`);
        thumbnailBtn.style.cssText = `
            position: relative;
            width: 100%;
            height: 270px;
            padding: 0;
            border: ${isActive ? '3px solid var(--primary-color, #0070F3)' : '1px solid var(--border-color)'};
            border-radius: var(--border-radius-md);
            background: transparent;
            cursor: pointer;
            overflow: hidden;
            transition: all 0.2s ease;
            outline: none;
        `;
        
        // Add hover effect
        thumbnailBtn.addEventListener('mouseenter', () => {
            if (!isActive) {
                thumbnailBtn.style.transform = 'scale(1.02)';
                thumbnailBtn.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
            }
        });
        
        thumbnailBtn.addEventListener('mouseleave', () => {
            if (!isActive) {
                thumbnailBtn.style.transform = '';
                thumbnailBtn.style.boxShadow = '';
            }
        });
        
        // Create modification type badge
        const badge = document.createElement('div');
        badge.textContent = modificationType;
        badge.style.cssText = `
            position: absolute;
            top: 8px;
            left: 8px;
            background: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 4px 8px;
            border-radius: var(--border-radius-sm);
            font-size: 11px;
            font-weight: 500;
            z-index: 1;
        `;
        
        // Create thumbnail image
        const img = document.createElement('img');
        img.src = `data:${item.mimeType};base64,${item.data}`;
        img.loading = 'lazy';
        img.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
        img.alt = `History item ${historyIndex + 1}`;
        
        thumbnailBtn.appendChild(badge);
        thumbnailBtn.appendChild(img);
        
        // Add keyboard support
        thumbnailBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                thumbnailBtn.click();
            }
        });
        
        // Click handler to load preview
        thumbnailBtn.addEventListener('click', () => {
            detailsPanelHistoryIndex2d = index;
            currentGeneratedImage2d = detailsPanelHistory2d[index];
            update2dViewFromState();
            updateDetailsPanelHistory2d();
            // Also update left sidebar history to match
            const matchingIndex = imageHistory2d.findIndex(h => h.id === currentGeneratedImage2d?.id);
            if (matchingIndex !== -1) {
                historyIndex2d = matchingIndex;
                renderHistory2d();
            }
        });
        
        detailsHistoryList.appendChild(thumbnailBtn);
    });
  };
  
  const renderHistory2d = () => {
    if (!historyPanel2d || !historyList2d || !historyCounter2d || !historyBackBtn2d || !historyForwardBtn2d) return;
    
    if (imageHistory2d.length === 0) {
        historyPanel2d.classList.add('hidden');
        return;
    }

    historyPanel2d.classList.remove('hidden');
    historyList2d.innerHTML = '';

    // Filter to only show Original (prompt-based generations), not Fix modifications
    const originalHistory = imageHistory2d.filter(item => 
        !item.modificationType || item.modificationType === 'Original'
    );
    
    if (originalHistory.length === 0) {
        historyPanel2d.classList.add('hidden');
        return;
    }

    originalHistory.forEach((item, listIndex) => {
        // Find the actual index in imageHistory2d
        const index = imageHistory2d.findIndex(h => h.id === item.id);
        const li = document.createElement('li');
        li.className = 'history-item';
        if (index === historyIndex2d) {
            li.classList.add('selected');
        }
        li.dataset.index = String(index);

        const date = new Date(item.timestamp);
        const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        li.innerHTML = `
        <div class="history-item-main">
            <div style="position: relative;">
                <img src="data:${item.mimeType};base64,${item.data}" class="history-thumbnail" alt="History item thumbnail">
                <button class="history-item-compare-btn" aria-label="Compare" title="Compare with current" style="position: absolute; top: 4px; right: 4px; width: 28px; height: 28px; padding: 0; border: none; background: rgba(255,255,255,0.9); backdrop-filter: blur(4px); border-radius: var(--border-radius-sm); cursor: pointer; opacity: 0; transition: opacity 0.2s; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); pointer-events: none;">
                    <span class="material-symbols-outlined" style="font-size: 16px; color: var(--text-primary);">compare</span>
                </button>
            </div>
            <div class="history-item-info">
            <span class="history-item-label">${item.subject}</span>
            <span class="history-item-timestamp">${timeString}</span>
            </div>
            <button class="history-item-delete-btn" aria-label="Delete history item">
                <span class="material-symbols-outlined">delete</span>
            </button>
        </div>
        `;
        
        // Show Compare button on hover
        li.addEventListener('mouseenter', () => {
            const compareBtn = li.querySelector('.history-item-compare-btn') as HTMLElement;
            if (compareBtn) {
                compareBtn.style.opacity = '1';
                compareBtn.style.pointerEvents = 'auto';
            }
        });
        
        li.addEventListener('mouseleave', () => {
            const compareBtn = li.querySelector('.history-item-compare-btn') as HTMLElement;
            if (compareBtn) {
                compareBtn.style.opacity = '0';
                compareBtn.style.pointerEvents = 'none';
            }
        });
        
        // Compare button event
        const compareBtn = li.querySelector('.history-item-compare-btn') as HTMLButtonElement;
        compareBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            
            if (!currentGeneratedImage2d || !p2dOriginalImageData) {
                showToast({ type: 'error', title: 'Error', body: 'Cannot compare images.' });
                return;
            }
            
            const historyDataUrl = `data:${item.mimeType};base64,${item.data}`;
            const currentDataUrl = `data:${currentGeneratedImage2d.mimeType};base64,${currentGeneratedImage2d.data}`;
            
            const compareOriginal = $('#p2d-compare-original') as HTMLImageElement;
            const compareCurrent = $('#p2d-compare-current') as HTMLImageElement;
            const compareSlider = $('#p2d-compare-slider') as HTMLInputElement;
            const compareDivider = $('#p2d-compare-divider');
            
            if (compareOriginal) compareOriginal.src = historyDataUrl;
            if (compareCurrent) compareCurrent.src = currentDataUrl;
            
            const handleSliderChange = () => {
                const value = compareSlider.valueAsNumber;
                if (compareDivider && compareCurrent) {
                    compareDivider.style.left = `${value}%`;
                    compareCurrent.style.clipPath = `inset(0 ${100 - value}% 0 0)`;
                }
            };
            compareSlider?.removeEventListener('input', handleSliderChange);
            compareSlider?.addEventListener('input', handleSliderChange);
            handleSliderChange();
            
            if (p2dCompareModal) p2dCompareModal.classList.remove('hidden');
        });
        
        // Delete button event
        const deleteBtn = li.querySelector('.history-item-delete-btn') as HTMLButtonElement;
        deleteBtn?.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent history item click
            if (imageHistory2d.length === 1) {
                showToast({ type: 'error', title: 'Cannot Delete', body: 'Cannot delete the last item in history.' });
                return;
            }
            
            imageHistory2d.splice(index, 1);
            
            // Adjust history index
            if (historyIndex2d >= index && historyIndex2d > 0) {
                historyIndex2d--;
            } else if (historyIndex2d >= imageHistory2d.length) {
                historyIndex2d = imageHistory2d.length - 1;
            }
            
            if (imageHistory2d.length > 0) {
                currentGeneratedImage2d = imageHistory2d[historyIndex2d];
                update2dViewFromState();
            } else {
                currentGeneratedImage2d = null;
                resultImage2d.src = '';
                resultImage2d.classList.add('hidden');
                resultIdlePlaceholder2d?.classList.remove('hidden');
                mainResultContentHeader2d?.classList.add('hidden');
            }
            
            renderHistory2d();
            showToast({ type: 'success', title: 'Deleted', body: 'Item removed from history.' });
        });
        
        li.addEventListener('click', () => {
            historyIndex2d = index;
            currentGeneratedImage2d = imageHistory2d[historyIndex2d];
            update2dViewFromState();
            renderHistory2d();
        });
        historyList2d.prepend(li);
    });

    const originalHistory = imageHistory2d.filter(item => 
        !item.modificationType || item.modificationType === 'Original'
    );
    const originalIndex = originalHistory.findIndex(h => imageHistory2d[historyIndex2d]?.id === h.id);
    
    if (originalHistory.length > 0 && originalIndex !== -1) {
        historyCounter2d.textContent = `${originalIndex + 1} / ${originalHistory.length}`;
        (historyBackBtn2d as HTMLButtonElement).disabled = originalIndex <= 0;
        (historyForwardBtn2d as HTMLButtonElement).disabled = originalIndex >= originalHistory.length - 1;
    } else {
        historyCounter2d.textContent = '0 / 0';
        (historyBackBtn2d as HTMLButtonElement).disabled = true;
        (historyForwardBtn2d as HTMLButtonElement).disabled = true;
    }
  };
  
  
  // --- PAGE-SPECIFIC LOGIC: 3D Studio ---
  const updateDropZoneUI = (zone: HTMLElement, dataUrl: string) => {
    const previewImg = zone.querySelector('.style-image-preview') as HTMLImageElement;
    const promptEl = zone.querySelector('.drop-zone-prompt');
    const removeBtn = zone.querySelector('.remove-style-image-btn') as HTMLButtonElement;

    if (previewImg && promptEl && removeBtn) {
        previewImg.src = dataUrl;
        previewImg.classList.remove('hidden');
        promptEl?.classList.add('hidden');
        removeBtn.classList.remove('hidden');
    }
  };

  const clearDropZoneUI = (zone: HTMLElement) => {
      const previewImg = zone.querySelector('.style-image-preview') as HTMLImageElement;
      const promptEl = zone.querySelector('.drop-zone-prompt');
      const removeBtn = zone.querySelector('.remove-style-image-btn') as HTMLButtonElement;
      if (previewImg && promptEl && removeBtn) {
        previewImg.src = '';
        previewImg.classList.add('hidden');
        promptEl.classList.remove('hidden');
        removeBtn.classList.add('hidden');
      }
  };
  
  const setInitialMotionFrames = async (imageData: GeneratedImageData) => {
    const dataUrl = `data:${imageData.mimeType};base64,${imageData.data}`;
    
    try {
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        const file = new File([blob], `generated_frame.${imageData.mimeType.split('/')[1] || 'png'}`, { type: imageData.mimeType });
        
        const frameData = { file, dataUrl };
        
        // Update state
        motionFirstFrameImage = frameData;
        motionLastFrameImage = frameData;

        // Update UI for both drop zones
        const firstFrameZone = document.querySelector<HTMLElement>('#motion-reference-image-container .image-drop-zone[data-index="0"]');
        const lastFrameZone = document.querySelector<HTMLElement>('#motion-reference-image-container .image-drop-zone[data-index="1"]');
        
        if (firstFrameZone) {
            updateDropZoneUI(firstFrameZone, dataUrl);
        }
        if (lastFrameZone) {
            updateDropZoneUI(lastFrameZone, dataUrl);
        }

    } catch (error) {
        console.error("Failed to set initial motion frames:", error);
    }
  };

  const setInitialMotionFramesStudio = async (imageData: GeneratedImageData) => {
    const dataUrl = `data:${imageData.mimeType};base64,${imageData.data}`;
    
    try {
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        const file = new File([blob], `generated_frame_studio.${imageData.mimeType.split('/')[1] || 'png'}`, { type: imageData.mimeType });
        
        const frameData = { file, dataUrl };
        
        // Update state
        motionFirstFrameImageStudio = frameData;
        motionLastFrameImageStudio = frameData;

        // Update UI for both drop zones
        const firstFrameZone = document.querySelector<HTMLElement>('#motion-reference-image-container-image .image-drop-zone[data-index="0"]');
        const lastFrameZone = document.querySelector<HTMLElement>('#motion-reference-image-container-image .image-drop-zone[data-index="1"]');
        
        if (firstFrameZone) {
            updateDropZoneUI(firstFrameZone, dataUrl);
        }
        if (lastFrameZone) {
            updateDropZoneUI(lastFrameZone, dataUrl);
        }

    } catch (error) {
        console.error("Failed to set initial motion frames for Image Studio:", error);
    }
  };

  const update3dPromptDisplay = () => {
    if (!imagePromptDisplay) return;
    try {
        const template = JSON.parse(DEFAULT_3D_STYLE_PROMPT_TEMPLATE);
        const subject = imagePromptSubjectInput.value || 'a friendly robot';
        template.subject = subject;

        if (shadowToggle3d.checked) {
            template.negative_prompt = template.negative_prompt.replace(', ground/drop shadows', '');
            template.lighting.shadows = "internal and soft ground shadow";
        } else {
            if (!template.negative_prompt.includes('ground/drop shadows')) {
                 template.negative_prompt += ', ground/drop shadows';
            }
            template.lighting.shadows = "internal only; no ground/drop shadow";
        }

        // Add background color
        const backgroundColorPicker = $('#background-color-picker-3d') as HTMLInputElement;
        if (backgroundColorPicker && template.background) {
            template.background.color = backgroundColorPicker.value;
        }

        // Add object color
        const objectColorPicker = $('#object-color-picker-3d') as HTMLInputElement;
        if (objectColorPicker && template.colors) {
            template.colors.dominant_blue = objectColorPicker.value;
        }

        imagePromptDisplay.value = JSON.stringify(template, null, 2);
    } catch(e) {
        console.error("Failed to update 3D prompt", e);
        imagePromptDisplay.value = DEFAULT_3D_STYLE_PROMPT_TEMPLATE.replace("{ICON_SUBJECT|backpack}", imagePromptSubjectInput.value || 'a friendly robot');
    }
  };

  const createImagePromptFromTemplate = (template: any, userPrompt: string = '', isFix: boolean = false): string => {
    const subject = template.subject || 'a friendly robot';
    const shadowText = template.lighting?.shadows || '';
    const backgroundColor = template.background?.color || '#FFFFFF';
    const objectColor = template.colors?.dominant_blue || '#2962FF';
    const inherentColors = template.colors?.inherent_colors || '';
    
    // Create a natural language prompt from the template
    let prompt = `Generate an isometric 3D ${subject}. `;
    
    // Add user prompt if provided
    if (userPrompt && userPrompt.trim()) {
      prompt += `${userPrompt}. `;
    }
    
    if (isFix) {
      // Fix mode: Maintain exact shape and only change colors
      prompt += `CRITICAL: Maintain the exact same shape, proportions, and form. DO NOT change the subject's structure or design. `;
      prompt += `Background color: ${backgroundColor}. `;
      prompt += `Object main color: ${objectColor}. Preserve all sub-elements' inherent colors (e.g., if there's food, keep it realistic; if there are decorative elements, maintain their natural appearance). `;
    } else {
      // Normal generation mode
      prompt += `Background: solid color ${backgroundColor}. `;
      
      // Color palette instructions
      if (inherentColors) {
        prompt += `Colors: ${inherentColors}. When natural colors are needed, use them. Otherwise, use the blue/white palette (${objectColor}). `;
      } else {
        prompt += `Color palette: Use natural colors where the object has a universal color identity (e.g., sun=yellow, carrot=orange/green, leaf=green). For other elements, use ${objectColor} and white. `;
      }
    }
    
    prompt += `Style: rounded, smooth, bubbly shapes with crisp edges and no outlines. `;
    prompt += `Materials: high-gloss plastic look. `;
    prompt += `Lighting: ${template.lighting?.mode || 'soft diffused studio'}, ${template.lighting?.source || 'top-front or top-right'}. ${shadowText}. `;
    prompt += `Camera: isometric view, static. `;
    prompt += `Composition: single main subject, centered, fully visible inside the frame with clean margins around all edges. No cropping, no extra decorations. `;
    
    // Add negative prompt
    if (template.negative_prompt) {
      prompt += `Negative: ${template.negative_prompt}`;
    }
    
    return prompt;
  };

  const handleGenerateImage3d = async () => {
    if (!imagePromptSubjectInput.value) {
        showToast({ type: 'error', title: 'Input Required', body: 'Please enter a subject for your image.' });
        imagePromptSubjectInput.focus();
        return;
    }

    update3dPromptDisplay();
    imageGenerationLoaderModal?.classList.remove('hidden');

    try {
        // Parse the template and create a natural language prompt
        const template = JSON.parse(imagePromptDisplay.value);
        const userPrompt = userPrompt3d?.value || '';
        const imagePromptText = createImagePromptFromTemplate(template, userPrompt);
        
        const imageData = await generateImage(
            imagePromptText,
            resultImage,
            resultPlaceholder,
            resultError,
            resultIdlePlaceholder,
            imageGenerateBtn,
            referenceImagesFor3d
        );

        if (imageData) {
            const newImage: GeneratedImageData = {
                id: `img_${Date.now()}`,
                data: imageData.data,
                mimeType: imageData.mimeType,
                subject: imagePromptSubjectInput.value,
                styleConstraints: imagePromptDisplay.value,
                timestamp: Date.now(),
                videoDataUrl: undefined,
                motionPrompt: null,
            };
            
            await setInitialMotionFrames(newImage);
            
            currentGeneratedImage = newImage;
            imageHistory.splice(historyIndex + 1);
            imageHistory.push(newImage);
            historyIndex = imageHistory.length - 1;

            const dataUrl = `data:${newImage.mimeType};base64,${newImage.data}`;
            const newLibraryItem = { id: newImage.id, dataUrl, mimeType: newImage.mimeType };

            imageLibrary.unshift(newLibraryItem);
            if (imageLibrary.length > 20) { // Limit to 20 images
                imageLibrary.pop();
            }

            saveImageLibrary();
            renderImageLibrary();
            update3dViewFromState();
            detailsPanel?.classList.remove('hidden');
            detailsPanel?.classList.add('is-open');
            renderHistory();
        }
    } finally {
        imageGenerationLoaderModal?.classList.add('hidden');
    }
  };

  const handleGenerateSubjectImageFromText = async (promptText: string) => {
    const loaderModal = $('#image-generation-loader-modal');
    const subjectZone = $('#subject-drop-zone-image');
    const content = subjectZone?.querySelector('.drop-zone-content');
    const previewImg = subjectZone?.querySelector('.drop-zone-preview') as HTMLImageElement;
    const removeBtn = subjectZone?.querySelector('.remove-style-image-btn') as HTMLButtonElement;

    loaderModal?.classList.remove('hidden');

    try {
      // Generate image from text using gemini-2.5-flash-image
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: [{ parts: [{ text: promptText }] }],
        config: {
          responseModalities: [Modality.IMAGE],
        },
      });

      const part = response.candidates?.[0]?.content?.parts?.[0];
      if (part && part.inlineData) {
        const { data, mimeType } = part.inlineData;
        const dataUrl = `data:${mimeType};base64,${data}`;
        
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], `generated_subject.png`, { type: mimeType });
        imageStudioSubjectImage = { file, dataUrl };
        
        if (content) content.classList.add('has-image');
        if (previewImg) previewImg.src = dataUrl;
        if (previewImg) previewImg.classList.remove('hidden');
        if (removeBtn) removeBtn.classList.remove('hidden');

        showToast({ type: 'success', title: 'Subject Generated', body: 'Image generated from text for subject.' });
      } else {
        throw new Error('No image data in response');
      }
    } catch (error) {
      console.error('Error generating subject image:', error);
      showToast({ type: 'error', title: 'Generation Failed', body: 'Failed to generate subject image.' });
    } finally {
      loaderModal?.classList.add('hidden');
    }
  };

  const handleGenerateSceneImageFromText = async (promptText: string) => {
    const loaderModal = $('#image-generation-loader-modal');
    const sceneZone = $('#scene-drop-zone-image');
    const content = sceneZone?.querySelector('.drop-zone-content');
    const previewImg = sceneZone?.querySelector('.drop-zone-preview') as HTMLImageElement;
    const removeBtn = sceneZone?.querySelector('.remove-style-image-btn') as HTMLButtonElement;

    loaderModal?.classList.remove('hidden');

    try {
      // Generate image from text using gemini-2.5-flash-image
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: [{ parts: [{ text: promptText }] }],
        config: {
          responseModalities: [Modality.IMAGE],
        },
      });

      const part = response.candidates?.[0]?.content?.parts?.[0];
      if (part && part.inlineData) {
        const { data, mimeType } = part.inlineData;
        const dataUrl = `data:${mimeType};base64,${data}`;
        
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], `generated_scene.png`, { type: mimeType });
        imageStudioSceneImage = { file, dataUrl };
        
        if (content) content.classList.add('has-image');
        if (previewImg) previewImg.src = dataUrl;
        if (previewImg) previewImg.classList.remove('hidden');
        if (removeBtn) removeBtn.classList.remove('hidden');

        showToast({ type: 'success', title: 'Scene Generated', body: 'Image generated from text for scene.' });
      } else {
        throw new Error('No image data in response');
      }
    } catch (error) {
      console.error('Error generating scene image:', error);
      showToast({ type: 'error', title: 'Generation Failed', body: 'Failed to generate scene image.' });
    } finally {
      loaderModal?.classList.add('hidden');
    }
  };

  // Main Page Generate Functions (3D Studio functionality)
  const handleGenerateImageMain = async () => {
    console.log('handleGenerateImageMain called');
    const generateInput = document.getElementById('generate-input') as HTMLInputElement;
    if (!generateInput?.value.trim()) {
      console.log('No input provided');
      showToast({ type: 'error', title: 'Input Required', body: 'Please enter a prompt for your image.' });
      generateInput?.focus();
      return;
    }

    const userPrompt = generateInput.value.trim();
    console.log('User prompt:', userPrompt);
    
    // Show loading modal
    if (mainGenerationLoaderModal) {
      console.log('Showing loading modal');
      mainGenerationLoaderModal.classList.remove('hidden');
    }

    // Show loading state on button
    const generateBtn = document.getElementById('generate-btn');
    if (generateBtn) {
      generateBtn.classList.add('loading');
      generateBtn.setAttribute('disabled', 'true');
    }

    try {
      // Use the same prompt generation logic as 3D Studio
      const template = JSON.parse(DEFAULT_3D_STYLE_PROMPT_TEMPLATE);
      // Set the subject from user input
      template.subject = userPrompt || 'a friendly robot';
      // Use default values for other options (shadow, colors, etc.)
      const imagePromptText = createImagePromptFromTemplate(template, '');
      console.log('Generated prompt:', imagePromptText);

      // Generate image using the same logic as 3D Studio
      console.log('Calling generateImage...');
      const imageData = await generateImage(
        imagePromptText,
        null, // No specific result image element for main page
        null, // No placeholder
        null, // No error element
        null, // No idle placeholder
        generateBtn as HTMLButtonElement,
        mainReferenceImage ? [{ dataUrl: mainReferenceImage, file: null as any }] : []
      );

      console.log('Image generation result:', imageData);

      if (imageData && imageData.data && imageData.mimeType) {
        const newImage: GeneratedImageData = {
          id: `img_main_${Date.now()}`,
          data: imageData.data,
          mimeType: imageData.mimeType,
          subject: userPrompt,
          styleConstraints: imagePromptText,
          timestamp: Date.now(),
          videoDataUrl: undefined,
          motionPrompt: null,
        };
        
        console.log('Created new image object:', newImage);
        
        await setInitialMotionFramesMain(newImage);
        
        currentGeneratedImageMain = newImage;
        imageHistoryMain.splice(historyIndexMain + 1);
        imageHistoryMain.push(newImage);
        historyIndexMain = imageHistoryMain.length - 1;

        // Add to image library
        const dataUrl = `data:${newImage.mimeType};base64,${newImage.data}`;
        const newLibraryItem = { id: newImage.id, dataUrl, mimeType: newImage.mimeType };
        imageLibrary.unshift(newLibraryItem);
        if (imageLibrary.length > 20) {
          imageLibrary.splice(20);
        }

        // Hide loading modal
        if (mainGenerationLoaderModal) {
          mainGenerationLoaderModal.classList.add('hidden');
        }

        // Show success toast
        showToast({ 
          type: 'success', 
          title: 'Image Generated!', 
          body: 'Your 3D image has been created successfully.' 
        });
        
        // Trigger confetti
        triggerConfetti();
        
        // Navigate to 3D Studio to show the result
        console.log('Navigating to 3D Studio...');
        navigateTo3DStudioWithResult(newImage);
      } else {
        console.error('Image generation returned invalid data:', imageData);
        throw new Error('Image generation failed: Invalid response data');
      }
    } catch (error) {
      console.error('Error generating image:', error);
      
      // Hide loading modal
      if (mainGenerationLoaderModal) {
        mainGenerationLoaderModal.classList.add('hidden');
      }
      
      showToast({ 
        type: 'error', 
        title: 'Generation Failed', 
        body: 'Failed to generate image. Please try again.' 
      });
    } finally {
      // Reset loading state
      if (generateBtn) {
        generateBtn.classList.remove('loading');
        generateBtn.removeAttribute('disabled');
      }
    }
  };

  const setInitialMotionFramesMain = async (imageData: GeneratedImageData) => {
    if (!imageData) return;
    
    try {
      const dataUrl = `data:${imageData.mimeType};base64,${imageData.data}`;
      
      // Set first frame (same as original image)
      imageData.videoDataUrl = dataUrl;
      
      // Motion prompt will be generated later when user requests it
      imageData.motionPrompt = null;
    } catch (error) {
      console.error('Error setting initial motion frames:', error);
    }
  };

  const navigateTo3DStudioWithResult = (imageData: GeneratedImageData) => {
    // Navigate to 3D Studio
    const targetPage = document.getElementById('page-id-3d');
    if (targetPage) {
      // Hide all pages
      document.querySelectorAll('.page-container').forEach(pageEl => {
        pageEl.classList.add('hidden');
      });
      
      // Show 3D Studio page
      targetPage.classList.remove('hidden');
      
      // Update nav items
      document.querySelectorAll('.nav-item').forEach(navItem => {
        navItem.classList.remove('active');
      });
      
      const targetNavItem = document.querySelector('[data-page="page-id-3d"]');
      if (targetNavItem) {
        targetNavItem.classList.add('active');
      }

      // Set the generated image as current in 3D Studio
      currentGeneratedImage = imageData;
      imageHistory = [imageData];
      historyIndex = 0;

      // Update 3D Studio UI with the generated image
      // Use setTimeout to ensure DOM is ready after page transition
      setTimeout(() => {
        update3DStudioUIWithImage(imageData);
      }, 100);
    }
  };

  const update3DStudioUIWithImage = (imageData: GeneratedImageData) => {
    console.log('update3DStudioUIWithImage called with:', imageData);
    
    // Update the result image - 3D Studio uses class selector, not ID
    const resultImage = document.querySelector('#page-id-3d .result-image') as HTMLImageElement;
    if (resultImage && imageData.data && imageData.mimeType) {
      const dataUrl = `data:${imageData.mimeType};base64,${imageData.data}`;
      console.log('Setting result image src:', dataUrl.substring(0, 50) + '...');
      console.log('Result image element found:', resultImage);
      resultImage.src = dataUrl;
      resultImage.classList.remove('hidden');
      resultImage.classList.add('visible');
      
      // Ensure image loads
      resultImage.onload = () => {
        console.log('Result image loaded successfully');
        console.log('Image dimensions:', resultImage.naturalWidth, 'x', resultImage.naturalHeight);
      };
      resultImage.onerror = (e) => {
        console.error('Error loading result image:', e);
        console.error('Failed dataUrl:', dataUrl.substring(0, 100));
      };
    } else {
      console.error('Result image element not found or invalid image data', {
        resultImage: !!resultImage,
        hasData: !!imageData.data,
        hasMimeType: !!imageData.mimeType,
        imageDataKeys: Object.keys(imageData)
      });
    }

    // Update prompt display
    const promptDisplay = $('#prompt-display-3d') as HTMLTextAreaElement;
    if (promptDisplay && imageData.styleConstraints) {
      promptDisplay.value = imageData.styleConstraints;
    }

    // Update user prompt
    const userPrompt = $('#user-prompt-3d') as HTMLInputElement;
    if (userPrompt && imageData.subject) {
      userPrompt.value = imageData.subject;
    }

    // Update subject input
    const subjectInput = $('#image-prompt-subject-input') as HTMLInputElement;
    if (subjectInput && imageData.subject) {
      subjectInput.value = imageData.subject;
    }

    // Hide placeholders and show result
    const placeholder = $('#id-3d-placeholder');
    const errorPlaceholder = $('#id-3d-error-placeholder');
    const resultPlaceholder = $('#result-placeholder');
    const idlePlaceholder = document.querySelector('#page-id-3d #result-idle-placeholder');
    const motionPromptPlaceholder = document.querySelector('#page-id-3d #motion-prompt-placeholder');
    
    if (placeholder) placeholder.classList.add('hidden');
    if (errorPlaceholder) errorPlaceholder.classList.add('hidden');
    if (resultPlaceholder) resultPlaceholder.classList.add('hidden');
    if (idlePlaceholder) idlePlaceholder.classList.add('hidden');
    if (motionPromptPlaceholder) motionPromptPlaceholder.classList.add('hidden');

    // Show result container - use class selector within 3D Studio page
    const resultContainer = document.querySelector('#page-id-3d .result-container');
    if (resultContainer) {
      resultContainer.classList.remove('hidden');
      console.log('Result container shown');
    } else {
      console.error('Result container not found');
    }

    // Update details panel
    const dataUrl = `data:${imageData.mimeType};base64,${imageData.data}`;
    const detailsPreviewImage = $('#details-preview-image') as HTMLImageElement;
    const detailsDownloadBtn = $('#details-download-btn') as HTMLAnchorElement;
    
    if (detailsPreviewImage && detailsDownloadBtn) {
      detailsPreviewImage.src = dataUrl;
      detailsDownloadBtn.href = dataUrl;
      detailsDownloadBtn.download = `${imageData.subject.replace(/\s+/g, '_')}.png`;
      console.log('Details panel preview and download updated');
    }
    
    // Update motion thumbnail in details panel
    const motionThumbnailImage = $('#motion-thumbnail-image') as HTMLImageElement;
    const motionThumbnailLabel = $('#motion-thumbnail-label');
    if (motionThumbnailImage && motionThumbnailLabel) {
      motionThumbnailImage.src = dataUrl;
      motionThumbnailLabel.textContent = imageData.subject;
      console.log('Motion thumbnail updated');
    }
    
    // Update color pickers in details panel from style constraints
    if (imageData.styleConstraints) {
      try {
        const styleData = JSON.parse(imageData.styleConstraints);
        const detailsBackgroundColorPicker = $('#details-background-color-picker-3d') as HTMLInputElement;
        const detailsObjectColorPicker = $('#details-object-color-picker-3d') as HTMLInputElement;
        
        if (detailsBackgroundColorPicker && styleData.background?.color) {
          detailsBackgroundColorPicker.value = styleData.background.color;
          console.log('Background color updated:', styleData.background.color);
        }
        if (detailsObjectColorPicker && styleData.colors?.dominant_blue) {
          detailsObjectColorPicker.value = styleData.colors.dominant_blue;
          console.log('Object color updated:', styleData.colors.dominant_blue);
        }
      } catch (e) {
        console.error('Failed to parse style constraints:', e);
      }
    }
    
    // Show details panel
    const detailsPanel = $('#image-details-panel');
    if (detailsPanel) {
      detailsPanel.classList.remove('hidden');
      detailsPanel.classList.add('is-open');
      console.log('Details panel shown');
    }

    // Update motion UI
    updateMotionUI();
    
    // Update history tab
    updateHistoryTab();
    
    console.log('3D Studio UI updated successfully');
  };

  // Main page reference image functions
  const handleMainReferenceImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      mainReferenceImage = dataUrl;
      
      // Update UI
      const previewImg = mainReferenceDropZone?.querySelector('.drop-zone-preview') as HTMLImageElement;
      const promptEl = mainReferenceDropZone?.querySelector('.drop-zone-prompt');
      
      if (previewImg && promptEl) {
        previewImg.src = dataUrl;
        previewImg.classList.remove('hidden');
        promptEl.classList.add('hidden');
      }
      
      // Show remove button
      if (mainRemoveReferenceBtn) {
        mainRemoveReferenceBtn.classList.remove('hidden');
      }
      
      // Show overlay buttons
      const overlay = mainReferenceDropZone?.querySelector('.drop-zone-overlay');
      if (overlay) {
        overlay.classList.remove('hidden');
      }
    };
    reader.readAsDataURL(file);
  };

  const removeMainReferenceImage = () => {
    mainReferenceImage = null;
    
    // Update UI
    const previewImg = mainReferenceDropZone?.querySelector('.drop-zone-preview') as HTMLImageElement;
    const promptEl = mainReferenceDropZone?.querySelector('.drop-zone-prompt');
    
    if (previewImg && promptEl) {
      previewImg.src = '';
      previewImg.classList.add('hidden');
      promptEl.classList.remove('hidden');
    }
    
    // Hide remove button
    if (mainRemoveReferenceBtn) {
      mainRemoveReferenceBtn.classList.add('hidden');
    }
    
    // Hide overlay buttons
    const overlay = mainReferenceDropZone?.querySelector('.drop-zone-overlay');
    if (overlay) {
      overlay.classList.add('hidden');
    }
  };

  const handleGenerateImageStudio = async () => {
    const promptInput = $('#image-prompt-subject-input-image') as HTMLInputElement;
    const promptText = promptInput?.value?.trim() || '';

    const loaderModal = $('#image-generation-loader-modal');
    const generateBtn = $('#image-generate-btn-image');
    const resultImage = $('.result-image-image') as HTMLImageElement;
    const resultPlaceholder = $('.result-placeholder');
    const resultIdlePlaceholder = $('#result-idle-placeholder-image');
    const resultError = $('.result-error');
    const promptDisplay = $('#image-prompt-display-image') as HTMLTextAreaElement;

    loaderModal?.classList.remove('hidden');
    resultPlaceholder?.classList.add('hidden');
    resultIdlePlaceholder?.classList.add('hidden');
    resultImage?.classList.add('hidden');
    resultError?.classList.add('hidden');
    updateButtonLoadingState(generateBtn, true);

    try {
      const imageCount = imageStudioReferenceImages.filter(img => img !== null).length;
      const hasMultipleImages = imageCount >= 2;
      
      if (hasMultipleImages) {
        if (!promptText) {
          showToast({ type: 'error', title: 'Prompt Required', body: 'Please enter a prompt.' });
          updateButtonLoadingState(generateBtn, false);
          loaderModal?.classList.add('hidden');
          return;
        }
        
        // Image Studio Composition: Blend multiple reference images with prompt
        console.log(`[Image Studio] Starting composition with ${imageCount} reference images`);
        console.log('[Image Studio] User prompt:', promptText);
        
        // Build the composition prompt with clearer instructions for image blending
        const imageCountStr = imageCount === 2 ? 'two' : 'three';
        const compositionPrompt = `You are creating a composed image based on the user's description and ${imageCountStr} reference images.

User's request: "${promptText}"

Instructions:
1. Analyze all reference images
2. Integrate the elements from the reference images according to the user's description
3. The final image should look natural and cohesive, not a weird hybrid
4. Maintain the style and quality of the reference images

Make sure the result is photorealistic and aesthetically pleasing.`;
        
        console.log('[Image Studio] Composition prompt:', compositionPrompt);
        
        const parts: any[] = [];
        
        // Add the composition instruction text
        parts.push({ text: compositionPrompt });
        
        // Add all reference images in order
        for (let i = 0; i < imageStudioReferenceImages.length; i++) {
          if (imageStudioReferenceImages[i]) {
            console.log(`[Image Studio] Adding reference image ${i + 1}`);
            parts.push({
              inlineData: {
                data: await blobToBase64(imageStudioReferenceImages[i]!.file),
                mimeType: imageStudioReferenceImages[i]!.file.type,
              }
            });
          }
        }

        console.log('[Image Studio] Sending request with', parts.length, 'parts');
        
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: { parts },
          config: {
            responseModalities: [Modality.IMAGE],
          },
        });
        
        console.log('[Image Studio] Composition complete');

        const part = response.candidates?.[0]?.content?.parts?.[0];
        if (part && part.inlineData) {
          const { data, mimeType } = part.inlineData;
          const dataUrl = `data:${mimeType};base64,${data}`;
          
          resultImage.src = dataUrl;
          resultImage.classList.remove('hidden');
          resultIdlePlaceholder?.classList.add('hidden');
          resultPlaceholder?.classList.add('hidden');
          loaderModal?.classList.add('hidden');
          
          if (promptDisplay) promptDisplay.value = "Subject placed in scene";
          
          // Save to history
          const timestamp = Date.now();
          currentGeneratedImageStudio = { 
            id: `img_${timestamp}`,
            data, 
            mimeType,
            subject: imageStudioReferenceImages[0]?.file.name || '',
            styleConstraints: imageStudioReferenceImages[1]?.file.name || '',
            timestamp
          };
          imageStudioHistory.push(currentGeneratedImageStudio);
          imageStudioHistoryIndex = imageStudioHistory.length - 1;
          
          // Show history panel
          const historyPanel = $('#image-studio-history-panel');
          historyPanel?.classList.remove('hidden');
          
          // Show details panel
          const detailsPanel = $('#image-details-panel-image');
          const detailsPreview = $('#details-preview-image-image') as HTMLImageElement;
          const detailsDownload = $('#details-download-btn-image') as HTMLAnchorElement;
          
          if (detailsPreview) detailsPreview.src = dataUrl;
          if (detailsDownload) detailsDownload.href = dataUrl;
          
          // Set initial motion frames
          await setInitialMotionFramesStudio(currentGeneratedImageStudio);
          
          // Show and animate details panel
          detailsPanel?.classList.remove('hidden');
          detailsPanel?.classList.add('is-open');
          
          // Render history
          renderImageStudioHistory();
          
          // Update motion UI
          updateMotionUIStudio();
          
          showToast({ type: 'success', title: 'Composed!', body: 'Image composition completed.' });
        }
      } else {
        // Single image generation mode with optional reference images
        const hasOneImage = imageStudioReferenceImages[0] || imageStudioReferenceImages[1];
        
        if (hasOneImage && !promptText) {
          showToast({ type: 'error', title: 'Prompt Required', body: 'Please enter a prompt to edit the image.' });
          updateButtonLoadingState(generateBtn, false);
          loaderModal?.classList.add('hidden');
          return;
        }
        
        const parts: any[] = [];
        
        // Add prompt text if provided
        if (promptText) {
          parts.push({ text: promptText });
        }
        
        // Add reference images if available
        for (let i = 0; i < imageStudioReferenceImages.length; i++) {
          if (imageStudioReferenceImages[i]) {
            console.log(`[Image Studio] Adding reference image ${i + 1}`);
            parts.push({
              inlineData: {
                data: await blobToBase64(imageStudioReferenceImages[i]!.file),
                mimeType: imageStudioReferenceImages[i]!.file.type,
              }
            });
          }
        }
        
        console.log(`[Image Studio] Sending request with ${parts.length} parts`);
        
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: { parts },
          config: {
            responseModalities: [Modality.IMAGE],
          },
        });

        const part = response.candidates?.[0]?.content?.parts?.[0];
        if (part && part.inlineData) {
          const { data, mimeType } = part.inlineData;
          const dataUrl = `data:${mimeType};base64,${data}`;
          
          resultImage.src = dataUrl;
          resultImage.classList.remove('hidden');
          resultIdlePlaceholder?.classList.add('hidden');
          resultPlaceholder?.classList.add('hidden');
          loaderModal?.classList.add('hidden');
          
          if (promptDisplay) promptDisplay.value = promptText || 'Based on reference image';
          
          // Save to history
          const timestamp = Date.now();
          currentGeneratedImageStudio = { 
            id: `img_${timestamp}`,
            data, 
            mimeType,
            subject: imageStudioReferenceImages[0]?.file.name || promptText || '',
            styleConstraints: promptText || '',
            timestamp
          };
          imageStudioHistory.push(currentGeneratedImageStudio);
          imageStudioHistoryIndex = imageStudioHistory.length - 1;
          
          // Show history panel
          const historyPanel = $('#image-studio-history-panel');
          historyPanel?.classList.remove('hidden');
          
          // Show details panel
          const detailsPanel = $('#image-details-panel-image');
          const detailsPreview = $('#details-preview-image-image') as HTMLImageElement;
          const detailsDownload = $('#details-download-btn-image') as HTMLAnchorElement;
          
          if (detailsPreview) detailsPreview.src = dataUrl;
          if (detailsDownload) detailsDownload.href = dataUrl;
          
          // Set initial motion frames
          await setInitialMotionFramesStudio(currentGeneratedImageStudio);
          
          // Show and animate details panel
          detailsPanel?.classList.remove('hidden');
          detailsPanel?.classList.add('is-open');
          
          // Render history
          renderImageStudioHistory();
          
          // Update motion UI
          updateMotionUIStudio();
          
          const hasImageAndPrompt = hasOneImage && promptText;
          const message = hasImageAndPrompt ? 'Image edited successfully.' : 'Image generated successfully.';
          showToast({ type: 'success', title: 'Success!', body: message });
        } else {
          showToast({ type: 'error', title: 'Missing Input', body: 'Please upload images or enter a prompt.' });
        }
      }
    } catch (error) {
      console.error("Image generation failed:", error);
      showToast({ type: 'error', title: 'Generation Failed', body: 'Could not generate image.' });
      resultError?.classList.remove('hidden');
    } finally {
      updateButtonLoadingState(generateBtn, false);
      loaderModal?.classList.add('hidden');
    }
  };

  const handleGenerateVideo = async () => {
    if (!currentGeneratedImage || !currentGeneratedImage.motionPrompt || !motionFirstFrameImage) {
        showToast({ type: 'error', title: 'Missing Data', body: 'Cannot generate video without an image and motion prompt.' });
        return;
    }

    updateButtonLoadingState(generateVideoBtn, true);
    updateButtonLoadingState(regenerateVideoBtn, true);
    isGeneratingVideo = true;

    // Show modal and start messages
    if (videoGenerationLoaderModal && videoLoaderMessage) {
        videoGenerationLoaderModal.classList.remove('hidden');
        let messageIndex = 0;
        videoLoaderMessage.textContent = VIDEO_LOADER_MESSAGES[messageIndex];
        videoMessageInterval = window.setInterval(() => {
            messageIndex = (messageIndex + 1) % VIDEO_LOADER_MESSAGES.length;
            videoLoaderMessage.textContent = VIDEO_LOADER_MESSAGES[messageIndex];
        }, 3000);
    }
    
    try {
        const userPrompt = (document.getElementById('motion-prompt-final-english') as HTMLTextAreaElement).value;
        
        // Remove cinematic keywords as requested.
        const cinematicKeywordsRegex = /cinematic|movie|film look/gi;
        const sanitizedUserPrompt = userPrompt.replace(cinematicKeywordsRegex, '').replace(/\s+/g, ' ').trim();

        // Detect and maintain source image aspect ratio to avoid black bars
        let aspectRatio = '16:9';
        let useImageAspectRatio = false;
        
        if (motionFirstFrameImage) {
            const img = new Image();
            const imgDataUrl = motionFirstFrameImage.dataUrl;
            
            await new Promise<void>((resolve) => {
                img.onload = () => {
                    const width = img.naturalWidth;
                    const height = img.naturalHeight;
                    const ratio = width / height;
                    
                    if (ratio > 1.5) {
                        aspectRatio = '16:9';
                    } else if (ratio > 1) {
                        aspectRatio = '4:3';
                    } else {
                        aspectRatio = '1:1';
                    }
                    useImageAspectRatio = true;
                    resolve();
                };
                img.src = imgDataUrl;
            });
        }

        // Add specific prompts to avoid letterboxing and maintain background
        const finalPrompt = `Maintain full frame coverage with no black bars, borders, or letterboxing. Keep the entire image visible. Preserve the exact background from the source image without any cropping or black bars. ${sanitizedUserPrompt}. CRITICAL NEGATIVE PROMPT: black bars, letterboxing, black borders, black edges, cinematic crop, pillarbox, narrow frame, cropped edges, missing background.`;

        const config: any = {
            numberOfVideos: 1,
            resolution: '1080p',
        };

        if (useImageAspectRatio || !motionFirstFrameImage) {
            config.aspectRatio = aspectRatio;
        }

        const selectedModel = (document.querySelector('input[name="motion-model"]:checked') as HTMLInputElement)?.value || 'veo-3.1-fast-generate-preview';

        const payload: any = {
            model: selectedModel,
            prompt: finalPrompt,
            config: config,
        };

        if (motionFirstFrameImage) {
            payload.image = {
                imageBytes: await blobToBase64(motionFirstFrameImage.file),
                mimeType: motionFirstFrameImage.file.type,
            };
        }

        if (motionLastFrameImage) {
            payload.config.lastFrame = {
                imageBytes: await blobToBase64(motionLastFrameImage.file),
                mimeType: motionLastFrameImage.file.type,
            };
        }

        let operation = await ai.models.generateVideos(payload);
        currentVideoGenerationOperation = operation;

        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            operation = await ai.operations.getVideosOperation({ operation: operation });
            currentVideoGenerationOperation = operation;
        }

        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (!downloadLink) {
            throw new Error("Video generation succeeded but no download link was found.");
        }
        
        const videoResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
        if (!videoResponse.ok) {
            throw new Error(`Failed to download video: ${videoResponse.statusText}`);
        }

        const videoBlob = await videoResponse.blob();
        const videoDataUrl = URL.createObjectURL(videoBlob);

        currentGeneratedImage.videoDataUrl = videoDataUrl;
        const historyItem = imageHistory.find(item => item.id === currentGeneratedImage!.id);
        if (historyItem) {
            historyItem.videoDataUrl = videoDataUrl;
        }
        
        if(resultVideo) {
            resultVideo.src = videoDataUrl;
            resultVideo.classList.remove('hidden');
            resultImage?.classList.add('hidden');
            motionPromptPlaceholder?.classList.add('hidden');
        }
        previewSwitcherVideoBtn?.click();

        updateMotionUI();
        showToast({ type: 'success', title: 'Video Generated!', body: 'Your animated image is ready.' });

    } catch (error) {
        console.error("Video generation failed:", error);
        showToast({ type: 'error', title: 'Video Failed', body: 'Something went wrong during video generation.' });
        if (motionVideoContainer) motionVideoContainer.classList.remove('loading');
    } finally {
        updateButtonLoadingState(generateVideoBtn, false);
        updateButtonLoadingState(regenerateVideoBtn, false);
        isGeneratingVideo = false;
        currentVideoGenerationOperation = null;
        
        videoGenerationLoaderModal?.classList.add('hidden');
        if (videoMessageInterval) {
            clearInterval(videoMessageInterval);
            videoMessageInterval = null;
        }
    }
  };

  const handleGenerateVideoStudio = async () => {
    if (!currentGeneratedImageStudio || !currentGeneratedImageStudio.motionPrompt || !motionFirstFrameImageStudio) {
        showToast({ type: 'error', title: 'Missing Data', body: 'Cannot generate video without an image and motion prompt.' });
        return;
    }

    updateButtonLoadingState(generateVideoBtnStudio, true);
    updateButtonLoadingState(regenerateVideoBtnStudio, true);
    isGeneratingVideo = true;

    // Show modal and start messages
    if (videoGenerationLoaderModal && videoLoaderMessage) {
        videoGenerationLoaderModal.classList.remove('hidden');
        let messageIndex = 0;
        videoLoaderMessage.textContent = VIDEO_LOADER_MESSAGES[messageIndex];
        videoMessageInterval = window.setInterval(() => {
            messageIndex = (messageIndex + 1) % VIDEO_LOADER_MESSAGES.length;
            videoLoaderMessage.textContent = VIDEO_LOADER_MESSAGES[messageIndex];
        }, 3000);
    }
    
    try {
        const userPrompt = (document.getElementById('motion-prompt-final-english-image') as HTMLTextAreaElement).value;
        
        // Remove cinematic keywords as requested.
        const cinematicKeywordsRegex = /cinematic|movie|film look/gi;
        const sanitizedUserPrompt = userPrompt.replace(cinematicKeywordsRegex, '').replace(/\s+/g, ' ').trim();

        // Detect and maintain source image aspect ratio to avoid black bars
        let aspectRatio = '16:9';
        let useImageAspectRatio = false;
        
        if (motionFirstFrameImageStudio) {
            const img = new Image();
            const imgDataUrl = motionFirstFrameImageStudio.dataUrl;
            
            await new Promise<void>((resolve) => {
                img.onload = () => {
                    const width = img.naturalWidth;
                    const height = img.naturalHeight;
                    const ratio = width / height;
                    
                    if (ratio > 1.5) {
                        aspectRatio = '16:9';
                    } else if (ratio > 1) {
                        aspectRatio = '4:3';
                    } else {
                        aspectRatio = '1:1';
                    }
                    useImageAspectRatio = true;
                    resolve();
                };
                img.src = imgDataUrl;
            });
        }

        // Add specific prompts to avoid letterboxing and maintain background
        const finalPrompt = `Maintain full frame coverage with no black bars, borders, or letterboxing. Keep the entire image visible. Preserve the exact background from the source image without any cropping or black bars. ${sanitizedUserPrompt}. CRITICAL NEGATIVE PROMPT: black bars, letterboxing, black borders, black edges, cinematic crop, pillarbox, narrow frame, cropped edges, missing background.`;

        const config: any = {
            numberOfVideos: 1,
            resolution: '1080p',
        };

        if (useImageAspectRatio || !motionFirstFrameImageStudio) {
            config.aspectRatio = aspectRatio;
        }

        const selectedModel = (document.querySelector('input[name="motion-model-image"]:checked') as HTMLInputElement)?.value || 'veo-3.1-fast-generate-preview';

        const payload: any = {
            model: selectedModel,
            prompt: finalPrompt,
            config: config,
        };

        if (motionFirstFrameImageStudio) {
            payload.image = {
                imageBytes: await blobToBase64(motionFirstFrameImageStudio.file),
                mimeType: motionFirstFrameImageStudio.file.type,
            };
        }

        if (motionLastFrameImageStudio) {
            payload.config.lastFrame = {
                imageBytes: await blobToBase64(motionLastFrameImageStudio.file),
                mimeType: motionLastFrameImageStudio.file.type,
            };
        }

        let operation = await ai.models.generateVideos(payload);
        currentVideoGenerationOperation = operation;

        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            operation = await ai.operations.getVideosOperation({ operation: operation });
            currentVideoGenerationOperation = operation;
        }

        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (!downloadLink) {
            throw new Error("Video generation succeeded but no download link was found.");
        }
        
        const videoResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
        if (!videoResponse.ok) {
            throw new Error(`Failed to download video: ${videoResponse.statusText}`);
        }

        const videoBlob = await videoResponse.blob();
        const videoDataUrl = URL.createObjectURL(videoBlob);

        currentGeneratedImageStudio.videoDataUrl = videoDataUrl;
        const historyItem = imageStudioHistory.find(item => item.id === currentGeneratedImageStudio!.id);
        if (historyItem) {
            historyItem.videoDataUrl = videoDataUrl;
        }
        
        if(resultVideoStudio) {
            resultVideoStudio.src = videoDataUrl;
            resultVideoStudio.classList.remove('hidden');
            resultImageStudio?.classList.add('hidden');
            motionPromptPlaceholderStudio?.classList.add('hidden');
        }
        if (previewSwitcherVideoBtnStudio) {
            previewSwitcherVideoBtnStudio.classList.add('active');
            previewSwitcherImageBtnStudio?.classList.remove('active');
        }

        updateMotionUIStudio();
        showToast({ type: 'success', title: 'Video Generated!', body: 'Your animated image is ready.' });

    } catch (error) {
        console.error("Video generation failed:", error);
        showToast({ type: 'error', title: 'Video Failed', body: 'Something went wrong during video generation.' });
        const motionVideoContainerStudio = $('#motion-video-container-image');
        if (motionVideoContainerStudio) motionVideoContainerStudio.classList.remove('loading');
    } finally {
        updateButtonLoadingState(generateVideoBtnStudio, false);
        updateButtonLoadingState(regenerateVideoBtnStudio, false);
        isGeneratingVideo = false;
        currentVideoGenerationOperation = null;
        
        videoGenerationLoaderModal?.classList.add('hidden');
        if (videoMessageInterval) {
            clearInterval(videoMessageInterval);
            videoMessageInterval = null;
        }
    }
  };

  const updateMotionUIStudio = () => {
    if (!currentGeneratedImageStudio) return;
    
    const motionPromptOutputStudio = $('#motion-prompt-output-image');
    const finalEnglishPromptEl = $('#motion-prompt-final-english-image') as HTMLTextAreaElement;
    const koreanDescEl = $('#motion-prompt-korean-image');
    
    const hasMotionPrompt = !!currentGeneratedImageStudio.motionPrompt;
    const hasVideo = !!currentGeneratedImageStudio.videoDataUrl;

    // Update prompt display
    if (hasMotionPrompt && finalEnglishPromptEl && koreanDescEl) {
        finalEnglishPromptEl.value = currentGeneratedImageStudio.motionPrompt!.english;
        koreanDescEl.textContent = currentGeneratedImageStudio.motionPrompt!.korean;
        if (motionPromptOutputStudio) motionPromptOutputStudio.classList.remove('hidden');
    } else {
        if (motionPromptOutputStudio) motionPromptOutputStudio.classList.add('hidden');
    }

    // Update video player
    const motionVideoPlayerStudio = $('#motion-video-player-image') as HTMLVideoElement;
    const motionVideoContainerStudio = $('#motion-video-container-image');
    
    if (motionVideoPlayerStudio) {
        if (hasVideo) {
            motionVideoPlayerStudio.src = currentGeneratedImageStudio.videoDataUrl!;
            if (motionVideoContainerStudio) motionVideoContainerStudio.classList.remove('loading');
            if (motionVideoContainerStudio) motionVideoContainerStudio.classList.remove('hidden');
        } else {
            motionVideoPlayerStudio.src = '';
            if (motionVideoContainerStudio) motionVideoContainerStudio.classList.add('hidden');
        }
    }
    
    // Update download button link
    if (downloadVideoBtnStudio) {
      if (hasVideo) {
        downloadVideoBtnStudio.href = currentGeneratedImageStudio.videoDataUrl!;
        downloadVideoBtnStudio.download = `${currentGeneratedImageStudio.subject.replace(/\s+/g, '_')}_motion.mp4`;
      }
    }

    // Update action buttons visibility
    if (generateMotionPromptBtnStudio && regenerateMotionPromptBtnStudio && generateVideoBtnStudio && regenerateVideoBtnStudio && downloadVideoBtnStudio) {
        if (hasVideo) {
            generateMotionPromptBtnStudio.classList.add('hidden');
            generateVideoBtnStudio.classList.add('hidden');
            regenerateMotionPromptBtnStudio.classList.remove('hidden');
            regenerateVideoBtnStudio.classList.remove('hidden');
            downloadVideoBtnStudio.classList.remove('hidden');
        } else if (hasMotionPrompt) {
            generateMotionPromptBtnStudio.classList.add('hidden');
            generateVideoBtnStudio.classList.remove('hidden');
            regenerateMotionPromptBtnStudio.classList.remove('hidden');
            regenerateVideoBtnStudio.classList.add('hidden');
            downloadVideoBtnStudio.classList.add('hidden');
        } else {
            generateMotionPromptBtnStudio.classList.remove('hidden');
            generateVideoBtnStudio.classList.add('hidden');
            regenerateMotionPromptBtnStudio.classList.add('hidden');
            regenerateVideoBtnStudio.classList.add('hidden');
            downloadVideoBtnStudio.classList.add('hidden');
        }
    }
    
    // Update thumbnail
    if (motionThumbnailImageStudio && motionThumbnailLabelStudio) {
        const dataUrl = `data:${currentGeneratedImageStudio.mimeType};base64,${currentGeneratedImageStudio.data}`;
        motionThumbnailImageStudio.src = dataUrl;
        motionThumbnailLabelStudio.textContent = currentGeneratedImageStudio.subject;
    }
  };

  const updateMotionUI = () => {
    if (!currentGeneratedImage || !motionPromptOutput || !generateMotionPromptBtn || !regenerateMotionPromptBtn || !generateVideoBtn || !regenerateVideoBtn || !downloadVideoBtn || !motionVideoContainer) return;
    
    const finalEnglishPromptEl = $('#motion-prompt-final-english') as HTMLTextAreaElement;
    const koreanDescEl = $('#motion-prompt-korean');
    
    const hasMotionPrompt = !!currentGeneratedImage.motionPrompt;
    const hasVideo = !!currentGeneratedImage.videoDataUrl;

    // Update prompt display
    if (hasMotionPrompt && finalEnglishPromptEl && koreanDescEl) {
        finalEnglishPromptEl.value = currentGeneratedImage.motionPrompt!.english;
        koreanDescEl.textContent = currentGeneratedImage.motionPrompt!.korean;
        motionPromptOutput.classList.remove('hidden');
    } else {
        motionPromptOutput.classList.add('hidden');
    }

    // Update video player in details panel
    if (motionVideoPlayer) {
        if (hasVideo) {
            motionVideoPlayer.src = currentGeneratedImage.videoDataUrl!;
            motionVideoContainer.classList.remove('loading');
            motionVideoContainer.classList.remove('hidden');
        } else {
            motionVideoPlayer.src = '';
            motionVideoContainer.classList.add('hidden');
        }
    }
    
    // Update download button link
    if (downloadVideoBtn) {
      if (hasVideo) {
        downloadVideoBtn.href = currentGeneratedImage.videoDataUrl!;
        downloadVideoBtn.download = `${currentGeneratedImage.subject.replace(/\s+/g, '_')}_motion.mp4`;
      }
    }

    // Update action buttons visibility
    if (hasVideo) {
        // Video has been generated: show regenerate and download options
        generateMotionPromptBtn.classList.add('hidden');
        generateVideoBtn.classList.add('hidden');
        regenerateMotionPromptBtn.classList.remove('hidden');
        regenerateVideoBtn.classList.remove('hidden');
        downloadVideoBtn.classList.remove('hidden');
    } else if (hasMotionPrompt) {
        // Prompt is ready, waiting to generate video
        generateMotionPromptBtn.classList.add('hidden');
        generateVideoBtn.classList.remove('hidden');
        regenerateMotionPromptBtn.classList.remove('hidden');
        regenerateVideoBtn.classList.add('hidden');
        downloadVideoBtn.classList.add('hidden');
    } else {
        // Initial state, no prompt yet
        generateMotionPromptBtn.classList.remove('hidden');
        generateVideoBtn.classList.add('hidden');
        regenerateMotionPromptBtn.classList.add('hidden');
        regenerateVideoBtn.classList.add('hidden');
        downloadVideoBtn.classList.add('hidden');
    }
  };

  const renderGeneratedMotionCategories = (categories: any[]) => {
    if (!motionCategoryList) return;
    motionCategoryList.innerHTML = '';

    if (!categories || categories.length === 0) {
        motionCategoryList.innerHTML = `<p style="text-align: center; color: var(--text-secondary); padding: var(--spacing-5);">Could not generate motion ideas. Please try again.</p>`;
        return;
    }

    categories.forEach((category, index) => {
        const item = document.createElement('button');
        item.className = 'category-item';

        item.innerHTML = `
            <div class="category-item-header">
                <h3 class="category-item-title">${category.name}</h3>
            </div>
            <p class="category-item-description">${category.description}</p>
        `;
        item.addEventListener('click', () => {
            if (!currentGeneratedImage) return;

            motionCategoryModal?.classList.add('hidden');
            
            const motionData = {
                json: category,
                english: category.english,
                korean: category.korean
            };

            currentGeneratedImage.motionPrompt = motionData;
            
            const historyItem = imageHistory.find(item => item.id === currentGeneratedImage!.id);
            if (historyItem) {
                historyItem.motionPrompt = motionData;
            }

            updateMotionUI();
            lastFocusedElement?.focus();
        });
        motionCategoryList.appendChild(item);
    });
  };
  
  const generateAndDisplayMotionCategoriesStudio = async () => {
    if (!currentGeneratedImageStudio || !motionCategoryList) return;

    motionCategoryList.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--spacing-4); padding: var(--spacing-6);">
            <div class="loader"></div>
            <p style="color: var(--text-secondary);">Analyzing image and generating ideas...</p>
        </div>
    `;

    try {
        const subject = currentGeneratedImageStudio.subject;
        const dataUrl = `data:${currentGeneratedImageStudio.mimeType};base64,${currentGeneratedImageStudio.data}`;
        const textPrompt = `Analyze the provided image of a '${subject}'. Based on its appearance, create 5 unique and creative motion style suggestions for a short, looping video.

For each suggestion, provide:
1. 'name': A short, catchy category name in Korean (e.g., '부드러운 루핑').
2. 'description': A brief, engaging description in Korean of the motion style. You can use <b> tags for emphasis (e.g., '<b>자연스럽게 반복되는 움직임.</b> 시작과 끝이 매끄럽게 연결됩니다.').
3. 'english': A concise, direct text-to-video prompt in English that embodies the motion style. Crucially, the prompt must ensure the animation creates a perfect loop, starting and ending with the provided image. The subject must remain fully visible within the frame throughout the animation. Start the prompt with the subject.
4. 'korean': A lively, descriptive version of the prompt in Korean for the user to read, mentioning that it's a looping animation.

Return the 5 suggestions as a JSON array.`;
        
        const imagePart = {
          inlineData: {
            data: currentGeneratedImageStudio.data,
            mimeType: currentGeneratedImageStudio.mimeType,
          },
        };

        const textPart = { text: textPrompt };
        const contents = { parts: [imagePart, textPart] };
        
        const schema = {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING, description: 'A short, catchy category name in Korean.' },
                    description: { type: Type.STRING, description: 'An engaging description in Korean of the motion style, allowing <b> tags.' },
                    english: { type: Type.STRING, description: 'A concise text-to-video prompt in English.' },
                    korean: { type: Type.STRING, description: 'A lively, descriptive version of the prompt in Korean for the user.' },
                },
                required: ['name', 'description', 'english', 'korean'],
            }
        };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: contents,
            config: {
                responseMimeType: 'application/json',
                responseSchema: schema,
            },
        });

        const jsonResponse = JSON.parse(response.text.trim());
        renderGeneratedMotionCategoriesStudio(jsonResponse);

    } catch (error) {
        console.error("Failed to generate motion categories:", error);
        showToast({ type: 'error', title: 'Error', body: 'Could not generate motion ideas.' });
        if (motionCategoryList) {
            motionCategoryList.innerHTML = `<p style="text-align: center; color: var(--text-secondary); padding: var(--spacing-5);">An error occurred. Please close this and try again.</p>`;
        }
    }
  };

  const renderGeneratedMotionCategoriesStudio = (categories: any[]) => {
    if (!motionCategoryList) return;
    motionCategoryList.innerHTML = '';

    if (!categories || categories.length === 0) {
        motionCategoryList.innerHTML = `<p style="text-align: center; color: var(--text-secondary); padding: var(--spacing-5);">Could not generate motion ideas. Please try again.</p>`;
        return;
    }

    categories.forEach((category, index) => {
        const item = document.createElement('button');
        item.className = 'category-item';

        item.innerHTML = `
            <div class="category-item-header">
                <h3 class="category-item-title">${category.name}</h3>
            </div>
            <p class="category-item-description">${category.description}</p>
        `;
        item.addEventListener('click', () => {
            if (!currentGeneratedImageStudio) return;

            motionCategoryModal?.classList.add('hidden');
            
            const motionData = {
                json: category,
                english: category.english,
                korean: category.korean
            };

            currentGeneratedImageStudio.motionPrompt = motionData;
            
            const historyItem = imageStudioHistory.find(item => item.id === currentGeneratedImageStudio!.id);
            if (historyItem) {
                historyItem.motionPrompt = motionData;
            }

            lastFocusedElement?.focus();
            
            // Update motion UI after modal is hidden
            setTimeout(() => {
                updateMotionUIStudio();
            }, 100);
        });
        motionCategoryList.appendChild(item);
    });
  };

  const generateAndDisplayMotionCategories = async () => {
    if (!currentGeneratedImage || !motionCategoryList) return;

    motionCategoryList.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--spacing-4); padding: var(--spacing-6);">
            <div class="loader"></div>
            <p style="color: var(--text-secondary);">Analyzing image and generating ideas...</p>
        </div>
    `;

    try {
        const subject = currentGeneratedImage.subject;
        const textPrompt = `Analyze the provided image of a '${subject}'. Based on its appearance, create 5 unique and creative motion style suggestions for a short, looping video.

For each suggestion, provide:
1. 'name': A short, catchy category name in Korean (e.g., '부드러운 루핑').
2. 'description': A brief, engaging description in Korean of the motion style. You can use <b> tags for emphasis (e.g., '<b>자연스럽게 반복되는 움직임.</b> 시작과 끝이 매끄럽게 연결됩니다.').
3. 'english': A concise, direct text-to-video prompt in English that embodies the motion style. Crucially, the prompt must ensure the animation creates a perfect loop, starting and ending with the provided image. The subject must remain fully visible within the frame throughout the animation. Start the prompt with the subject.
4. 'korean': A lively, descriptive version of the prompt in Korean for the user to read, mentioning that it's a looping animation.

Return the 5 suggestions as a JSON array.`;
        
        const imagePart = {
          inlineData: {
            data: currentGeneratedImage.data,
            mimeType: currentGeneratedImage.mimeType,
          },
        };

        const textPart = { text: textPrompt };
        const contents = { parts: [imagePart, textPart] };
        
        const schema = {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING, description: 'A short, catchy category name in Korean.' },
                    description: { type: Type.STRING, description: 'An engaging description in Korean of the motion style, allowing <b> tags.' },
                    english: { type: Type.STRING, description: 'A concise text-to-video prompt in English.' },
                    korean: { type: Type.STRING, description: 'A lively, descriptive version of the prompt in Korean for the user.' },
                },
                required: ['name', 'description', 'english', 'korean'],
            }
        };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: contents,
            config: {
                responseMimeType: 'application/json',
                responseSchema: schema,
            },
        });

        const jsonResponse = JSON.parse(response.text.trim());
        renderGeneratedMotionCategories(jsonResponse);

    } catch (error) {
        console.error("Failed to generate motion categories:", error);
        showToast({ type: 'error', title: 'Error', body: 'Could not generate motion ideas.' });
        if (motionCategoryList) {
            motionCategoryList.innerHTML = `<p style="text-align: center; color: var(--text-secondary); padding: var(--spacing-5);">An error occurred. Please close this and try again.</p>`;
        }
    }
  };

  const updateHistoryTab = () => {
    if (!currentGeneratedImage) return;
    
    const historyOriginalImage = $('#history-original-image') as HTMLImageElement;
    const historyFixedImage = $('#history-fixed-image') as HTMLImageElement;
    
    if (historyOriginalImage && currentGeneratedImage.originalData) {
        const originalDataUrl = `data:${currentGeneratedImage.originalMimeType};base64,${currentGeneratedImage.originalData}`;
        historyOriginalImage.src = originalDataUrl;
    }
    
    if (historyFixedImage) {
        const fixedDataUrl = `data:${currentGeneratedImage.mimeType};base64,${currentGeneratedImage.data}`;
        historyFixedImage.src = fixedDataUrl;
    }
  };

  const update3dViewFromState = () => {
    if (!currentGeneratedImage || !resultImage || !resultIdlePlaceholder || !resultPlaceholder || !resultError || !mainResultContentHeader) return;

    const dataUrl = `data:${currentGeneratedImage.mimeType};base64,${currentGeneratedImage.data}`;
    resultImage.src = dataUrl;
    resultImage.classList.remove('hidden');
    resultVideo.classList.add('hidden'); 
    motionPromptPlaceholder?.classList.add('hidden');
    
    // Switch to image tab
    previewSwitcherImageBtn?.classList.add('active');
    previewSwitcherVideoBtn?.classList.remove('active');

    setTimeout(() => resultImage.classList.add('visible'), 50);

    resultIdlePlaceholder.classList.add('hidden');
    resultPlaceholder.classList.add('hidden');
    resultError.classList.add('hidden');
    mainResultContentHeader.classList.remove('hidden');
    
    if(detailsPreviewImage && detailsDownloadBtn) {
        detailsPreviewImage.src = dataUrl;
        detailsDownloadBtn.href = dataUrl;
        detailsDownloadBtn.download = `${currentGeneratedImage.subject.replace(/\s+/g, '_')}.png`;
    }
    
    if (motionThumbnailImage && motionThumbnailLabel) {
      motionThumbnailImage.src = dataUrl;
      motionThumbnailLabel.textContent = currentGeneratedImage.subject;
    }
    
    // Update color pickers in details panel
    if (currentGeneratedImage.styleConstraints) {
        try {
            const styleData = JSON.parse(currentGeneratedImage.styleConstraints);
            if (detailsBackgroundColorPicker && styleData.background?.color) {
                detailsBackgroundColorPicker.value = styleData.background.color;
            }
            if (detailsObjectColorPicker && styleData.colors?.dominant_blue) {
                detailsObjectColorPicker.value = styleData.colors.dominant_blue;
            }
        } catch (e) {
            console.error('Failed to parse style constraints:', e);
        }
    }

    updateMotionUI();
    updateHistoryTab();
  };

  const renderHistory = () => {
    if (!historyPanel || !historyList || !historyCounter || !historyBackBtn || !historyForwardBtn) return;
    
    if (imageHistory.length === 0) {
        historyPanel.classList.add('hidden');
        return;
    }

    historyPanel.classList.remove('hidden');
    historyList.innerHTML = '';

    imageHistory.forEach((item, index) => {
        const li = document.createElement('li');
        li.className = 'history-item';
        if (index === historyIndex) {
            li.classList.add('selected');
        }
        li.dataset.index = String(index);

        const date = new Date(item.timestamp);
        const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        li.innerHTML = `
        <div class="history-item-main">
            <img src="data:${item.mimeType};base64,${item.data}" class="history-thumbnail" alt="History item thumbnail">
            <div class="history-item-info">
            <span class="history-item-label">${item.subject}</span>
            <span class="history-item-timestamp">${timeString}</span>
            </div>
            <button class="history-item-delete-btn" aria-label="Delete history item">
                <span class="material-symbols-outlined">delete</span>
            </button>
        </div>
        `;
        
        // Delete button event
        const deleteBtn = li.querySelector('.history-item-delete-btn') as HTMLButtonElement;
        deleteBtn?.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent history item click
            if (imageHistory.length === 1) {
                showToast({ type: 'error', title: 'Cannot Delete', body: 'Cannot delete the last item in history.' });
                return;
            }
            
            imageHistory.splice(index, 1);
            
            // Adjust history index
            if (historyIndex >= index && historyIndex > 0) {
                historyIndex--;
            } else if (historyIndex >= imageHistory.length) {
                historyIndex = imageHistory.length - 1;
            }
            
            if (imageHistory.length > 0) {
                currentGeneratedImage = imageHistory[historyIndex];
                update3dViewFromState();
            } else {
                currentGeneratedImage = null;
                resultImage.src = '';
                resultImage.classList.add('hidden');
                resultIdlePlaceholder?.classList.remove('hidden');
                mainResultContentHeader?.classList.add('hidden');
            }
            
            renderHistory();
            showToast({ type: 'success', title: 'Deleted', body: 'Item removed from history.' });
        });
        
        li.addEventListener('click', () => {
            historyIndex = index;
            currentGeneratedImage = imageHistory[historyIndex];
            update3dViewFromState();
            renderHistory();
        });
        historyList.prepend(li);
    });

    historyCounter.textContent = `${historyIndex + 1} / ${imageHistory.length}`;
    (historyBackBtn as HTMLButtonElement).disabled = historyIndex <= 0;
    (historyForwardBtn as HTMLButtonElement).disabled = historyIndex >= imageHistory.length - 1;
  };

  const renderImageStudioHistory = () => {
    const historyPanelEl = $('#image-studio-history-panel');
    const historyListEl = $('#history-list-image');
    const historyCounterEl = $('#history-counter-image');
    const historyBackBtnEl = $('#history-back-btn-image');
    const historyForwardBtnEl = $('#history-forward-btn-image');
    
    if (!historyPanelEl || !historyListEl || !historyCounterEl || !historyBackBtnEl || !historyForwardBtnEl) return;
    
    if (imageStudioHistory.length === 0) {
        historyPanelEl.classList.add('hidden');
        return;
    }

    historyPanelEl.classList.remove('hidden');
    historyListEl.innerHTML = '';

    imageStudioHistory.forEach((item, index) => {
        const li = document.createElement('li');
        li.className = 'history-item';
        if (index === imageStudioHistoryIndex) {
            li.classList.add('selected');
        }
        li.dataset.index = String(index);

        const date = new Date(item.timestamp);
        const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        li.innerHTML = `
        <div class="history-item-main">
            <img src="data:${item.mimeType};base64,${item.data}" class="history-thumbnail" alt="History item thumbnail">
            <div class="history-item-info">
            <span class="history-item-label">${item.subject}</span>
            <span class="history-item-timestamp">${timeString}</span>
            </div>
        </div>
        `;
        li.addEventListener('click', () => {
            imageStudioHistoryIndex = index;
            currentGeneratedImageStudio = imageStudioHistory[imageStudioHistoryIndex];
            const dataUrl = `data:${item.mimeType};base64,${item.data}`;
            const resultImage = $('#result-image-image') as HTMLImageElement;
            if (resultImage) {
                resultImage.src = dataUrl;
                resultImage.classList.remove('hidden');
            }
            // Update details panel
            const detailsPanel = $('#image-details-panel-image');
            const detailsPreview = $('#details-preview-image-image') as HTMLImageElement;
            const detailsDownload = $('#details-download-btn-image') as HTMLAnchorElement;
            if (detailsPreview) detailsPreview.src = dataUrl;
            if (detailsDownload) detailsDownload.href = dataUrl;
            detailsPanel?.classList.remove('hidden');
            detailsPanel?.classList.add('is-open');
            renderImageStudioHistory();
        });
        historyListEl.prepend(li);
    });

    historyCounterEl.textContent = `${imageStudioHistoryIndex + 1} / ${imageStudioHistory.length}`;
    (historyBackBtnEl as HTMLButtonElement).disabled = imageStudioHistoryIndex <= 0;
    (historyForwardBtnEl as HTMLButtonElement).disabled = imageStudioHistoryIndex >= imageStudioHistory.length - 1;
  };
  
  // --- PAGE-SPECIFIC LOGIC: Icon Studio ---
  
  const populateIconGrid = (filter = '') => {
    if (!iconGrid) return;
    iconGrid.innerHTML = '';
    const query = filter.toLowerCase().trim();
    const filteredIcons = ICON_DATA.filter(icon => 
        icon.name.toLowerCase().includes(query) || 
        icon.tags.some(tag => tag.toLowerCase().includes(query))
    );

    filteredIcons.forEach(icon => {
        const item = document.createElement('div');
        item.className = 'icon-item';
        item.dataset.iconName = icon.name;
        item.innerHTML = `
            <span class="material-symbols-outlined">${icon.name}</span>
            <span>${icon.name.replace(/_/g, ' ')}</span>
        `;
        item.addEventListener('click', () => handleIconClick(icon));
        iconGrid.appendChild(item);
    });
    applyAllIconStyles();
  };
  
  const getSelectedIconStyles = () => {
    if (!selectedIcon) return null;

    const style = (document.querySelector('input[name="icon-family"]:checked') as HTMLInputElement)?.value || 'Outlined';
    const fill = ($('#fill-toggle') as HTMLInputElement)?.checked ? 1 : 0;
    const weight = ($('#weight-slider') as HTMLInputElement)?.value || '400';
    const opticalSize = ($('#optical-size-slider') as HTMLInputElement)?.value || '24';
    // Fix: Use '$' instead of '$$' to select a single element by ID.
    const exportSize = ($('#export-size-input') as HTMLInputElement)?.value || '48';
    const color = ($('#color-picker') as HTMLInputElement)?.value || '#0F172A';

    return {
      name: selectedIcon.name,
      style: style,
      fill: fill,
      weight: weight,
      opsz: opticalSize,
      size: parseInt(exportSize, 10),
      color: color,
      fontVariationSettings: `'FILL' ${fill}, 'wght' ${weight}, 'opsz' ${opticalSize}`
    };
  };

  const generateCodeSnippet = (lang: string) => {
    const styles = getSelectedIconStyles();
    if (!styles) return '';
  
    const { name, style, size, color, fontVariationSettings } = styles;
    const styleClass = `material-symbols-${style.toLowerCase()}`;
  
    switch (lang) {
      case 'react':
        return `<span\n  className="${styleClass}"\n  style={{\n    fontVariationSettings: "${fontVariationSettings}",\n    fontSize: "${size}px",\n    color: "${color}"\n  }}\n>\n  ${name}\n</span>`;
      case 'vue':
        return `<span\n  class="${styleClass}"\n  :style="{\n    fontVariationSettings: '${fontVariationSettings}',\n    fontSize: '${size}px',\n    color: '${color}'\n  }"\n>\n  ${name}\n</span>`;
      case 'svelte':
      case 'html':
      default:
        return `<span\n  class="${styleClass}"\n  style="\n    font-variation-settings: ${fontVariationSettings};\n    font-size: ${size}px;\n    color: ${color};\n  "\n>\n  ${name}\n</span>`;
    }
  };
  
  const updateCodeSnippetDisplay = () => {
    if (!selectedIcon) return;
    const activeTab = snippetTabsContainer?.querySelector('.snippet-tab-item.active');
    const lang = (activeTab as HTMLElement)?.dataset.lang || 'html';
    if (snippetCode) {
      snippetCode.textContent = generateCodeSnippet(lang);
    }
  };
  
  const downloadCanvas = (canvas: HTMLCanvasElement, filename: string) => {
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };
  
  const downloadText = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = filename;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadSVG = () => {
    const styles = getSelectedIconStyles();
    if (!styles) return;
  
    const { name, style, size, color, fontVariationSettings } = styles;
    const fontUrl = `https://fonts.googleapis.com/css2?family=Material+Symbols+${style}:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200`;
  
    const svgContent = `
  <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <style>
      @import url('${fontUrl}');
      .icon {
        font-family: 'Material Symbols ${style}';
        font-size: ${size}px;
        fill: ${color};
        font-variation-settings: ${fontVariationSettings.replace(/'/g, '')};
      }
    </style>
    <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" class="icon">${name}</text>
  </svg>
    `.trim();
  
    downloadText(svgContent, `${name}.svg`, 'image/svg+xml');
  };

  const handleDownloadPNG = async () => {
    const styles = getSelectedIconStyles();
    if (!styles) return;
  
    const { name, style, size, color, fontVariationSettings } = styles;
  
    const tempIcon = document.createElement('span');
    tempIcon.textContent = name;
    tempIcon.className = `material-symbols-${style.toLowerCase()}`;
    tempIcon.style.fontVariationSettings = fontVariationSettings;
    tempIcon.style.position = 'absolute';
    tempIcon.style.left = '-9999px';
    tempIcon.style.visibility = 'hidden';
    tempIcon.style.fontSize = `${size}px`;
    document.body.appendChild(tempIcon);
  
    await document.fonts.ready;
    await new Promise(resolve => setTimeout(resolve, 50));
  
    const canvas = document.createElement('canvas');
    const padding = size * 0.1;
    canvas.width = size + padding * 2;
    canvas.height = size + padding * 2;
    const ctx = canvas.getContext('2d');
  
    if (ctx) {
      const computedStyle = window.getComputedStyle(tempIcon);
      ctx.font = computedStyle.font;
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(name, canvas.width / 2, canvas.height / 2);
      downloadCanvas(canvas, `${name}.png`);
    }
  
    document.body.removeChild(tempIcon);
  };
  
  const handleCopyCode = async (code: string, type: string) => {
      if (!code) return;
      try {
          await navigator.clipboard.writeText(code);
          showToast({ type: 'success', title: 'Copied to Clipboard', body: `${type} code has been copied.` });
      } catch (err) {
          console.error('Failed to copy text: ', err);
          showToast({ type: 'error', title: 'Copy Failed', body: 'Could not copy code to clipboard.' });
      }
  };

  const handleUpscaleImage = async () => {
      if (!currentGeneratedImage) return;
      
      const upscaleBtn = $('#details-upscale-btn');
      updateButtonLoadingState(upscaleBtn, true);
      imageGenerationLoaderModal?.classList.remove('hidden');
      
      try {
          // Use the current image as reference and upscale to 4K
          const parts: any[] = [
              {
                  text: "Create a high-resolution version of this image. Generate it at maximum resolution (at least 2048x2048 pixels or larger, preferably 4096x4096), with extremely sharp details, enhanced clarity, perfect edge definition, no blur or artifacts. Maintain all colors, composition, and visual elements exactly as shown but at significantly higher resolution and quality."
              }
          ];
          
          // Add current image as reference
          parts.push({
              inlineData: {
                  data: currentGeneratedImage.data,
                  mimeType: currentGeneratedImage.mimeType,
              }
          });
          
          const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash-image',
              contents: { parts },
              config: {
                  responseModalities: [Modality.IMAGE],
                  temperature: 0.1,
                  topP: 0.95,
                  topK: 40,
              },
          });
          
          const part = response.candidates?.[0]?.content?.parts?.[0];
          if (part && part.inlineData) {
              const { data, mimeType } = part.inlineData;
              
              // Update current image
              currentGeneratedImage.data = data;
              currentGeneratedImage.mimeType = mimeType;
              
              // Update history
              const historyItem = imageHistory.find(item => item.id === currentGeneratedImage!.id);
              if (historyItem) {
                  historyItem.data = data;
                  historyItem.mimeType = mimeType;
              }
              
              // Update UI
              update3dViewFromState();
              
              showToast({ type: 'success', title: 'Upscaled!', body: 'Image has been upscaled to 4K resolution.' });
          } else {
              throw new Error('No image data in response');
          }
      } catch (error) {
          console.error('Upscale failed:', error);
          showToast({ type: 'error', title: 'Upscale Failed', body: 'Failed to upscale image.' });
      } finally {
          updateButtonLoadingState(upscaleBtn, false);
          imageGenerationLoaderModal?.classList.add('hidden');
      }
  };

  const updateIconStudio3dPrompt = () => {
    if (!selectedIcon || !promptDisplay3d || !shadowToggleIcons) return;
    try {
        const promptObject = JSON.parse(ICON_STUDIO_3D_PROMPT_TEMPLATE);
        promptObject.subject = selectedIcon.name.replace(/_/g, ' ');

        if (shadowToggleIcons.checked) {
            promptObject.negative_prompt = promptObject.negative_prompt.replace(', ground/drop shadows', '');
            promptObject.lighting.shadows = "internal and soft ground shadow";
        } else {
            if (!promptObject.negative_prompt.includes('ground/drop shadows')) {
                promptObject.negative_prompt += ', ground/drop shadows';
            }
            promptObject.lighting.shadows = "internal only; no ground/drop shadow";
        }

        promptDisplay3d.value = JSON.stringify(promptObject, null, 2);
    } catch (e) {
        console.error("Failed to update icon studio 3D prompt", e);
        promptDisplay3d.value = `A high-quality, professional 3D icon of a ${selectedIcon.name.replace(/_/g, ' ')}.`;
    }
  };

  const handleIconClick = (icon: IconData) => {
    selectedIcon = icon;
    
    $$('#icon-grid .icon-item').forEach(item => {
        item.classList.toggle('selected', item.dataset.iconName === icon.name);
    });
    
    settingsPanel?.classList.remove('hidden');
    settingsPanel?.classList.add('is-open');
    if (settingsTitle) settingsTitle.textContent = icon.name.replace(/_/g, ' ');
    if (settingsPreviewIcon) settingsPreviewIcon.textContent = icon.name;
    if (motionPreviewIcon) motionPreviewIcon.textContent = icon.name;
    
    updateIconStudio3dPrompt();
    
    (downloadSvgBtn as HTMLButtonElement).disabled = false;
    (downloadPngBtn as HTMLButtonElement).disabled = false;
    (copyJsxBtn as HTMLButtonElement).disabled = false;
    (copySnippetBtn as HTMLButtonElement).disabled = false;
    
    updateCodeSnippetDisplay();
    applyAllIconStyles();
    updatePreviewStyles();
  };

  const handleConvertTo3D = async () => {
    if (!selectedIcon) return;
    
    updateButtonLoadingState(convertTo3DBtn, true);
    loader3d?.classList.remove('hidden');
    generatedImageIcon?.classList.add('hidden');
    placeholder3d?.classList.add('hidden');
    errorPlaceholder3d?.classList.add('hidden');
    imageGenerationLoaderModal?.classList.remove('hidden');

    try {
        let finalPrompt = promptDisplay3d.value;
        const userAddition = userPrompt3d.value.trim();
        if (userAddition) {
             try {
                const promptObject = JSON.parse(finalPrompt);
                promptObject.subject += `, ${userAddition}`;
                finalPrompt = JSON.stringify(promptObject, null, 2);
            } catch (e) {
                finalPrompt += ` Additional details: ${userAddition}.`;
            }
        }

        const parts: any[] = [{text: finalPrompt}];
        const imageParts = await Promise.all(referenceImagesForIconStudio3d.filter(img => img).map(async refImg => {
            return {
              inlineData: {
                data: await blobToBase64(refImg!.file),
                mimeType: refImg!.file.type,
              }
            };
        }));
        parts.push(...imageParts);
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });
        
        const part = response.candidates?.[0]?.content?.parts?.[0];
        if (part && part.inlineData) {
            const { data, mimeType } = part.inlineData;
            const dataUrl = `data:${mimeType};base64,${data}`;
            generatedImageIcon.src = dataUrl;
            generatedImageIcon.classList.remove('hidden');
            download3DBtn.href = dataUrl;
            download3DBtn.classList.remove('hidden');
            regenerate3DBtn.classList.remove('hidden');
            viewLargerBtn.classList.remove('hidden');
            currentGeneratedIcon3d = { data, prompt: finalPrompt, userPrompt: userAddition };
        } else {
            throw new Error("No image data returned.");
        }
    } catch (e) {
        console.error("3D conversion failed", e);
        errorPlaceholder3d?.classList.remove('hidden');
    } finally {
        updateButtonLoadingState(convertTo3DBtn, false);
        loader3d?.classList.add('hidden');
        imageGenerationLoaderModal?.classList.add('hidden');
    }
  };


  // --- PAGE-SPECIFIC LOGIC: Explore Page ---

  const openExploreDetails = (item: any) => {
    if (!item || !exploreDetailsPanel) return;
    
    currentSelectedExploreMedia = item;

    if (exploreDetailsTitle) exploreDetailsTitle.textContent = item.name;

    if (exploreDetailsPreviewContainer) {
        exploreDetailsPreviewContainer.innerHTML = '';
        let mediaEl;
        if (item.type.startsWith('image/')) {
            mediaEl = document.createElement('img');
            mediaEl.src = item.dataUrl;
            mediaEl.alt = item.name;
        } else if (item.type.startsWith('video/')) {
            mediaEl = document.createElement('video');
            mediaEl.src = item.dataUrl;
            mediaEl.controls = true;
            mediaEl.autoplay = true;
            mediaEl.loop = true;
        }
        if (mediaEl) {
            exploreDetailsPreviewContainer.appendChild(mediaEl);
        }
    }

    if (exploreDetailsInfo) {
        const date = new Date(item.timestamp).toLocaleString();
        exploreDetailsInfo.innerHTML = `
            <dt>Name</dt><dd>${item.name}</dd>
            <dt>Type</dt><dd>${item.type}</dd>
            <dt>Added</dt><dd>${date}</dd>
        `;
    }

    if (item.styleConstraints) {
        exploreDetailsPromptContainer?.classList.remove('hidden');
        exploreDetailsNoPrompt?.classList.add('hidden');
        if (exploreDetailsPromptCode) exploreDetailsPromptCode.textContent = item.styleConstraints;
    } else {
        exploreDetailsPromptContainer?.classList.add('hidden');
        exploreDetailsNoPrompt?.classList.remove('hidden');
    }
    
    if (exploreDetailsDownloadBtn) {
        exploreDetailsDownloadBtn.href = item.dataUrl;
        exploreDetailsDownloadBtn.download = item.name;
    }

    exploreDetailsPanel.classList.remove('hidden');
    exploreDetailsPanel.classList.add('is-open');
    explorePage?.classList.add('panel-open');
  };

  const handleFileUpload = (files: FileList) => {
    if (!files.length) return;
    
    for (const file of Array.from(files)) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target?.result as string;
            const newItem = {
                id: `local_${Date.now()}_${Math.random()}`,
                name: file.name,
                type: file.type,
                dataUrl: dataUrl,
                timestamp: Date.now()
            };
            exploreMedia.unshift(newItem);
            renderExploreFeed();
        };
        reader.readAsDataURL(file);
    }
    showToast({ type: 'success', title: 'Upload Complete', body: `${files.length} file(s) added.`});
  };

  const initVideoObserver = () => {
    if (videoObserver) {
        videoObserver.disconnect();
    }

    const options = {
        root: exploreMain,
        rootMargin: '0px',
        threshold: 0.5 
    };

    const handlePlay = (entries: IntersectionObserverEntry[]) => {
        entries.forEach(entry => {
            const video = entry.target as HTMLVideoElement;
            if (entry.isIntersecting) {
                const playPromise = video.play();
                if (playPromise !== undefined) {
                    playPromise.catch(error => {
                        console.log("Autoplay prevented for video:", video.src, error);
                    });
                }
            } else {
                video.pause();
            }
        });
    };

    videoObserver = new IntersectionObserver(handlePlay, options);
    const videos = exploreFeed?.querySelectorAll('video');
    videos?.forEach(video => videoObserver!.observe(video));
  };
  
  const renderExploreFeed = () => {
    if (!exploreFeed) return;
    
    const hasContent = exploreMedia.length > 0;
    exploreMain?.classList.toggle('has-content', hasContent);
    if(!hasContent) {
        exploreFeed.innerHTML = `
            <div class="explore-feed-empty">
                <span class="material-symbols-outlined">add_photo_alternate</span>
                <p>Your library is empty</p>
                <span>Upload images and videos to get started.</span>
            </div>
        `;
        return;
    }

    exploreFeed.innerHTML = '';
    exploreMedia.forEach(item => {
        const card = document.createElement('div');
        card.className = 'feed-card';
        card.dataset.id = item.id;
        card.setAttribute('tabindex', '0');
        card.setAttribute('aria-label', `View details for ${item.name}`);

        let mediaElement = '';
        if (item.type.startsWith('image/')) {
            mediaElement = `<img src="${item.dataUrl}" class="feed-card-media" alt="${item.name}" loading="lazy">`;
        } else if (item.type.startsWith('video/')) {
            mediaElement = `<video src="${item.dataUrl}" class="feed-card-media" autoplay muted loop playsinline></video>`;
        }
        
        card.innerHTML = `
            ${mediaElement}
            <div class="feed-card-info">
                <div class="feed-card-text-content">
                    <span class="feed-card-title">${item.name}</span>
                </div>
            </div>
        `;
        
        exploreFeed.appendChild(card);
    });

    initVideoObserver();
  };
  
  // --- REFERENCE IMAGE DROP ZONES ---

  const handleFileForDropZone = (file: File | undefined, zone: HTMLElement, stateArray: ({ file: File; dataUrl: string } | null)[]) => {
      if (!file || !file.type.startsWith('image/')) return;
      
      const index = parseInt(zone.dataset.index!);
      const previewImg = zone.querySelector('.style-image-preview') as HTMLImageElement;
      const promptEl = zone.querySelector('.drop-zone-prompt');
      const removeBtn = zone.querySelector('.remove-style-image-btn') as HTMLButtonElement;
      
      const reader = new FileReader();
      reader.onload = e => {
          const dataUrl = e.target?.result as string;
          stateArray[index] = { file, dataUrl };

          previewImg.src = dataUrl;
          previewImg.classList.remove('hidden');
          promptEl?.classList.add('hidden');
          removeBtn.classList.remove('hidden');
      };
      reader.readAsDataURL(file);
  };

  const setupDropZoneListeners = (containerSelector: string, inputSelector: string, stateArray: ({ file: File; dataUrl: string } | null)[]) => {
      const container = $(containerSelector);
      const inputEl = $(inputSelector) as HTMLInputElement;
      if (!container || !inputEl) return;

      const zones = container.querySelectorAll<HTMLElement>('.image-drop-zone');

      zones.forEach((zone, index) => {
          const removeBtn = zone.querySelector('.remove-style-image-btn') as HTMLButtonElement;
          
          const handleFileSelect = () => {
              const file = inputEl.files?.[0];
              if (file) {
                  handleFileForDropZone(file, zone, stateArray);
              }
              inputEl.value = '';
          };

          zone.addEventListener('click', () => {
              if (stateArray[index]) return; 
              inputEl.addEventListener('change', handleFileSelect, { once: true });
              inputEl.click();
          });

          zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
          zone.addEventListener('dragleave', (e) => { e.preventDefault(); zone.classList.remove('dragleave'); });
          zone.addEventListener('drop', (e) => {
              e.preventDefault();
              zone.classList.remove('dragover');
              const file = e.dataTransfer?.files[0];
              handleFileForDropZone(file, zone, stateArray);
          });

          removeBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              stateArray[index] = null;

              const previewImg = zone.querySelector('.style-image-preview') as HTMLImageElement;
              const promptEl = zone.querySelector('.drop-zone-prompt');
              
              previewImg.src = '';
              previewImg.classList.add('hidden');
              promptEl?.classList.remove('hidden');
              removeBtn.classList.add('hidden');
          });
      });
  };

  const setupMotionDropZones = () => {
      const container = $('#motion-reference-image-container');
      const inputEl = $('#motion-reference-image-input') as HTMLInputElement;
      if (!container || !inputEl) return;

      const zones = container.querySelectorAll<HTMLElement>('.image-drop-zone');

      zones.forEach(zone => {
          const index = parseInt(zone.dataset.index!);
          const removeBtn = zone.querySelector('.remove-style-image-btn') as HTMLButtonElement;

          const handleFile = (file: File | undefined) => {
              if (!file || !file.type.startsWith('image/')) return;
              
              const reader = new FileReader();
              reader.onload = e => {
                  const dataUrl = e.target?.result as string;
                  const frameData = { file, dataUrl };
                  if (index === 0) {
                      motionFirstFrameImage = frameData;
                  } else {
                      motionLastFrameImage = frameData;
                  }
                  updateDropZoneUI(zone, dataUrl);
              };
              reader.readAsDataURL(file);
          };

          const handleFileSelect = () => {
              const file = inputEl.files?.[0];
              if (file) handleFile(file);
              inputEl.value = '';
          };
          
          zone.addEventListener('click', () => {
              const currentState = index === 0 ? motionFirstFrameImage : motionLastFrameImage;
              if (currentState) return; 
              inputEl.addEventListener('change', handleFileSelect, { once: true });
              inputEl.click();
          });
          
          zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
          zone.addEventListener('dragleave', (e) => { e.preventDefault(); zone.classList.remove('dragleave'); });
          zone.addEventListener('drop', (e) => {
              e.preventDefault();
              zone.classList.remove('dragover');
              const file = e.dataTransfer?.files[0];
              handleFile(file);
          });


          removeBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              if (index === 0) {
                  motionFirstFrameImage = null;
              } else {
                  motionLastFrameImage = null;
              }
              clearDropZoneUI(zone);
          });
      });
  };

  // Create a new image reference zone
  const createImageReferenceZone = (index: number, container: HTMLElement) => {
    const zoneId = `image-studio-zone-${index}`;
    
    const html = `
      <div class="control-card">
        <div class="prompt-card-header">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <h3>Reference Image ${index + 1}</h3>
            <button class="remove-reference-zone-btn icon-button" data-index="${index}" ${index === 0 ? 'style="visibility: hidden;"' : ''}>
              <span class="material-symbols-outlined">delete</span>
            </button>
          </div>
        </div>
        <div class="image-studio-drop-zone" data-index="${index}" id="${zoneId}">
          <div class="drop-zone-content">
            <div class="drop-zone-prompt-large">
              <span class="material-symbols-outlined">add_photo_alternate</span>
              <p>Drop or click</p>
            </div>
            <img class="drop-zone-preview hidden" alt="Reference image ${index + 1}">
            <button class="remove-style-image-btn hidden" aria-label="Remove image ${index + 1}">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
          <div class="drop-zone-overlay">
            <button class="generate-text-btn">
              <span class="material-symbols-outlined">text_fields</span>
              <span class="overlay-text-label">Generate with Text</span>
            </button>
            <div class="overlay-divider"></div>
            <button class="attach-image-btn">
              <span class="material-symbols-outlined">attach_file</span>
              <span class="overlay-text-label">Attach Image</span>
            </button>
          </div>
        </div>
        <input type="file" class="image-studio-reference-input hidden" data-index="${index}" accept="image/*">
      </div>
    `;
    
    const div = document.createElement('div');
    div.innerHTML = html.trim();
    const card = div.firstChild as HTMLElement;
    container.appendChild(card);
    
    return card;
  };
  
  // Initialize Image Studio with dynamic zones
  const initializeImageStudio = () => {
    const container = $('#image-studio-reference-container');
    const addBtn = $('#add-reference-image-btn');
    const addBtnCard = $('#add-reference-image-card');
    
    if (!container) return;
    
    // Clear container
    container.innerHTML = '';
    
    // Initialize with one zone (ensure array has space)
    if (imageStudioReferenceImages.length === 0) {
      imageStudioReferenceImages = [null, null, null];
    }
    
    // Create first zone
    createImageReferenceZone(0, container);
    setupSingleImageZone(0);
    
    // Hide add button initially (will show when image is uploaded)
    addBtnCard?.classList.add('hidden');
    
    // Add button handler - remove old listeners first
    addBtn?.replaceWith(addBtn.cloneNode(true));
    const newAddBtn = $('#add-reference-image-btn');
    newAddBtn?.addEventListener('click', () => {
      const currentCount = document.querySelectorAll('.image-studio-drop-zone').length;
      if (currentCount >= 3) return; // Max 3 images
      
      // Extend array if needed
      if (imageStudioReferenceImages.length < currentCount + 1) {
        imageStudioReferenceImages.push(null);
      }
      
      createImageReferenceZone(currentCount, container);
      setupSingleImageZone(currentCount);
      
      // Hide add button if max reached
      if (currentCount + 1 >= 3) {
        addBtnCard?.classList.add('hidden');
      }
      
      // Show delete buttons on all zones
      updateDeleteButtonVisibility();
    });
    
    // Update delete button visibility
    updateDeleteButtonVisibility();
  };
  
  const updateDeleteButtonVisibility = () => {
    const deleteBtns = document.querySelectorAll('.remove-reference-zone-btn');
    deleteBtns.forEach(btn => {
      const index = parseInt(btn.getAttribute('data-index') || '0');
      if (index === 0) {
        (btn as HTMLElement).style.visibility = 'hidden';
      } else {
        (btn as HTMLElement).style.visibility = 'visible';
      }
    });
  };
  
  // Setup event listeners for a single image zone
  const setupSingleImageZone = (index: number) => {
    const zone = document.querySelector(`.image-studio-drop-zone[data-index="${index}"]`) as HTMLElement;
    const input = document.querySelector(`.image-studio-reference-input[data-index="${index}"]`) as HTMLInputElement;
    const removeZoneBtn = document.querySelector(`.remove-reference-zone-btn[data-index="${index}"]`) as HTMLButtonElement;
    
    if (!zone || !input) return;
    
    const content = zone.querySelector('.drop-zone-content');
    const previewImg = zone.querySelector('.drop-zone-preview') as HTMLImageElement;
    const removeBtn = zone.querySelector('.remove-style-image-btn') as HTMLButtonElement;
    const attachBtn = zone.querySelector('.attach-image-btn') as HTMLButtonElement;
    const generateBtn = zone.querySelector('.generate-text-btn') as HTMLButtonElement;
    
    const updateUI = (dataUrl: string | null) => {
      if (dataUrl && previewImg && content) {
        previewImg.src = dataUrl;
        previewImg.classList.remove('hidden');
        removeBtn?.classList.remove('hidden');
        content.classList.add('has-image');
        
        // Show "Add Reference Image" button when image is uploaded
        const addBtnCard = $('#add-reference-image-card');
        const currentCount = document.querySelectorAll('.image-studio-drop-zone').length;
        if (currentCount < 3 && imageStudioReferenceImages.some(img => img !== null)) {
          addBtnCard?.classList.remove('hidden');
        }
      } else if (content) {
        previewImg.src = '';
        previewImg.classList.add('hidden');
        removeBtn?.classList.add('hidden');
        content.classList.remove('has-image');
        
        // Hide "Add Reference Image" button if no images
        const hasImages = imageStudioReferenceImages.some(img => img !== null);
        if (!hasImages) {
          const addBtnCard = $('#add-reference-image-card');
          addBtnCard?.classList.add('hidden');
        }
      }
    };
    
    const handleFile = (file: File | undefined) => {
      if (!file || !file.type.startsWith('image/')) return;
      
      const reader = new FileReader();
      reader.onload = e => {
        const dataUrl = e.target?.result as string;
        imageStudioReferenceImages[index] = { file, dataUrl };
        updateUI(dataUrl);
      };
      reader.readAsDataURL(file);
    };
    
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (file) handleFile(file);
      input.value = '';
    });
    
    zone.addEventListener('dragover', (e) => { e.preventDefault(); });
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      const file = (e as DragEvent).dataTransfer?.files[0];
      handleFile(file);
    });
    
    if (removeBtn) {
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        imageStudioReferenceImages[index] = null;
        updateUI(null);
      });
    }
    
    if (attachBtn) {
      attachBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        input.click();
      });
    }
    
    if (generateBtn) {
      generateBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // Store which image slot we're generating for
        let currentImageStudioSlotIndex = index;
        const textInput = $('#image-studio-text-input') as HTMLTextAreaElement;
        
        // Open modal
        $('#image-studio-text-modal')?.classList.remove('hidden');
        textInput.value = '';
        textInput.focus();
        
        // Handle modal generate button
        const generateBtn = $('#image-studio-text-generate-btn');
        generateBtn?.replaceWith(generateBtn.cloneNode(true)); // Remove old listener
        const newGenerateBtn = $('#image-studio-text-generate-btn');
        
        newGenerateBtn?.addEventListener('click', async () => {
          const promptText = textInput?.value?.trim() || '';
          if (!promptText) {
            showToast({ type: 'error', title: 'Input Required', body: 'Please enter a prompt.' });
            return;
          }
          
          try {
            // Hide text modal and show loader modal
            $('#image-studio-text-modal')?.classList.add('hidden');
            const loaderModal = $('#image-generation-loader-modal');
            loaderModal?.classList.remove('hidden');
            
            // Generate image from text using gemini-2.5-flash-image
            console.log('[Image Studio] Generating image from text with model: gemini-2.5-flash-image');
            console.log('[Image Studio] Prompt:', promptText);
            
            const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash-image',
              contents: [{ parts: [{ text: promptText }] }],
              config: {
                responseModalities: [Modality.IMAGE],
              },
            });
            
            console.log('[Image Studio] Full response:', response);
            const part = response.candidates?.[0]?.content?.parts?.[0];
            console.log('[Image Studio] Response part:', part);
            
            if (part && part.inlineData) {
              const { data, mimeType } = part.inlineData;
              const dataUrl = `data:${mimeType};base64,${data}`;
              
              console.log('[Image Studio] Image data received, creating file...');
              
              const blob = await (await fetch(dataUrl)).blob();
              const file = new File([blob], `generated_image_${currentImageStudioSlotIndex}.png`, { type: mimeType });
              
              // Save to reference images
              imageStudioReferenceImages[currentImageStudioSlotIndex] = { file, dataUrl };
              
              const dropZone = document.querySelector(`.image-studio-drop-zone[data-index="${currentImageStudioSlotIndex}"]`);
              console.log('[Image Studio] Drop zone:', dropZone);
              
              if (dropZone) {
                const previewImg = dropZone.querySelector('.drop-zone-preview') as HTMLImageElement;
                const content = dropZone.querySelector('.drop-zone-content');
                const removeBtn = dropZone.querySelector('.remove-style-image-btn') as HTMLButtonElement;
                const promptLarge = content?.querySelector('.drop-zone-prompt-large');
                
                if (previewImg && content) {
                  previewImg.src = dataUrl;
                  previewImg.classList.remove('hidden');
                  if (promptLarge) promptLarge.classList.add('hidden');
                  if (removeBtn) removeBtn.classList.remove('hidden');
                  content.classList.add('has-image');
                  console.log('[Image Studio] UI updated successfully');
                }
              }
              
              showToast({ type: 'success', title: 'Generated!', body: 'Image generated from text.' });
            } else {
              console.error('[Image Studio] No image data in response:', part);
              throw new Error('No image data in response');
            }
            
            loaderModal?.classList.add('hidden');
          } catch (error) {
            console.error('[Image Studio] Text generation failed:', error);
            showToast({ type: 'error', title: 'Generation Failed', body: 'Could not generate image from text.' });
          }
        });
      });
    }
    
    // Handle remove zone button
    if (removeZoneBtn && index > 0) {
      removeZoneBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // Remove from array
        imageStudioReferenceImages[index] = null;
        
        // Find and remove the DOM element
        const zone = document.querySelector(`.control-card`)?.querySelector(`.image-studio-drop-zone[data-index="${index}"]`);
        if (zone) {
          const card = zone.closest('.control-card');
          card?.remove();
        }
        
        // Show add button
        const addBtnCard = $('#add-reference-image-card');
        addBtnCard?.classList.remove('hidden');
        
        // Update visibility
        updateDeleteButtonVisibility();
      });
    }
  };
  
  const setupImageStudioDropZones = () => {
    initializeImageStudio();
  };
  
  // --- EVENT LISTENERS ---
  
  // Image Studio history navigation
  const historyBackBtnImage = $('#history-back-btn-image');
  const historyForwardBtnImage = $('#history-forward-btn-image');
  const detailsCloseBtnImage = $('#details-close-btn-image');
  const resultImageEl = $('#result-image-image') as HTMLImageElement;
  
  historyBackBtnImage?.addEventListener('click', () => {
    if (imageStudioHistoryIndex > 0) {
      imageStudioHistoryIndex--;
      const item = imageStudioHistory[imageStudioHistoryIndex];
      const dataUrl = `data:${item.mimeType};base64,${item.data}`;
      if (resultImageEl) {
        resultImageEl.src = dataUrl;
        resultImageEl.classList.remove('hidden');
      }
      renderImageStudioHistory();
    }
  });
  
  historyForwardBtnImage?.addEventListener('click', () => {
    if (imageStudioHistoryIndex < imageStudioHistory.length - 1) {
      imageStudioHistoryIndex++;
      const item = imageStudioHistory[imageStudioHistoryIndex];
      const dataUrl = `data:${item.mimeType};base64,${item.data}`;
      if (resultImageEl) {
        resultImageEl.src = dataUrl;
        resultImageEl.classList.remove('hidden');
      }
      renderImageStudioHistory();
    }
  });
  
  // Close details panel button
  detailsCloseBtnImage?.addEventListener('click', () => {
    const detailsPanel = $('#image-details-panel-image');
    detailsPanel?.classList.add('hidden');
    detailsPanel?.classList.remove('is-open');
  });
  
  // Show details panel button (add to result image or generate button)
  resultImageEl?.addEventListener('click', () => {
    if (currentGeneratedImageStudio) {
      const detailsPanel = $('#image-details-panel-image');
      detailsPanel?.classList.remove('hidden');
      detailsPanel?.classList.add('is-open');
    }
  });
  
  // Toggle details panel button
  const toggleDetailsPanelBtnImage = $('#toggle-details-panel-btn-image');
  toggleDetailsPanelBtnImage?.addEventListener('click', () => {
    const detailsPanel = $('#image-details-panel-image');
    if (detailsPanel?.classList.contains('hidden')) {
      detailsPanel.classList.remove('hidden');
      detailsPanel.classList.add('is-open');
    } else {
      detailsPanel.classList.add('hidden');
      detailsPanel.classList.remove('is-open');
    }
  });
  
  // Upscale button for Image Studio
  const upscaleBtnImage = $('#details-upscale-btn-image');
  upscaleBtnImage?.addEventListener('click', async () => {
    if (!currentGeneratedImageStudio) return;
    
    const loaderModal = $('#image-generation-loader-modal');
    loaderModal?.classList.remove('hidden');
    
    try {
      const dataUrl = `data:${currentGeneratedImageStudio.mimeType};base64,${currentGeneratedImageStudio.data}`;
      
      // Create blob from dataUrl
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const file = new File([blob], 'image.png', { type: currentGeneratedImageStudio.mimeType });
      
      // Convert to base64 for API
      const base64Data = await blobToBase64(file);
      
      // Use blending with upscale prompt
      const parts = [
        { inlineData: { data: base64Data, mimeType: currentGeneratedImageStudio.mimeType } },
        { text: 'Upscale this image to 4K resolution while maintaining quality and details' }
      ];
      
      const upscaleResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts },
        config: {
          responseModalities: [Modality.IMAGE],
        },
      });
      
      const upscalePart = upscaleResponse.candidates?.[0]?.content?.parts?.[0];
      if (upscalePart && upscalePart.inlineData) {
        const { data, mimeType } = upscalePart.inlineData;
        const upscaledDataUrl = `data:${mimeType};base64,${data}`;
        
        // Update current image
        currentGeneratedImageStudio.data = data;
        currentGeneratedImageStudio.mimeType = mimeType;
        
        // Update UI
        const resultImage = $('#result-image-image') as HTMLImageElement;
        if (resultImage) {
          resultImage.src = upscaledDataUrl;
        }
        
        const detailsPreview = $('#details-preview-image-image') as HTMLImageElement;
        if (detailsPreview) {
          detailsPreview.src = upscaledDataUrl;
        }
        
        const detailsDownload = $('#details-download-btn-image') as HTMLAnchorElement;
        if (detailsDownload) {
          detailsDownload.href = upscaledDataUrl;
        }
        
        showToast({ type: 'success', title: 'Upscaled!', body: 'Image has been upscaled to higher resolution.' });
      }
    } catch (error) {
      console.error('Error upscaling image:', error);
      showToast({ type: 'error', title: 'Upscale Failed', body: 'Failed to upscale image.' });
    } finally {
      loaderModal?.classList.add('hidden');
    }
  });

  themeToggleButton?.addEventListener('click', () => {
    const newTheme = body.dataset.theme === 'light' ? 'dark' : 'light';
    applyTheme(newTheme);
  });
  
  navItems.forEach(item => {
    item.addEventListener('click', handleNavClick);
  });
  
  $('#banner-toast-close-btn')?.addEventListener('click', () => {
      $('#banner-toast')?.classList.add('hidden');
      if (bannerToastTimer) clearTimeout(bannerToastTimer);
  });
  
  $$('input[name="icon-family"], #fill-toggle, #weight-slider, #optical-size-slider').forEach(el => {
      el.addEventListener('input', () => {
          applyAllIconStyles();
          updateCodeSnippetDisplay();
      });
  });
  $('#weight-slider')?.addEventListener('input', updateWeightValue);

  $('#export-size-input')?.addEventListener('input', () => {
      updatePreviewStyles();
      updateCodeSnippetDisplay();
  });
  $('#color-picker')?.addEventListener('input', () => {
      updatePreviewStyles();
      updateCodeSnippetDisplay();
  });

  motionPlayBtn?.addEventListener('click', handlePlayMotion);
  searchInput?.addEventListener('input', () => populateIconGrid(searchInput.value));
  convertTo3DBtn?.addEventListener('click', handleConvertTo3D);
  regenerate3DBtn?.addEventListener('click', () => {
      if(currentGeneratedIcon3d) {
          userPrompt3d.value = currentGeneratedIcon3d.userPrompt;
          handleConvertTo3D();
      }
  });
  settingsCloseBtn?.addEventListener('click', () => settingsPanel?.classList.remove('is-open'));
  toggleFiltersBtn?.addEventListener('click', () => {
    iconsPage?.classList.toggle('filters-collapsed');
  });
  filtersCloseBtn?.addEventListener('click', () => {
    iconsPage?.classList.add('filters-collapsed');
  });


  imageGenerateBtn2d?.addEventListener('click', handleGenerateImage2d);
  imagePromptSubjectInput2d?.addEventListener('input', update2dPromptDisplay);
  $$('#page-id-2d input[type="radio"], #page-id-2d input[type="checkbox"], #page-id-2d input[type="range"], #page-id-2d input[type="color"]').forEach(el => {
      el.addEventListener('input', () => {
        update2dPromptDisplay();
        if (el.id === 'p2d-weight-slider') {
          update2dWeightValue();
        }
      });
  });

  imageGenerateBtn?.addEventListener('click', handleGenerateImage3d);
  imagePromptSubjectInput?.addEventListener('input', update3dPromptDisplay);
  shadowToggle3d?.addEventListener('change', update3dPromptDisplay);
  
  // Color picker event listeners for 3D Studio
  $('#background-color-picker-3d')?.addEventListener('input', update3dPromptDisplay);
  $('#object-color-picker-3d')?.addEventListener('input', update3dPromptDisplay);
  
  // Image Studio Generate button
  $('#image-generate-btn-image')?.addEventListener('click', handleGenerateImageStudio);
  
  // Image Studio Text Modal
  $('#image-studio-text-modal-close-btn')?.addEventListener('click', () => {
    $('#image-studio-text-modal')?.classList.add('hidden');
    currentImageStudioModalType = null;
  });
  
  $('#image-studio-text-cancel-btn')?.addEventListener('click', () => {
    $('#image-studio-text-modal')?.classList.add('hidden');
    currentImageStudioModalType = null;
  });
  
  // Note: image-studio-text-generate-btn click handler is added dynamically per slot
  
  exploreUploadBtn?.addEventListener('click', () => uploadChoiceModal?.classList.remove('hidden'));
  uploadChoiceCloseBtn?.addEventListener('click', () => uploadChoiceModal?.classList.add('hidden'));
  uploadFromDeviceBtn?.addEventListener('click', () => {
      exploreUploadInput?.click();
      uploadChoiceModal?.classList.add('hidden');
  });
  exploreUploadInput?.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement;
    if (target.files) {
        handleFileUpload(target.files);
    }
  });
  exploreFeed?.addEventListener('click', (e) => {
    const card = (e.target as HTMLElement).closest<HTMLElement>('.feed-card');
    if (card && card.dataset.id) {
        const selectedItem = exploreMedia.find(item => item.id === card.dataset.id);
        if (selectedItem) {
            openExploreDetails(selectedItem);
        }
    }
  });
  exploreDetailsCloseBtn?.addEventListener('click', () => {
    exploreDetailsPanel?.classList.remove('is-open');
    explorePage?.classList.remove('panel-open');
  });


  // --- LOAD HOME PAGE IMAGES ---
  
  const loadHomePageImages = async () => {
    // Load images from JSON file
    try {
      const response = await fetch('/home_images.json');
      const homeImages = await response.json();
      exploreMedia = [...homeImages];
      renderExploreFeed();
    } catch (error) {
      console.error('Failed to load home images:', error);
      exploreMedia = [];
    }
  };

  // --- DEFAULT REFERENCE IMAGES ---
  
  const loadDefaultReferenceImages = async () => {
    // Load default reference images from public folder
    const defaultRefUrls = [
      '/images/references/reference_1.png',
      '/images/references/reference_2.png',
      '/images/references/reference_3.png'
    ];
    
    const loadImageToRef = async (url: string, index: number, refArray: ({ file: File; dataUrl: string } | null)[], containerSelector: string) => {
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const reader = new FileReader();
        
        const dataUrl = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => {
            if (typeof reader.result === 'string') {
              resolve(reader.result);
            } else {
              reject(new Error("Failed to convert blob to data URL"));
            }
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        
        const file = new File([blob], `default_ref_${index}.png`, { type: 'image/png' });
        refArray[index] = { file, dataUrl };
        
        // Update UI to show the loaded image
        const zone = document.querySelector<HTMLElement>(`${containerSelector} .image-drop-zone[data-index="${index}"]`);
        if (zone) {
          updateDropZoneUI(zone, dataUrl);
        }
      } catch (error) {
        console.error(`Failed to load default reference ${index}:`, error);
      }
    };
    
    // Load default images for 3D Studio references
    await Promise.all(
      defaultRefUrls.map((url, index) => loadImageToRef(url, index, referenceImagesFor3d, '#edit-reference-image-container-3d'))
    );
    
    // Load default images for Icon Studio 3D Generate references
    await Promise.all(
      defaultRefUrls.map((url, index) => loadImageToRef(url, index, referenceImagesForIconStudio3d, '#reference-image-container-3d'))
    );

    const default2dRefUrls = [
      '/images/references/fill_on.png',
      '/images/references/fill_off.png',
      '/images/references/weight_light.png',
      '/images/references/weight_bold.png',
    ];

    // Load default images for 2D Studio references
    await Promise.all(
      default2dRefUrls.map((url, index) => loadImageToRef(url, index, referenceImagesForEdit2d, '#p2d-edit-reference-image-container-3d'))
    );
  };

  // --- INITIALIZATION ---
  
  const init = async () => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    applyTheme(savedTheme || 'light');

    const activeNavItem = document.querySelector<HTMLElement>('.nav-item.active');
    currentPage = activeNavItem?.dataset.page || 'page-usages';
    
    // Load home page images
    await loadHomePageImages();
    
    // Load default reference images
    await loadDefaultReferenceImages();
    
    loadImageLibrary();
    populateIconGrid();
    updateWeightValue();
    update2dWeightValue();
    renderImageLibrary();
    update2dPromptDisplay();
    update3dPromptDisplay();
    
    setupDropZoneListeners('#edit-reference-image-container-3d', '#edit-reference-image-input-3d', referenceImagesFor3d);
    setupDropZoneListeners('#reference-image-container-3d', '#reference-image-input-3d', referenceImagesForIconStudio3d);
    setupDropZoneListeners('#p2d-edit-reference-image-container-3d', '#p2d-edit-reference-image-input-3d', referenceImagesForEdit2d);
    setupMotionDropZones();
    setupImageStudioDropZones();
    
    setupTabs($('#settings-panel'));
    setupTabs($('#image-details-panel'));
    setupTabs($('#image-details-panel-image'));
    setupTabs($('#p2d-image-details-panel'));
    
    // 2D Studio Details Panel: Update history when History tab is opened
    const p2dDetailsPanelTabs = $('#p2d-image-details-panel')?.querySelectorAll('.tab-item');
    p2dDetailsPanelTabs?.forEach(tab => {
        tab.addEventListener('click', () => {
            if (tab.getAttribute('data-tab') === 'history') {
                // Delay to ensure tab content is visible before updating
                setTimeout(() => {
                    updateDetailsPanelHistory2d();
                }, 50);
            }
        });
    });
    
    // Icon Studio Details Listeners
    downloadSvgBtn?.addEventListener('click', handleDownloadSVG);
    downloadPngBtn?.addEventListener('click', handleDownloadPNG);
    shadowToggleIcons?.addEventListener('change', updateIconStudio3dPrompt);
    
    copyJsxBtn?.addEventListener('click', () => {
      const jsxCode = generateCodeSnippet('react');
      handleCopyCode(jsxCode, 'React JSX');
    });
    copySnippetBtn?.addEventListener('click', () => {
      const activeTab = snippetTabsContainer?.querySelector('.snippet-tab-item.active');
      const lang = (activeTab as HTMLElement)?.dataset.lang || 'html';
      const code = snippetCode?.textContent || '';
      handleCopyCode(code, lang.charAt(0).toUpperCase() + lang.slice(1));
    });
    
    snippetTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            snippetTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            updateCodeSnippetDisplay();
        });
    });

    // 2D History Button Listeners
    historyBackBtn2d?.addEventListener('click', () => {
        const originalHistory = imageHistory2d.filter(item => 
            !item.modificationType || item.modificationType === 'Original'
        );
        const originalIndex = originalHistory.findIndex(h => imageHistory2d[historyIndex2d]?.id === h.id);
        
        if (originalIndex > 0) {
            historyIndex2d = imageHistory2d.findIndex(h => h.id === originalHistory[originalIndex - 1].id);
            currentGeneratedImage2d = imageHistory2d[historyIndex2d];
            update2dViewFromState();
            renderHistory2d();
        }
    });

    historyForwardBtn2d?.addEventListener('click', () => {
        const originalHistory = imageHistory2d.filter(item => 
            !item.modificationType || item.modificationType === 'Original'
        );
        const originalIndex = originalHistory.findIndex(h => imageHistory2d[historyIndex2d]?.id === h.id);
        
        if (originalIndex < originalHistory.length - 1) {
            historyIndex2d = imageHistory2d.findIndex(h => h.id === originalHistory[originalIndex + 1].id);
            currentGeneratedImage2d = imageHistory2d[historyIndex2d];
            update2dViewFromState();
            renderHistory2d();
        }
    });

    // 2D Details Panel Listeners
    toggleDetailsPanelBtn2d?.addEventListener('click', () => {
        detailsPanel2d?.classList.toggle('hidden');
        detailsPanel2d?.classList.toggle('is-open');
    });
    
    detailsCloseBtn2d?.addEventListener('click', () => {
        detailsPanel2d?.classList.add('hidden');
        detailsPanel2d?.classList.remove('is-open');
    });

    resultImage2d?.addEventListener('click', () => {
        if (!currentGeneratedImage2d) return;
        detailsPanel2d?.classList.remove('hidden');
        detailsPanel2d?.classList.add('is-open');
    });
    
    detailsCopyBtn2d?.addEventListener('click', () => {
        if (!currentGeneratedImage2d) return;
        handleCopyCode(currentGeneratedImage2d.styleConstraints, '2D Prompt');
    });

    // 2D Studio: Fix Icon handlers
    const backgroundColorPicker = $('#p2d-background-color-picker') as HTMLInputElement;
    const objectColorPicker = $('#p2d-object-color-picker') as HTMLInputElement;
    const bgCheckerboardToggle = $('#p2d-bg-checkerboard-toggle') as HTMLInputElement;
    const p2dRegenerateBtn = $('#p2d-regenerate-btn');
    
    // Checkerboard toggle for details preview
    bgCheckerboardToggle?.addEventListener('change', (e) => {
        const checked = (e.target as HTMLInputElement).checked;
        const preview = $('#p2d-details-preview-image') as HTMLImageElement;
        if (!preview) return;
        
        if (checked) {
            preview.style.backgroundColor = '';
            preview.style.backgroundImage = 'repeating-linear-gradient(45deg, #f0f0f0 25%, transparent 25%, transparent 75%, #f0f0f0 75%, #f0f0f0), repeating-linear-gradient(45deg, #f0f0f0 25%, #ffffff 25%, #ffffff 75%, #f0f0f0 75%, #f0f0f0)';
            preview.style.backgroundPosition = '0 0, 8px 8px';
            preview.style.backgroundSize = '16px 16px';
        } else {
            preview.style.backgroundImage = '';
            preview.style.backgroundColor = backgroundColorPicker.value;
        }
    });
    
    // Regenerate handler
    p2dRegenerateBtn?.addEventListener('click', async () => {
        if (!currentGeneratedImage2d) {
            showToast({ type: 'error', title: 'No Image', body: 'Please generate an image first.' });
            return;
        }
        
        const bgColor = backgroundColorPicker?.value || '#ffffff';
        const objColor = objectColorPicker?.value || '#000000';
        
        // Update prompt with colors
        const originalPrompt = currentGeneratedImage2d.subject;
        const colorPrompt = `Background color: ${bgColor}, Icon color: ${objColor}. ${originalPrompt}`;
        
        // Show loading
        if (p2dRegenerateBtn) {
            p2dRegenerateBtn.setAttribute('disabled', 'true');
            p2dRegenerateBtn.classList.add('loading');
        }
        
        if (p2dLoaderModal && p2dLoaderMessage) {
            p2dLoaderMessage.textContent = 'Regenerating icon with new colors...';
            p2dLoaderModal.classList.remove('hidden');
        }
        
        try {
            // Re-generate using the existing generation logic
            await generateImage(
                colorPrompt,
                resultImage2d,
                resultPlaceholder2d,
                resultError2d,
                resultIdlePlaceholder2d,
                p2dRegenerateBtn,
                referenceImagesForEdit2d.filter(ref => ref !== null) as { file: File; dataUrl: string; }[]
            );
            
            // Update history - add to left sidebar (all prompts) and details panel (Fix only)
            if (currentGeneratedImage2d) {
                // Add to left sidebar history
                imageHistory2d.push({
                    ...currentGeneratedImage2d,
                    modificationType: 'Modified'
                });
                historyIndex2d = imageHistory2d.length - 1;
                
                // Add to details panel history
                detailsPanelHistory2d.push({
                    ...currentGeneratedImage2d,
                    modificationType: 'Modified'
                });
                detailsPanelHistoryIndex2d = detailsPanelHistory2d.length - 1;
                
                update2dViewFromState();
                renderHistory2d();
                updateDetailsPanelHistory2d();
                
                showToast({ type: 'success', title: 'Icon regenerated ✅', body: 'New version added to history.' });
            }
        } catch (error) {
            console.error('Regeneration failed:', error);
            showToast({ type: 'error', title: 'Regeneration Failed', body: 'Failed to regenerate icon.' });
        } finally {
            p2dRegenerateBtn?.removeAttribute('disabled');
            p2dRegenerateBtn?.classList.remove('loading');
            if (p2dLoaderModal) {
                p2dLoaderModal.classList.add('hidden');
            }
        }
    });

    // 2D Studio: Remove Background
    const removeBackgroundBtn2d = $('#p2d-remove-background-btn');
    removeBackgroundBtn2d?.addEventListener('click', async () => {
        if (!currentGeneratedImage2d) {
            showToast({ type: 'error', title: 'No Image', body: 'Please generate an image first.' });
            return;
        }

        // Show loading modal
        if (p2dLoaderModal && p2dLoaderMessage) {
            p2dLoaderMessage.textContent = 'Removing background...';
            p2dLoaderModal.classList.remove('hidden');
        }

        try {
            removeBackgroundBtn2d.setAttribute('disabled', 'true');
            removeBackgroundBtn2d.classList.add('loading');
            
            const dataUrl = `data:${currentGeneratedImage2d.mimeType};base64,${currentGeneratedImage2d.data}`;
            
            // Convert data URL to blob
            const response = await fetch(dataUrl);
            const blob = await response.blob();
            
            // Dynamically import background removal (loads WebAssembly only when needed)
            const { removeBackground } = await import('@imgly/background-removal');
            
            // Remove background
            const blobWithoutBg = await removeBackground(blob);
            
            // Convert to base64
            const reader = new FileReader();
            reader.onload = (e) => {
                const result = e.target?.result as string;
                const base64Data = result.split(',')[1];
                
                // Update current image
                currentGeneratedImage2d.data = base64Data;
                currentGeneratedImage2d.mimeType = 'image/png';
                
                // Update preview
                const newDataUrl = `data:image/png;base64,${base64Data}`;
                if (detailsPreviewImage2d) detailsPreviewImage2d.src = newDataUrl;
                if (resultImage2d) {
                    resultImage2d.src = newDataUrl;
                }
                
                // Update download button
                if (detailsDownloadBtn2d) {
                    detailsDownloadBtn2d.href = newDataUrl;
                    detailsDownloadBtn2d.download = `${currentGeneratedImage2d.subject.replace(/\s+/g, '_')}-bg-removed.png`;
                }
                
                // Update UI state
                p2dHasBackgroundRemoved = true;
                const removeBgBtn = $('#p2d-remove-background-btn');
                const bgTransparentNote = $('#p2d-bg-transparent-note');
                if (removeBgBtn) removeBgBtn.classList.add('hidden');
                if (bgTransparentNote) bgTransparentNote.classList.remove('hidden');
                
                // Add to details panel history only (not left sidebar)
                if (currentGeneratedImage2d) {
                    detailsPanelHistory2d.push({
                        ...currentGeneratedImage2d,
                        modificationType: 'Remove Background'
                    });
                    detailsPanelHistoryIndex2d = detailsPanelHistory2d.length - 1;
                    updateDetailsPanelHistory2d();
                }
                
                showToast({ type: 'success', title: 'Background removed ✅', body: 'Background has been successfully removed.' });
            };
            reader.readAsDataURL(blobWithoutBg);
            
        } catch (error) {
            console.error('Background removal failed:', error);
            showToast({ type: 'error', title: 'Removal Failed', body: 'Failed to remove background. Please try again.' });
        } finally {
            removeBackgroundBtn2d?.removeAttribute('disabled');
            removeBackgroundBtn2d?.classList.remove('loading');
            // Hide loading modal
            if (p2dLoaderModal) {
                p2dLoaderModal.classList.add('hidden');
            }
        }
    });

    // 2D Studio: Revert Background
    p2dRevertBackgroundBtn?.addEventListener('click', () => {
        if (!p2dOriginalImageData || !currentGeneratedImage2d) {
            showToast({ type: 'error', title: 'Error', body: 'Original image not found.' });
            return;
        }

        // Restore original image
        currentGeneratedImage2d.data = p2dOriginalImageData.split(',')[1];
        currentGeneratedImage2d.mimeType = 'image/png';
        
        if (detailsPreviewImage2d) detailsPreviewImage2d.src = p2dOriginalImageData;
        if (resultImage2d) resultImage2d.src = p2dOriginalImageData;
        if (detailsDownloadBtn2d) {
            detailsDownloadBtn2d.href = p2dOriginalImageData;
            detailsDownloadBtn2d.download = `${currentGeneratedImage2d.subject.replace(/\s+/g, '_')}.png`;
        }
        
        // Reset state
        p2dHasBackgroundRemoved = false;
        const removeBgBtn = $('#p2d-remove-background-btn');
        if (removeBgBtn) removeBgBtn.classList.remove('hidden');
        if (p2dRevertBackgroundBtn) p2dRevertBackgroundBtn.classList.add('hidden');
        
        showToast({ type: 'success', title: 'Reverted to original ↩️', body: 'Background restoration completed.' });
    });

    // 2D Studio: Convert to SVG
    const convertToSvgBtn2d = $('#p2d-convert-to-svg-btn');
    convertToSvgBtn2d?.addEventListener('click', async () => {
        if (!currentGeneratedImage2d) {
            showToast({ type: 'error', title: 'No Image', body: 'Please generate an image first.' });
            return;
        }

        // Show loading modal
        if (p2dLoaderModal && p2dLoaderMessage) {
            p2dLoaderMessage.textContent = 'Converting to SVG...';
            p2dLoaderModal.classList.remove('hidden');
        }

        try {
            convertToSvgBtn2d.setAttribute('disabled', 'true');
            convertToSvgBtn2d.classList.add('loading');
            
            const dataUrl = `data:${currentGeneratedImage2d.mimeType};base64,${currentGeneratedImage2d.data}`;
            
            // Create image element to get image data
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            img.onload = () => {
                // Create canvas
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    throw new Error('Could not get canvas context');
                }
                
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                
                // Get image data
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                
                // Convert to SVG using ImageTracer
                const options = {
                    ltres: 1,
                    qtres: 1,
                    pathomit: 8,
                    colorsampling: 2,
                    numberofcolors: 256,
                    mincolorratio: 0.02,
                    colorquantcycles: 5,
                    scale: 1,
                    roundcoords: 1,
                    blurradius: 0,
                    blurdelta: 20,
                    strokewidth: 1,
                    linefilter: true,
                    layercontainer: 'g',
                    layerbgcolor: '',
                    viewbox: false,
                    desc: false,
                    lcpr: 0,
                    qcpr: 0,
                    minroundedstops: 0,
                    minrectroundedstops: 0,
                    blursvg: false,
                    despeckle: false,
                    despecklelevel: 0,
                    simplifytolerance: 0,
                    corsenabled: false
                };
                
                const svgString = ImageTracer.imagedataToSVG(imageData, options);
                
                // Show SVG preview modal instead of immediate download
                const svgCodeView = $('#p2d-svg-code-view') as HTMLTextAreaElement;
                const svgPreviewContent = $('#p2d-svg-preview-content');
                const svgBgToggle = $('#p2d-svg-bg-toggle') as HTMLInputElement;
                const svgPreviewContainer = $('#p2d-svg-preview-container');
                
                if (svgCodeView) svgCodeView.value = svgString;
                
                // Render SVG preview
                if (svgPreviewContent) {
                    svgPreviewContent.innerHTML = svgString;
                }
                
                // Background toggle handler
                const updateSvgPreview = () => {
                    if (svgPreviewContainer) {
                        if (svgBgToggle?.checked) {
                            svgPreviewContainer.style.backgroundColor = '';
                            svgPreviewContainer.style.backgroundImage = 'repeating-linear-gradient(45deg, #f0f0f0 25%, transparent 25%, transparent 75%, #f0f0f0 75%, #f0f0f0), repeating-linear-gradient(45deg, #f0f0f0 25%, #ffffff 25%, #ffffff 75%, #f0f0f0 75%, #f0f0f0)';
                        } else {
                            svgPreviewContainer.style.backgroundColor = 'white';
                            svgPreviewContainer.style.backgroundImage = 'none';
                        }
                    }
                };
                svgBgToggle?.addEventListener('change', updateSvgPreview);
                updateSvgPreview();
                
                // Store SVG string for download
                (currentGeneratedImage2d as any).svgString = svgString;
                
                // Hide loader modal and show SVG modal
                if (p2dLoaderModal) p2dLoaderModal.classList.add('hidden');
                if (p2dSvgPreviewModal) p2dSvgPreviewModal.classList.remove('hidden');
            };
            
            img.onerror = () => {
                throw new Error('Failed to load image');
            };
            
            img.src = dataUrl;
            
        } catch (error) {
            console.error('SVG conversion failed:', error);
            showToast({ type: 'error', title: 'Conversion Failed', body: 'Failed to convert image to SVG. Please try again.' });
        } finally {
            convertToSvgBtn2d?.removeAttribute('disabled');
            convertToSvgBtn2d?.classList.remove('loading');
            // Hide loading modal
            if (p2dLoaderModal) {
                p2dLoaderModal.classList.add('hidden');
            }
        }
    });

    detailsDeleteBtn2d?.addEventListener('click', () => {
        if (!currentGeneratedImage2d) return;

        const indexToDelete = imageHistory2d.findIndex(item => item.id === currentGeneratedImage2d.id);
        if (indexToDelete === -1) return;

        // Remove from history
        imageHistory2d.splice(indexToDelete, 1);

        if (imageHistory2d.length === 0) {
            // Reset view
            currentGeneratedImage2d = null;
            if(resultImage2d) resultImage2d.src = '';
            resultImage2d?.classList.add('hidden');
            resultIdlePlaceholder2d?.classList.remove('hidden');
            mainResultContentHeader2d?.classList.add('hidden');
            detailsPanel2d?.classList.add('hidden');
            detailsPanel2d?.classList.remove('is-open');
            historyIndex2d = -1;
        } else {
            // Update index and current image
            historyIndex2d = Math.max(0, indexToDelete - 1);
            currentGeneratedImage2d = imageHistory2d[historyIndex2d];
            update2dViewFromState();
        }
        
        renderHistory2d();
        showToast({ type: 'success', title: 'Deleted', body: 'Image removed from history.' });
    });

    // 2D Studio: SVG Modal Handlers
    const svgPreviewCloseBtn = $('#p2d-svg-preview-close-btn');
    const svgModalCloseBtn = $('#p2d-svg-modal-close-btn');
    const copySvgCodeBtn = $('#p2d-copy-svg-code-btn');
    const p2dDownloadSvgBtn = $('#p2d-download-svg-btn');
    
    svgPreviewCloseBtn?.addEventListener('click', () => {
        if (p2dSvgPreviewModal) p2dSvgPreviewModal.classList.add('hidden');
        showToast({ type: 'success', title: 'SVG conversion completed ✅', body: 'SVG ready for use.' });
    });
    
    svgModalCloseBtn?.addEventListener('click', () => {
        if (p2dSvgPreviewModal) p2dSvgPreviewModal.classList.add('hidden');
        showToast({ type: 'success', title: 'SVG conversion completed ✅', body: 'SVG ready for use.' });
    });
    
    copySvgCodeBtn?.addEventListener('click', () => {
        const svgCodeView = $('#p2d-svg-code-view') as HTMLTextAreaElement;
        if (svgCodeView && svgCodeView.value) {
            navigator.clipboard.writeText(svgCodeView.value);
            showToast({ type: 'success', title: 'Copied', body: 'SVG code copied to clipboard.' });
        }
    });
    
    p2dDownloadSvgBtn?.addEventListener('click', () => {
        if (!currentGeneratedImage2d || !(currentGeneratedImage2d as any).svgString) {
            showToast({ type: 'error', title: 'Error', body: 'SVG not found.' });
            return;
        }
        
        const svgString = (currentGeneratedImage2d as any).svgString;
        const blob = new Blob([svgString], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentGeneratedImage2d.subject.replace(/\s+/g, '_')}-converted.svg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showToast({ type: 'success', title: 'Downloaded', body: 'SVG file downloaded.' });
    });

    // 2D Studio: Preview Result
    p2dPreviewResultBtn?.addEventListener('click', () => {
        if (!currentGeneratedImage2d) {
            showToast({ type: 'error', title: 'No Image', body: 'Please generate an image first.' });
            return;
        }
        
        const dataUrl = `data:${currentGeneratedImage2d.mimeType};base64,${currentGeneratedImage2d.data}`;
        window.open(dataUrl, '_blank');
    });

    // 2D Studio: Compare
    p2dCompareBtn?.addEventListener('click', () => {
        if (!currentGeneratedImage2d || !p2dOriginalImageData) {
            showToast({ type: 'error', title: 'Error', body: 'Cannot compare images.' });
            return;
        }
        
        const currentDataUrl = `data:${currentGeneratedImage2d.mimeType};base64,${currentGeneratedImage2d.data}`;
        const compareOriginal = $('#p2d-compare-original') as HTMLImageElement;
        const compareCurrent = $('#p2d-compare-current') as HTMLImageElement;
        const compareSlider = $('#p2d-compare-slider') as HTMLInputElement;
        const compareDivider = $('#p2d-compare-divider');
        
        if (compareOriginal) compareOriginal.src = p2dOriginalImageData;
        if (compareCurrent) compareCurrent.src = currentDataUrl;
        
        // Slider handler
        const handleSliderChange = () => {
            const value = compareSlider.valueAsNumber;
            if (compareDivider && compareCurrent) {
                compareDivider.style.left = `${value}%`;
                compareCurrent.style.clipPath = `inset(0 ${100 - value}% 0 0)`;
            }
        };
        compareSlider?.removeEventListener('input', handleSliderChange);
        compareSlider?.addEventListener('input', handleSliderChange);
        handleSliderChange();
        
        if (p2dCompareModal) p2dCompareModal.classList.remove('hidden');
    });
    
    const compareCloseBtn = $('#p2d-compare-close-btn');
    const compareModalCloseBtn = $('#p2d-compare-modal-close-btn');
    
    compareCloseBtn?.addEventListener('click', () => {
        if (p2dCompareModal) p2dCompareModal.classList.add('hidden');
    });
    
    compareModalCloseBtn?.addEventListener('click', () => {
        if (p2dCompareModal) p2dCompareModal.classList.add('hidden');
    });

    // 3D History Button Listeners
    historyBackBtn?.addEventListener('click', () => {
        if (historyIndex > 0) {
            historyIndex--;
            currentGeneratedImage = imageHistory[historyIndex];
            update3dViewFromState();
            renderHistory();
        }
    });

    historyForwardBtn?.addEventListener('click', () => {
        if (historyIndex < imageHistory.length - 1) {
            historyIndex++;
            currentGeneratedImage = imageHistory[historyIndex];
            update3dViewFromState();
            renderHistory();
        }
    });

    // 3D Panel and Tab Listeners
    toggleDetailsPanelBtn?.addEventListener('click', () => {
        detailsPanel?.classList.toggle('hidden');
        detailsPanel?.classList.toggle('is-open');
    });
    
    detailsCloseBtn?.addEventListener('click', () => {
        detailsPanel?.classList.add('hidden');
        detailsPanel?.classList.remove('is-open');
    });

    detailsUpscaleBtn?.addEventListener('click', () => {
        handleUpscaleImage();
    });

    detailsFixBtn?.addEventListener('click', async () => {
        if (!currentGeneratedImage) return;
        
        const fixBtn = detailsFixBtn;
        updateButtonLoadingState(fixBtn, true);
        imageGenerationLoaderModal?.classList.remove('hidden');
        
        try {
            const backgroundColor = detailsBackgroundColorPicker?.value || '#FFFFFF';
            const objectColor = detailsObjectColorPicker?.value || '#2962FF';
            
            // Save original image data if not already saved
            if (!currentGeneratedImage.originalData) {
                currentGeneratedImage.originalData = currentGeneratedImage.data;
                currentGeneratedImage.originalMimeType = currentGeneratedImage.mimeType;
            }
            
            // Parse current style constraints
            let template = JSON.parse(currentGeneratedImage.styleConstraints);
            
            // Update colors
            template.background.color = backgroundColor;
            template.colors.dominant_blue = objectColor;
            
            // Create new prompt with updated colors (Fix mode)
            const imagePromptText = createImagePromptFromTemplate(template, userPrompt3d?.value || '', true);
            
            const imageData = await generateImage(
                imagePromptText,
                resultImage,
                resultPlaceholder,
                resultError,
                resultIdlePlaceholder,
                imageGenerateBtn,
                referenceImagesFor3d
            );
            
            if (imageData) {
                // Update current image with new data
                currentGeneratedImage.data = imageData.data;
                currentGeneratedImage.mimeType = imageData.mimeType;
                currentGeneratedImage.styleConstraints = JSON.stringify(template, null, 2);
                
                // Update in history
                const historyItem = imageHistory.find(item => item.id === currentGeneratedImage!.id);
                if (historyItem) {
                    historyItem.data = imageData.data;
                    historyItem.mimeType = imageData.mimeType;
                    historyItem.styleConstraints = JSON.stringify(template, null, 2);
                    if (!historyItem.originalData) {
                        historyItem.originalData = currentGeneratedImage.originalData;
                        historyItem.originalMimeType = currentGeneratedImage.originalMimeType;
                    }
                }
                
                // Update UI
                update3dViewFromState();
                updateHistoryTab();
                
                showToast({ type: 'success', title: 'Fixed!', body: 'Image updated with new colors.' });
            }
        } catch (error) {
            console.error("Fix failed:", error);
            showToast({ type: 'error', title: 'Fix Failed', body: 'Failed to update image.' });
        } finally {
            updateButtonLoadingState(fixBtn, false);
            imageGenerationLoaderModal?.classList.add('hidden');
        }
    });

    resultImage?.addEventListener('click', () => {

        if (!currentGeneratedImage) return;
        detailsPanel?.classList.remove('hidden');
        detailsPanel?.classList.add('is-open');
        const detailsDetailTabBtn = detailsPanel?.querySelector<HTMLElement>('.tab-item[data-tab="detail"]');
        detailsDetailTabBtn?.click();
    });
    
    previewSwitcherImageBtn?.addEventListener('click', () => {
        if (!currentGeneratedImage) return;
        previewSwitcherImageBtn.classList.add('active');
        previewSwitcherVideoBtn?.classList.remove('active');

        resultImage?.classList.remove('hidden');
        resultVideo?.classList.add('hidden');
        resultIdlePlaceholder?.classList.add('hidden');
        motionPromptPlaceholder?.classList.add('hidden');
        
        detailsPanel?.classList.remove('hidden');
        detailsPanel?.classList.add('is-open');
        const detailsDetailTabBtn = detailsPanel?.querySelector<HTMLElement>('.tab-item[data-tab="detail"]');
        detailsDetailTabBtn?.click();
    });

    previewSwitcherVideoBtn?.addEventListener('click', () => {
        if (!currentGeneratedImage) return;
        previewSwitcherVideoBtn.classList.add('active');
        previewSwitcherImageBtn?.classList.remove('active');
        
        resultImage?.classList.add('hidden');

        if (currentGeneratedImage.videoDataUrl) {
            resultVideo.src = currentGeneratedImage.videoDataUrl;
            resultVideo.classList.remove('hidden');
            motionPromptPlaceholder?.classList.add('hidden');
        } else {
            resultVideo?.classList.add('hidden');
            motionPromptPlaceholder?.classList.remove('hidden');
        }
        resultIdlePlaceholder?.classList.add('hidden');
        
        detailsPanel?.classList.remove('hidden');
        detailsPanel?.classList.add('is-open');
        const detailsMotionTabBtn = detailsPanel?.querySelector<HTMLElement>('.tab-item[data-tab="motion"]');
        detailsMotionTabBtn?.click();
    });
    
    const openMotionCategoryModal = () => {
      motionCategoryModal?.classList.remove('hidden');
      generateAndDisplayMotionCategories();
      lastFocusedElement = document.activeElement as HTMLElement;
    }

    generateMotionPromptBtn?.addEventListener('click', openMotionCategoryModal);
    regenerateMotionPromptBtn?.addEventListener('click', openMotionCategoryModal);
    generateVideoBtn?.addEventListener('click', handleGenerateVideo);
    regenerateVideoBtn?.addEventListener('click', handleGenerateVideo);
    
    // Image Studio motion handlers
    const openMotionCategoryModalStudio = () => {
        motionCategoryModal?.classList.remove('hidden');
        generateAndDisplayMotionCategoriesStudio();
        lastFocusedElement = document.activeElement as HTMLElement;
    };
    
    generateMotionPromptBtnStudio?.addEventListener('click', openMotionCategoryModalStudio);
    regenerateMotionPromptBtnStudio?.addEventListener('click', openMotionCategoryModalStudio);
    generateMotionFromPreviewBtnImage?.addEventListener('click', () => {
      if (!currentGeneratedImageStudio) {
        showToast({ type: 'error', title: 'No Image', body: 'Please generate an image first.' });
        return;
      }
      // Ensure details panel is open and on Motion tab
      if (detailsPanelImageStudio?.classList.contains('hidden')) {
        detailsPanelImageStudio.classList.remove('hidden');
        detailsPanelImageStudio.classList.add('is-open');
      }
      detailsTabBtnMotionImageStudio?.click();
      openMotionCategoryModalStudio();
    });
    generateVideoBtnStudio?.addEventListener('click', handleGenerateVideoStudio);
    regenerateVideoBtnStudio?.addEventListener('click', handleGenerateVideoStudio);

    motionCategoryCloseBtn?.addEventListener('click', () => {
      motionCategoryModal?.classList.add('hidden');
      lastFocusedElement?.focus();
    });
    
    generateMotionFromPreviewBtn?.addEventListener('click', () => {
        if (!currentGeneratedImage) return;
        
        detailsPanel?.classList.remove('hidden');
        detailsPanel?.classList.add('is-open');

        const detailsMotionTabBtn = detailsPanel?.querySelector<HTMLElement>('.tab-item[data-tab="motion"]');
        detailsMotionTabBtn?.click();
        
        openMotionCategoryModal();
    });
    
    // History tab thumbnail click handlers
    $('#history-original-image')?.addEventListener('click', () => {
        if (!currentGeneratedImage || !currentGeneratedImage.originalData) return;
        
        const dataUrl = `data:${currentGeneratedImage.originalMimeType};base64,${currentGeneratedImage.originalData}`;
        resultImage.src = dataUrl;
        resultImage.classList.remove('hidden');
        resultImage.classList.add('visible');
        
        // Switch to image tab
        previewSwitcherImageBtn?.classList.add('active');
        previewSwitcherVideoBtn?.classList.remove('active');
    });
    
    $('#history-fixed-image')?.addEventListener('click', () => {
        if (!currentGeneratedImage) return;
        
        const dataUrl = `data:${currentGeneratedImage.mimeType};base64,${currentGeneratedImage.data}`;
        resultImage.src = dataUrl;
        resultImage.classList.remove('hidden');
        resultImage.classList.add('visible');
        
        // Switch to image tab
        previewSwitcherImageBtn?.classList.add('active');
        previewSwitcherVideoBtn?.classList.remove('active');
    });
    
    // Image Studio preview switcher handlers
    if (previewSwitcherImageBtnStudio && previewSwitcherVideoBtnStudio) {
        previewSwitcherImageBtnStudio.addEventListener('click', () => {
            if (!currentGeneratedImageStudio) return;
            
            resultImageStudio?.classList.remove('hidden');
            resultVideoStudio?.classList.add('hidden');
            motionPromptPlaceholderStudio?.classList.add('hidden');
            
            previewSwitcherImageBtnStudio.classList.add('active');
            previewSwitcherVideoBtnStudio.classList.remove('active');
            
            // Switch details panel to detail tab
            if (detailsPanelImageStudio && !detailsPanelImageStudio.classList.contains('hidden')) {
                detailsTabBtnDetailImageStudio?.click();
            }
        });
        
        previewSwitcherVideoBtnStudio.addEventListener('click', () => {
            if (!currentGeneratedImageStudio) return;
            
            previewSwitcherVideoBtnStudio.classList.add('active');
            previewSwitcherImageBtnStudio.classList.remove('active');
            
            if (currentGeneratedImageStudio.videoDataUrl) {
                resultVideoStudio.src = currentGeneratedImageStudio.videoDataUrl;
                resultVideoStudio.classList.remove('hidden');
                motionPromptPlaceholderStudio?.classList.add('hidden');
            } else {
                resultVideoStudio?.classList.add('hidden');
                motionPromptPlaceholderStudio?.classList.remove('hidden');
            }
            resultImageStudio?.classList.add('hidden');
            
            // Switch details panel to motion tab
            if (detailsPanelImageStudio && !detailsPanelImageStudio.classList.contains('hidden')) {
                detailsTabBtnMotionImageStudio?.click();
            }
        });
    }

    // GNB scroll effect
    const appHeader = document.querySelector('.app-header');
    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      if (currentScrollY > 50) {
        appHeader?.classList.add('scrolled');
      } else {
        appHeader?.classList.remove('scrolled');
      }
      
      lastScrollY = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    // Generate button functionality (navigate to 3D Studio and prefill)
    const generateBtn = document.getElementById('generate-btn');
    const generateInput = document.getElementById('generate-input') as HTMLInputElement;

    generateBtn?.addEventListener('click', handleGenerateImageMain);

    // Enter key support for generate input
    generateInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        generateBtn?.click();
      }
    });

    // Main page reference image upload functionality
    if (mainReferenceDropZone) {
      // Drag and drop events
      mainReferenceDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        mainReferenceDropZone.classList.add('dragover');
      });

      mainReferenceDropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        mainReferenceDropZone.classList.remove('dragover');
      });

      mainReferenceDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        mainReferenceDropZone.classList.remove('dragover');
        const file = e.dataTransfer?.files[0];
        if (file && file.type.startsWith('image/')) {
          handleMainReferenceImageUpload(file);
        }
      });

      // Click to upload
      mainReferenceDropZone.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.addEventListener('change', (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (file) {
            handleMainReferenceImageUpload(file);
          }
        });
        input.click();
      });
    }

    // Main page reference image buttons
    mainGenerateWithTextBtn?.addEventListener('click', () => {
      if (mainReferenceImage) {
        handleGenerateImageMain();
      }
    });

    mainAttachImageBtn?.addEventListener('click', () => {
      if (mainReferenceImage) {
        handleGenerateImageMain();
      }
    });

    mainRemoveReferenceBtn?.addEventListener('click', () => {
      removeMainReferenceImage();
    });

    // Logo click handler to navigate to home
    const logo = $('.logo');
    logo?.addEventListener('click', () => {
      // Remove active class from all nav items
      document.querySelectorAll('.nav-item').forEach(navItem => {
        navItem.classList.remove('active');
      });
      
      // Show home page
      currentPage = 'page-usages';
      pageContainers.forEach(container => {
        container.classList.add('hidden');
      });
      
      const homePage = $('#page-usages');
      if (homePage) {
        homePage.classList.remove('hidden');
      }
    });

    // Dynamic placeholder functionality
    const dynamicPlaceholder = document.getElementById('dynamic-placeholder');
    const placeholderTexts = [
      'Creon create a stunning 3D logo animation...',
      'Creon create a modern icon set for my app...',
      'Creon create a cinematic video intro...',
      'Creon create a futuristic UI mockup...',
      'Creon create a minimalist brand identity...',
      'Creon create a product showcase video...',
      'Creon create a social media banner...',
      'Creon create a mobile app interface...',
      'Creon create a promotional animation...',
      'Creon create a website hero section...'
    ];

    let currentIndex = 0;
    let isTyping = false;
    let currentText = '';
    let charIndex = 0;

    function typeText() {
      if (charIndex < placeholderTexts[currentIndex].length) {
        currentText += placeholderTexts[currentIndex].charAt(charIndex);
        if (dynamicPlaceholder) {
          dynamicPlaceholder.textContent = currentText;
        }
        charIndex++;
        setTimeout(typeText, 50); // Typing speed
      } else {
        // Wait before erasing
        setTimeout(eraseText, 2000);
      }
    }

    function eraseText() {
      if (currentText.length > 0) {
        currentText = currentText.slice(0, -1);
        if (dynamicPlaceholder) {
          dynamicPlaceholder.textContent = currentText;
        }
        setTimeout(eraseText, 30); // Erasing speed
      } else {
        // Move to next text
        currentIndex = (currentIndex + 1) % placeholderTexts.length;
        charIndex = 0;
        setTimeout(typeText, 500); // Pause before next text
      }
    }

    // Start the dynamic placeholder
    if (dynamicPlaceholder) {
      typeText();
    }

    // Hide placeholder when user starts typing
    generateInput?.addEventListener('input', () => {
      if (dynamicPlaceholder) {
        dynamicPlaceholder.classList.add('hidden');
      }
    });

    // Show placeholder when input is empty
    generateInput?.addEventListener('blur', () => {
      if (generateInput?.value === '' && dynamicPlaceholder) {
        dynamicPlaceholder.classList.remove('hidden');
      }
    });
  };
  
  // Setup 2D Studio accordions
  const p2dOptionsAccordion = document.querySelector('.accordion-header[data-accordion="p2d-options"]');
  const p2dOptionsContent = document.getElementById('p2d-options-content');
  
  if (p2dOptionsAccordion && p2dOptionsContent) {
    p2dOptionsAccordion.addEventListener('click', () => {
      const isActive = p2dOptionsAccordion.getAttribute('data-active') === 'true';
      p2dOptionsAccordion.setAttribute('data-active', isActive ? 'false' : 'true');
      p2dOptionsContent.setAttribute('data-active', isActive ? 'false' : 'true');
    });
  }
  
  const p2dReferenceAccordion = document.querySelector('.accordion-header[data-accordion="p2d-reference"]');
  const p2dReferenceContent = document.getElementById('p2d-reference-content');
  
  if (p2dReferenceAccordion && p2dReferenceContent) {
    p2dReferenceAccordion.addEventListener('click', () => {
      const isActive = p2dReferenceAccordion.getAttribute('data-active') === 'true';
      p2dReferenceAccordion.setAttribute('data-active', isActive ? 'false' : 'true');
      p2dReferenceContent.setAttribute('data-active', isActive ? 'false' : 'true');
    });
  }
  
  const p2dLibraryAccordion = document.querySelector('.accordion-header[data-accordion="p2d-library"]');
  const p2dLibraryContent = document.getElementById('p2d-library-content');
  
  if (p2dLibraryAccordion && p2dLibraryContent) {
    p2dLibraryAccordion.addEventListener('click', () => {
      const isActive = p2dLibraryAccordion.getAttribute('data-active') === 'true';
      p2dLibraryAccordion.setAttribute('data-active', isActive ? 'false' : 'true');
      p2dLibraryContent.setAttribute('data-active', isActive ? 'false' : 'true');
    });
  }
  
  // 2D Details Panel: Fix the icon accordion
  const p2dFixIconAccordion = document.querySelector('.accordion-header[data-accordion="p2d-fix-icon"]');
  const p2dFixIconContent = document.getElementById('p2d-fix-icon-content');
  if (p2dFixIconAccordion && p2dFixIconContent) {
    p2dFixIconAccordion.addEventListener('click', () => {
      const isActive = p2dFixIconAccordion.getAttribute('data-active') === 'true';
      p2dFixIconAccordion.setAttribute('data-active', isActive ? 'false' : 'true');
      p2dFixIconContent.setAttribute('data-active', isActive ? 'false' : 'true');
    });
  }
  
  // Setup 3D Studio accordions
  const p3dOptionsAccordion = document.querySelector('.accordion-header[data-accordion="3d-options"]');
  const p3dOptionsContent = document.getElementById('3d-options-content');
  
  if (p3dOptionsAccordion && p3dOptionsContent) {
    p3dOptionsAccordion.addEventListener('click', () => {
      const isActive = p3dOptionsAccordion.getAttribute('data-active') === 'true';
      p3dOptionsAccordion.setAttribute('data-active', isActive ? 'false' : 'true');
      p3dOptionsContent.setAttribute('data-active', isActive ? 'false' : 'true');
    });
  }
  
  const p3dRefAccordion = document.querySelector('.accordion-header[data-accordion="3d-reference"]');
  const p3dRefContent = document.getElementById('3d-reference-content');
  if (p3dRefAccordion && p3dRefContent) {
    p3dRefAccordion.addEventListener('click', () => {
      const isActive = p3dRefAccordion.getAttribute('data-active') === 'true';
      p3dRefAccordion.setAttribute('data-active', isActive ? 'false' : 'true');
      p3dRefContent.setAttribute('data-active', isActive ? 'false' : 'true');
    });
  }

  const p3dLibAccordion = document.querySelector('.accordion-header[data-accordion="3d-library"]');
  const p3dLibContent = document.getElementById('3d-library-content');
  if (p3dLibAccordion && p3dLibContent) {
    p3dLibAccordion.addEventListener('click', () => {
      const isActive = p3dLibAccordion.getAttribute('data-active') === 'true';
      p3dLibAccordion.setAttribute('data-active', isActive ? 'false' : 'true');
      p3dLibContent.setAttribute('data-active', isActive ? 'false' : 'true');
    });
  }
  
  // 3D Details Panel: Fix the image accordion
  const p3dFixAccordion = document.querySelector('.accordion-header[data-accordion="3d-fix"]');
  const p3dFixContent = document.getElementById('3d-fix-content');
  if (p3dFixAccordion && p3dFixContent) {
    p3dFixAccordion.addEventListener('click', () => {
      const isActive = p3dFixAccordion.getAttribute('data-active') === 'true';
      p3dFixAccordion.setAttribute('data-active', isActive ? 'false' : 'true');
      p3dFixContent.setAttribute('data-active', isActive ? 'false' : 'true');
    });
  }
  
  init();

});