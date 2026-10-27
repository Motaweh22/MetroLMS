import { describe, it, expect } from 'vitest';
import { threeWayRebase } from '@/features/course-review/services/threeWayRebase';
import type { Course } from '@/core/courses/types';

describe('Increment 9 — Three-Way Rebase Algorithm Unit Tests (Phase 3)', () => {
  const createBaseCourse = (): Course => ({
    id: 'CRS_TEST_001',
    title: 'هندسة السكة الحديد والمترو',
    description: 'المقرر التأسيسي لمسير القطارات',
    level: 'مبتدئ',
    estimatedHours: 10,
    coverType: 'default',
    coverColor: '#1E3A8A',
    thumbnail: '',
    lecturerId: 'usr_lect_001',
    lecturerName: 'م. أحمد الجوهري',
    rating: 4.8,
    ratingCount: 15,
    enrollmentCount: 40,
    status: 'pending_admin',
    chapters: [
      {
        id: 'ch_1',
        title: 'الفصل الأول: البنية التحتية',
        order: 1,
        items: [
          {
            id: 'item_1_1',
            type: 'video',
            title: 'مقدمة في شبكة المترو',
            duration: '10:00',
          },
          {
            id: 'item_1_2',
            type: 'pdf',
            title: 'دليل السلامة الأساسي',
          },
        ],
      },
      {
        id: 'ch_2',
        title: 'الفصل الثاني: الإشارات والتحكم',
        order: 2,
        items: [
          {
            id: 'item_2_1',
            type: 'video',
            title: 'أنظمة سيمافور والإشارات الضوئية',
            duration: '15:00',
          },
        ],
      },
    ],
  });

  // 1. Independent metadata edits from two sessions
  it('merges independent metadata edits from two concurrent sessions without conflict', () => {
    const base = createBaseCourse();

    // Session A (Server) edits description
    const serverPatch: Partial<Course> = {
      description: 'وصف محدث بواسطة الجلسة الأولى على الخادم',
    };

    // Session B (Local) edits title and estimatedHours
    const localPatch: Partial<Course> = {
      title: 'عنوان مقرر محدث بواسطة الجلسة الثانية محلياً',
      estimatedHours: 14,
    };

    const result = threeWayRebase(base, serverPatch, localPatch);

    expect(result.hasConflict).toBe(false);
    expect(result.conflicts).toHaveLength(0);
    // Both independent edits are merged into the final patch!
    expect(result.mergedPatch.description).toBe('وصف محدث بواسطة الجلسة الأولى على الخادم');
    expect(result.mergedPatch.title).toBe('عنوان مقرر محدث بواسطة الجلسة الثانية محلياً');
    expect(result.mergedPatch.estimatedHours).toBe(14);
  });

  // 2. Independent lesson edits from two sessions
  it('merges independent lesson edits within the curriculum without conflict', () => {
    const base = createBaseCourse();

    // Session A (Server) updates Lesson 1_1 title
    const serverChapters = JSON.parse(JSON.stringify(base.chapters));
    serverChapters[0].items[0].title = 'مقدمة محدثة في شبكة المترو';
    const serverPatch: Partial<Course> = { chapters: serverChapters };

    // Session B (Local) updates Lesson 1_2 title and Lesson 2_1 duration
    const localChapters = JSON.parse(JSON.stringify(base.chapters));
    localChapters[0].items[1].title = 'دليل السلامة الميداني المعتمد';
    localChapters[1].items[0].duration = '22:00';
    const localPatch: Partial<Course> = { chapters: localChapters };

    const result = threeWayRebase(base, serverPatch, localPatch);

    expect(result.hasConflict).toBe(false);
    expect(result.conflicts).toHaveLength(0);

    const mergedChapters = result.mergedPatch.chapters!;
    expect(mergedChapters[0].items[0].title).toBe('مقدمة محدثة في شبكة المترو');
    expect(mergedChapters[0].items[1].title).toBe('دليل السلامة الميداني المعتمد');
    expect(mergedChapters[1].items[0].duration).toBe('22:00');
  });

  // 3. Curriculum reorder versus lesson rename
  it('merges curriculum chapter reorder versus chapter/lesson rename without conflict', () => {
    const base = createBaseCourse();

    // Session A (Server) renames Chapter 1 and updates Lesson 1_1
    const serverChapters = JSON.parse(JSON.stringify(base.chapters));
    serverChapters[0].title = 'الفصل الأول: البنية التحتية المتطورة';
    serverChapters[0].items[0].title = 'مقدمة تفصيلية للشبكة';
    const serverPatch: Partial<Course> = { chapters: serverChapters };

    // Session B (Local) reorders Chapter 1 and Chapter 2
    const localChapters = [
      JSON.parse(JSON.stringify(base.chapters[1])), // ch_2 first
      JSON.parse(JSON.stringify(base.chapters[0])), // ch_1 second
    ];
    const localPatch: Partial<Course> = { chapters: localChapters };

    const result = threeWayRebase(base, serverPatch, localPatch);

    expect(result.hasConflict).toBe(false);
    expect(result.conflicts).toHaveLength(0);

    const mergedChapters = result.mergedPatch.chapters!;
    // Chapter order follows local reordering: [ch_2, ch_1]
    expect(mergedChapters[0].id).toBe('ch_2');
    expect(mergedChapters[1].id).toBe('ch_1');
    // Renamed title and lesson from server are preserved inside ch_1!
    expect(mergedChapters[1].title).toBe('الفصل الأول: البنية التحتية المتطورة');
    expect(mergedChapters[1].items[0].title).toBe('مقدمة تفصيلية للشبكة');
  });

  // 4. Overlapping edits to the same field
  it('detects overlapping conflicts when concurrent sessions modify the same metadata field', () => {
    const base = createBaseCourse();

    // Both sessions modify course title to different strings
    const serverPatch: Partial<Course> = {
      title: 'عنوان مقترح من الخادم',
    };
    const localPatch: Partial<Course> = {
      title: 'عنوان مقترح من المحرر المحلي',
    };

    const result = threeWayRebase(base, serverPatch, localPatch);

    expect(result.hasConflict).toBe(true);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].field).toBe('title');
    expect(result.conflicts[0].baseValue).toBe(base.title);
    expect(result.conflicts[0].serverValue).toBe('عنوان مقترح من الخادم');
    expect(result.conflicts[0].localValue).toBe('عنوان مقترح من المحرر المحلي');
  });

  // 5. Overlapping edits to the same lesson field
  it('detects overlapping conflicts when concurrent sessions modify the same lesson property', () => {
    const base = createBaseCourse();

    // Session A updates Lesson 1_1 title
    const serverChapters = JSON.parse(JSON.stringify(base.chapters));
    serverChapters[0].items[0].title = 'تعديل الخادم لعنوان الدرس';
    const serverPatch: Partial<Course> = { chapters: serverChapters };

    // Session B updates the same Lesson 1_1 title to a different value
    const localChapters = JSON.parse(JSON.stringify(base.chapters));
    localChapters[0].items[0].title = 'تعديل محلي لعنوان الدرس';
    const localPatch: Partial<Course> = { chapters: localChapters };

    const result = threeWayRebase(base, serverPatch, localPatch);

    expect(result.hasConflict).toBe(true);
    expect(result.conflicts.length).toBeGreaterThanOrEqual(1);
    const itemTitleConflict = result.conflicts.find((c) => c.path.includes('item_1_1.title'));
    expect(itemTitleConflict).toBeDefined();
    expect(itemTitleConflict?.serverValue).toBe('تعديل الخادم لعنوان الدرس');
    expect(itemTitleConflict?.localValue).toBe('تعديل محلي لعنوان الدرس');
  });

  // 6. Stale full-curriculum payloads cannot overwrite newer accepted edits
  it('prevents a stale full-curriculum payload from overwriting newer accepted server edits', () => {
    const base = createBaseCourse();

    // Session A (Server) added a new lesson to Chapter 1
    const serverChapters = JSON.parse(JSON.stringify(base.chapters));
    serverChapters[0].items.push({
      id: 'item_1_new_server',
      type: 'video',
      title: 'درس جديد مضاف على الخادم',
      duration: '08:00',
    });
    const serverPatch: Partial<Course> = { chapters: serverChapters };

    // Session B (Local) had the full stale chapters array from base (unchanged),
    // and only changed the course description
    const localPatch: Partial<Course> = {
      description: 'تعديل الوصف فقط بينما تم إرسال مصفوفة الفصول كاملة دون تغيير عن الأساس',
      chapters: JSON.parse(JSON.stringify(base.chapters)), // Stale full array identical to base!
    };

    const result = threeWayRebase(base, serverPatch, localPatch);

    expect(result.hasConflict).toBe(false);
    expect(result.conflicts).toHaveLength(0);

    // The newer server lesson is preserved and NOT overwritten by the stale payload!
    const mergedChapters = result.mergedPatch.chapters!;
    expect(mergedChapters[0].items).toHaveLength(3);
    expect(mergedChapters[0].items.some((i) => i.id === 'item_1_new_server')).toBe(true);
    // And local's description edit is applied!
    expect(result.mergedPatch.description).toBe(localPatch.description);
  });

  // 7. Both sessions making identical changes to the same field
  it('resolves without conflict when both sessions apply identical changes', () => {
    const base = createBaseCourse();

    const serverPatch: Partial<Course> = {
      title: 'نفس العنوان المعتمد',
    };
    const localPatch: Partial<Course> = {
      title: 'نفس العنوان المعتمد',
    };

    const result = threeWayRebase(base, serverPatch, localPatch);

    expect(result.hasConflict).toBe(false);
    expect(result.conflicts).toHaveLength(0);
    expect(result.mergedPatch.title).toBe('نفس العنوان المعتمد');
  });

  // 8. Independent addition of new lessons from both sessions
  it('merges independent lesson additions from both sessions into the same chapter', () => {
    const base = createBaseCourse();

    // Session A adds Lesson A
    const serverChapters = JSON.parse(JSON.stringify(base.chapters));
    serverChapters[0].items.push({
      id: 'item_added_by_server',
      type: 'video',
      title: 'درس الخادم الجديد',
    });
    const serverPatch: Partial<Course> = { chapters: serverChapters };

    // Session B adds Lesson B
    const localChapters = JSON.parse(JSON.stringify(base.chapters));
    localChapters[0].items.push({
      id: 'item_added_by_local',
      type: 'pdf',
      title: 'درس محلي جديد',
    });
    const localPatch: Partial<Course> = { chapters: localChapters };

    const result = threeWayRebase(base, serverPatch, localPatch);

    expect(result.hasConflict).toBe(false);
    expect(result.conflicts).toHaveLength(0);

    const mergedItems = result.mergedPatch.chapters![0].items;
    // Both added items exist!
    expect(mergedItems.some((i) => i.id === 'item_added_by_server')).toBe(true);
    expect(mergedItems.some((i) => i.id === 'item_added_by_local')).toBe(true);
    expect(mergedItems).toHaveLength(4);
  });

  // 9. Deletion vs modification conflict
  it('detects conflict when one session deletes an entity while the other modifies it', () => {
    const base = createBaseCourse();

    // Session A deletes Chapter 2
    const serverChapters = [JSON.parse(JSON.stringify(base.chapters[0]))];
    const serverPatch: Partial<Course> = { chapters: serverChapters };

    // Session B modifies Chapter 2 title
    const localChapters = JSON.parse(JSON.stringify(base.chapters));
    localChapters[1].title = 'تعديل عنوان الفصل الثاني المراد حذفه';
    const localPatch: Partial<Course> = { chapters: localChapters };

    const result = threeWayRebase(base, serverPatch, localPatch);

    expect(result.hasConflict).toBe(true);
    expect(result.conflicts.some((c) => c.field === 'chapter.deleted')).toBe(true);
  });
});
