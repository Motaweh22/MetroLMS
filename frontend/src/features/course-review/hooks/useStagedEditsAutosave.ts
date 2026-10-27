import { useState, useEffect, useRef, useCallback } from 'react';
import type { Course, StagedAdminEditsRecord } from '@/core/courses/types';
import { reviewApi } from '../api/reviewApi';
import { ApiError } from '@/core/api/apiClient';
import {
  threeWayRebase,
  type FieldConflict,
  type ThreeWayRebaseResult,
} from '../services/threeWayRebase';

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'conflict' | 'error';

export interface UseStagedEditsAutosaveOptions {
  courseId: string;
  baselineCourse?: Course | null;
  initialRevision?: number;
  initialStagedEdits?: StagedAdminEditsRecord | null;
  initialPatchedContent?: Partial<Course>;
  debounceMs?: number;
  maxRetries?: number;
  onSaveSuccess?: (record: StagedAdminEditsRecord) => void;
  onSaveError?: (error: Error) => void;
  onConflictDetected?: (conflicts: FieldConflict[]) => void;
}

export interface UseStagedEditsAutosaveReturn {
  status: AutosaveStatus;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  clientRevision: number;
  lastSavedAt: string | null;
  error: Error | null;
  conflicts: FieldConflict[];
  isConflictModalOpen: boolean;
  serverRecord: StagedAdminEditsRecord | null;
  pendingPatch: Partial<Course>;
  effectiveContent: Course;
  updateLocalEdits: (patch: Partial<Course>) => void;
  saveImmediately: () => Promise<StagedAdminEditsRecord | null>;
  resolveConflict: (resolution: 'keep_local' | 'accept_server' | 'cancel') => Promise<void>;
  rehydrate: () => Promise<void>;
  closeConflictModal: () => void;
}

/**
 * useStagedEditsAutosave
 *
 * Manages debounced autosave of staged administrator edits with optimistic
 * concurrency revision tokens, HTTP 409 conflict detection, safe 3-way rebase,
 * and explicit conflict resolution workflows.
 */
export function useStagedEditsAutosave({
  courseId,
  baselineCourse,
  initialRevision,
  initialStagedEdits,
  initialPatchedContent = {},
  debounceMs = 2000,
  maxRetries = 3,
  onSaveSuccess,
  onSaveError,
  onConflictDetected,
}: UseStagedEditsAutosaveOptions): UseStagedEditsAutosaveReturn {
  const [status, setStatus] = useState<AutosaveStatus>('idle');
  const [clientRevision, setClientRevision] = useState<number>(
    initialRevision ?? initialStagedEdits?.clientRevision ?? 0
  );
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  // Unsaved local edits made by the administrator
  const [pendingPatch, setPendingPatch] = useState<Partial<Course>>(initialPatchedContent);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  // Accepted staged content on server
  const [serverPatchedContent, setServerPatchedContent] = useState<Partial<Course>>(initialPatchedContent);

  // Conflict modal state
  const [isConflictModalOpen, setIsConflictModalOpen] = useState<boolean>(false);
  const [conflicts, setConflicts] = useState<FieldConflict[]>([]);
  const [serverRecord, setServerRecord] = useState<StagedAdminEditsRecord | null>(
    initialStagedEdits || null
  );
  const [lastRebaseResult, setLastRebaseResult] = useState<ThreeWayRebaseResult | null>(null);

  // Debounce and retry tracking refs
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef<number>(0);
  const clientRevisionRef = useRef<number>(clientRevision);
  const pendingPatchRef = useRef<Partial<Course>>(pendingPatch);
  const baselineCourseRef = useRef<Course | null>(baselineCourse || null);

  useEffect(() => {
    clientRevisionRef.current = clientRevision;
  }, [clientRevision]);

  useEffect(() => {
    pendingPatchRef.current = pendingPatch;
  }, [pendingPatch]);

  useEffect(() => {
    if (baselineCourse) {
      baselineCourseRef.current = baselineCourse;
    }
  }, [baselineCourse]);

  useEffect(() => {
    if (initialStagedEdits) {
      setServerRecord(initialStagedEdits);
      setClientRevision(initialStagedEdits.clientRevision);
      clientRevisionRef.current = initialStagedEdits.clientRevision;
      const patched = initialStagedEdits.patchedContent || {};
      setServerPatchedContent(patched);
      setPendingPatch((prev) => {
        if (!hasUnsavedChanges || Object.keys(prev).length === 0) {
          pendingPatchRef.current = patched;
          return patched;
        }
        return prev;
      });
    }
  }, [initialStagedEdits, hasUnsavedChanges]);

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  /**
   * Rehydrate latest accepted server revision and staged content
   */
  const rehydrate = useCallback(async () => {
    try {
      const res = await reviewApi.getStagedAdminEdits(courseId);
      if (res.record) {
        setClientRevision(res.record.clientRevision);
        clientRevisionRef.current = res.record.clientRevision;
        setLastSavedAt(res.record.lastSavedAt);
        setServerPatchedContent(res.record.patchedContent || {});
        setPendingPatch(res.record.patchedContent || {});
        pendingPatchRef.current = res.record.patchedContent || {};
        setHasUnsavedChanges(false);
      } else {
        // Check localStorage fallback
        if (typeof localStorage !== 'undefined') {
          const raw = localStorage.getItem(`metro_admin_staged_edits_${courseId}`);
          if (raw) {
            try {
              const parsed: StagedAdminEditsRecord = JSON.parse(raw);
              setClientRevision(parsed.clientRevision);
              clientRevisionRef.current = parsed.clientRevision;
              setLastSavedAt(parsed.lastSavedAt);
              setServerPatchedContent(parsed.patchedContent || {});
              setPendingPatch(parsed.patchedContent || {});
              pendingPatchRef.current = parsed.patchedContent || {};
              setHasUnsavedChanges(false);
            } catch {
              // ignore
            }
          }
        }
      }
    } catch {
      // Rehydration errors shouldn't crash the editor
    }
  }, [courseId]);

  /**
   * Internal save execution with 409 conflict detection and 3-way rebase
   */
  const executeSave = useCallback(
    async (
      patchToSave: Partial<Course>,
      revisionOverride?: number
    ): Promise<StagedAdminEditsRecord | null> => {
      setStatus('saving');
      setError(null);

      const targetRevision =
        revisionOverride !== undefined
          ? revisionOverride
          : clientRevisionRef.current + 1;

      try {
        const res = await reviewApi.saveStagedAdminEdits(courseId, {
          baselineId: baselineCourseRef.current?.id || courseId,
          baselineSubmittedAt: baselineCourseRef.current?.submittedAt || '',
          clientRevision: targetRevision,
          patch: patchToSave,
        });

        // 200 OK -> Update state
        setServerRecord(res.record);
        setClientRevision(res.record.clientRevision);
        clientRevisionRef.current = res.record.clientRevision;
        setLastSavedAt(res.record.lastSavedAt);
        setServerPatchedContent(res.record.patchedContent || {});
        setStatus('saved');
        setHasUnsavedChanges(false);
        retryCountRef.current = 0;
        onSaveSuccess?.(res.record);
        return res.record;
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          // HTTP 409 Conflict Detected!
          // Guard against infinite retry loops
          if (retryCountRef.current >= maxRetries) {
            setStatus('error');
            const loopErr = new Error('تعذر حل تعارض الحفظ تلقائياً بعد عدة محاولات متتالية.');
            setError(loopErr);
            onSaveError?.(loopErr);
            return null;
          }

          // Step 1: Fetch authoritative server staged record
          let fetchedServerRecord: StagedAdminEditsRecord | null = null;
          try {
            const serverRes = await reviewApi.getStagedAdminEdits(courseId);
            fetchedServerRecord = serverRes.record;
          } catch {
            // failed to fetch server state
          }

          if (!fetchedServerRecord) {
            // Server has no prior record; retry with revision 1
            retryCountRef.current += 1;
            return executeSave(patchToSave, 1);
          }

          const acceptedRev = fetchedServerRecord.clientRevision;
          setServerRecord(fetchedServerRecord);

          // Step 2: Perform 3-Way Rebase
          const rebaseResult = threeWayRebase(
            baselineCourseRef.current || ({} as Course),
            fetchedServerRecord.patchedContent || {},
            patchToSave
          );
          setLastRebaseResult(rebaseResult);

          if (!rebaseResult.hasConflict) {
            // Non-overlapping! Automatically merge and retry save
            retryCountRef.current += 1;
            setPendingPatch(rebaseResult.mergedPatch);
            pendingPatchRef.current = rebaseResult.mergedPatch;
            setClientRevision(acceptedRev);
            clientRevisionRef.current = acceptedRev;

            // Retry save with merged content and acceptedRevision + 1
            return executeSave(rebaseResult.mergedPatch, acceptedRev + 1);
          } else {
            // Overlapping conflicts! Require explicit administrator resolution
            setStatus('conflict');
            setConflicts(rebaseResult.conflicts);
            setIsConflictModalOpen(true);
            onConflictDetected?.(rebaseResult.conflicts);
            return null;
          }
        }

        // Other API errors
        setStatus('error');
        const errObj = err instanceof Error ? err : new Error('خطأ في حفظ التعديلات');
        setError(errObj);
        onSaveError?.(errObj);
        return null;
      }
    },
    [courseId, maxRetries, onSaveSuccess, onSaveError, onConflictDetected]
  );

  /**
   * Save immediately, bypassing debounce timer
   */
  const saveImmediately = useCallback(async (): Promise<StagedAdminEditsRecord | null> => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    return executeSave(pendingPatchRef.current);
  }, [executeSave]);

  /**
   * Queue local edits with debounced autosave
   */
  const updateLocalEdits = useCallback(
    (patch: Partial<Course>) => {
      setStatus('idle');
      setPendingPatch((prev) => {
        const next = { ...prev, ...patch };
        pendingPatchRef.current = next;
        return next;
      });
      setHasUnsavedChanges(true);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        executeSave(pendingPatchRef.current);
      }, debounceMs);
    },
    [debounceMs, executeSave]
  );

  /**
   * Resolve overlapping conflict via user modal choice
   */
  const resolveConflict = useCallback(
    async (resolution: 'keep_local' | 'accept_server' | 'cancel') => {
      if (resolution === 'cancel') {
        // Choice 3: Cancel for manual review
        // Retains local pending edits in client memory, closes modal, pauses autosave
        setIsConflictModalOpen(false);
        setStatus('idle');
        return;
      }

      if (resolution === 'accept_server') {
        // Choice 2: Accept server version
        // Discard local conflicting edits and adopt server state
        if (serverRecord) {
          const serverContent = serverRecord.patchedContent || {};
          setPendingPatch(serverContent);
          pendingPatchRef.current = serverContent;
          setServerPatchedContent(serverContent);
          setClientRevision(serverRecord.clientRevision);
          clientRevisionRef.current = serverRecord.clientRevision;
          setHasUnsavedChanges(false);
        }
        setIsConflictModalOpen(false);
        setStatus('saved');
        return;
      }

      if (resolution === 'keep_local') {
        // Choice 1: Keep local edits
        // Overwrite conflicting server fields with local values, increment revision and save
        setIsConflictModalOpen(false);
        const nextRevision = (serverRecord?.clientRevision ?? clientRevisionRef.current) + 1;
        retryCountRef.current = 0;

        // Construct resolved patch using merged base + local overwrites
        const resolvedPatch = lastRebaseResult?.mergedPatch || pendingPatchRef.current;
        await executeSave(resolvedPatch, nextRevision);
      }
    },
    [serverRecord, lastRebaseResult, executeSave]
  );

  const closeConflictModal = useCallback(() => {
    setIsConflictModalOpen(false);
  }, []);

  // Compute effective content (Baseline + Accepted Server Edits + Pending Local Edits)
  const effectiveContent: Course = {
    ...(baselineCourse || ({} as Course)),
    ...serverPatchedContent,
    ...pendingPatch,
    id: baselineCourse?.id || courseId,
  };

  return {
    status,
    isSaving: status === 'saving',
    hasUnsavedChanges,
    clientRevision,
    lastSavedAt,
    error,
    conflicts,
    isConflictModalOpen,
    serverRecord,
    pendingPatch,
    effectiveContent,
    updateLocalEdits,
    saveImmediately,
    resolveConflict,
    rehydrate,
    closeConflictModal,
  };
}
