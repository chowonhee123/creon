/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, GenerateContentResponse, Modality, Chat, Type } from '@google/genai';
import {marked} from 'https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js';

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
  let imageHistory2d: GeneratedImageData[] = [];
  let historyIndex2d = -1;
  let referenceImagesForEdit2d: ({ file: File; dataUrl: string } | null)[] = [null, null, null, null];

  let referenceImagesFor3d: ({ file: File; dataUrl: string } | null)[] = [null, null, null];
  let referenceImagesForIconStudio3d: ({ file: File; dataUrl: string } | null)[] = [null, null, null];
  let motionFirstFrameImage: { file: File; dataUrl: string; } | null = null;
  let motionLastFrameImage: { file: File; dataUrl: string; } | null = null;
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
  let imageStudioSubjectImage: { file: File; dataUrl: string; } | null = null;
  let imageStudioSceneImage: { file: File; dataUrl: string; } | null = null;
  let currentGeneratedImageStudio: GeneratedImageData | null = null;
  let imageStudioHistory: GeneratedImageData[] = [];
  let imageStudioSubjectPrompt: string = '';
  let imageStudioScenePrompt: string = '';
  let currentImageStudioModalType: 'subject' | 'scene' | null = null;

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

  // Loader Modals
  const imageGenerationLoaderModal = $('#image-generation-loader-modal');
  const videoGenerationLoaderModal = $('#video-generation-loader-modal');
  const videoLoaderMessage = $('#video-loader-message');
  
  // Explore Page
  const explorePage = $('#page-usages');
  const exploreMain = $('.explore-main');
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

    bannerToastTimer = window.setTimeout(() => {
        toast.classList.add('hidden');
    }, options.duration || 5000);
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
    resultImgElement: HTMLImageElement,
    resultPlaceholderElement: HTMLElement,
    resultErrorElement: HTMLElement,
    idlePlaceholderElement: HTMLElement,
    generateBtn: HTMLElement,
    referenceImages: ({ file: File; dataUrl: string } | null)[] = []
  ) => {
    updateButtonLoadingState(generateBtn, true);
    resultPlaceholderElement.classList.remove('hidden');
    resultPlaceholderElement.classList.remove('is-error');
    idlePlaceholderElement.classList.add('hidden');
    resultImgElement.classList.add('hidden');
    resultImgElement.classList.remove('visible');

    try {
      const parts: any[] = [{ text: prompt }];
      
      const imageParts = await Promise.all(referenceImages.filter(img => img).map(async refImg => {
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

      if (response.candidates && response.candidates[0].content.parts[0].inlineData) {
        const imageData = response.candidates[0].content.parts[0].inlineData;
        const dataUrl = `data:${imageData.mimeType};base64,${imageData.data}`;
        resultImgElement.src = dataUrl;
        resultImgElement.classList.remove('hidden');
        setTimeout(() => resultImgElement.classList.add('visible'), 50); // For transition
        return { data: imageData.data, mimeType: imageData.mimeType };
      } else {
        throw new Error('No image data received from API.');
      }
    } catch (error) {
      console.error('Image generation failed:', error);
      resultPlaceholderElement.classList.add('is-error');
      return null;
    } finally {
      updateButtonLoadingState(generateBtn, false);
      resultPlaceholderElement.classList.add('hidden');
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
            timestamp: Date.now()
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
  };
  
  const renderHistory2d = () => {
    if (!historyPanel2d || !historyList2d || !historyCounter2d || !historyBackBtn2d || !historyForwardBtn2d) return;
    
    if (imageHistory2d.length === 0) {
        historyPanel2d.classList.add('hidden');
        return;
    }

    historyPanel2d.classList.remove('hidden');
    historyList2d.innerHTML = '';

    imageHistory2d.forEach((item, index) => {
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
            <img src="data:${item.mimeType};base64,${item.data}" class="history-thumbnail" alt="History item thumbnail">
            <div class="history-item-info">
            <span class="history-item-label">${item.subject}</span>
            <span class="history-item-timestamp">${timeString}</span>
            </div>
        </div>
        `;
        li.addEventListener('click', () => {
            historyIndex2d = index;
            currentGeneratedImage2d = imageHistory2d[historyIndex2d];
            update2dViewFromState();
            renderHistory2d();
        });
        historyList2d.prepend(li);
    });

    historyCounter2d.textContent = `${historyIndex2d + 1} / ${imageHistory2d.length}`;
    historyBackBtn2d.disabled = historyIndex2d <= 0;
    historyForwardBtn2d.disabled = historyIndex2d >= imageHistory2d.length - 1;
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

  const handleGenerateImage3d = async () => {
    if (!imagePromptSubjectInput.value) {
        showToast({ type: 'error', title: 'Input Required', body: 'Please enter a subject for your image.' });
        imagePromptSubjectInput.focus();
        return;
    }

    update3dPromptDisplay();
    imageGenerationLoaderModal?.classList.remove('hidden');

    try {
        const imageData = await generateImage(
            imagePromptDisplay.value,
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
      // Generate image from text using imagen-4.0-fast-generate-001
      const response = await ai.models.generateContent({
        model: 'imagen-4.0-fast-generate-001',
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
      // Generate image from text using imagen-4.0-fast-generate-001
      const response = await ai.models.generateContent({
        model: 'imagen-4.0-fast-generate-001',
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
    updateButtonLoadingState(generateBtn, true);

    try {
      if (imageStudioSubjectImage && imageStudioSceneImage) {
        // Composition mode - use gemini-2.5-flash-image
        const parts: any[] = [
          {
            text: "Combine these two images: place the subject from the first image into the scene from the second image. Create a natural, seamless composition."
          }
        ];

        const subjectBlob = await blobToBase64(imageStudioSubjectImage.file);
        parts.push({
          inlineData: {
            data: subjectBlob,
            mimeType: imageStudioSubjectImage.file.type,
          }
        });

        const sceneBlob = await blobToBase64(imageStudioSceneImage.file);
        parts.push({
          inlineData: {
            data: sceneBlob,
            mimeType: imageStudioSceneImage.file.type,
          }
        });

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
          
          if (promptDisplay) promptDisplay.value = "Subject placed in scene";
          
          // Save to history
          const timestamp = Date.now();
          currentGeneratedImageStudio = { 
            id: `img_${timestamp}`,
            data, 
            mimeType,
            subject: imageStudioSubjectImage?.file.name || '',
            styleConstraints: imageStudioSceneImage?.file.name || '',
            timestamp
          };
          imageStudioHistory.push(currentGeneratedImageStudio);
          
          // Show details panel
          const detailsPanel = $('#image-details-panel-image');
          const detailsPreview = $('#details-preview-image-image') as HTMLImageElement;
          const detailsDownload = $('#details-download-btn-image') as HTMLAnchorElement;
          
          if (detailsPreview) detailsPreview.src = dataUrl;
          if (detailsDownload) detailsDownload.href = dataUrl;
          
          detailsPanel?.classList.remove('hidden');
          
          showToast({ type: 'success', title: 'Composed!', body: 'Image composition completed.' });
        }
      } else if (promptText) {
        // Single image generation mode - use imagen-4.0-fast-generate-001
        const response = await ai.models.generateContent({
          model: 'imagen-4.0-fast-generate-001',
          contents: [{ parts: [{ text: promptText }] }],
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
          
          if (promptDisplay) promptDisplay.value = promptText;
          
          // Save to history
          const timestamp = Date.now();
          currentGeneratedImageStudio = { 
            id: `img_${timestamp}`,
            data, 
            mimeType,
            subject: promptText,
            styleConstraints: '',
            timestamp
          };
          imageStudioHistory.push(currentGeneratedImageStudio);
          
          // Show details panel
          const detailsPanel = $('#image-details-panel-image');
          const detailsPreview = $('#details-preview-image-image') as HTMLImageElement;
          const detailsDownload = $('#details-download-btn-image') as HTMLAnchorElement;
          
          if (detailsPreview) detailsPreview.src = dataUrl;
          if (detailsDownload) detailsDownload.href = dataUrl;
          
          detailsPanel?.classList.remove('hidden');
          
          showToast({ type: 'success', title: 'Generated!', body: 'Image generated from prompt.' });
        }
      } else {
        showToast({ type: 'error', title: 'Missing Input', body: 'Please upload images or enter a prompt.' });
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

        // Add specific prompts to avoid letterboxing and set resolution.
        const finalPrompt = `Avoid letterboxing 16:9 aspect ratio, 1920x1080 resolution. ${sanitizedUserPrompt}. Negative Prompt: letterbox, cinematic crop, black bars, narrow frame, pillarbox.`;

        const config: any = {
            numberOfVideos: 1,
            resolution: '1080p',
        };

        if (!motionFirstFrameImage) {
            config.aspectRatio = '16:9';
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

    updateMotionUI();
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
        </div>
        `;
        li.addEventListener('click', () => {
            historyIndex = index;
            currentGeneratedImage = imageHistory[historyIndex];
            update3dViewFromState();
            renderHistory();
        });
        historyList.prepend(li);
    });

    historyCounter.textContent = `${historyIndex + 1} / ${imageHistory.length}`;
    historyBackBtn.disabled = historyIndex <= 0;
    historyForwardBtn.disabled = historyIndex >= imageHistory.length - 1;
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
                  text: "Upscale this image to 4k resolution (3840x3840), maintaining all details and quality, with enhanced sharpness and clarity."
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
    
    downloadSvgBtn.disabled = false;
    downloadPngBtn.disabled = false;
    copyJsxBtn.disabled = false;
    copySnippetBtn.disabled = false;
    
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

  const setupImageStudioDropZones = () => {
    const subjectZone = $('#subject-drop-zone-image');
    const sceneZone = $('#scene-drop-zone-image');
    const subjectInput = $('#subject-image-input') as HTMLInputElement;
    const sceneInput = $('#scene-image-input') as HTMLInputElement;

    if (!subjectZone || !sceneZone || !subjectInput || !sceneInput) return;

    const setupZone = (zone: HTMLElement, input: HTMLInputElement, isSubject: boolean) => {
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
        } else if (content) {
          previewImg.src = '';
          previewImg.classList.add('hidden');
          removeBtn?.classList.add('hidden');
          content.classList.remove('has-image');
        }
      };

      const handleFile = (file: File | undefined) => {
        if (!file || !file.type.startsWith('image/')) return;
        
        const reader = new FileReader();
        reader.onload = e => {
          const dataUrl = e.target?.result as string;
          const imageData = { file, dataUrl };
          
          if (isSubject) {
            imageStudioSubjectImage = imageData;
          } else {
            imageStudioSceneImage = imageData;
          }
          
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
        const file = e.dataTransfer?.files[0];
        handleFile(file);
      });

      if (removeBtn) {
        removeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (isSubject) {
            imageStudioSubjectImage = null;
            imageStudioSubjectPrompt = '';
          } else {
            imageStudioSceneImage = null;
            imageStudioScenePrompt = '';
          }
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
          currentImageStudioModalType = isSubject ? 'subject' : 'scene';
          const modal = $('#image-studio-text-modal');
          modal?.classList.remove('hidden');
        });
      }
    };

    setupZone(subjectZone, subjectInput, true);
    setupZone(sceneZone, sceneInput, false);
  };
  
  // --- EVENT LISTENERS ---

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
  
  $('#image-studio-text-generate-btn')?.addEventListener('click', async () => {
    const textInput = $('#image-studio-text-input') as HTMLTextAreaElement;
    const promptText = textInput?.value?.trim() || '';
    if (!promptText) {
      showToast({ type: 'error', title: 'Input Required', body: 'Please enter a prompt.' });
      return;
    }
    
    if (currentImageStudioModalType === 'subject') {
      imageStudioSubjectPrompt = promptText;
      await handleGenerateSubjectImageFromText(promptText);
    } else if (currentImageStudioModalType === 'scene') {
      imageStudioScenePrompt = promptText;
      await handleGenerateSceneImageFromText(promptText);
    }
    
    $('#image-studio-text-modal')?.classList.add('hidden');
    textInput.value = '';
    currentImageStudioModalType = null;
  });
  
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
        if (historyIndex2d > 0) {
            historyIndex2d--;
            currentGeneratedImage2d = imageHistory2d[historyIndex2d];
            update2dViewFromState();
            renderHistory2d();
        }
    });

    historyForwardBtn2d?.addEventListener('click', () => {
        if (historyIndex2d < imageHistory2d.length - 1) {
            historyIndex2d++;
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
  };
  
  init();

});