import { describe, it, expect } from 'vitest';
import {
  isMatchingInstructorId,
  isUserAuthorizedCourseInstructor,
  isAuthorizedForCoursePerformance,
} from '@/core/courses/courseAuthorization';

describe('Increment 11 — Course Instructor & Performance Authorization Unit Tests', () => {
  describe('isMatchingInstructorId', () => {
    it('matches exact user IDs case-insensitively and with whitespace trimming', () => {
      expect(isMatchingInstructorId('USR002', 'USR002')).toBe(true);
      expect(isMatchingInstructorId('usr002', 'USR002')).toBe(true);
      expect(isMatchingInstructorId(' USR002 ', 'usr002')).toBe(true);
      expect(isMatchingInstructorId('USR017', 'usr017')).toBe(true);
    });

    it('matches the documented trusted synthetic demo lecturer pair (usr_lect_002 <-> USR002)', () => {
      expect(isMatchingInstructorId('usr_lect_002', 'USR002')).toBe(true);
      expect(isMatchingInstructorId('USR002', 'usr_lect_002')).toBe(true);
      expect(isMatchingInstructorId('usr_lect_002', 'usr002')).toBe(true);
      expect(isMatchingInstructorId('usr002', 'usr_lect_002')).toBe(true);
    });

    it('rejects distinct, unrelated user IDs', () => {
      expect(isMatchingInstructorId('USR004', 'USR002')).toBe(false);
      expect(isMatchingInstructorId('USR005', 'USR002')).toBe(false);
      expect(isMatchingInstructorId('usr_trainee_003', 'usr_lect_002')).toBe(false);
      expect(isMatchingInstructorId('usr_admin_001', 'usr_lect_002')).toBe(false);
    });

    it('returns false when either ID is empty, null, or undefined', () => {
      expect(isMatchingInstructorId('', 'USR002')).toBe(false);
      expect(isMatchingInstructorId('USR002', '')).toBe(false);
      expect(isMatchingInstructorId('', '')).toBe(false);
    });
  });

  describe('isUserAuthorizedCourseInstructor', () => {
    const sampleCourse = {
      lecturerId: 'USR002',
      coLecturers: ['USR017', 'USR008'],
    };

    it('returns true when actor is the primary instructor', () => {
      expect(isUserAuthorizedCourseInstructor(sampleCourse, 'USR002')).toBe(true);
      expect(isUserAuthorizedCourseInstructor(sampleCourse, 'usr002')).toBe(true);
      expect(isUserAuthorizedCourseInstructor(sampleCourse, 'usr_lect_002')).toBe(true);
    });

    it('returns true when actor is one of the assigned co-lecturers', () => {
      expect(isUserAuthorizedCourseInstructor(sampleCourse, 'USR017')).toBe(true);
      expect(isUserAuthorizedCourseInstructor(sampleCourse, 'usr017')).toBe(true);
      expect(isUserAuthorizedCourseInstructor(sampleCourse, 'USR008')).toBe(true);
    });

    it('returns false when actor is not assigned to the course', () => {
      expect(isUserAuthorizedCourseInstructor(sampleCourse, 'USR005')).toBe(false);
      expect(isUserAuthorizedCourseInstructor(sampleCourse, 'USR010')).toBe(false);
      expect(isUserAuthorizedCourseInstructor(sampleCourse, 'usr_trainee_003')).toBe(false);
    });

    it('handles courses with empty or undefined co-lecturers safely', () => {
      const courseWithoutCo = { lecturerId: 'USR005' };
      expect(isUserAuthorizedCourseInstructor(courseWithoutCo, 'USR005')).toBe(true);
      expect(isUserAuthorizedCourseInstructor(courseWithoutCo, 'USR002')).toBe(false);
    });
  });

  describe('isAuthorizedForCoursePerformance', () => {
    const course = {
      lecturerId: 'USR002',
      coLecturers: ['USR017'],
    };

    it('grants platform-wide performance oversight to System Administrator (admin)', () => {
      expect(isAuthorizedForCoursePerformance(course, { id: 'usr_admin_001', role: 'admin' })).toBe(true);
      expect(isAuthorizedForCoursePerformance(course, { id: 'random_admin_id', role: 'admin' })).toBe(true);
    });

    it('grants approved platform-wide read-only performance oversight to Assistant Administrator (assistant_admin)', () => {
      expect(isAuthorizedForCoursePerformance(course, { id: 'USR016', role: 'assistant_admin' })).toBe(true);
      expect(isAuthorizedForCoursePerformance(course, { id: 'any_asst_admin', role: 'assistant_admin' })).toBe(true);
    });

    it('grants performance access to assigned primary lecturer and co-lecturer', () => {
      // Primary
      expect(isAuthorizedForCoursePerformance(course, { id: 'USR002', role: 'lecturer' })).toBe(true);
      expect(isAuthorizedForCoursePerformance(course, { id: 'usr_lect_002', role: 'lecturer' })).toBe(true);

      // Co-lecturer
      expect(isAuthorizedForCoursePerformance(course, { id: 'USR017', role: 'lecturer' })).toBe(true);
    });

    it('strictly denies an unrelated lecturer even if an external object has identical display names', () => {
      // USR005 is NOT assigned to this course
      expect(isAuthorizedForCoursePerformance(course, { id: 'USR005', role: 'lecturer' })).toBe(false);
      expect(isAuthorizedForCoursePerformance(course, { id: 'USR010', role: 'lecturer' })).toBe(false);
    });

    it('strictly denies trainees (user role)', () => {
      expect(isAuthorizedForCoursePerformance(course, { id: 'usr_trainee_003', role: 'user' })).toBe(false);
      expect(isAuthorizedForCoursePerformance(course, { id: 'USR004', role: 'user' })).toBe(false);
    });

    it('returns false for null or undefined user session', () => {
      expect(isAuthorizedForCoursePerformance(course, null)).toBe(false);
      expect(isAuthorizedForCoursePerformance(course, undefined)).toBe(false);
    });
  });
});
