import React, { useState, useRef, useEffect } from 'react';
import type {
  ChapterItem,
  ContentItemType,
  ItemDownloadPolicy,
  VideoSourceType,
  ExternalResource,
  LessonCompletionPolicy,
} from '@/core/courses/types';
import { parseDurationToSeconds } from '@/core/domain/progress';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Icon, type SemanticIconName } from '@/shared/ui/Icon';
import { ExternalResourcesEditor } from '@/features/courses/components/ExternalResourcesEditor';
import { YouTubePlayer } from '@/features/learning-player/components/YouTubePlayer';
import { GoogleDrivePlayer } from '@/features/learning-player/components/GoogleDrivePlayer';
import { extractYouTubeVideoId, extractGoogleDriveFileId } from '../utils/videoUrlHelpers';
import { mediaStorageService, MediaStorageError } from '@/core/storage/mediaStorageService';
import {
  type VideoEmbedPolicy,
  getMandatoryVideoEmbedPolicy,
} from '@/core/courses/videoEmbedPolicy';

export interface ItemEditorModalProps {
  isOpen: boolean;
  chapterTitle: string;
  item?: ChapterItem | null; // null if creating a new item
  onClose: () => void;
  onSave: (itemData: ChapterItem) => void;
}

const CONTENT_TYPE_CONFIG: Record<
  ContentItemType,
  {
    label: string;
    icon: SemanticIconName;
    accept: string;
    maxSizeMB: number;
    isInAppViewer: boolean;
    badgeLabel: string;
    badgeVariant: 'primary' | 'success' | 'neutral' | 'warning';
  }
> = {
  video: {
    label: 'محاضرة فيديو',
    icon: 'video',
    accept: 'video/mp4,video/webm,video/ogg',
    maxSizeMB: 100,
    isInAppViewer: true,
    badgeLabel: 'يفتح في مشغل التعلم',
    badgeVariant: 'primary',
  },
  pdf: {
    label: 'مستند رقمي PDF',
    icon: 'fileText',
    accept: 'application/pdf',
    maxSizeMB: 25,
    isInAppViewer: true,
    badgeLabel: 'يفتح في مشغل التعلم',
    badgeVariant: 'primary',
  },
  image: {
    label: 'مخطط / صورة توضيحية',
    icon: 'info',
    accept: 'image/png,image/jpeg,image/webp,image/svg+xml',
    maxSizeMB: 5,
    isInAppViewer: true,
    badgeLabel: 'يفتح في مشغل التعلم',
    badgeVariant: 'success',
  },
  powerpoint: {
    label: 'عرض تقديمي (PowerPoint)',
    icon: 'file',
    accept: '.ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation',
    maxSizeMB: 25,
    isInAppViewer: false,
    badgeLabel: 'مورد قابل للتنزيل',
    badgeVariant: 'neutral',
  },
  docx: {
    label: 'مستند وورد (Word)',
    icon: 'fileText',
    accept: '.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    maxSizeMB: 20,
    isInAppViewer: false,
    badgeLabel: 'مورد قابل للتنزيل',
    badgeVariant: 'neutral',
  },
  zip: {
    label: 'أرشيف مضغوط (ZIP)',
    icon: 'download',
    accept: '.zip,application/zip,application/x-zip-compressed',
    maxSizeMB: 25,
    isInAppViewer: false,
    badgeLabel: 'مورد قابل للتنزيل',
    badgeVariant: 'neutral',
  },
  audio: {
    label: 'تسجيل صوتي (Audio)',
    icon: 'info',
    accept: 'audio/mpeg,audio/wav,audio/aac,audio/ogg',
    maxSizeMB: 25,
    isInAppViewer: false,
    badgeLabel: 'مورد قابل للتنزيل',
    badgeVariant: 'neutral',
  },
  other: {
    label: 'ملحق تدريبي إضافي',
    icon: 'file',
    accept: '*/*',
    maxSizeMB: 20,
    isInAppViewer: false,
    badgeLabel: 'مورد قابل للتنزيل',
    badgeVariant: 'neutral',
  },
};

export const ItemEditorModal: React.FC<ItemEditorModalProps> = ({
  isOpen,
  chapterTitle,
  item,
  onClose,
  onSave,
}) => {
  const [activeTab, setActiveTab] = useState<'content' | 'resources'>('content');

  const [title, setTitle] = useState(item?.title || '');
  const [type, setType] = useState<ContentItemType>(item?.type || 'video');
  const [duration, setDuration] = useState(item?.duration || '');
  const [downloadPolicy, setDownloadPolicy] = useState<ItemDownloadPolicy>(
    item?.downloadPolicy || (item?.type === 'video' ? 'never' : 'immediate')
  );

  // Video Source States
  const [videoSourceType, setVideoSourceType] = useState<VideoSourceType>(
    item?.videoSourceType || 'upload'
  );
  const [youtubeUrl, setYoutubeUrl] = useState<string>(
    item?.videoSourceType === 'youtube'
      ? item.externalUrl || item.url || (item.youtubeVideoId ? `https://www.youtube.com/watch?v=${item.youtubeVideoId}` : '')
      : ''
  );
  const [driveUrl, setDriveUrl] = useState<string>(
    item?.videoSourceType === 'drive'
      ? item.externalUrl || item.url || (item.driveFileId ? `https://drive.google.com/file/d/${item.driveFileId}/view` : '')
      : ''
  );

  // Completion Policy State: Minimum Viewing-Time Requirement for Google Drive
  // Default to enabled (true) for newly created lessons; preserve explicitly saved setting on edit; false for historical
  const [requireMinimumViewingTime, setRequireMinimumViewingTime] = useState<boolean>(() => {
    if (item) {
      return item.completionPolicy?.requireMinimumViewingTime ?? false;
    }
    return true;
  });

  const handleVideoSourceChange = (newSource: VideoSourceType) => {
    setVideoSourceType(newSource);
  };

  const handleYouTubeUrlChange = (value: string) => {
    setYoutubeUrl(value);
    const driveId = extractGoogleDriveFileId(value.trim());
    if (driveId) {
      setDriveUrl(value);
      setVideoSourceType('drive');
    }
  };

  const handleDriveUrlChange = (value: string) => {
    setDriveUrl(value);
    const ytId = extractYouTubeVideoId(value.trim());
    if (ytId) {
      setYoutubeUrl(value);
      setVideoSourceType('youtube');
    }
  };

  // File metadata states (for uploaded files)
  const [fileName, setFileName] = useState(item?.originalFileName || '');
  const [fileSize, setFileSize] = useState<number | undefined>(item?.fileSizeBytes);
  const [fileUrl, setFileUrl] = useState(item?.url || '');
  const [mediaId, setMediaId] = useState<string | undefined>(item?.mediaId);
  const [fileError, setFileError] = useState<string | null>(null);

  // Lesson-level external resources
  const [lessonResources, setLessonResources] = useState<ExternalResource[]>(
    item?.externalResources || []
  );

  // Object URL memory tracking ref to avoid memory leaks
  const createdObjectUrlRef = useRef<string | null>(null);
  const pendingFileRef = useRef<File | null>(null);

  // Recreate object URL if reopening a lesson with an existing persistent mediaId
  useEffect(() => {
    let isMounted = true;
    if (item?.mediaId) {
      mediaStorageService
        .createMediaObjectUrl(item.mediaId)
        .then((recreatedUrl) => {
          if (!isMounted) return;
          if (recreatedUrl) {
            if (createdObjectUrlRef.current && createdObjectUrlRef.current !== recreatedUrl) {
              mediaStorageService.revokeMediaObjectUrl(createdObjectUrlRef.current);
            }
            createdObjectUrlRef.current = recreatedUrl;
            setFileUrl(recreatedUrl);
          }
        })
        .catch((err) => {
          console.warn('[ItemEditorModal] Failed to restore media from IndexedDB:', err);
        });
    }
    return () => {
      isMounted = false;
    };
  }, [item?.mediaId]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (createdObjectUrlRef.current) {
        mediaStorageService.revokeMediaObjectUrl(createdObjectUrlRef.current);
        createdObjectUrlRef.current = null;
      }
    };
  }, []);

  if (!isOpen) return null;

  const config = CONTENT_TYPE_CONFIG[type];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];

    // 1. Empty file validation
    if (file.size === 0) {
      setFileError('عذراً، الملف المحدد فارغ (0 بايت). يرجى اختيار ملف صالح.');
      e.target.value = '';
      return;
    }

    // 2. Maximum file size validation
    const maxBytes = config.maxSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      setFileError(
        `عذراً، حجم الملف (${(file.size / (1024 * 1024)).toFixed(1)} ميجابايت) يتجاوز الحد الأقصى المسموح لهذا النوع (${config.maxSizeMB} ميجابايت).`
      );
      e.target.value = '';
      return;
    }

    // Revoke previous object URL if any
    if (createdObjectUrlRef.current) {
      mediaStorageService.revokeMediaObjectUrl(createdObjectUrlRef.current);
      createdObjectUrlRef.current = null;
    }

    // Store pending file for IndexedDB persistence on save
    pendingFileRef.current = file;

    // Generate stable media ID and initiate persistence
    const assignedMediaId = mediaStorageService.generateMediaId();
    setMediaId(assignedMediaId);
    mediaStorageService
      .saveMedia(file, {
        id: assignedMediaId,
        fileName: file.name,
        mimeType: file.type,
      })
      .catch((err: unknown) => {
        if (err instanceof MediaStorageError) {
          setFileError(err.message);
        } else {
          console.warn('[ItemEditorModal] Media persistence error:', err);
        }
      });

    // 3. Extract metadata
    setFileName(file.name);
    setFileSize(file.size);

    // Create temporary object URL for immediate browser playback/preview
    const objectUrl = URL.createObjectURL(file);
    createdObjectUrlRef.current = objectUrl;
    setFileUrl(objectUrl);

    // If video, attempt to extract duration
    if (type === 'video' && !duration) {
      const tempVideo = document.createElement('video');
      tempVideo.preload = 'metadata';
      tempVideo.src = objectUrl;
      tempVideo.onloadedmetadata = () => {
        const sec = Math.round(tempVideo.duration);
        const mins = Math.floor(sec / 60);
        const remSec = sec % 60;
        setDuration(`${mins}:${remSec < 10 ? '0' : ''}${remSec}`);
      };
    }
  };

  const handleRemoveFile = () => {
    if (createdObjectUrlRef.current) {
      mediaStorageService.revokeMediaObjectUrl(createdObjectUrlRef.current);
      createdObjectUrlRef.current = null;
    }
    pendingFileRef.current = null;
    setMediaId(undefined);
    setFileName('');
    setFileSize(undefined);
    setFileUrl('');
  };

  const handleCancel = () => {
    if (createdObjectUrlRef.current) {
      mediaStorageService.revokeMediaObjectUrl(createdObjectUrlRef.current);
      createdObjectUrlRef.current = null;
    }
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFileError(null);

    if (!title.trim()) {
      setFileError('يرجى إدخال عنوان للدرس.');
      return;
    }

    let finalUrl = fileUrl;
    let finalMediaId = mediaId;
    let ytId: string | undefined;
    let gdriveId: string | undefined;

    // Video Source-specific validations
    if (type === 'video') {
      if (videoSourceType === 'youtube') {
        const clean = youtubeUrl.trim();
        const extracted = extractYouTubeVideoId(clean);
        if (!extracted) {
          setFileError('يرجى إدخال رابط YouTube صالح (مثال: https://www.youtube.com/watch?v=XXXXX)');
          return;
        }
        ytId = extracted;
        finalUrl = `https://www.youtube.com/embed/${extracted}`;
        finalMediaId = undefined;
      } else if (videoSourceType === 'drive') {
        const clean = driveUrl.trim();
        const extracted = extractGoogleDriveFileId(clean);
        if (!extracted) {
          setFileError('يرجى إدخال رابط ملف Google Drive صالح يتضمن معرف الملف.');
          return;
        }
        if (requireMinimumViewingTime) {
          const effectiveDuration = duration.trim() || '10:00';
          const durationSeconds = parseDurationToSeconds(effectiveDuration);
          if (durationSeconds <= 0) {
            setFileError('يرجى تحديد مدة صالحة للمحاضرة (أكبر من 00:00) عند تفعيل اشتراط الحد الأدنى لوقت المشاهدة.');
            return;
          }
        }
        gdriveId = extracted;
        finalUrl = `https://drive.google.com/file/d/${extracted}/preview`;
        finalMediaId = undefined;
      }
    }

    // Persist local file to IndexedDB if a new file is pending without an assigned ID
    if ((type !== 'video' || videoSourceType === 'upload') && pendingFileRef.current && !finalMediaId) {
      finalMediaId = mediaStorageService.generateMediaId();
      setMediaId(finalMediaId);
      mediaStorageService
        .saveMedia(pendingFileRef.current, {
          id: finalMediaId,
          fileName: fileName || pendingFileRef.current.name,
          mimeType: pendingFileRef.current.type,
        })
        .catch((err: unknown) => {
          if (err instanceof MediaStorageError) {
            setFileError(err.message);
          } else {
            console.warn('[ItemEditorModal] Media persistence error:', err);
          }
        });
    }

    const isExternalVideo =
      type === 'video' && (videoSourceType === 'youtube' || videoSourceType === 'drive');

    const embedPolicy: VideoEmbedPolicy | undefined = isExternalVideo
      ? getMandatoryVideoEmbedPolicy(videoSourceType)
      : undefined;

    const completionPolicy: LessonCompletionPolicy | undefined =
      type === 'video' && videoSourceType === 'drive'
        ? { requireMinimumViewingTime }
        : item?.completionPolicy;

    const updatedItem: ChapterItem = {
      id: item?.id || `ITEM_${Date.now()}`,
      title: title.trim(),
      type,
      url: finalUrl || (type === 'video' ? '/dev-media/test-video.mp4' : undefined),
      mediaId: finalMediaId,
      duration: type === 'video' ? duration.trim() || '10:00' : undefined,
      downloadPolicy: isExternalVideo ? 'never' : downloadPolicy,
      canDownload: isExternalVideo ? false : downloadPolicy !== 'never',
      originalFileName: isExternalVideo ? undefined : fileName || undefined,
      fileSizeBytes: isExternalVideo ? undefined : fileSize,
      mimeType: isExternalVideo ? 'video/external' : config.accept.split(',')[0],
      uploadedAt: new Date().toISOString(),
      // Increment 8 Additions
      videoSourceType: type === 'video' ? videoSourceType : undefined,
      externalUrl:
        type === 'video'
          ? videoSourceType === 'youtube'
            ? youtubeUrl.trim()
            : videoSourceType === 'drive'
            ? driveUrl.trim()
            : undefined
          : undefined,
      youtubeVideoId: ytId,
      driveFileId: gdriveId,
      embedPolicy,
      completionPolicy,
      externalResources: lessonResources,
    };

    onSave(updatedItem);
  };

  const isExternalVideo =
    type === 'video' && (videoSourceType === 'youtube' || videoSourceType === 'drive');

  const youtubeVideoId = extractYouTubeVideoId(youtubeUrl);
  const driveFileId = extractGoogleDriveFileId(driveUrl);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="item-modal-title"
      data-testid="item-editor-modal"
    >
      <div className="bg-surface border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border bg-bg-alt/40 shrink-0">
          <div>
            <h2 id="item-modal-title" className="text-base font-bold text-text-heading">
              {item ? 'تعديل محتوى الدرس' : 'إضافة درس / محتوى تعليمي'}
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              ضمن الفصل: <span className="font-semibold text-text">{chapterTitle}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            className="text-text-muted hover:text-text p-1.5 rounded-lg hover:bg-neutral-light transition-colors"
            aria-label="إغلاق النافذة"
          >
            ✕
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="flex items-center border-b border-border px-5 bg-surface">
          <button
            type="button"
            onClick={() => setActiveTab('content')}
            className={`py-2.5 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'content'
                ? 'border-primary text-primary'
                : 'border-transparent text-text-muted hover:text-text'
            }`}
            data-testid="modal-tab-content"
          >
            <Icon name="fileText" size="sm" />
            <span>بيانات ومحتوى الدرس</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('resources')}
            className={`py-2.5 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'resources'
                ? 'border-primary text-primary'
                : 'border-transparent text-text-muted hover:text-text'
            }`}
            data-testid="modal-tab-resources"
          >
            <Icon name="link" size="sm" />
            <span>المصادر الخارجية للدرس ({lessonResources.length})</span>
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
          {fileError && (
            <div
              className="p-3 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs font-semibold"
              role="alert"
            >
              {fileError}
            </div>
          )}

          {activeTab === 'content' ? (
            <>
              {/* Lesson Title */}
              <div className="space-y-1.5">
                <label htmlFor="item-title-input" className="block text-xs font-bold text-text-heading">
                  عنوان المحتوى / الدرس <span className="text-danger">*</span>
                </label>
                <input
                  id="item-title-input"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: إجراءات عزل الخط الكهربائي الراجع"
                  className="w-full px-3.5 py-2.5 text-sm bg-surface border border-border rounded-xl text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  required
                  autoFocus
                  data-testid="item-title-input"
                />
              </div>

              {/* Content Type Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-text-heading">
                  نوع المحتوى التعليمي <span className="text-danger">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(Object.keys(CONTENT_TYPE_CONFIG) as ContentItemType[]).map((t) => {
                    const itemCfg = CONTENT_TYPE_CONFIG[t];
                    const isSelected = type === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          setType(t);
                          if (t === 'video') setDownloadPolicy('never');
                          else setDownloadPolicy('immediate');
                        }}
                        className={`p-2.5 rounded-xl border text-right transition-all flex flex-col justify-between gap-1.5 ${
                          isSelected
                            ? 'border-primary bg-primary/10 shadow-sm'
                            : 'border-border bg-surface hover:bg-neutral-light text-text-muted'
                        }`}
                        data-testid={`item-type-btn-${t}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-bold ${isSelected ? 'text-primary' : 'text-text-heading'}`}>
                            {itemCfg.label.split(' ')[0]}
                          </span>
                          <Icon name={itemCfg.icon} size="sm" className={isSelected ? 'text-primary' : 'text-text-muted'} />
                        </div>
                        <Badge variant={itemCfg.badgeVariant} className="text-[10px] self-start py-0 px-1.5">
                          {itemCfg.isInAppViewer ? 'مشغل مدمج' : 'ملف للتنزيل'}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Video Source Type Selection (Video-only) */}
              {type === 'video' && (
                <div className="space-y-2 p-3.5 rounded-xl border border-primary/20 bg-primary/5">
                  <label className="block text-xs font-bold text-text-heading">
                    مصدر تشغيل الفيديو
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'upload', label: 'رفع ملف فيديو', icon: 'upload' },
                      { id: 'youtube', label: 'رابط YouTube', icon: 'video' },
                      { id: 'drive', label: 'رابط Google Drive', icon: 'file' },
                    ].map((srcOption) => (
                      <button
                        key={srcOption.id}
                        type="button"
                        onClick={() => handleVideoSourceChange(srcOption.id as VideoSourceType)}
                        className={`p-2 text-xs font-bold rounded-xl border transition-all flex items-center justify-center gap-1.5 ${
                          videoSourceType === srcOption.id
                            ? 'border-primary bg-surface text-primary shadow-xs'
                            : 'border-border bg-surface/60 text-text-muted hover:bg-surface'
                        }`}
                        data-testid={`video-source-${srcOption.id}`}
                      >
                        <Icon name={srcOption.icon as SemanticIconName} size="sm" />
                        <span>{srcOption.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Video: YouTube URL Input */}
              {type === 'video' && videoSourceType === 'youtube' && (
                <div className="space-y-3 p-4 rounded-xl border border-border bg-bg-alt/30" data-testid="youtube-source-section">
                  <div className="space-y-2">
                    <label htmlFor="youtube-url-input" className="block text-xs font-bold text-text-heading">
                      رابط فيديو YouTube <span className="text-danger">*</span>
                    </label>
                    <input
                      id="youtube-url-input"
                      type="url"
                      value={youtubeUrl}
                      onChange={(e) => handleYouTubeUrlChange(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=dQw4w9WgXcQ أو https://youtu.be/..."
                      className="w-full px-3.5 py-2 text-xs bg-surface border border-border rounded-xl text-text font-mono text-left focus:outline-none focus:ring-2 focus:ring-primary"
                      dir="ltr"
                      data-testid="youtube-url-input"
                      required
                    />
                    {youtubeVideoId && (
                      <div className="flex items-center gap-2 text-xs text-success font-semibold">
                        <Icon name="checkCircle" size="sm" />
                        <span>معرف الفيديو المكتشف: {youtubeVideoId}</span>
                      </div>
                    )}
                    <p className="text-[11px] text-text-muted leading-relaxed">
                      * ملاحظة: يتم تضمين الفيديو وتشغيله في مشغل التعلم للمتدرب. لا يمكن للمنصة تنزيل فيديو YouTube أو تضمينه في حزمة ZIP لأسباب قانونية وتقنية.
                    </p>
                  </div>
                </div>
              )}

              {/* Video: Google Drive URL Input */}
              {type === 'video' && videoSourceType === 'drive' && (
                <div className="space-y-3 p-4 rounded-xl border border-border bg-bg-alt/30" data-testid="drive-source-section">
                  <div className="space-y-2">
                    <label htmlFor="drive-url-input" className="block text-xs font-bold text-text-heading">
                      رابط ملف فيديو Google Drive <span className="text-danger">*</span>
                    </label>
                    <input
                      id="drive-url-input"
                      type="url"
                      value={driveUrl}
                      onChange={(e) => handleDriveUrlChange(e.target.value)}
                      placeholder="https://drive.google.com/file/d/1aBcDeFgHiJkLmNoPqRsTuVwXyZ/view?usp=sharing"
                      className="w-full px-3.5 py-2 text-xs bg-surface border border-border rounded-xl text-text font-mono text-left focus:outline-none focus:ring-2 focus:ring-primary"
                      dir="ltr"
                      data-testid="drive-url-input"
                      required
                    />
                    {driveFileId && (
                      <div className="flex items-center gap-2 text-xs text-success font-semibold">
                        <Icon name="checkCircle" size="sm" />
                        <span>معرف ملف Drive: {driveFileId}</span>
                      </div>
                    )}
                    <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 text-text text-[11px] space-y-1">
                      <strong className="text-warning-dark block font-bold">تنبيه هام حول أذونات Google Drive:</strong>
                      <p className="leading-relaxed">
                        1. تأكد من ضبط أذونات مشاركة الملف في Drive إلى: <strong>أي شخص لديه الرابط (Anyone with the link)</strong>.
                      </p>
                      <p className="leading-relaxed">
                        2. لا يدعم مشغل Drive التتبع الزمني المباشر عبر المتصفح؛ سيتعين على المتدرب النقر على <strong>'تأكيد المشاهدة والإكمال'</strong> لتوثيق تقدمه.
                      </p>
                    </div>

                    {/* Completion Policy: Minimum Viewing-Time Requirement */}
                    <div className="pt-3 border-t border-border/60" data-testid="gdrive-completion-policy-section">
                      <label className="flex items-start gap-2.5 cursor-pointer select-none">
                        <input
                          id="require-minimum-viewing-time"
                          type="checkbox"
                          checked={requireMinimumViewingTime}
                          onChange={(e) => setRequireMinimumViewingTime(e.target.checked)}
                          className="mt-0.5 rounded border-border text-primary focus:ring-primary w-4 h-4 accent-primary"
                          data-testid="require-minimum-viewing-time-toggle"
                        />
                        <div className="space-y-0.5">
                          <span className="text-xs font-bold text-text-heading block">
                            اشتراط الحد الأدنى لوقت المشاهدة
                          </span>
                          <p className="text-[11px] text-text-muted leading-relaxed">
                            يلزم المتدرب بقضاء وقت مشاهدة يعادل مدة المحاضرة المحددة قبل إتاحة تأكيد الإكمال والانتقال للدرس التالي المقفل.
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Standard File Upload Box (For upload videos or all other content types) */}
              {(type !== 'video' || videoSourceType === 'upload') && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-text-heading">
                    الملف المرفق للمحتوى
                  </label>
                  <div className="p-4 border-2 border-dashed border-border rounded-xl bg-bg-alt/30 text-center space-y-2 hover:border-primary/50 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                      <Icon name="upload" size="md" />
                    </div>
                    <div>
                      <label
                        htmlFor="item-file-upload"
                        className="cursor-pointer text-xs font-bold text-primary hover:underline"
                        data-testid="choose-file-label"
                      >
                        {fileName ? 'اضغط لتغيير الملف المختار' : 'اضغط لاختيار ملف من جهازك'}
                      </label>
                      <input
                        id="item-file-upload"
                        type="file"
                        accept={config.accept}
                        onChange={handleFileChange}
                        className="hidden"
                        data-testid="item-file-input"
                      />
                      <p className="text-[11px] text-text-muted mt-0.5">
                        الحد الأقصى المسموح: {config.maxSizeMB} ميجابايت (الامتدادات: {config.accept.replace(/\/\*/g, '')})
                      </p>
                    </div>

                    {fileName && (
                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface border border-border mt-2 text-right">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <Icon name={config.icon} size="sm" className="text-primary shrink-0" />
                          <span className="text-xs font-semibold text-text truncate">{fileName}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 mr-2">
                          {fileSize && (
                            <span className="text-[11px] text-text-muted">
                              {(fileSize / (1024 * 1024)).toFixed(2)} MB
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={handleRemoveFile}
                            className="text-text-muted hover:text-danger text-xs p-1"
                            title="إزالة الملف وإلغاء المعاينة"
                            data-testid="remove-selected-file-btn"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ======================================================== */}
              {/* Content Live Preview Stage (Before Done/Save)            */}
              {/* ======================================================== */}
              <div className="space-y-2 pt-3 border-t border-border" data-testid="item-live-preview-section">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon name="eye" size="sm" className="text-primary" />
                    <label className="text-xs font-bold text-text-heading">
                      المعاينة المباشرة للمحتوى (قبل التأكيد والحفظ)
                    </label>
                  </div>
                  <Badge variant="primary" className="text-[10px]">
                    وضع المعاينة
                  </Badge>
                </div>

                <div className="p-3.5 rounded-xl border border-border bg-bg-alt/30 space-y-3">
                  {/* Case 1: Video Preview */}
                  {type === 'video' && (
                    <>
                      {videoSourceType === 'youtube' ? (
                        youtubeUrl.trim() ? (
                          youtubeVideoId ? (
                            <div className="space-y-2" data-testid="preview-youtube-stage">
                              <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2 text-success font-semibold">
                                  <Icon name="checkCircle" size="sm" />
                                  <span>فيديو YouTube معتمد للمعاينة ({youtubeVideoId})</span>
                                </div>
                                <span className="text-[11px] text-text-muted">تشغيل تجريبي للمحاضر</span>
                              </div>
                              <div className="rounded-xl overflow-hidden border border-border">
                                <YouTubePlayer
                                  key={`preview-yt-${youtubeVideoId}`}
                                  videoId={youtubeVideoId}
                                  title={title || 'معاينة فيديو YouTube'}
                                  previewMode={true}
                                  onComplete={() => {}}
                                  onLocalProgressUpdate={() => {}}
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="p-3.5 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs space-y-1" data-testid="preview-youtube-error">
                              <div className="flex items-center gap-1.5 font-bold">
                                <Icon name="alertCircle" size="sm" />
                                <span>رابط YouTube غير صالح للمعاينة</span>
                              </div>
                              <p className="text-[11px] text-text-muted">
                                يرجى التأكد من كتابة الرابط بالشكل الصحيح: https://www.youtube.com/watch?v=... أو https://youtu.be/...
                              </p>
                            </div>
                          )
                        ) : (
                          <div className="p-4 rounded-xl border border-dashed border-border text-center text-xs text-text-muted" data-testid="preview-empty-youtube">
                            أدخل رابط فيديو YouTube أعلاه لبدء المعاينة التفاعلية الفورية هنا
                          </div>
                        )
                      ) : videoSourceType === 'drive' ? (
                        driveUrl.trim() ? (
                          driveFileId ? (
                            <div className="space-y-2" data-testid="preview-drive-stage">
                              <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2 text-success font-semibold">
                                  <Icon name="checkCircle" size="sm" />
                                  <span>ملف Google Drive معتمد للمعاينة ({driveFileId})</span>
                                </div>
                                <span className="text-[11px] text-text-muted">وضع المعاينة الفورية</span>
                              </div>
                              <div className="rounded-xl overflow-hidden border border-border">
                                <GoogleDrivePlayer
                                  key={`preview-drive-${driveFileId}`}
                                  driveFileId={driveFileId}
                                  title={title || 'معاينة Google Drive'}
                                  previewMode={true}
                                  onComplete={() => {}}
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="p-3.5 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs space-y-1" data-testid="preview-drive-error">
                              <div className="flex items-center gap-1.5 font-bold">
                                <Icon name="alertCircle" size="sm" />
                                <span>رابط Google Drive غير صالح للمعاينة</span>
                              </div>
                              <p className="text-[11px] text-text-muted">
                                تأكد من أن الرابط يحتوي على معرّف ملف Drive صالح ومضبوط على صلاحية المشاركة العامة
                              </p>
                            </div>
                          )
                        ) : (
                          <div className="p-4 rounded-xl border border-dashed border-border text-center text-xs text-text-muted" data-testid="preview-empty-drive">
                            أدخل رابط Google Drive أعلاه لمعاينة الفيديو والتحقق من صلاحيات العرض
                          </div>
                        )
                      ) : (
                        /* Video Upload File */
                        fileUrl ? (
                          <div className="space-y-2" data-testid="preview-video-upload-stage">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-text">معاينة مشغل الفيديو (HTML5):</span>
                              <span className="text-[11px] text-text-muted">{fileName}</span>
                            </div>
                            <div className="rounded-xl overflow-hidden border border-border bg-black aspect-video max-h-64 flex items-center justify-center">
                              <video
                                src={fileUrl}
                                controls
                                className="w-full h-full object-contain"
                                data-testid="video-preview-player"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="p-4 rounded-xl border border-dashed border-border text-center text-xs text-text-muted" data-testid="preview-empty-upload">
                            اختر ملف فيديو من جهازك لمعاينته والتحقق من جودة التشغيل هنا
                          </div>
                        )
                      )}
                    </>
                  )}

                  {/* Case 2: PDF Document */}
                  {type === 'pdf' && (
                    fileUrl ? (
                      <div className="space-y-2" data-testid="preview-pdf-stage">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-text">معاينة مستند PDF الرقمي:</span>
                          <span className="text-[11px] text-text-muted">{fileName}</span>
                        </div>
                        <div className="rounded-xl overflow-hidden border border-border bg-slate-900 h-64 flex items-center justify-center">
                          <iframe
                            src={fileUrl}
                            title="معاينة المستند الرقمي"
                            className="w-full h-full border-0"
                            data-testid="pdf-preview-frame"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl border border-dashed border-border text-center text-xs text-text-muted" data-testid="preview-empty-pdf">
                        اختر ملف PDF من جهازك لمعاينة صفحاته هنا قبل الحفظ
                      </div>
                    )
                  )}

                  {/* Case 3: Image / Diagram */}
                  {type === 'image' && (
                    fileUrl ? (
                      <div className="space-y-2" data-testid="preview-image-stage">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-text">معاينة المخطط / الصورة:</span>
                          <span className="text-[11px] text-text-muted">{fileName}</span>
                        </div>
                        <div className="rounded-xl overflow-hidden border border-border bg-black/30 p-2 flex items-center justify-center min-h-[160px] max-h-64">
                          <img
                            src={fileUrl}
                            alt={title || fileName || 'معاينة الصورة'}
                            className="max-h-60 max-w-full rounded-lg object-contain shadow-sm"
                            data-testid="image-preview-element"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl border border-dashed border-border text-center text-xs text-text-muted" data-testid="preview-empty-image">
                        اختر صورة أو مخططاً توضيحياً لمعاينته هنا قبل الحفظ
                      </div>
                    )
                  )}

                  {/* Case 4: Downloadable Resource Types (PowerPoint, Word, ZIP, Audio, Other) */}
                  {type !== 'video' && type !== 'pdf' && type !== 'image' && (
                    fileUrl ? (
                      <div className="p-4 rounded-xl border border-border bg-surface space-y-3" data-testid="downloadable-summary-card">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                              <Icon name={config.icon} size="md" />
                            </div>
                            <div>
                              <span className="text-xs font-bold text-text-heading block">{fileName || 'ملف مرفق للتنزيل'}</span>
                              <span className="text-[11px] text-text-muted">{config.label}</span>
                            </div>
                          </div>
                          {fileSize && (
                            <Badge variant="neutral" className="text-xs font-mono">
                              {(fileSize / (1024 * 1024)).toFixed(2)} MB
                            </Badge>
                          )}
                        </div>
                        <div className="p-2.5 rounded-lg bg-bg-alt/60 border border-border text-[11px] text-text-muted flex items-center gap-2">
                          <Icon name="info" size="sm" className="text-primary-light shrink-0" />
                          <p className="leading-relaxed">
                            هذا المحتوى مصنف كـ <strong>{config.label}</strong> مخصص للتنزيل المباشر للمتدربين. المعاينة المباشرة داخل المتصفح غير مدعومة لهذا النوع من الملفات.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl border border-dashed border-border text-center text-xs text-text-muted" data-testid="preview-empty-downloadable">
                        اختر ملف {config.label} من جهازك لعرض بياناته وحجمه هنا قبل الحفظ
                      </div>
                    )
                  )}

                  {/* Storage limitation notice */}
                  <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 text-xs text-text-muted space-y-1" data-testid="storage-boundary-notice">
                    <div className="flex items-center gap-1.5 font-bold text-text-heading">
                      <Icon name="info" size="sm" className="text-primary" />
                      <span>تخزين محلي مؤقت للمتصفح (IndexedDB)</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      يتم حفظ ملفات الوسائط المرفوعة داخل الذاكرة التخزينية لمتصفحك فقط. هذا النموذج الأولي يعمل بالكامل على جانب العميل ولا يقوم برفع الملفات إلى خادم خارجي أو مزامنتها تلقائياً مع أجهزة أخرى.
                    </p>
                  </div>
                </div>
              </div>

              {/* Video Duration (Video-only) */}
              {type === 'video' && (
                <div className="space-y-1.5">
                  <label htmlFor="video-duration-input" className="block text-xs font-bold text-text-heading">
                    مدة المحاضرة التقديرية (دقيقة:ثانية)
                  </label>
                  <input
                    id="video-duration-input"
                    type="text"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="15:30"
                    className="w-full sm:w-1/2 px-3.5 py-2 text-sm bg-surface border border-border rounded-xl text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary"
                    data-testid="item-duration-input"
                  />
                </div>
              )}

              {/* Download Policy Section */}
              <div className="space-y-2 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-text-heading">
                    سياسة وإتاحة تنزيل هذا المحتوى
                  </label>
                  <span className="text-[11px] text-text-muted">تحكم خاص بهذا العنصر</span>
                </div>

                {isExternalVideo ? (
                  <div className="p-3 rounded-xl border border-border bg-bg-alt/40 text-xs text-text-muted" data-testid="external-video-download-locked">
                    <div className="flex items-center gap-2 font-semibold text-text">
                      <Icon name="lock" size="sm" className="text-text-muted" />
                      <span>غير متاح للتنزيل المباشر أو التضمين في أرشيف ZIP</span>
                    </div>
                    <p className="text-[11px] mt-1 leading-relaxed">
                      هذا الفيديو مستضاف لدى طرف خارجي (YouTube أو Google Drive). لا تدعي المنصة القدرة على منعه أو إتاحته كتنزيل LMS داخلي.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      { id: 'never', label: 'غير متاح للتنزيل نهائياً (حماية المحتوى)' },
                      { id: 'immediate', label: 'متاح فوراً للمتدرب المسجل' },
                      { id: 'after_item_completion', label: 'متاح للتنزيل بعد إتمام هذا الدرس' },
                      { id: 'after_course_completion', label: 'متاح للتنزيل بعد إتمام الكورس كاملاً' },
                    ].map((pol) => (
                      <label
                        key={pol.id}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                          downloadPolicy === pol.id
                            ? 'border-primary bg-primary/5 font-semibold text-text'
                            : 'border-border text-text-muted hover:bg-neutral-light'
                        }`}
                      >
                        <input
                          type="radio"
                          name="item-download-policy"
                          value={pol.id}
                          checked={downloadPolicy === pol.id}
                          onChange={() => setDownloadPolicy(pol.id as ItemDownloadPolicy)}
                          className="accent-primary"
                          data-testid={`item-download-policy-${pol.id}`}
                        />
                        <span>{pol.label}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Resources Tab (Lesson-Level External Resources) */
            <div data-testid="lesson-resources-tab-panel">
              <ExternalResourcesEditor
                resources={lessonResources}
                onChange={setLessonResources}
                scopeLabel="لهذا الدرس فقط"
              />
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <span className="text-[11px] text-text-muted">
              * لن يتم تطبيق أي تعديلات على مسودة المقرر حتى تضغط على "حفظ الدرس"
            </span>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleCancel} data-testid="item-cancel-btn">
                إلغاء
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={!title.trim()}
                className="px-5 font-bold"
                data-testid="item-save-btn"
              >
                حفظ الدرس
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ItemEditorModal;
